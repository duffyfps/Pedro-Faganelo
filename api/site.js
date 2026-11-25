// Site público: início, ofertas, cupons, categorias, uma categoria e grupos
import { db } from '../lib/db.js';
import { layout, card, joinBox, trustRow, catsGrid, catOf, catBySlug, CATEGORIES, esc, GROUP, SITE, hat } from '../lib/site.js';

const PER_PAGE = 24;

async function recent(limit = 500) {
  const since = new Date(Date.now() - 10 * 86400000).toISOString();
  const rows = await db.select(
    'offers',
    `status=eq.sent&sent_at=gte.${since}&select=id,price,old_price,discount_pct,coupon,sent_at,products(title,image,store)&order=sent_at.desc&limit=${limit}`
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
  <span class="bighat">${hat(320, '#d4af55', '#e0262f')}</span>
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
<section class="hero"><span class="bighat">${hat(320, '#d4af55', '#e0262f')}</span><span class="kick"><i></i> Grupo VIP gratuito</span><h1>As ofertas de magnata <em>no seu WhatsApp</em></h1>
<p>Entre no grupo e receba as melhores promoções da Amazon e do Mercado Livre assim que elas aparecem. É grátis e você pode sair quando quiser.</p>
${GROUP() ? `<a class="btn wa" href="${esc(GROUP())}" rel="nofollow">Entrar no grupo do WhatsApp</a>` : '<p class="sub">Link do grupo em breve.</p>'}
</section>
<div class="sec"><h2>Veja o que você vai receber<small>Algumas das últimas ofertas do grupo</small></h2><a href="/ofertas">Ver ofertas →</a></div>${grid(all.slice(0, 10))}${trustRow()}`,
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
