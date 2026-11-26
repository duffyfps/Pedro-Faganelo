// Lê a prévia pública de um canal do Telegram (t.me/s/<canal>) — sem login, sem conta
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
export function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}

export function htmlToText(html) {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseChannel(html) {
  const posts = [];
  const chunks = html.split(/(?=<div class="tgme_widget_message_wrap)/);
  for (const c of chunks) {
    const postRef = c.match(/data-post="([^"]+)\/(\d+)"/);
    if (!postRef) continue;
    const textHtml = c.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] || '';
    const hrefs = [...textHtml.matchAll(/href="([^"]+)"/g)].map((m) => decode(m[1]));
    const text = htmlToText(textHtml);
    const inline = text.match(/https?:\/\/[^\s<>"')]+/g) || [];
    posts.push({
      channel: postRef[1],
      id: Number(postRef[2]),
      text,
      links: [...new Set([...hrefs, ...inline])].filter((u) => /^https?:\/\//.test(u)),
      date: c.match(/<time[^>]+datetime="([^"]+)"/)?.[1] || null,
      image: decode(c.match(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/)?.[1] || '') || null,
    });
  }
  return posts.sort((a, b) => a.id - b.id);
}

export async function fetchChannel(channel) {
  const res = await fetch(`https://t.me/s/${encodeURIComponent(channel)}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
  });
  if (!res.ok) throw new Error(`Telegram ${channel}: ${res.status}`);
  return parseChannel(await res.text());
}

// Classifica links de loja
export function storeOf(u) {
  if (/(^|\/\/|\.)(link\.amazon|amzn\.to|amzn\.com|a\.co|amazon\.com\.br)\//i.test(u)) return 'amazon';
  if (/(^|\/\/|\.)(meli\.la|mercadolivre\.com\.br|mercadolibre\.com|mlstatic\.com)\//i.test(u)) return 'ml';
  return null;
}

// Segue redirecionamentos um a um (sem baixar páginas) e devolve a cadeia de URLs
export async function followRedirects(u, max = 6) {
  const chain = [u];
  let cur = u;
  for (let i = 0; i < max; i++) {
    let res;
    try {
      res = await fetch(cur, { redirect: 'manual', headers: { 'User-Agent': UA } });
    } catch {
      break;
    }
    const loc = res.headers.get('location');
    if (!loc || res.status < 300 || res.status >= 400) break;
    cur = new URL(loc, cur).toString();
    chain.push(cur);
  }
  return chain;
}

// Extrai dados úteis do texto do post
// Chamada do post (ex.: "CHEGA DE ANDAR COM MEIA FURADA"). Só usamos se não entregar a origem
// nem falar de forma de pagamento.
const HOOK_BLOCK = /xet|telegram|canal|https?:|@|\blink\b|bio\b|chat\b|pix|cart[ãa]o|mercado pago|pagamento|pagando|parcel|boleto|esgotad|eu (uso|amo|recomendo)/i;
export function cleanHook(line, title = '') {
  if (!line || /R\$\s*\d/.test(line)) return null;
  let h = line.split(/,\s*(?=(?:[^,]*)(?:pagando|cupom exclusivo|cart[ãa]o|pix|parcel))/i)[0].trim(); // corta ", pagando com Cartão..."
  h = h.replace(/[\s,;:–-]+$/, '').trim();
  if (h.replace(/[^\p{L}\p{N}]/gu, '').length < 6 || h.length > 70) return null;
  if (HOOK_BLOCK.test(h)) return null;
  if (title && h.toLowerCase() === String(title).toLowerCase()) return null;
  return h;
}

export function parsePostText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const money = (s) => Number(s.replace(/\./g, '').replace(',', '.'));
  const por = text.match(/por\s*:?\s*R\$\s*([\d.]+(?:,\d{1,2})?)/i) || text.match(/R\$\s*([\d.]+(?:,\d{1,2})?)(?![\s\S]*R\$)/);
  const de = text.match(/de\s*:?\s*R\$\s*([\d.]+(?:,\d{1,2})?)/i);
  // Código do cupom vem em MAIÚSCULAS no post ("Use o Cupom: MELIXF9"); "cupom exclusivo meli+" não é código.
  const NOT_CODE = /^(EXCLUSIV[OA]S?|MELI|DESCONTO|DESCONTOS|APLICADO|ATIVO|ATIVADO|NO|NA|DE|DA|DO|PARA|PRA|LIMITADO|ABAIXO|ACIMA|AUTOMATICO|AUTOMÁTICO|NOVO|DISPONIVEL|DISPONÍVEL|VALIDO|VÁLIDO|SELECIONE|PIX)$/;
  // "cupom: 15IMPERDIVEL + SAMSUNG100" = usar os dois juntos (fica "A + B"); menções separadas = alternativas ("A ou B")
  const CODE = /^[A-Z0-9][A-Z0-9_-]{3,}$/;
  const coupons = [...text.matchAll(/[Cc][Uu][Pp][Oo][MmNn][Ss]?\s*:?\s*([A-Z0-9][A-Z0-9_-]{3,}(?:\s*\+\s*[A-Z0-9][A-Z0-9_-]{3,})*)(?![a-z])/g)]
    .map((m) => m[1].split(/\s*\+\s*/).filter((c) => CODE.test(c) && !NOT_CODE.test(c)).join(' + '))
    .filter(Boolean);
  // Preço só vale no Pix ("por R$ 597 no Pix", "Selecione Pix") — aí a mensagem precisa avisar
  const pix = /selecion\w*\s+(o\s+)?pix|R\$\s*[\d.,]+\s*(no|via|pagando no|pagando com)\s+pix|(no|via)\s+pix\b/i.test(text);
  // Cupom exclusivo para assinantes Meli+
  const meliPlus = /meli\s*\+|meli\s*plus|mercado\s*livre\s*\+/i.test(text);
  // Oferta só para assinantes Prime
  const prime = /exclusiv\w*\s+(para\s+)?(membros\s+|assinantes\s+|clientes\s+)?prime|s[óo]\s+(para\s+)?prime|somente\s+(para\s+)?prime|apenas\s+(para\s+)?prime|prime\s+exclusiv/i.test(text);
  // Desconto que só aparece no fim da compra
  const checkout = /desconto\s+(aparece\s+|aplicado\s+|s[óo]\s+)?(na|no)\s+(finaliza|carrinho|checkout|fechamento)/i.test(text);
  // Observações úteis (frete, loja oficial...). Forma de pagamento (Pix, parcelas) fica de fora.
  const extras = lines.filter(
    (l) =>
      /frete|vendido por|loja oficial|cashback|primeira compra/i.test(l) &&
      !/https?:\/\/|R\$|pix|pagamento|parcel|\d+x\b|cart[ãa]o|boleto/i.test(l)
  );
  const candidates = lines.filter(
    (l) =>
      !/https?:\/\/|R\$|cupo[mn]|vendido|loja oficial|pix|aba an[ôo]nima|golpe|privado/i.test(l) &&
      l.replace(/[^\p{L}\p{N}]/gu, '').length >= 6 &&
      l !== l.toUpperCase() // cabeçalhos em CAIXA ALTA ficam de fora
  );
  // Formato do canal: CHAMADA EM CAIXA ALTA / nome do produto / "De R$ X por R$ Y".
  // O nome do produto é a linha logo antes da primeira linha de preço.
  const isNoise = (l) => /https?:\/\/|cupo[mn]|selecione|vendido|loja oficial|programe e poupe|aba an[ôo]nima/i.test(l);
  const priceIdx = lines.findIndex((l) => /R\$\s*\d/.test(l));
  let title = null;
  for (let i = priceIdx - 1; i >= 0 && !title; i--) {
    const l = lines[i];
    if (isNoise(l) || l.replace(/[^\p{L}\p{N}]/gu, '').length < 4) continue;
    if (/^\s*[-•*▪▫◦·➖➡️✔️✅]/u.test(l)) continue; // itens de um kit ("- Shampoo 250ml") não são o nome do produto
    if (i === 0 && l === l.toUpperCase() && priceIdx > 1) continue; // é a chamada, não o produto
    title = l;
  }
  if (!title) title = candidates.sort((a, b) => b.length - a.length)[0] || lines[0] || null;
  return {
    hook: cleanHook(priceIdx > 1 ? lines[0] : null, title),
    price: por ? money(por[1]) : null,
    listPrice: de ? money(de[1]) : null,
    title: title ? title.replace(/^[^\p{L}\p{N}]+/u, '') : null,
    coupons: [...new Set(coupons)],
    pix,
    meliPlus,
    prime,
    checkout,
    extras: extras.slice(0, 3),
  };
}
