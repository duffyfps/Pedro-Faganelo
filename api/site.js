// Site público: início, ofertas, cupons, categorias, uma categoria e grupos
import { db } from '../lib/db.js';
import { layout, card, joinBox, catsGrid, catOf, catBySlug, CATEGORIES, esc, GROUP, SITE } from '../lib/site.js';

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
  return `<div class="more">${page > 1 ? `<a class="btn ghost" href="${base}${sep}pagina=${page - 1}">← Anteriores</a> ` : ''}${
    page < pages ? `<a class="btn gold" href="${base}${sep}pagina=${page + 1}">Ver mais ofertas</a>` : ''
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
      const withCoupon = all.filter((o) => o.coupon).slice(0, 8);
      const top = [...all.slice(0, 80)].sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0)).slice(0, 8);
      const counts = Object.fromEntries(CATEGORIES.map((c) => [c.slug, 0]));
      all.forEach((o) => { const c = catOf(o.products.title).slug; if (c in counts) counts[c]++; });
      const hot = CATEGORIES.filter((c) => counts[c.slug] > 0).sort((a, b) => counts[b.slug] - counts[a.slug]);
      html = layout({
        title: `${SITE()} — as melhores ofertas da Amazon e do Mercado Livre`,
        desc: 'Ofertas, cupons e promoções selecionadas da Amazon e do Mercado Livre, atualizadas o dia todo.',
        active: 'home',
        host,
        body: `
<section class="hero">
  <h1>As <em>melhores ofertas</em> do dia, num lugar só</h1>
  <p>Promoções e cupons da Amazon e do Mercado Livre, selecionados e atualizados o dia todo.</p>
  ${GROUP() ? `<a class="btn wa" href="${esc(GROUP())}" rel="nofollow">Receber no WhatsApp — grátis</a>` : `<a class="btn gold" href="/ofertas">Ver ofertas</a>`}
</section>
<div class="chips">${hot.slice(0, 10).map((c) => `<a class="chip" href="/categoria/${c.slug}">${c.icon} ${esc(c.name)}</a>`).join('')}</div>
<div class="sec"><h2>🔥 Últimas ofertas</h2><a href="/ofertas">Ver todas</a></div>
${grid(all.slice(0, 12))}
${top.length ? `<div class="sec"><h2>💸 Maiores descontos</h2><a href="/ofertas">Ver mais</a></div>${grid(top)}` : ''}
${withCoupon.length ? `<div class="sec"><h2>🎟️ Com cupom</h2><a href="/cupons">Ver cupons</a></div>${grid(withCoupon)}` : ''}
${joinBox()}
<div class="sec"><h2>Categorias em destaque</h2><a href="/categorias">Todas</a></div>
${catsGrid(hot.slice(0, 8).length ? hot.slice(0, 8) : CATEGORIES.slice(0, 8))}`,
      });
    } else if (r === 'ofertas') {
      const loja = req.query.loja === 'amazon' ? 'amazon' : req.query.loja === 'ml' ? 'ml' : '';
      const list = loja ? all.filter((o) => o.products.store === loja) : all;
      const base = loja ? `/ofertas?loja=${loja}` : '/ofertas';
      html = layout({
        title: `Ofertas de hoje — ${SITE()}`,
        desc: 'Todas as promoções do dia da Amazon e do Mercado Livre.',
        active: 'ofertas',
        host,
        body: `
<div class="crumbs"><a href="/">Início</a> / Ofertas</div>
<h1 class="page">Ofertas de hoje</h1><p class="sub">${list.length} ofertas publicadas nos últimos dias.</p>
<div class="chips"><a class="chip ${!loja ? 'on' : ''}" href="/ofertas">Todas</a><a class="chip ${loja === 'amazon' ? 'on' : ''}" href="/ofertas?loja=amazon">Amazon</a><a class="chip ${loja === 'ml' ? 'on' : ''}" href="/ofertas?loja=ml">Mercado Livre</a></div>
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
<h1 class="page">Cupons de desconto</h1><p class="sub">Ofertas que ficam ainda mais baratas com cupom.</p>
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
<section class="hero"><h1>Receba as ofertas <em>no seu WhatsApp</em></h1>
<p>Entre no grupo e receba as melhores promoções da Amazon e do Mercado Livre assim que elas aparecem. É grátis e você pode sair quando quiser.</p>
${GROUP() ? `<a class="btn wa" href="${esc(GROUP())}" rel="nofollow">Entrar no grupo do WhatsApp</a>` : '<p class="sub">Link do grupo em breve.</p>'}
</section>
<div class="sec"><h2>Veja o que você vai receber</h2><a href="/ofertas">Ver ofertas</a></div>${grid(all.slice(0, 8))}`,
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
