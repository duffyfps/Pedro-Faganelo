// Espelhamento: lê os canais de origem no Telegram e coloca as ofertas na sua fila com o SEU link
// Chamado a cada 2–5 min pelo cron-job.org: /api/mirror?key=CRON_SECRET
import { db } from '../lib/db.js';
import { getItems, asinFromUrl } from '../lib/amazon.js';
import { idsFromUrl, affiliateLink } from '../lib/ml.js';
import { fetchChannel, storeOf, followRedirects, parsePostText } from '../lib/telegram.js';
import { processProduct } from '../lib/offers.js';
import { requireCronKey } from '../lib/auth.js';
import { sendDue } from '../lib/sender.js';

const TIME_BUDGET_MS = 45_000;
const FIRST_RUN_POSTS = 5;

async function mlData(ids) {
  const h = {};
  if (process.env.ML_ACCESS_TOKEN) h.Authorization = `Bearer ${process.env.ML_ACCESS_TOKEN}`;
  try {
    if (ids.item) {
      const r = await fetch(`https://api.mercadolibre.com/items/${ids.item}`, { headers: h });
      if (r.ok) {
        const it = await r.json();
        return { title: it.title, price: it.price, listPrice: it.original_price, image: it.pictures?.[0]?.secure_url || it.thumbnail };
      }
    }
    if (ids.product) {
      const r = await fetch(`https://api.mercadolibre.com/products/${ids.product}`, { headers: h });
      if (r.ok) {
        const p = await r.json();
        return { title: p.name, price: p.buy_box_winner?.price, listPrice: p.buy_box_winner?.original_price, image: p.pictures?.[0]?.url };
      }
    }
  } catch {}
  return {};
}

export default async function handler(req, res) {
  if (!requireCronKey(req, res)) return;
  const started = Date.now();
  const channels = (process.env.SOURCE_CHANNELS || 'xetdaspromocoes').split(',').map((s) => s.trim()).filter(Boolean);
  const out = { posts: 0, queued: 0, skipped: [], errors: [] };

  for (const channel of channels) {
    try {
      const key = `last:${channel}`;
      const [st] = await db.select('state', `key=eq.${encodeURIComponent(key)}`);
      const last = st ? Number(st.value) : null;
      const posts = await fetchChannel(channel);
      if (!posts.length) continue;
      let todo = last === null ? posts.slice(-FIRST_RUN_POSTS) : posts.filter((p) => p.id > last);
      let lastDone = last ?? 0;

      // 1) Descobre para onde cada link leva
      const jobs = [];
      for (const post of todo) {
        if (Date.now() - started > TIME_BUDGET_MS) break;
        out.posts++;
        lastDone = post.id;
        const link = post.links.find(storeOf);
        if (!link) { out.skipped.push(`${post.id}: outra loja`); continue; }
        const store = storeOf(link);
        const chain = await followRedirects(link);
        jobs.push({ post, store, chain, info: parsePostText(post.text) });
      }

      // 2) Amazon: busca tudo de uma vez na API (até 10 por chamada) já com a SUA tag
      const amzJobs = jobs.filter((j) => j.store === 'amazon');
      amzJobs.forEach((j) => (j.asin = j.chain.map(asinFromUrl).find(Boolean)));
      const asins = [...new Set(amzJobs.map((j) => j.asin).filter(Boolean))];
      const found = new Map();
      const useApi = !!(process.env.AMAZON_CLIENT_ID && process.env.AMAZON_CLIENT_SECRET);
      for (let i = 0; useApi && i < asins.length; i += 10) {
        try {
          (await getItems(asins.slice(i, i + 10))).forEach((p) => found.set(p.id, p));
        } catch (e) {
          out.errors.push(`Amazon: ${e.message.slice(0, 200)}`);
        }
      }

      // 3) Monta as ofertas
      for (const j of jobs) {
        const source = `${channel}/${j.post.id}`;
        let p = null;
        if (j.store === 'amazon') {
          if (!j.asin) { out.skipped.push(`${j.post.id}: Amazon sem ASIN`); continue; }
          const base = found.get(`amz:${j.asin}`);
          if (base) p = { ...base };
          else {
            // Sem a API da Amazon: usa título e preço do post + link com a SUA tag
            if (!process.env.AMAZON_TAG || !j.info.title || !j.info.price) {
              out.skipped.push(`${j.post.id}: Amazon sem dados`);
              continue;
            }
            p = {
              id: `amz:${j.asin}`,
              store: 'amazon',
              title: j.info.title,
              image: null,
              price: j.info.price,
              listPrice: j.info.listPrice,
              url: `https://www.amazon.com.br/dp/${j.asin}?tag=${encodeURIComponent(process.env.AMAZON_TAG.trim())}`,
            };
          }
        } else {
          const ids = j.chain.map(idsFromUrl).find((x) => x.item || x.product) || {};
          const openUrl = ids.product
            ? `https://www.mercadolivre.com.br/p/${ids.product}`
            : ids.item
              ? `https://produto.mercadolivre.com.br/${ids.item.replace(/^MLB/, 'MLB-')}`
              : j.chain.at(-1);
          const d = ids.item || ids.product ? await mlData(ids) : {};
          p = {
            id: `ml:${ids.item || ids.product || `post:${source}`}`,
            store: 'ml',
            title: d.title || j.info.title,
            image: d.image || null,
            price: d.price || j.info.price,
            listPrice: d.listPrice || j.info.listPrice,
            openUrl,
            url: process.env.ML_AUTO_LINK === 'true' && (ids.item || ids.product) ? affiliateLink(openUrl, openUrl) : null,
          };
          if (!p.title || !p.price) { out.skipped.push(`${j.post.id}: ML sem título/preço`); continue; }
        }
        p.coupons = j.info.coupons;
        p.extras = j.info.extras;
        try {
          if (await processProduct(p, { source })) out.queued++;
          else out.skipped.push(`${j.post.id}: repetida`);
        } catch (e) {
          if (/duplicate|23505/.test(e.message)) out.skipped.push(`${j.post.id}: já lida`);
          else out.errors.push(`${j.post.id}: ${e.message.slice(0, 200)}`);
        }
      }

      if (lastDone > (last ?? 0)) await db.upsert('state', [{ key, value: String(lastDone) }], 'key');
    } catch (e) {
      out.errors.push(`${channel}: ${e.message.slice(0, 200)}`);
    }
  }

  try {
    out.whatsapp = await sendDue();
  } catch (e) {
    out.errors.push(`envio: ${e.message.slice(0, 200)}`);
  }
  out.ms = Date.now() - started;
  res.status(200).json(out);
}
