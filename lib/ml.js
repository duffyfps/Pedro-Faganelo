// Mercado Livre: lê um link (meli.la ou link do produto), pega dados e monta o link de afiliado
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36';

export function isShortLink(u) {
  return /^https?:\/\/(www\.)?meli\.la\//i.test(u);
}

// Segue redirecionamentos e devolve a URL final
async function resolve(u) {
  try {
    const res = await fetch(u, { redirect: 'follow', headers: { 'User-Agent': UA } });
    return { finalUrl: res.url || u, html: await res.text() };
  } catch {
    return { finalUrl: u, html: '' };
  }
}

export function idsFromUrl(u) {
  const s = decodeURIComponent(String(u));
  const product = s.match(/\/p\/(MLB\d+)/i)?.[1]?.toUpperCase() || null;
  const itemRaw =
    s.match(/[?&](?:item_id|wid)=(MLB-?\d+)/i)?.[1] ||
    s.match(/\/(MLB-?\d{6,})/i)?.[1] ||
    null;
  const item = itemRaw ? itemRaw.replace('-', '').toUpperCase() : null;
  const up = s.match(/\/up\/(MLBU\d+)/i)?.[1]?.toUpperCase() || null; // produto de moda/variações
  return { product: product || (item ? null : up), item };
}

// Link de afiliado: link curto do portal é usado como está; senão, adiciona seus parâmetros
export function affiliateLink(original, finalUrl) {
  if (isShortLink(original)) return original;
  const u = new URL(finalUrl || original);
  [...u.searchParams.keys()].forEach((k) => {
    if (!['item_id', 'wid', 'pdp_filters'].includes(k)) u.searchParams.delete(k);
  });
  u.hash = '';
  if (process.env.ML_MATT_WORD) u.searchParams.set('matt_word', process.env.ML_MATT_WORD);
  if (process.env.ML_MATT_TOOL) u.searchParams.set('matt_tool', process.env.ML_MATT_TOOL);
  return u.toString();
}

async function api(path) {
  const h = { 'User-Agent': UA };
  if (process.env.ML_ACCESS_TOKEN) h.Authorization = `Bearer ${process.env.ML_ACCESS_TOKEN}`;
  const res = await fetch(`https://api.mercadolibre.com${path}`, { headers: h });
  if (!res.ok) return null;
  return res.json();
}

function fromHtml(html) {
  if (!html) return {};
  const meta = (p) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, 'i'))?.[1];
  const out = { title: meta('og:title'), image: meta('og:image') };
  // JSON-LD do produto costuma trazer o preço
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]);
      const arr = Array.isArray(j) ? j : [j];
      for (const x of arr) {
        const offer = Array.isArray(x?.offers) ? x.offers[0] : x?.offers;
        if (offer?.price) out.price = Number(offer.price);
        if (x?.name && !out.title) out.title = x.name;
        if (x?.image && !out.image) out.image = Array.isArray(x.image) ? x.image[0] : x.image;
      }
    } catch {}
  }
  const orig = html.match(/"original_price"\s*:\s*([\d.]+)/)?.[1];
  if (orig) out.listPrice = Number(orig);
  if (out.title) out.title = out.title.replace(/\s*\|\s*Mercado Livre.*$/i, '').trim();
  return out;
}

export async function lookup(original) {
  const { finalUrl, html } = await resolve(original);
  const { product, item } = idsFromUrl(finalUrl);
  let d = {};

  if (item) {
    const it = await api(`/items/${item}`);
    if (it?.price) {
      d = {
        title: it.title,
        image: it.pictures?.[0]?.secure_url || it.thumbnail,
        price: it.price,
        listPrice: it.original_price || null,
      };
    }
  }
  if (!d.price && product) {
    const p = await api(`/products/${product}`);
    const bb = p?.buy_box_winner;
    if (bb?.price) {
      d = {
        title: p.name,
        image: p.pictures?.[0]?.url,
        price: bb.price,
        listPrice: bb.original_price || null,
      };
    }
  }
  if (!d.price) d = { ...fromHtml(html), ...Object.fromEntries(Object.entries(d).filter(([, v]) => v)) };

  const key = item || product || Buffer.from(finalUrl).toString('base64url').slice(0, 24);
  return {
    id: `ml:${key}`,
    store: 'ml',
    url: affiliateLink(original, finalUrl),
    finalUrl,
    title: d.title || null,
    image: d.image || null,
    price: d.price || null,
    listPrice: d.listPrice || null,
  };
}
