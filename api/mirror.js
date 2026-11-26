// Espelhamento: lê os canais de origem no Telegram e coloca as ofertas na sua fila com o SEU link
// Chamado a cada 2–5 min pelo cron-job.org: /api/mirror?key=CRON_SECRET
import { db } from '../lib/db.js';
import { getItems, asinFromUrl } from '../lib/amazon.js';
import { idsFromUrl, affiliateLink } from '../lib/ml.js';
import { fetchChannel, storeOf, followRedirects, parsePostText } from '../lib/telegram.js';
import { processProduct } from '../lib/offers.js';
import { requireCronKey } from '../lib/auth.js';
import { sendDue } from '../lib/sender.js';
import { shortAmazon } from '../lib/amazonShort.js';
import { trackShortLink, trackLink, watch, readState, writeState } from '../lib/alerts.js';
import { inQuietHours } from '../lib/sender.js';
import { resolveCompetitorLink, createMlLink, sameProduct } from '../lib/mlLink.js';
import { hasWatermark, amazonImage } from '../lib/watermark.js';

const TIME_BUDGET_MS = 45_000;

// Link da Amazon no formato mais curto aceito: amazon.com.br/dp/ASIN?tag=SUA_TAG
const amazonLink = (asin) =>
  asin && process.env.AMAZON_TAG ? `https://amazon.com.br/dp/${asin}?tag=${encodeURIComponent(process.env.AMAZON_TAG.trim())}` : null;
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
              url: amazonLink(j.asin),
            };
          }
        } else {
          let ids = j.chain.map(idsFromUrl).find((x) => x.item || x.product) || {};
          let productUrl = null;
          // Link do concorrente cai no perfil social: abre a página e pega o produto em destaque
          if (!ids.item && !ids.product && process.env.ML_COOKIE) {
            const r = await resolveCompetitorLink(j.chain.at(-1));
            if (r.product) { productUrl = r.product; ids = idsFromUrl(r.product); }
            else out.mlLinks = [...(out.mlLinks || []), `produto: ${r.why}`];
          }
          const openUrl = productUrl
            ? productUrl
            : ids.product
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
          // Gera o SEU meli.la pelo gerador oficial de afiliados
          if (process.env.ML_COOKIE && (ids.item || ids.product)) {
            const ml = await createMlLink(openUrl);
            // Trava: o produto do link tem que ser o mesmo do post. Se não for, NÃO manda (fica no painel).
            const wrong = ml.url && j.info.title && ml.title && !sameProduct(j.info.title, ml.title);
            p.url = wrong ? null : ml.url || null;
            if (!wrong && ml.image && !p.image) p.image = ml.image; // foto oficial do anúncio (reserva) // sem link garantido: fica no painel para você colar o seu
            out.mlLinks = [...(out.mlLinks || []), wrong ? `produto diferente: "${ml.title.slice(0, 50)}"` : ml.url ? 'meli.la' : `sem link: ${ml.why}`];
            await trackLink('ml', !!ml.url, ml.why).catch(() => {});
          }
        }
        // Mesma foto do post — MAS só se não tiver selo de outro canal (ex.: @xetdaspromocoes).
        // Com selo (ou se não der para conferir), usa a foto oficial da loja; sem ela, vai só o texto.
        if (j.post.image) {
          const wm = await hasWatermark(j.post.image);
          if (wm.wm === false) p.image = j.post.image;
          else {
            const official = p.store === 'amazon' ? p.image || (await amazonImage(j.asin)) : p.image;
            p.image = official || null;
            out.photos = [...(out.photos || []), `${j.post.id}: ${wm.why} → ${official ? 'foto da loja' : 'sem foto'}`];
          }
        }
        if (p.store === 'amazon') {
          // Link curto (link.amazon) só quando ligado no banco: state amazon_short = 'on'
          const shortOn = (await readState('amazon_short')) === 'on';
          const short = shortOn ? await shortAmazon(j.asin) : { url: null, why: 'desligado' };
          p.url = short.url || amazonLink(j.asin) || p.url;
          out.shortLinks = out.shortLinks || [];
          out.shortLinks.push(short.url ? 'curto' : `normal: ${short.why}`);
          if (shortOn && process.env.AMAZON_COOKIE) await trackShortLink(!!short.url, short.why).catch(() => {});
        }
        p.coupons = j.info.coupons;
        p.pix = !!j.info.pix;
        p.meliPlus = !!j.info.meliPlus;
        p.hook = j.info.hook;
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

  // Vigia: canal parado ou leitura do Telegram falhando (só em horário de envio)
  try {
    const now = Date.now();
    if (out.posts > 0) await writeState('last_post_at', now);
    const tgFail = out.errors.some((e) => /Telegram|xetdas/i.test(e));
    const fails = tgFail ? (Number(await readState('tg_fail_count')) || 0) + 1 : 0;
    await writeState('tg_fail_count', fails);
    await watch('telegram', fails >= 20,
      'não estou conseguindo ler o canal do Telegram há ~5 minutos. Pode ser instabilidade ou mudança no canal.',
      'a leitura do canal do Telegram voltou ao normal.');
    const quiet = (await readState('quiet_hours')) ?? process.env.QUIET_HOURS ?? '22-8';
    const quietNow = inQuietHours(new Date(), quiet);
    if (quietNow) await writeState('last_post_at', now); // à noite não conta: o relógio recomeça às 8h
    const lastPost = Number(await readState('last_post_at')) || now;
    const idleMin = (now - lastPost) / 60000;
    await watch('idle', !quietNow && idleMin > 45,
      `nenhum post novo no canal há ${Math.round(idleMin)} minutos (horário de envio). O canal pode ter parado ou mudado de formato.`,
      'o canal voltou a postar e as ofertas estão chegando de novo.');
  } catch {}

  try {
    out.whatsapp = await sendDue();
  } catch (e) {
    out.errors.push(`envio: ${e.message.slice(0, 200)}`);
  }
  out.ms = Date.now() - started;
  res.status(200).json(out);
}
