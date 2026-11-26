// Visual e peças compartilhadas do site público do Magnata (home, oferta, categorias, cupons, grupos)
export const SITE = () => (process.env.SITE_NAME || 'Magnata Promoções').trim();
export const GROUP = () => (process.env.GROUP_INVITE_URL || 'https://chat.whatsapp.com/KHuEfGetKebLZJcctXhZEI').trim();
export const INSTAGRAM = () => (process.env.INSTAGRAM_URL || '').trim();

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const brl = (n) =>
  n == null ? '' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ');
export const codeOf = (id) => Number(id).toString(36);
export const idOf = (code) => parseInt(String(code || '').replace(/[^0-9a-z]/gi, ''), 36);
export const img = (u) => (u ? `/api/img?url=${encodeURIComponent(u)}` : '');
export const storeName = (s) => (s === 'amazon' ? 'Amazon' : 'Mercado Livre');
export const naLoja = (s) => (s === 'amazon' ? 'na Amazon' : 'no Mercado Livre');
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

// ---------- Marca ----------
// Cartola do magnata (desenho original). fill = cor da cartola; band = faixa.
export const hat = (size = 32, fill = '#fff', band = '#e0262f') =>
  `<svg class="hat" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="51" rx="29" ry="7.5" fill="${fill}"/><path d="M15 13.5Q32 8.5 49 13.5L46.6 47.5Q32 51.5 17.4 47.5Z" fill="${fill}"/><path d="M17 37.5Q32 41.5 47 37.5L46.6 45Q32 49 17.4 45Z" fill="${band}"/><path d="M21 16.5Q20.4 25 20.8 33" stroke="#d4af55" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".85"/></svg>`;
export const FAVICON = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><ellipse cx="32" cy="51" rx="29" ry="7.5" fill="#111" stroke="#fff" stroke-width="2"/><path d="M15 13.5Q32 8.5 49 13.5L46.6 47.5Q32 51.5 17.4 47.5Z" fill="#111" stroke="#fff" stroke-width="2"/><path d="M17 37.5Q32 41.5 47 37.5L46.6 45Q32 49 17.4 45Z" fill="#e0262f"/></svg>`)}`;

export const hatImg = (w, cls = '') => `<img class="hatimg ${cls}" src="/cartola.webp" alt="" width="${w}" style="width:${w}px;height:auto">`;

// ---------- Layout ----------
const CSS = `
:root{--ink:#0e0e11;--ink2:#1b1b21;--bg:#f5f3ee;--card:#fff;--line:#e8e4da;--text:#17171c;--muted:#6f6c66;--red:#e0262f;--red2:#b9151e;--gold:#d4af55;--gold2:#f3d98b;--green:#1fae55;--wa:#25d366;--shadow:0 1px 2px rgba(20,16,8,.06),0 6px 20px rgba(20,16,8,.06)}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 Inter,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}img{display:block}.serif{font-family:"Playfair Display",Georgia,serif}
.top{background:var(--red);color:#fff;font-size:13px;font-weight:600}
.top .in{max-width:1180px;margin:0 auto;padding:7px 16px;display:flex;align-items:center;justify-content:center;gap:12px}
.top a{background:#fff;color:var(--red2);text-decoration:none;font-weight:800;padding:4px 12px;border-radius:99px;white-space:nowrap;font-size:12px}
header{position:sticky;top:0;z-index:20;background:#000;box-shadow:0 1px 0 rgba(212,175,85,.35)}
header>.in{max-width:1180px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:20px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff;flex-shrink:0}
.logo img{height:70px;width:auto;display:block}
.logo .wm{display:flex;flex-direction:column;line-height:1}
.logo .wm b{font-family:"Playfair Display",Georgia,serif;font-weight:900;font-size:22px;letter-spacing:1.5px}
.logo .wm small{font-size:9.5px;font-weight:800;letter-spacing:3.6px;color:var(--gold);margin-top:3px}
.search{flex:1;display:flex;max-width:440px;background:#fff;border-radius:12px;overflow:hidden}
.search input{flex:1;border:0;padding:10px 14px;font:inherit;font-size:14px;outline:none;min-width:0}
.search button{border:0;background:var(--gold);padding:0 14px;cursor:pointer;font-size:16px}
nav.main{background:var(--ink2);border-top:1px solid #2a2a33}
nav.main .in{max-width:1180px;margin:0 auto;padding:0 10px;display:flex;gap:2px;overflow-x:auto;scrollbar-width:none}nav.main .in::-webkit-scrollbar{display:none}
nav.main a{text-decoration:none;color:#c9c7c1;font-weight:600;font-size:14px;padding:10px 12px;white-space:nowrap;border-bottom:2px solid transparent}
nav.main a.on,nav.main a:hover{color:#fff;border-bottom-color:var(--red)}
@media(max-width:760px){header>.in{flex-wrap:wrap;gap:10px;padding:8px 12px}.logo img{height:54px}.top .long{display:none}.search{order:3;max-width:none;flex-basis:100%}.logo .wm b{font-size:19px}}
main{max-width:1180px;margin:0 auto;padding:18px 16px}
.crumbs{font-size:12px;color:var(--muted);margin:0 0 12px}.crumbs a{text-decoration:none}.crumbs a:hover{color:var(--red)}
h1.page{font-family:"Playfair Display",Georgia,serif;font-size:30px;margin:4px 0 4px;letter-spacing:-.3px}.sub{color:var(--muted);margin:0 0 16px}
.hero{position:relative;overflow:hidden;background:radial-gradient(700px 320px at 85% 10%,rgba(224,38,47,.35),transparent 60%),radial-gradient(600px 300px at 0% 100%,rgba(212,175,85,.22),transparent 60%),var(--ink);color:#fff;border-radius:22px;padding:34px 26px;margin-bottom:22px}
.hero .bighat{position:absolute;right:34px;top:34px;transform:rotate(-10deg);pointer-events:none;filter:drop-shadow(0 14px 30px rgba(0,0,0,.6))}@media(max-width:900px){.hero .bighat{opacity:.22;right:-70px;top:auto;bottom:-30px}}
.hero .kick{display:inline-flex;gap:8px;align-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:99px;padding:5px 12px;font-size:12px;font-weight:700;color:var(--gold2)}
.hero .kick i{width:8px;height:8px;border-radius:50%;background:#35e07a;box-shadow:0 0 0 4px rgba(53,224,122,.18);font-style:normal}
.hero h1{position:relative;font-family:"Playfair Display",Georgia,serif;font-size:42px;line-height:1.08;margin:14px 0 10px;max-width:640px;letter-spacing:-.5px}
.hero h1 em{font-style:normal;color:#ff3434}
.hero p{position:relative;margin:0 0 20px;color:#d9d6cf;max-width:560px;font-size:16px}
.hero .cta{position:relative;display:flex;gap:10px;flex-wrap:wrap}
.stats{position:relative;display:flex;gap:26px;flex-wrap:wrap;margin-top:26px;padding-top:18px;border-top:1px solid rgba(255,255,255,.12)}
.stats div b{display:block;font-size:24px;font-weight:900;color:#fff}.stats div span{font-size:12px;color:#b9b5ac;font-weight:600}
@media(max-width:600px){.hero{padding:26px 18px}.hero h1{font-size:31px}.stats{gap:18px}.stats div b{font-size:20px}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font-weight:800;border-radius:12px;padding:13px 18px;border:0;cursor:pointer;font-size:15px;transition:transform .12s,filter .12s}
.btn:hover{transform:translateY(-1px);filter:brightness(1.06)}
.btn.wa{background:var(--wa);color:#05290f}.btn.red{background:var(--red);color:#fff;box-shadow:0 6px 18px rgba(224,38,47,.35)}
.btn.gold{background:linear-gradient(135deg,var(--gold2),var(--gold));color:#1b1405}.btn.ghost{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.35)}
.btn.line{background:#fff;color:var(--text);border:1.5px solid var(--line)}
.chips{display:flex;gap:8px;overflow-x:auto;padding:2px 0 6px;margin-bottom:8px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}
.chip{white-space:nowrap;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:99px;padding:8px 14px;font-size:13px;font-weight:700;box-shadow:var(--shadow)}
.chip:hover{border-color:var(--text)}.chip.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.sec{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin:30px 0 14px}
.sec h2{font-family:"Playfair Display",Georgia,serif;font-size:25px;margin:0;letter-spacing:-.2px}.sec h2 small{display:block;font-family:Inter,sans-serif;font-size:13px;color:var(--muted);font-weight:500;letter-spacing:0;margin-top:2px}
.sec a{font-size:13px;color:var(--red);text-decoration:none;font-weight:800;white-space:nowrap}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:14px}
@media(max-width:480px){.grid{grid-template-columns:1fr 1fr;gap:10px}.card .hot{font-size:0;padding:3px 6px}.card .hot::before{content:'🔥';font-size:12px}.card .st{flex-wrap:wrap}.card .p{font-size:19px}}
.card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:16px;text-decoration:none;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow);transition:transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-3px);box-shadow:0 2px 4px rgba(20,16,8,.06),0 14px 32px rgba(20,16,8,.12)}
.card .ph{position:relative;background:#fff;aspect-ratio:1/1;display:grid;place-items:center;padding:14px;border-bottom:1px solid #f0ede6}
.card .ph img{max-width:100%;max-height:100%;object-fit:contain;transition:transform .25s}.card:hover .ph img{transform:scale(1.04)}
.card .off{position:absolute;top:10px;left:10px;background:var(--red);color:#fff;font-weight:900;font-size:13px;border-radius:8px;padding:3px 8px}
.card .hot{position:absolute;top:10px;right:10px;background:var(--ink);color:var(--gold2);font-weight:800;font-size:10.5px;border-radius:8px;padding:4px 7px;letter-spacing:.3px}
.card .bd{padding:11px 12px 12px;display:flex;flex-direction:column;flex:1}
.card .st{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:11px;color:var(--muted)}
.store{font-weight:800;font-size:10.5px;border-radius:6px;padding:2px 7px;letter-spacing:.2px}
.store.amazon{background:#131921;color:#ffb84d}.store.ml{background:#ffe600;color:#2d3277}
.card .t{font-size:13.5px;font-weight:600;margin:8px 0 8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.85em;line-height:1.4}
.card .o{font-size:12px;color:var(--muted);text-decoration:line-through;min-height:1.2em}
.card .p{font-size:22px;font-weight:900;color:var(--text);letter-spacing:-.3px;line-height:1.15}
.card .sv{font-size:11.5px;color:var(--green);font-weight:700;min-height:1.3em;margin-top:2px}
.card .p small{font-size:12px;font-weight:700;color:#0b7a55;letter-spacing:0}
.card .tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.tg{font-size:10.5px;font-weight:800;border-radius:6px;padding:2px 6px}.tg.prime{background:#e6f1ff;color:#0a4fa8}.tg.meli{background:#fff3c4;color:#6a4b00}.tg.pix{background:#e3f8f0;color:#0b7a55}
.card .cp{margin-top:7px;font-size:11px;font-weight:800;color:#7a5a07;background:#fff7dc;border:1px dashed var(--gold);border-radius:7px;padding:3px 7px;align-self:flex-start}
.card .go{margin-top:auto;padding-top:10px}.card .go span{display:block;text-align:center;background:var(--red);color:#fff;font-weight:800;font-size:13px;border-radius:10px;padding:9px}
.card:hover .go span{background:var(--red2)}
.cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
.cat{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 10px;text-align:center;text-decoration:none;font-size:13px;font-weight:700;box-shadow:var(--shadow);transition:transform .15s,border-color .15s}
.cat:hover{transform:translateY(-2px);border-color:var(--red)}
.cat i{display:grid;place-items:center;width:52px;height:52px;margin:0 auto 8px;border-radius:50%;background:#f6f1e4;font-style:normal;font-size:26px}
.join{position:relative;overflow:hidden;margin:34px 0 8px;background:linear-gradient(135deg,#0b3d22,#0e0e11 70%);color:#fff;border-radius:22px;padding:28px 22px;display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center}
.join .hatimg{flex-shrink:0;filter:drop-shadow(0 6px 14px rgba(0,0,0,.5))}
.join h3{margin:0 0 4px;font-family:"Playfair Display",Georgia,serif;font-size:24px}.join p{margin:0;color:#cfe3d6}
@media(max-width:700px){.join{grid-template-columns:1fr;text-align:center}.join .hatimg{margin:0 auto}}
.trust{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:30px 0 0}
.trust div{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:var(--shadow)}
.trust b{display:block;margin-bottom:3px}.trust span{font-size:13px;color:var(--muted)}
.more{text-align:center;margin:22px 0}
footer{background:#000;color:#a9a69e;margin-top:40px;font-size:13px}
footer .in{max-width:1180px;margin:0 auto;padding:30px 16px 44px;display:grid;gap:12px}
footer .logo{margin-bottom:4px}footer a{color:#d9d6cf}
.empty{color:var(--muted);text-align:center;padding:50px 0}
`;

export function layout({ title, desc = '', head = '', active = '', body, host, q = '' }) {
  const site = SITE();
  const g = GROUP();
  const logo = `<a class="logo" href="/" aria-label="${esc(site)}"><img src="/logo.webp" alt="${esc(site)}" width="150" height="75"></a>`;
  const nav = [['home', '/', 'Início'], ['ofertas', '/ofertas', 'Ofertas do dia'], ['descontos', '/ofertas?ordem=desconto', 'Maiores descontos'], ['cupons', '/cupons', 'Cupons'], ['ate50', '/ofertas?ate=50', 'Até R$ 50'], ['amazon', '/ofertas?loja=amazon', 'Amazon'], ['ml', '/ofertas?loja=ml', 'Mercado Livre'], ['categorias', '/categorias', 'Categorias'], ['grupos', '/grupos', 'Grupo VIP']];
  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#0e0e11">
<link rel="icon" type="image/png" sizes="64x64" href="/favicon.png"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"><link rel="apple-touch-icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@800;900&display=swap" rel="stylesheet">
${head}
<style>${CSS}</style></head><body>
${g ? `<div class="top"><div class="in"><span>🎩 Ofertas de magnata<span class="long"> direto</span> no seu WhatsApp<span class="long"> — grátis</span></span><a href="${esc(g)}" rel="nofollow">Entrar no grupo</a></div></div>` : ''}
<header><div class="in">
  ${logo}
  <form class="search" action="/ofertas" role="search"><input name="q" value="${esc(q)}" placeholder="Buscar ofertas: tênis, air fryer, iPhone..." aria-label="Buscar ofertas"><button aria-label="Buscar">🔎</button></form>
</div>
<nav class="main"><div class="in">${nav.map(([k, h, t]) => `<a href="${h}" class="${active === k ? 'on' : ''}">${t}</a>`).join('')}</div></nav>
</header>
<main>${body}</main>
<footer><div class="in">
  ${logo}
  <div>As melhores ofertas e cupons da Amazon e do Mercado Livre, selecionados a dedo o dia todo. A compra é feita direto na loja oficial.</div>
  <div>Preços e disponibilidade podem mudar a qualquer momento na loja. Como participantes de programas de afiliados, podemos receber comissão pelas compras qualificadas, sem custo extra para você.</div>
  <div>${INSTAGRAM() ? `<a href="${esc(INSTAGRAM())}">Instagram</a> · ` : ''}${g ? `<a href="${esc(g)}">Grupo de WhatsApp</a> · ` : ''}<a href="/ofertas">Ofertas</a> · <a href="/categorias">Categorias</a> · <a href="/cupons">Cupons</a></div>
  <div>© ${new Date().getFullYear()} ${esc(site)}</div>
</div></footer>
</body></html>`;
}

// Condições da oferta (vêm da mensagem que foi pro grupo + campo de cupom)
const NOT_CODE = /^(EXCLUSIV[OA]S?|MELI|DESCONTO|APLICADO|ATIVO|SELECIONE|PIX)$/i;
export function dealInfo(o) {
  const msg = String(o.message || '');
  const coupons = String(o.coupon || '').split(',').map((g) => g.split('+').map((c) => c.trim()).filter((c) => c && !NOT_CODE.test(c)).join(' + ')).filter(Boolean);
  return {
    coupons, // cada item é um cupom, ou uma combinação "A + B" (usar juntos); itens diferentes são alternativas
    pix: /\* no Pix|selecione \*Pix\*/i.test(msg),
    meliPlus: /Meli\+/i.test(msg),
    prime: /exclusiva Prime/i.test(msg),
    checkout: /finaliza[çc][ãa]o da compra/i.test(msg),
  };
}
export const couponText = (list) => list.join(' ou ');

export function card(o) {
  const p = o.products || {};
  const d = dealInfo(o);
  const off = o.discount_pct ? `<span class="off">-${o.discount_pct}%</span>` : '';
  const hot = Number(o.discount_pct) >= 50 ? '<span class="hot">🔥 IMPERDÍVEL</span>' : '';
  const saved = o.old_price && Number(o.old_price) > Number(o.price) ? Number(o.old_price) - Number(o.price) : 0;
  return `<a class="card" href="/p/${codeOf(o.id)}">
  <div class="ph">${p.image ? `<img loading="lazy" src="${esc(img(p.image))}" alt="${esc(p.title)}">` : ''}${off}${hot}</div>
  <div class="bd">
  <div class="st"><span class="store ${p.store === 'amazon' ? 'amazon' : 'ml'}">${storeName(p.store)}</span><span>${o.sent_at ? ago(o.sent_at) : ''}</span></div>
  <div class="t">${esc(p.title)}</div>
  <div class="o">${saved ? brl(o.old_price) : ''}</div>
  <div class="p">${brl(o.price)}${d.pix ? '<small> no Pix</small>' : ''}</div>
  <div class="sv">${saved ? `Economize ${brl(saved)}` : ''}</div>
  ${d.coupons.length ? `<span class="cp">🎟️ ${d.coupons.some((c) => c.includes('+')) ? 'Cupons' : 'Cupom'}: ${esc(couponText(d.coupons))}</span>` : ''}
  ${d.pix || d.meliPlus || d.prime ? `<div class="tags">${d.prime ? '<span class="tg prime">👑 Só Prime</span>' : ''}${d.meliPlus ? '<span class="tg meli">⭐ Só Meli+</span>' : ''}${d.pix ? '<span class="tg pix">💠 Pagando no Pix</span>' : ''}</div>` : ''}
  <div class="go"><span>Ver oferta</span></div>
  </div>
</a>`;
}

export const joinBox = () =>
  GROUP()
    ? `<div class="join">${hatImg(86)}<div><h3>Entre para o clube dos magnatas</h3><p>Receba no WhatsApp só as ofertas que valem a pena, assim que elas aparecem. Grátis, sem spam, e você sai quando quiser.</p></div><a class="btn wa" href="${esc(GROUP())}" rel="nofollow">Entrar no grupo grátis</a></div>`
    : '';

export const trustRow = () => `<div class="trust">
<div><b>🎩 Curadoria de magnata</b><span>Ofertas selecionadas pelo desconto real e pelo que vale a pena comprar.</span></div>
<div><b>🛡️ Compra na loja oficial</b><span>Você finaliza direto na Amazon ou no Mercado Livre, com a garantia deles.</span></div>
<div><b>⚡ Atualizado o dia todo</b><span>Novas promoções a cada poucos minutos. Corra: o preço pode mudar.</span></div>
</div>`;

export const catsGrid = (list = CATEGORIES) =>
  `<div class="cats">${list.map((c) => `<a class="cat" href="/categoria/${c.slug}"><i>${c.icon}</i>${esc(c.name)}</a>`).join('')}</div>`;
