// Página de cada oferta (/p/<código>). As tags og:* fazem o WhatsApp mostrar a prévia (foto + nome + preço).
import { db } from '../lib/db.js';
import { related } from '../lib/related.js';
import { layout, card, joinBox, catsGrid, catOf, CATEGORIES, esc, brl, img, storeName, naLoja, storeLink, dealInfo, ago, codeOf, idOf, SITE } from '../lib/site.js';

const PCSS = `
.prod{display:grid;grid-template-columns:1fr;gap:22px;background:#fff;border:1px solid var(--line);border-radius:22px;padding:16px;box-shadow:var(--shadow)}
@media(min-width:860px){.prod{grid-template-columns:460px 1fr;padding:26px;gap:34px}}
.prod .pic{background:#fff;border:1px solid #f0ede6;border-radius:16px;aspect-ratio:1/1;display:grid;place-items:center;overflow:hidden;position:relative;padding:18px}
.prod .pic img{max-width:100%;max-height:100%;object-fit:contain}
.prod .badge{position:absolute;top:14px;left:14px;background:var(--red);color:#fff;font-weight:900;font-size:18px;border-radius:10px;padding:5px 11px;box-shadow:0 6px 16px rgba(224,38,47,.35)}
.prod .meta{font-size:12px;color:var(--muted);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.prod h1{font-size:23px;margin:12px 0 16px;line-height:1.3;letter-spacing:-.2px}
.pricebox{background:#faf8f3;border:1px solid var(--line);border-radius:16px;padding:16px 18px}
.pricebox .old{color:var(--muted);text-decoration:line-through;font-size:15px}
.pricebox .price{font-size:40px;font-weight:900;line-height:1.05;letter-spacing:-.8px}
.pricebox .save{display:inline-block;margin-top:8px;background:#e7f7ed;color:#137a3a;font-weight:800;font-size:13px;border-radius:8px;padding:4px 9px}
.coupon{margin-top:12px;border:2px dashed var(--gold);border-radius:14px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px;background:#fffaea}
.coupon span{font-size:13px;color:#6b5310}.coupon code{display:block;font-size:20px;font-weight:900;letter-spacing:1.5px;color:var(--text)}
.coupon.plus{margin-top:6px}
.pricebox .price small{font-size:16px;font-weight:800;color:#0b7a55;letter-spacing:0}
.conds{list-style:none;padding:0;margin:12px 0 0;display:grid;gap:7px}.conds li{background:#f4f2ec;border-radius:12px;padding:10px 12px;font-size:14px}.conds li.pix{background:#e3f8f0}.conds li.meli{background:#fff3c4}.conds li.prime{background:#e6f1ff}
.coupon button{background:var(--ink);border:0;color:#fff;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;font-family:inherit}
.actions{display:grid;gap:10px;margin-top:16px}
.actions .btn{width:100%;font-size:18px;padding:17px}
.actions .btn.line{font-size:15px;padding:13px}
.ptrust{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:7px;font-size:13px;color:#4c4a45}
.note{color:var(--muted);font-size:12px;margin-top:12px}
.sticky{position:fixed;left:0;right:0;bottom:0;z-index:30;background:#fff;border-top:1px solid var(--line);box-shadow:0 -6px 20px rgba(0,0,0,.08);padding:10px 14px;display:flex;align-items:center;gap:12px}
.sticky b{font-size:20px;font-weight:900;white-space:nowrap}.sticky small{display:block;font-size:11px;color:var(--muted);font-weight:600}
.sticky .btn{flex:1;padding:13px}
@media(min-width:860px){.sticky{display:none}}
@media(max-width:859px){body{padding-bottom:76px}}
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
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const recent = (await db.select(
      'offers',
      `status=eq.sent&id=neq.${id}&sent_at=gte.${since}&select=id,price,old_price,discount_pct,coupon,message,sent_at,products(title,image,store)&order=sent_at.desc&limit=800`
    )).filter((m) => m.products && m.products.title);
    // Relacionados pelo nome do produto (ex.: bracelete feminino → pulseiras, colares, brincos), não só pela categoria
    const same = related(p.title, recent, (m) => m.products.title, { max: 10, sameCat: (m) => catOf(m.products.title).slug === cat.slug });
    const latest = recent.filter((m) => !same.includes(m)).slice(0, 8);

    const store = storeName(p.store);
    const pic = p.image ? `https://${host}/api/og?v=4&url=${encodeURIComponent(p.image)}${o.discount_pct ? `&off=${o.discount_pct}` : ''}` : '';
    const picPlain = p.image ? img(p.image) : '';
    const url = `https://${host}/p/${codeOf(o.id)}`;
    const desc = `${o.old_price && Number(o.old_price) > Number(o.price) ? `De ${brl(o.old_price)} por ` : ''}${brl(o.price)}${o.discount_pct ? ` (${o.discount_pct}% OFF)` : ''} ${naLoja(p.store)}`;
    const d = dealInfo(o);
    const coupons = d.coupons;
    const saved = o.old_price && Number(o.old_price) > Number(o.price) ? Number(o.old_price) - Number(o.price) : 0;
    const share = `https://wa.me/?text=${encodeURIComponent(`${p.title}\n${desc}\n${url}`)}`;
    const when = o.sent_at || o.created_at;

    const head = `
<meta property="og:type" content="product">
<meta property="og:site_name" content="${esc(SITE())}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${pic ? `<meta property="og:image" content="${esc(pic)}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:alt" content="${esc(p.title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(pic)}">` : ''}
<meta property="product:price:amount" content="${esc(o.price)}"><meta property="product:price:currency" content="BRL">
<style>${PCSS}</style>`;

    const body = `
<div class="crumbs"><a href="/">Início</a> / <a href="/ofertas?loja=${p.store === 'amazon' ? 'amazon' : 'ml'}">${store}</a> / <a href="/categoria/${cat.slug}">${esc(cat.name)}</a></div>
<div class="prod">
  <div class="pic">${pic ? `<img src="${esc(picPlain)}" alt="${esc(p.title)}">` : ''}${o.discount_pct ? `<span class="badge">-${o.discount_pct}%</span>` : ''}</div>
  <div>
    <div class="meta"><span class="store ${p.store === 'amazon' ? 'amazon' : 'ml'}">${store}</span><span>Publicada ${ago(when)}</span></div>
    <h1>${esc(p.title)}</h1>
    <div class="pricebox">
      ${saved ? `<div class="old">De ${brl(o.old_price)}</div>` : ''}
      <div class="price">${brl(o.price)}${d.pix ? '<small> no Pix</small>' : ''}</div>
      ${saved ? `<span class="save">Você economiza ${brl(saved)}${o.discount_pct ? ` · ${o.discount_pct}% OFF` : ''}</span>` : ''}
    </div>
    ${coupons.map((g, i) => {
      const codes = g.split(' + ');
      const label = codes.length > 1 ? 'Use os cupons juntos no carrinho' : i > 0 ? 'Ou use o cupom' : 'Use o cupom no carrinho';
      return codes.map((c, k) => `<div class="coupon${k ? ' plus' : ''}"><span>${k ? '+ junto com' : label}<code>${esc(c)}</code></span><button onclick="navigator.clipboard.writeText('${esc(c)}');this.textContent='Copiado ✓'">Copiar</button></div>`).join('');
    }).join('')}
    ${d.pix || d.meliPlus || d.prime || d.checkout ? `<ul class="conds">
      ${d.pix ? '<li class="pix">💠 <b>Preço pagando no Pix</b> — selecione <b>Pix</b> na hora de pagar</li>' : ''}
      ${d.meliPlus ? '<li class="meli">⭐ <b>Exclusivo para assinantes Meli+</b></li>' : ''}
      ${d.prime ? '<li class="prime">👑 <b>Oferta exclusiva para membros Prime</b></li>' : ''}
      ${d.checkout ? '<li>💡 O desconto aparece na <b>finalização da compra</b></li>' : ''}
    </ul>` : ''}
    <div class="actions">
      ${link ? `<a class="btn red" href="${esc(link)}" rel="nofollow sponsored">Pegar promoção ${naLoja(p.store)} →</a>` : ''}
      <a class="btn line" href="${esc(share)}">📲 Mandar pra alguém no WhatsApp</a>
    </div>
    <ul class="ptrust">
      <li>🛡️ Compra feita direto ${naLoja(p.store)}, com a garantia da loja</li>
      <li>⚡ Preço de oferta: pode mudar ou acabar a qualquer momento</li>
      <li>🎩 Selecionada pela equipe ${esc(SITE())}</li>
    </ul>
    <div class="note">#publicidade · Como afiliados, podemos receber comissão sem custo extra para você.</div>
  </div>
</div>
${link ? `<div class="sticky"><div><b>${brl(o.price)}</b><small>${d.pix ? 'no Pix · ' : ''}${o.discount_pct ? `${o.discount_pct}% OFF ` : ''}${naLoja(p.store)}</small></div><a class="btn red" href="${esc(link)}" rel="nofollow sponsored">Pegar promoção →</a></div>` : ''}
${joinBox()}
${same.length ? `<div class="sec"><h2>Você também vai gostar</h2><a href="/categoria/${cat.slug}">Ver mais →</a></div><div class="grid">${same.map(card).join('')}</div>` : ''}
${latest.length ? `<div class="sec"><h2>⚡ Últimas ofertas</h2><a href="/ofertas">Ver todas →</a></div><div class="grid">${latest.map(card).join('')}</div>` : ''}
<div class="sec"><h2>Categorias</h2><a href="/categorias">Todas →</a></div>
${catsGrid(CATEGORIES.slice(0, 8))}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.status(200).send(layout({ title: `${p.title} - ${SITE()}`, desc, head, body, host }));
  } catch (e) {
    res.status(500).send('Erro ao carregar a oferta');
  }
}
