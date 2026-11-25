// Visual e peças compartilhadas do site público do Magnata (home, oferta, categorias, cupons, grupos)
export const SITE = () => (process.env.SITE_NAME || 'Magnata Promoções').trim();
export const GROUP = () => (process.env.GROUP_INVITE_URL || '').trim();
export const INSTAGRAM = () => (process.env.INSTAGRAM_URL || '').trim();

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const brl = (n) =>
  n == null ? '' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ');
export const codeOf = (id) => Number(id).toString(36);
export const idOf = (code) => parseInt(String(code || '').replace(/[^0-9a-z]/gi, ''), 36);
export const img = (u) => (u ? `/api/img?url=${encodeURIComponent(u)}` : '');
export const storeName = (s) => (s === 'amazon' ? 'Amazon' : 'Mercado Livre');
export const storeLink = (msg) => (String(msg || '').match(/🛒[^\n]*?(https?:\/\/\S+)/) || [])[1] || null;
export const ago = (d) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(d)) / 60000));
  return m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dias`;
};

// ---------- Categorias (pelo nome do produto) ----------
export const CATEGORIES = [
  { slug: 'celulares', name: 'Celulares e Smartwatches', icon: '📱', re: /iphone|galaxy|xiaomi|redmi|poco\b|motorola|celular|smartphone|smartwatch|apple watch|rel[óo]gio inteligente|airpods|fone|earbuds|headset|jbl|caixa de som|soundbar/i },
  { slug: 'informatica', name: 'Informática e Games', icon: '💻', re: /notebook|monitor|ssd|teclado|mouse|placa de v[íi]deo|processador|ryzen|intel|pc gamer|headset gamer|ps5|playstation|xbox|nintendo|switch|dualsense|controle|gta|roteador|pendrive|hd externo|impressora|kindle|tablet|ipad/i },
  { slug: 'tv', name: 'TV e Vídeo', icon: '📺', re: /smart ?tv|\btv\b|polegadas|qled|oled|fire tv|chromecast|projetor|roku/i },
  { slug: 'eletrodomesticos', name: 'Eletrodomésticos', icon: '🔌', re: /geladeira|refrigerador|micro-?ondas|lava[- ]lou[çc]a|lavadora|m[áa]quina de lavar|air ?fryer|fritadeira|forno|liquidificador|batedeira|cafeteira|nespresso|dolce gusto|aspirador|ventilador|ar[- ]condicionado|purificador|sanduicheira|panela el[ée]trica/i },
  { slug: 'casa', name: 'Casa e Cozinha', icon: '🏠', re: /panela|tramontina|faqueiro|talher|copo|garrafa|stanley|toalha|len[çc]ol|travesseiro|edredom|manta|cobertor|colch[ãa]o|cadeira|mesa\b|organizador|fechadura|l[âa]mpada|cortina|tapete|decora/i },
  { slug: 'beleza', name: 'Beleza e Cuidados Pessoais', icon: '💄', re: /perfume|parfum|eau de|col[ôo]nia|desodorante|shampoo|condicionador|hidratante|protetor solar|s[ée]rum|creme|maquiagem|batom|esfoliante|sabonete|barbeador|gillette|oneblade|escova|secador|chapinha|skincare|cetaphil|nivea|vichy|la roche|elseve|kérastase|kerastase/i },
  { slug: 'moda', name: 'Moda e Acessórios', icon: '👕', re: /camis[ae]|camiseta|polo\b|cal[çc]a|bermuda|short|jaqueta|moletom|cueca|meia|suti[ãa]|vestido|bolsa|mochila|carteira|[óo]culos|bon[ée]\b|rel[óo]gio|pulseira|colar|bracelete/i },
  { slug: 'calcados', name: 'Calçados', icon: '👟', re: /t[êe]nis|chuteira|sand[áa]lia|chinelo|havaianas|crocs|sapat|bota\b|jordan|air force/i },
  { slug: 'esporte', name: 'Esporte e Suplementos', icon: '💪', re: /whey|creatina|suplemento|pr[ée]-treino|bcaa|bicicleta|halter|anilha|esteira|yoga|academia|corrida|bola\b/i },
  { slug: 'mercado', name: 'Mercado e Bebidas', icon: '🛒', re: /chocolate|chocottone|panetone|caf[ée]\b|c[áa]psula|cerveja|vinho|whisky|refrigerante|biscoito|leite|azeite|sab[ãa]o|amaciante|detergente|papel higi[êe]nico|fralda|len[çc]o umedecido|doritos/i },
  { slug: 'ferramentas', name: 'Ferramentas e Automotivo', icon: '🔧', re: /parafusadeira|furadeira|ferramenta|serra|chave de|alicate|compressor|lavadora de alta|aspirador automotivo|carro|pneu|moto\b/i },
  { slug: 'infantil', name: 'Bebês e Brinquedos', icon: '🧸', re: /lego|brinquedo|boneca|pok[ée]mon|hot wheels|carrinho de beb[êe]|beb[êe]|infantil|kids/i },
  { slug: 'pet', name: 'Pet', icon: '🐾', re: /\bpet\b|ra[çc][ãa]o|gato|cachorro|areia sanit/i },
];
export const catOf = (title = '') => CATEGORIES.find((c) => c.re.test(title)) || { slug: 'outros', name: 'Outros', icon: '🏷️' };
export const catBySlug = (slug) => CATEGORIES.find((c) => c.slug === slug) || (slug === 'outros' ? { slug: 'outros', name: 'Outros', icon: '🏷️' } : null);

// ---------- Layout ----------
const CSS = `
:root{--gold:#e8b931;--gold2:#ffd766;--bg:#0b0b0d;--card:#151518;--card2:#1c1c21;--line:#2a2a31;--text:#f4f4f6;--muted:#9d9daa;--green:#25d366;--red:#ff4d5e}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:inherit}img{display:block}
.top{background:linear-gradient(90deg,#000,#1a1406);border-bottom:1px solid #3a2f12;font-size:13px}
.top .in{max-width:1100px;margin:0 auto;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.top a{background:var(--green);color:#000;text-decoration:none;font-weight:800;padding:6px 12px;border-radius:99px;white-space:nowrap}
header{position:sticky;top:0;z-index:5;background:rgba(11,11,13,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
header .in{max-width:1100px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;gap:18px}
.logo{display:flex;align-items:center;gap:9px;text-decoration:none;font-weight:900;letter-spacing:.5px}
.logo b{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--gold2),var(--gold));color:#000;font-size:18px}
.logo span{color:var(--gold);font-size:17px}
nav{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}nav::-webkit-scrollbar{display:none}
nav a{text-decoration:none;color:var(--muted);font-weight:600;font-size:14px;padding:7px 11px;border-radius:9px;white-space:nowrap}
nav a.on,nav a:hover{color:var(--text);background:var(--card2)}
@media(max-width:720px){header .in{flex-wrap:wrap;gap:8px}nav{width:100%}}
main{max-width:1100px;margin:0 auto;padding:16px}
.crumbs{font-size:12px;color:var(--muted);margin:2px 0 12px}.crumbs a{text-decoration:none}.crumbs a:hover{color:var(--gold)}
h1.page{font-size:22px;margin:6px 0 4px}.sub{color:var(--muted);margin:0 0 16px}
.hero{background:radial-gradient(1200px 300px at 20% -20%,#3a2c07 0%,transparent 60%),linear-gradient(180deg,#141210,#0b0b0d);border:1px solid #2e2612;border-radius:18px;padding:22px 18px;margin-bottom:18px}
.hero h1{margin:0 0 6px;font-size:24px}.hero h1 em{color:var(--gold);font-style:normal}.hero p{margin:0 0 14px;color:#cfcfd6}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font-weight:800;border-radius:12px;padding:12px 16px;border:0;cursor:pointer;font-size:15px}
.btn.wa{background:var(--green);color:#000}.btn.gold{background:linear-gradient(135deg,var(--gold2),var(--gold));color:#000}.btn.ghost{background:var(--card2);color:var(--text);border:1px solid var(--line)}
.chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:14px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}
.chip{white-space:nowrap;text-decoration:none;background:var(--card);border:1px solid var(--line);border-radius:99px;padding:7px 12px;font-size:13px;font-weight:600}
.chip.on{background:var(--gold);color:#000;border-color:var(--gold)}
.sec{display:flex;align-items:center;justify-content:space-between;margin:22px 0 10px}.sec h2{font-size:18px;margin:0}.sec a{font-size:13px;color:var(--gold);text-decoration:none;font-weight:700}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
@media(max-width:420px){.grid{grid-template-columns:1fr 1fr;gap:10px}}
.card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px;text-decoration:none;display:flex;flex-direction:column;transition:transform .15s,border-color .15s}
.card:hover{transform:translateY(-2px);border-color:#3b3b44}
.card .ph{background:#fff;border-radius:10px;aspect-ratio:1/1;display:grid;place-items:center;overflow:hidden}
.card .ph img{max-width:100%;max-height:100%;object-fit:contain}
.card .off{position:absolute;top:16px;left:16px;background:var(--red);color:#fff;font-weight:800;font-size:11px;border-radius:6px;padding:2px 6px}
.card .st{font-size:11px;color:var(--muted);margin-top:8px;display:flex;justify-content:space-between;gap:6px}
.card .t{font-size:13px;font-weight:600;margin:4px 0 6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.8em}
.card .o{font-size:12px;color:var(--muted);text-decoration:line-through;min-height:1.2em}
.card .p{font-size:18px;font-weight:900;color:var(--gold)}
.card .cp{margin-top:6px;font-size:11px;color:var(--gold2);border:1px dashed #5a4a1a;border-radius:6px;padding:2px 6px;align-self:flex-start}
.cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.cat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 10px;text-align:center;text-decoration:none;font-size:13px;font-weight:600}
.cat i{display:block;font-style:normal;font-size:26px;margin-bottom:6px}
.join{margin:26px 0 6px;background:linear-gradient(135deg,#0f2a19,#0b0b0d);border:1px solid #1f5a35;border-radius:18px;padding:20px;text-align:center}
.join h3{margin:0 0 4px;font-size:19px}.join p{margin:0 0 12px;color:#cfd8d2}
.more{text-align:center;margin:18px 0}
footer{border-top:1px solid var(--line);margin-top:30px;color:var(--muted);font-size:12px}
footer .in{max-width:1100px;margin:0 auto;padding:20px 16px 40px;display:grid;gap:8px}
footer a{color:var(--muted)}
.empty{color:var(--muted);text-align:center;padding:40px 0}
`;

export function layout({ title, desc = '', head = '', active = '', body, host }) {
  const site = SITE();
  const g = GROUP();
  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#0b0b0d">
${head}
<style>${CSS}</style></head><body>
${g ? `<div class="top"><div class="in"><span>💰 Receba as melhores promoções no WhatsApp — é grátis!</span><a href="${esc(g)}" rel="nofollow">Entrar no grupo</a></div></div>` : ''}
<header><div class="in">
  <a class="logo" href="/"><b>M</b><span>${esc(site.toUpperCase())}</span></a>
  <nav>
    <a href="/" class="${active === 'home' ? 'on' : ''}">Início</a>
    <a href="/ofertas" class="${active === 'ofertas' ? 'on' : ''}">Ofertas</a>
    <a href="/cupons" class="${active === 'cupons' ? 'on' : ''}">Cupons</a>
    <a href="/categorias" class="${active === 'categorias' ? 'on' : ''}">Categorias</a>
    <a href="/grupos" class="${active === 'grupos' ? 'on' : ''}">Grupos</a>
  </nav>
</div></header>
<main>${body}</main>
<footer><div class="in">
  <div><b style="color:var(--gold)">${esc(site)}</b> — as melhores ofertas da Amazon e do Mercado Livre, todos os dias.</div>
  <div>Preços e disponibilidade podem mudar a qualquer momento na loja. Como participantes de programas de afiliados, podemos receber comissão pelas compras qualificadas, sem custo extra para você.</div>
  <div>${INSTAGRAM() ? `<a href="${esc(INSTAGRAM())}">Instagram</a> · ` : ''}${g ? `<a href="${esc(g)}">Grupo de WhatsApp</a> · ` : ''}<a href="/categorias">Categorias</a> · <a href="/cupons">Cupons</a></div>
</div></footer>
</body></html>`;
}

export function card(o) {
  const p = o.products || {};
  const off = o.discount_pct ? `<span class="off">-${o.discount_pct}%</span>` : '';
  const cp = String(o.coupon || '').split(',').map((s) => s.trim()).filter(Boolean)[0];
  return `<a class="card" href="/p/${codeOf(o.id)}">${off}
  <div class="ph">${p.image ? `<img loading="lazy" src="${esc(img(p.image))}" alt="${esc(p.title)}">` : ''}</div>
  <div class="st"><span>${storeName(p.store)}</span><span>${o.sent_at ? ago(o.sent_at) : ''}</span></div>
  <div class="t">${esc(p.title)}</div>
  <div class="o">${o.old_price && Number(o.old_price) > Number(o.price) ? brl(o.old_price) : ''}</div>
  <div class="p">${brl(o.price)}</div>
  ${cp ? `<span class="cp">Cupom: ${esc(cp)}</span>` : ''}
</a>`;
}

export const joinBox = () =>
  GROUP()
    ? `<div class="join"><h3>Já está no nosso grupo de promoções?</h3><p>É grátis! Receba no WhatsApp as melhores ofertas e economize mais.</p><a class="btn wa" href="${esc(GROUP())}" rel="nofollow">Clique aqui para entrar</a></div>`
    : '';

export const catsGrid = (list = CATEGORIES) =>
  `<div class="cats">${list.map((c) => `<a class="cat" href="/categoria/${c.slug}"><i>${c.icon}</i>${esc(c.name)}</a>`).join('')}</div>`;
