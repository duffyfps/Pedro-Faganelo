// Página de cada oferta (/p/<código>). As tags og:* fazem o WhatsApp mostrar a prévia (foto + nome + preço).
import { db } from '../lib/db.js';
import { layout, card, joinBox, catsGrid, catOf, CATEGORIES, esc, brl, img, storeName, storeLink, ago, codeOf, idOf, SITE } from '../lib/site.js';

const PCSS = `
.prod{display:grid;grid-template-columns:1fr;gap:16px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px}
@media(min-width:820px){.prod{grid-template-columns:420px 1fr;padding:22px}}
.prod .pic{background:#fff;border-radius:14px;aspect-ratio:1/1;display:grid;place-items:center;overflow:hidden;position:relative}
.prod .pic img{max-width:100%;max-height:100%;object-fit:contain}
.prod .badge{position:absolute;top:12px;left:12px;background:var(--red);color:#fff;font-weight:900;border-radius:8px;padding:4px 9px}
.prod .meta{font-size:12px;color:var(--muted);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.prod .store{background:var(--card2);border:1px solid var(--line);border-radius:99px;padding:3px 10px;color:var(--text);font-weight:700}
.prod h1{font-size:20px;margin:10px 0 12px;line-height:1.3}
.prod .old{color:var(--muted);text-decoration:line-through}
.prod .price{font-size:34px;font-weight:900;color:var(--gold);line-height:1.1}
.prod .save{color:var(--green);font-weight:700;font-size:13px;margin-top:4px}
.coupon{margin-top:14px;border:1px dashed var(--gold);border-radius:12px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;background:#16130a}
.coupon code{font-size:17px;font-weight:900;letter-spacing:1px;color:var(--gold2)}
.coupon button{background:none;border:1px solid var(--gold);color:var(--gold);border-radius:8px;padding:7px 12px;font-weight:800;cursor:pointer}
.actions{display:grid;gap:10px;margin-top:16px}
.actions .btn{width:100%;font-size:17px;padding:15px}
.note{color:var(--muted);font-size:12px;margin-top:10px}
`;

export default async function handler(req, res) {
  const id = idOf(req.query.code);
  if (!id) return res.status(404).send('Oferta não encontrada');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    const [o] = await db.select('offers', `id=eq.${id}&select=*,products(title,image,store,url)`);
    if (!o || !o.products) return res.status(404).send('Oferta não encontrada');
    const p = o.products;
    const link = storeLink(o.message) || p.url;
    const cat = catOf(p.title);
    const since = new Date(Date.now() - 10 * 86400000).toISOString();
    const recent = (await db.select(
      'offers',
      `status=eq.sent&id=neq.${id}&sent_at=gte.${since}&select=id,price,old_price,discount_pct,coupon,sent_at,products(title,image,store)&order=sent_at.desc&limit=300`
    )).filter((m) => m.products && m.products.title);
    const same = recent.filter((m) => catOf(m.products.title).slug === cat.slug).slice(0, 8);
    const latest = recent.filter((m) => !same.includes(m)).slice(0, 8);

    const store = storeName(p.store);
    const pic = p.image ? `https://${host}${img(p.image)}` : '';
    const url = `https://${host}/p/${codeOf(o.id)}`;
    const desc = `${o.old_price && Number(o.old_price) > Number(o.price) ? `De ${brl(o.old_price)} por ` : ''}${brl(o.price)}${o.discount_pct ? ` (${o.discount_pct}% OFF)` : ''} na ${store}`;
    const coupons = String(o.coupon || '').split(',').map((s) => s.trim()).filter(Boolean);
    const saved = o.old_price && Number(o.old_price) > Number(o.price) ? Number(o.old_price) - Number(o.price) : 0;
    const share = `https://wa.me/?text=${encodeURIComponent(`${p.title}\n${desc}\n${url}`)}`;
    const when = o.sent_at || o.created_at;

    const head = `
<meta property="og:type" content="product">
<meta property="og:site_name" content="${esc(SITE())}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${pic ? `<meta property="og:image" content="${esc(pic)}"><meta property="og:image:alt" content="${esc(p.title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(pic)}">` : ''}
<meta property="product:price:amount" content="${esc(o.price)}"><meta property="product:price:currency" content="BRL">
<style>${PCSS}</style>`;

    const body = `
<div class="crumbs"><a href="/">Início</a> / <a href="/ofertas">Ofertas</a> / <a href="/ofertas?loja=${p.store === 'amazon' ? 'amazon' : 'ml'}">${store}</a> / <a href="/categoria/${cat.slug}">${esc(cat.name)}</a></div>
<div class="prod">
  <div class="pic">${pic ? `<img src="${esc(img(p.image))}" alt="${esc(p.title)}">` : ''}${o.discount_pct ? `<span class="badge">-${o.discount_pct}%</span>` : ''}</div>
  <div>
    <div class="meta"><span class="store">Promoção da loja: ${store}</span><span>${ago(when)}</span><span>#parceria</span></div>
    <h1>${esc(p.title)}</h1>
    ${saved ? `<div class="old">${brl(o.old_price)}</div>` : ''}
    <div class="price">${brl(o.price)}</div>
    ${saved ? `<div class="save">Você economiza ${brl(saved)}${o.discount_pct ? ` (${o.discount_pct}% OFF)` : ''}</div>` : ''}
    ${coupons.map((c) => `<div class="coupon"><span>Use o cupom <code>${esc(c)}</code></span><button onclick="navigator.clipboard.writeText('${esc(c)}');this.textContent='Copiado!'">Copiar</button></div>`).join('')}
    <div class="actions">
      ${link ? `<a class="btn gold" href="${esc(link)}" rel="nofollow sponsored">Pegar promoção ↗</a>` : ''}
      <a class="btn ghost" href="${esc(share)}">Compartilhar no WhatsApp</a>
    </div>
    <div class="note">Oferta publicada ${ago(when)}. O preço e a disponibilidade podem mudar a qualquer momento na loja.</div>
  </div>
</div>
${joinBox()}
${same.length ? `<div class="sec"><h2>Produtos da mesma categoria</h2><a href="/categoria/${cat.slug}">Ver mais</a></div><div class="grid">${same.map(card).join('')}</div>` : ''}
${latest.length ? `<div class="sec"><h2>Últimas ofertas</h2><a href="/ofertas">Ver todas</a></div><div class="grid">${latest.map(card).join('')}</div>` : ''}
<div class="sec"><h2>Categorias em destaque</h2><a href="/categorias">Todas</a></div>
${catsGrid(CATEGORIES.slice(0, 8))}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.status(200).send(layout({ title: `${p.title} - ${SITE()}`, desc, head, body, host }));
  } catch (e) {
    res.status(500).send('Erro ao carregar a oferta');
  }
}
