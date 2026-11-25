// Página pública de cada oferta (/p/<código>): foto, preço, cupom e botão "Pegar promoção".
// As tags og:* fazem o WhatsApp mostrar a prévia (foto + nome) quando o link é enviado.
import { db } from '../lib/db.js';

const SITE = () => (process.env.SITE_NAME || 'Magnata Promoções').trim();
const GROUP = () => (process.env.GROUP_INVITE_URL || '').trim();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (n) => (n == null ? '' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' '));
export const codeOf = (id) => Number(id).toString(36);
const idOf = (code) => parseInt(String(code || '').replace(/[^0-9a-z]/gi, ''), 36);
const storeLink = (msg) => (String(msg || '').match(/🛒[^\n]*?(https?:\/\/\S+)/) || [])[1] || null;
const ago = (d) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(d)) / 60000));
  return m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dias`;
};

function page({ o, p, link, host, more }) {
  const store = p.store === 'amazon' ? 'Amazon' : 'Mercado Livre';
  const img = p.image ? `https://${host}/api/img?url=${encodeURIComponent(p.image)}` : '';
  const url = `https://${host}/p/${codeOf(o.id)}`;
  const desc = `${o.old_price ? `De ${brl(o.old_price)} por ` : ''}${brl(o.price)}${o.discount_pct ? ` (${o.discount_pct}% OFF)` : ''} na ${store}`;
  const coupons = String(o.coupon || '').split(',').map((s) => s.trim()).filter(Boolean);
  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)} - ${esc(SITE())}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="${esc(SITE())}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${img ? `<meta property="og:image" content="${esc(img)}"><meta property="og:image:alt" content="${esc(p.title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">` : ''}
<meta property="product:price:amount" content="${esc(o.price)}"><meta property="product:price:currency" content="BRL">
<style>
  :root { --gold:#e8b931; --bg:#0d0d0f; --card:#17171b; --line:#2a2a30; --text:#f4f4f6; --muted:#a2a2ad; --green:#25d366; }
  * { box-sizing: border-box; } body { margin:0; background:var(--bg); color:var(--text); font:15px/1.45 -apple-system,"Segoe UI",Roboto,sans-serif; }
  header { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 16px; background:#000; border-bottom:2px solid var(--gold); position:sticky; top:0; z-index:2; }
  .brand { font-weight:800; letter-spacing:.5px; color:var(--gold); font-size:17px; }
  .join { background:var(--green); color:#000; text-decoration:none; font-weight:700; font-size:13px; padding:8px 12px; border-radius:99px; white-space:nowrap; }
  main { max-width:520px; margin:0 auto; padding:16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px; }
  .store { font-size:12px; color:var(--muted); display:flex; gap:8px; align-items:center; }
  .store b { color:var(--text); }
  .pic { background:#fff; border-radius:12px; margin:12px 0; aspect-ratio:1/1; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .pic img { max-width:100%; max-height:100%; object-fit:contain; }
  h1 { font-size:18px; margin:6px 0 10px; }
  .old { color:var(--muted); text-decoration:line-through; font-size:14px; }
  .price { font-size:30px; font-weight:800; color:var(--gold); }
  .off { display:inline-block; background:var(--green); color:#000; font-weight:800; font-size:12px; border-radius:6px; padding:2px 7px; margin-left:6px; vertical-align:middle; }
  .coupon { margin-top:12px; border:1px dashed var(--gold); border-radius:10px; padding:10px 12px; display:flex; justify-content:space-between; align-items:center; gap:10px; }
  .coupon code { font-size:16px; font-weight:800; letter-spacing:1px; }
  .coupon button { background:none; border:1px solid var(--gold); color:var(--gold); border-radius:8px; padding:6px 10px; font-weight:700; cursor:pointer; }
  .go { display:block; text-align:center; background:var(--gold); color:#000; text-decoration:none; font-weight:800; font-size:17px; padding:15px; border-radius:12px; margin-top:16px; }
  .when { color:var(--muted); font-size:12px; margin-top:8px; text-align:center; }
  .cta { margin-top:18px; text-align:center; } .cta p { color:var(--muted); margin:6px 0 10px; }
  h2 { font-size:16px; margin:26px 0 10px; }
  .more { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .more a { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:8px; color:var(--text); text-decoration:none; font-size:12px; }
  .more img { width:100%; aspect-ratio:1/1; object-fit:contain; background:#fff; border-radius:8px; }
  .more .t { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin:6px 0 2px; }
  .more .p { color:var(--gold); font-weight:800; font-size:14px; }
  footer { text-align:center; color:var(--muted); font-size:11px; padding:24px 16px 40px; }
</style></head><body>
<header><span class="brand">${esc(SITE().toUpperCase())}</span>${GROUP() ? `<a class="join" href="${esc(GROUP())}">Entrar no grupo</a>` : ''}</header>
<main>
  <div class="card">
    <div class="store">Promoção da loja: <b>${store}</b> · ${ago(o.sent_at || o.created_at)}</div>
    ${img ? `<div class="pic"><img src="${esc(img)}" alt="${esc(p.title)}"></div>` : ''}
    <h1>${esc(p.title)}</h1>
    ${o.old_price && Number(o.old_price) > Number(o.price) ? `<div class="old">${brl(o.old_price)}</div>` : ''}
    <div><span class="price">${brl(o.price)}</span>${o.discount_pct ? `<span class="off">${o.discount_pct}% OFF</span>` : ''}</div>
    ${coupons.map((c) => `<div class="coupon"><span>Cupom: <code>${esc(c)}</code></span><button onclick="navigator.clipboard.writeText('${esc(c)}');this.textContent='Copiado!'">Copiar</button></div>`).join('')}
    ${link ? `<a class="go" href="${esc(link)}" rel="nofollow sponsored">Pegar promoção</a>` : ''}
    <div class="when">Oferta publicada ${ago(o.sent_at || o.created_at)}. O preço pode mudar na loja.</div>
  </div>
  ${GROUP() ? `<div class="cta"><b>Já está no nosso grupo de promoções?</b><p>É grátis! Receba as melhores ofertas no WhatsApp.</p><a class="join" href="${esc(GROUP())}">Clique aqui para entrar</a></div>` : ''}
  ${more.length ? `<h2>Mais ofertas</h2><div class="more">${more.map((m) => `<a href="/p/${codeOf(m.id)}">${m.products?.image ? `<img loading="lazy" src="/api/img?url=${encodeURIComponent(m.products.image)}" alt="">` : ''}<div class="t">${esc(m.products?.title)}</div><div class="p">${brl(m.price)}</div></a>`).join('')}</div>` : ''}
</main>
<footer>${esc(SITE())} · Como participante de programas de afiliados, podemos ganhar comissão pelas compras qualificadas.</footer>
</body></html>`;
}

export default async function handler(req, res) {
  const id = idOf(req.query.code);
  if (!id) return res.status(404).send('Oferta não encontrada');
  try {
    const [o] = await db.select('offers', `id=eq.${id}&select=*,products(title,image,store,url)`);
    if (!o || !o.products) return res.status(404).send('Oferta não encontrada');
    const more = await db.select(
      'offers',
      `status=eq.sent&id=neq.${id}&select=id,price,products(title,image)&order=sent_at.desc&limit=6`
    );
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const link = storeLink(o.message) || o.products.url;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.status(200).send(page({ o, p: o.products, link, host, more: more.filter((m) => m.products) }));
  } catch (e) {
    res.status(500).send('Erro ao carregar a oferta');
  }
}
