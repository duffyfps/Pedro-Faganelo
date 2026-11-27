// Site público: início, ofertas, cupons, categorias, uma categoria e grupos
import { db } from '../lib/db.js';
import { profile } from '../lib/related.js';
import { layout, card, joinBox, trustRow, catsGrid, catOf, catBySlug, CATEGORIES, esc, GROUP, SITE, hatImg } from '../lib/site.js';

const PER_PAGE = 24;

async function recent(limit = 500) {
  const since = new Date(Date.now() - 10 * 86400000).toISOString();
  const rows = await db.select(
    'offers',
    `status=eq.sent&sent_at=gte.${since}&select=id,price,old_price,discount_pct,coupon,message,sent_at,products(title,image,store)&order=sent_at.desc&limit=${limit}`
  );
  return rows.filter((o) => o.products && o.products.title);
}

function pager(base, page, total) {
  const pages = Math.ceil(total / PER_PAGE);
  if (pages <= 1) return '';
  const sep = base.includes('?') ? '&' : '?';
  return `<div class="more">${page > 1 ? `<a class="btn line" href="${base}${sep}pagina=${page - 1}">← Anteriores</a> ` : ''}${
    page < pages ? `<a class="btn red" href="${base}${sep}pagina=${page + 1}">Carregar mais ofertas</a>` : ''
  }</div>`;
}

const grid = (list) => (list.length ? `<div class="grid">${list.map(card).join('')}</div>` : '<div class="empty">Nenhuma oferta por aqui ainda.</div>');

export default async function handler(req, res) {
  const r = String(req.query.r || 'home');
  const page = Math.max(1, Number(req.query.pagina) || 1);
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    const all = await recent();
    let html;

    if (r === 'home') {
      const withCoupon = all.filter((o) => o.coupon).slice(0, 10);
      const top = [...all.slice(0, 120)].filter((o) => (o.discount_pct || 0) >= 40).sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0)).slice(0, 10);
      const cheap = all.filter((o) => Number(o.price) <= 50).slice(0, 10);
      const counts = Object.fromEntries(CATEGORIES.map((c) => [c.slug, 0]));
      all.forEach((o) => { const c = catOf(o.products.title).slug; if (c in counts) counts[c]++; });
      const hot = CATEGORIES.filter((c) => counts[c.slug] > 0).sort((a, b) => counts[b.slug] - counts[a.slug]);
      const today = all.filter((o) => Date.now() - new Date(o.sent_at) < 86400000);
      const maxOff = Math.max(0, ...today.map((o) => o.discount_pct || 0));
      const coupons = today.filter((o) => o.coupon).length;
      html = layout({
        title: `${SITE()} — as melhores ofertas da Amazon e do Mercado Livre`,
        desc: 'Ofertas, cupons e promoções selecionadas da Amazon e do Mercado Livre, atualizadas o dia todo.',
        active: 'home',
        host,
        body: `
<section class="hero">
  ${hatImg(330, 'bighat')}
  <span class="kick"><i></i> Atualizado ${all[0] ? `${Math.max(1, Math.round((Date.now() - new Date(all[0].sent_at)) / 60000))} min atrás` : 'o dia todo'}</span>
  <h1>Pague pouco.<br>Compre como um <em>magnata</em>.</h1>
  <p>Caçamos as melhores ofertas e cupons da Amazon e do Mercado Livre o dia todo e só mostramos o que vale a pena.</p>
  <div class="cta">
    <a class="btn red" href="/ofertas">Ver ofertas de hoje</a>
    ${GROUP() ? `<a class="btn ghost" href="${esc(GROUP())}" rel="nofollow">Receber no WhatsApp</a>` : ''}
  </div>
  <div class="stats">
    <div><b>${today.length || all.length}</b><span>ofertas ${today.length ? 'nas últimas 24h' : 'recentes'}</span></div>
    ${maxOff ? `<div><b>até ${maxOff}%</b><span>de desconto hoje</span></div>` : ''}
    ${coupons ? `<div><b>${coupons}</b><span>cupons ativos</span></div>` : ''}
    <div><b>2 lojas</b><span>Amazon e Mercado Livre</span></div>
  </div>
</section>
<div class="chips">${hot.slice(0, 12).map((c) => `<a class="chip" href="/categoria/${c.slug}">${c.icon} ${esc(c.name)}</a>`).join('')}</div>
<div class="sec"><h2>⚡ Acabaram de sair<small>As promoções mais recentes, direto do forno</small></h2><a href="/ofertas">Ver todas →</a></div>
${grid(all.slice(0, 15))}
${top.length ? `<div class="sec"><h2>💸 Descontos de magnata<small>40% OFF ou mais</small></h2><a href="/ofertas?ordem=desconto">Ver mais →</a></div>${grid(top)}` : ''}
${joinBox()}
${withCoupon.length ? `<div class="sec"><h2>🎟️ Com cupom<small>Fica ainda mais barato no carrinho</small></h2><a href="/cupons">Ver cupons →</a></div>${grid(withCoupon)}` : ''}
${cheap.length ? `<div class="sec"><h2>🏷️ Até R$ 50<small>Achadinhos que cabem no bolso</small></h2><a href="/ofertas?ate=50">Ver mais →</a></div>${grid(cheap)}` : ''}
<div class="sec"><h2>Categorias em destaque</h2><a href="/categorias">Todas →</a></div>
${catsGrid(hot.slice(0, 12).length ? hot.slice(0, 12) : CATEGORIES.slice(0, 12))}
${trustRow()}`,
      });
    } else if (r === 'ofertas') {
      const loja = req.query.loja === 'amazon' ? 'amazon' : req.query.loja === 'ml' ? 'ml' : '';
      const q = String(req.query.q || '').trim().slice(0, 60);
      const ate = Number(req.query.ate) || 0;
      const ordem = req.query.ordem === 'desconto' ? 'desconto' : '';
      const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const terms = norm(q).split(/\s+/).filter(Boolean);
      let list = all;
      if (loja) list = list.filter((o) => o.products.store === loja);
      if (ate) list = list.filter((o) => Number(o.price) <= ate);
      if (terms.length) list = list.filter((o) => { const t = norm(o.products.title); return terms.every((w) => t.includes(w)); });
      if (ordem) list = [...list].sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0));
      const params = new URLSearchParams();
      if (loja) params.set('loja', loja); if (q) params.set('q', q); if (ate) params.set('ate', String(ate)); if (ordem) params.set('ordem', ordem);
      const base = `/ofertas${params.toString() ? `?${params}` : ''}`;
      const link = (k, v) => { const p2 = new URLSearchParams(params); if (v) p2.set(k, v); else p2.delete(k); const s2 = p2.toString(); return `/ofertas${s2 ? `?${s2}` : ''}`; };
      const active = q ? '' : ordem ? 'descontos' : ate ? 'ate50' : loja === 'amazon' ? 'amazon' : loja === 'ml' ? 'ml' : 'ofertas';
      const titulo = q ? `Resultados para “${esc(q)}”` : ordem ? 'Maiores descontos' : ate ? `Ofertas até R$ ${ate}` : loja === 'amazon' ? 'Ofertas da Amazon' : loja === 'ml' ? 'Ofertas do Mercado Livre' : 'Ofertas de hoje';
      html = layout({
        title: `${q ? q : titulo.replace(/<[^>]+>/g, '')} — ${SITE()}`,
        desc: 'As promoções do dia da Amazon e do Mercado Livre.',
        active,
        host,
        q,
        body: `
<div class="crumbs"><a href="/">Início</a> / Ofertas</div>
<h1 class="page">${titulo}</h1><p class="sub">${list.length} ${list.length === 1 ? 'oferta encontrada' : 'ofertas encontradas'}${q ? '' : ' nos últimos dias'}.</p>
<div class="chips">
  <a class="chip ${!loja ? 'on' : ''}" href="${link('loja', '')}">Todas as lojas</a>
  <a class="chip ${loja === 'amazon' ? 'on' : ''}" href="${link('loja', 'amazon')}">Amazon</a>
  <a class="chip ${loja === 'ml' ? 'on' : ''}" href="${link('loja', 'ml')}">Mercado Livre</a>
  <a class="chip ${ordem ? 'on' : ''}" href="${link('ordem', ordem ? '' : 'desconto')}">Maior desconto</a>
  <a class="chip ${ate === 50 ? 'on' : ''}" href="${link('ate', ate === 50 ? '' : '50')}">Até R$ 50</a>
  <a class="chip ${ate === 100 ? 'on' : ''}" href="${link('ate', ate === 100 ? '' : '100')}">Até R$ 100</a>
</div>
${grid(list.slice((page - 1) * PER_PAGE, page * PER_PAGE))}
${pager(base, page, list.length)}
${joinBox()}`,
      });
    } else if (r === 'cupons') {
      const list = all.filter((o) => o.coupon);
      html = layout({
        title: `Cupons de desconto — ${SITE()}`,
        desc: 'Cupons de desconto ativos da Amazon e do Mercado Livre.',
        active: 'cupons',
        host,
        body: `
<div class="crumbs"><a href="/">Início</a> / Cupons</div>
<h1 class="page">🎟️ Cupons de desconto</h1><p class="sub">Ofertas que ficam ainda mais baratas com cupom.</p>
${grid(list.slice((page - 1) * PER_PAGE, page * PER_PAGE))}
${pager('/cupons', page, list.length)}
${joinBox()}`,
      });
    } else if (r === 'categorias') {
      html = layout({
        title: `Categorias — ${SITE()}`,
        desc: 'Ofertas por categoria.',
        active: 'categorias',
        host,
        body: `<div class="crumbs"><a href="/">Início</a> / Categorias</div><h1 class="page">Categorias</h1><p class="sub">Escolha o que você procura.</p>${catsGrid([...CATEGORIES, { slug: 'outros', name: 'Outros', icon: '🏷️' }])}${joinBox()}`,
      });
    } else if (r === 'categoria') {
      const c = catBySlug(req.query.slug);
      if (!c) return res.status(404).send('Categoria não encontrada');
      const list = all.filter((o) => catOf(o.products.title).slug === c.slug);
      html = layout({
        title: `${c.name} em promoção — ${SITE()}`,
        desc: `Ofertas de ${c.name} na Amazon e no Mercado Livre.`,
        active: 'categorias',
        host,
        body: `
<div class="crumbs"><a href="/">Início</a> / <a href="/categorias">Categorias</a> / ${esc(c.name)}</div>
<h1 class="page">${c.icon} ${esc(c.name)}</h1><p class="sub">${list.length} ofertas recentes.</p>
${grid(list.slice((page - 1) * PER_PAGE, page * PER_PAGE))}
${pager(`/categoria/${c.slug}`, page, list.length)}
${joinBox()}`,
      });
    } else if (r === 'grupos') {
      html = layout({
        title: `Grupos de promoção — ${SITE()}`,
        desc: 'Entre no nosso grupo de WhatsApp e receba as melhores promoções.',
        active: 'grupos',
        host,
        body: `
<div class="crumbs"><a href="/">Início</a> / Grupos</div>
<section class="hero">${hatImg(330, 'bighat')}<span class="kick"><i></i> Grupo VIP gratuito</span><h1>As ofertas de magnata <em>no seu WhatsApp</em></h1>
<p>Entre no grupo e receba as melhores promoções da Amazon e do Mercado Livre assim que elas aparecem. É grátis e você pode sair quando quiser.</p>
${GROUP() ? `<a class="btn wa" href="${esc(GROUP())}" rel="nofollow">Entrar no grupo do WhatsApp</a>` : '<p class="sub">Link do grupo em breve.</p>'}
</section>
<div class="sec"><h2>Veja o que você vai receber<small>Algumas das últimas ofertas do grupo</small></h2><a href="/ofertas">Ver ofertas →</a></div>${grid(all.slice(0, 10))}${trustRow()}`,
      });
    } else if (r === 'feminino') {
      // Página do grupo feminino parceiro: Baratinho Diário (cores e logo dele)
      const FEM_GROUP = 'https://chat.whatsapp.com/ISJYZJMqrOC7TGF36EKyVG';
      const FEM_GROUPS = ['joia', 'pele', 'maquiagem'];
      // Primeiro o que é claramente feminino; se faltar, completa com beleza/joias sem marca de público masculino
      const profs = all.map((o) => [o, profile(o.products.title)]);
      const femOnly = profs.filter(([, pr]) => pr.gender === 'f').map(([o]) => o);
      const extra = profs.filter(([, pr]) => !pr.gender && [...pr.groups].some((g) => FEM_GROUPS.includes(g))).map(([o]) => o);
      const fem = [...femOnly, ...extra].slice(0, 10);
      const wa = '<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.6c-2 0-4-.5-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.6 10.6 0 1 1 16 26.6zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.7 8.7 0 0 1-2.6-1.6 9.6 9.6 0 0 1-1.8-2.2c-.2-.3 0-.5.1-.7l.5-.6.3-.5v-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .8 2.8.9 3.8.7a3.2 3.2 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.1-.3-.2-.6-.4z"/></svg>';
      html = layout({
        title: 'Grupo feminino Baratinho Diário — achadinhos para mulheres no WhatsApp',
        desc: 'Entre no grupo Baratinho Diário: beleza, skincare, moda, perfumes e achadinhos com desconto, todo dia no seu WhatsApp. Grátis.',
        active: 'feminino',
        host,
        head: `<meta name="theme-color" content="#ff1f7a"><meta property="og:image" content="https://${host}/baratinho-logo.webp"><style>
.fem{--p:#ff1f7a;--p2:#a3124f;--p3:#ffe3ef;--p4:#fff4f8}
.fem .fhero{position:relative;overflow:hidden;border-radius:26px;margin:18px 0 26px;padding:38px 26px 34px;text-align:center;color:#fff;background:radial-gradient(1200px 400px at 50% -10%,#ff6fae 0,transparent 60%),linear-gradient(160deg,#ff2d86 0%,#e3126a 55%,#a3124f 100%);box-shadow:0 18px 50px rgba(227,18,106,.35)}
.fem .fhero:before,.fem .fhero:after{content:"";position:absolute;border-radius:50%;background:rgba(255,255,255,.08)}
.fem .fhero:before{width:340px;height:340px;left:-120px;top:-120px}.fem .fhero:after{width:260px;height:260px;right:-90px;bottom:-110px}
.fem .flogo{position:relative;display:inline-block;background:#fff;border-radius:22px;padding:16px 22px;box-shadow:0 10px 30px rgba(120,0,50,.25)}
.fem .flogo img{display:block;width:min(340px,70vw);height:auto}
.fem .fkick{position:relative;display:inline-block;margin:20px 0 8px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);padding:6px 14px;border-radius:99px;font-weight:700;font-size:13px;letter-spacing:.3px}
.fem h1{position:relative;font-family:'Playfair Display',serif;font-weight:900;font-size:clamp(28px,5vw,44px);line-height:1.08;margin:6px auto 12px;max-width:760px}
.fem .fhero p{position:relative;max-width:620px;margin:0 auto 22px;font-size:17px;line-height:1.5;color:#ffe9f2}
.fem .fbtn{position:relative;display:inline-flex;align-items:center;gap:10px;background:#fff;color:var(--p2);text-decoration:none;font-weight:900;font-size:18px;padding:16px 28px;border-radius:99px;box-shadow:0 10px 26px rgba(90,0,40,.3);transition:transform .15s}
.fem .fbtn:hover{transform:translateY(-2px)}.fem .fbtn svg{color:#25d366}
.fem .fnote{position:relative;margin-top:12px;font-size:13px;color:#ffd3e4}
.fem .fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin:0 0 30px}
.fem .fcard{background:var(--p4);border:1px solid var(--p3);border-radius:18px;padding:18px}
.fem .fcard b{display:block;font-size:26px;margin-bottom:6px}.fem .fcard h3{margin:0 0 4px;color:var(--p2);font-size:17px}.fem .fcard p{margin:0;color:#6b4a57;font-size:14px;line-height:1.45}
.fem .fsteps{counter-reset:s;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:0 0 30px;padding:0;list-style:none}
.fem .fsteps li{counter-increment:s;background:#fff;border:1px solid var(--p3);border-radius:16px;padding:16px 16px 16px 58px;position:relative;color:#4b3540;font-size:15px}
.fem .fsteps li:before{content:counter(s);position:absolute;left:14px;top:14px;width:32px;height:32px;border-radius:50%;background:var(--p);color:#fff;font-weight:900;display:grid;place-items:center}
.fem .sec h2{color:var(--p2)}.fem .sec a{color:var(--p)}
.fem .fend{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;background:linear-gradient(120deg,#ff2d86,#a3124f);color:#fff;border-radius:22px;padding:22px 24px;margin:30px 0 10px}
.fem .fend img{height:44px;width:auto}.fem .fend strong{font-size:19px}.fem .fend .fbtn{font-size:16px;padding:13px 22px}
</style>`,
        body: `<div class="fem">
<div class="crumbs"><a href="/">Início</a> / Grupo feminino</div>
<section class="fhero">
  <div class="flogo"><img src="/baratinho-logo.webp" alt="Baratinho Diário" width="480" height="245"></div><br>
  <span class="fkick">💖 Grupo feminino · 100% grátis</span>
  <h1>Os achadinhos que toda mulher ama, todo dia no seu WhatsApp</h1>
  <p>No <strong>Baratinho Diário</strong> você recebe as melhores promoções de beleza, skincare, perfumes, moda e casa, com cupons e preços baixinhos, escolhidas a dedo.</p>
  <a class="fbtn" href="${FEM_GROUP}" rel="nofollow noopener" target="_blank">${wa} Entrar no grupo Baratinho Diário</a>
  <div class="fnote">Sem spam · Você sai quando quiser</div>
</section>
<div class="fgrid">
  <div class="fcard"><b>💄</b><h3>Beleza e skincare</h3><p>Maquiagem, cabelo e cuidados com a pele das marcas que você já usa, por menos.</p></div>
  <div class="fcard"><b>🌸</b><h3>Perfumes</h3><p>Importados, árabes e nacionais com descontos de verdade.</p></div>
  <div class="fcard"><b>👜</b><h3>Moda e acessórios</h3><p>Bolsas, roupas, calçados, joias e relógios em promoção.</p></div>
  <div class="fcard"><b>🎟️</b><h3>Cupons e achadinhos</h3><p>Cupons que funcionam e achadinhos para casa e presentes.</p></div>
</div>
<div class="sec"><h2>Como entrar</h2></div>
<ol class="fsteps"><li>Toque no botão <strong>Entrar no grupo</strong>.</li><li>O WhatsApp abre: toque em <strong>Entrar no grupo</strong> de novo.</li><li>Pronto! Agora é só aproveitar os achadinhos 💕</li></ol>
${fem.length ? `<div class="sec"><h2>Achadinhos femininos de hoje<small>Alguns que estão em promoção agora</small></h2><a href="/ofertas">Ver mais →</a></div>${grid(fem)}` : ''}
<div class="fend"><img src="/baratinho-logo.webp" alt="Baratinho Diário" style="background:#fff;border-radius:12px;padding:6px 10px"><strong>Vem pro grupo das mulheres que compram bem 💖</strong><a class="fbtn" href="${FEM_GROUP}" rel="nofollow noopener" target="_blank">${wa} Entrar agora</a></div>
</div>`,
      });
    } else {
      return res.status(404).send('Página não encontrada');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    res.status(200).send(html);
  } catch (e) {
    res.status(500).send('Erro ao carregar a página');
  }
}
