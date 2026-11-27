// Marca do site: o mesmo código serve o Magnata e o Baratinho Diário.
// Cada projeto na Vercel escolhe com a variável BRAND (padrão: magnata).
const BRANDS = {
  magnata: {
    key: 'magnata',
    name: 'Magnata Promoções',
    logo: '/logo.webp', logoW: 150, logoH: 75,
    mark: '/logo-marca.webp', // logo transparente da prévia do WhatsApp
    markScale: 0.3, // tamanho da logo na prévia (fração do lado menor da foto)
    markShadow: false, // logo limpa, sem a sombra escura atrás
    msgStyle: 'magnata',
    icon: '/cartola.webp', // desenho grande (topo) e reserva quando falta foto
    favicon: '/favicon.png', favicon32: '/favicon-32.png',
    theme: '#0e0e11',
    emoji: '🎩',
    top: 'Ofertas de magnata<span class="long"> direto</span> no seu WhatsApp<span class="long"> — grátis</span>',
    heroH1: 'Pague pouco.<br>Compre como um <em>magnata</em>.',
    heroP: 'Caçamos as melhores ofertas e cupons da Amazon e do Mercado Livre o dia todo e só mostramos o que vale a pena.',
    topDeals: 'Descontos de magnata',
    joinTitle: 'Entre para o clube dos magnatas',
    trust: 'Curadoria de magnata',
    groupsH1: 'As ofertas de magnata <em>no seu WhatsApp</em>',
    femLink: true, // mostra o "Grupo feminino" no menu
    css: '',
  },
  baratinho: {
    key: 'baratinho',
    name: 'Baratinho Diário',
    logo: '/baratinho-logo.webp', logoW: 137, logoH: 65,
    mark: '/baratinho-logo.webp',
    markScale: 0.2, // logo larga: menor na prévia
    markShadow: false, // logo rosa fica limpa, sem a sombra escura
    msgStyle: 'baratinho', // 🆘 chamada! produto / 💰 de… por… / 🎟️ Use o cupom / 🛍️ link
    icon: '/baratinho-laco.webp',
    favicon: '/baratinho-favicon.png', favicon32: '/baratinho-favicon-32.png',
    theme: '#ff1f7a',
    emoji: '🎀',
    top: 'Achadinhos todo dia<span class="long"> direto</span> no seu WhatsApp<span class="long"> — grátis</span>',
    heroH1: 'Achadinhos lindos,<br>preços <em>baratinhos</em>.',
    heroP: 'Garimpamos todo dia as melhores ofertas e cupons de beleza, moda, casa e muito mais na Amazon e no Mercado Livre, e só mostramos o que vale a pena.',
    topDeals: 'Descontos imperdíveis',
    joinTitle: 'Entre no grupo do Baratinho',
    trust: 'Curadoria com carinho',
    groupsH1: 'Os achadinhos do Baratinho <em>no seu WhatsApp</em>',
    femLink: false,
    css: `:root{--ink:#4a0f2b;--ink2:#fff;--bg:#fff6fa;--line:#ffd6e7;--red:#ff1f7a;--red2:#d40f62;--gold:#ff8fbf;--gold2:#ffd1e5;--muted:#8a5a6f}
.top{background:#ff1f7a}
header{background:#fff;box-shadow:0 1px 0 #ffd6e7}
.search{border:1.5px solid #ffc2da}.search button{background:#ff1f7a;color:#fff}
nav.main{background:#fff;border-top:1px solid #ffe3ef;border-bottom:1px solid #ffe3ef}
nav.main a{color:#8a3a5c}nav.main a.on,nav.main a:hover{color:#ff1f7a;border-bottom-color:#ff1f7a}
.hero{background:radial-gradient(900px 380px at 50% -20%,#fff 0,transparent 65%),linear-gradient(165deg,#fff6fa,#ffe1ee 55%,#ffc9df);color:#4a0f2b;border:1px solid #ffd0e3}
.hero .bighat{filter:drop-shadow(0 14px 30px rgba(163,18,79,.25))}
.hero .kick{background:#fff;border-color:#ffc2da;color:#ff1f7a}
.hero h1 em{color:#ff1f7a}.hero p{color:#7d3b58}
.stats{border-top-color:#ffc2da}.stats div b{color:#a3124f}.stats div span{color:#9a6a7f}
.btn.ghost{color:#a3124f;border-color:#ff9cc4}
.btn.red{box-shadow:0 6px 18px rgba(255,31,122,.35)}
.chip.on{background:#ff1f7a;border-color:#ff1f7a}
.card .hot{background:#ffe3ef;color:#c2185b}
.card .cp{color:#a3124f;background:#fff0f6;border-color:#ff8fbf}
.card .ph{border-bottom-color:#ffeef5}
.cat i{background:#ffe8f1}
.join{background:linear-gradient(135deg,#ff2d86,#a3124f)}.join p{color:#ffe1ee}
footer{background:#4a0f2b;color:#f3c6d8}footer a{color:#fff}`,
  },
};

export const brand = () => BRANDS[(process.env.BRAND || 'magnata').trim().toLowerCase()] || BRANDS.magnata;
