import { db } from './db.js';

export const LINK_PLACEHOLDER = '[COLE SEU LINK AQUI]';

const brl = (n) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ');
const DAY = 86400000;

// Categorias que costumam ser falsificadas: nelas vale avisar que é loja oficial (produto original)
const FAKE_PRONE = new RegExp(
  [
    // calçados e roupas de marca
    't[êe]nis', 'chuteira', 'sapat', 'bota\\b', 'sand[áa]lia', 'chinelo', 'havaianas', 'crocs',
    'camis[ae]', 'camiseta', 'jaqueta', 'moletom', 'bon[ée]\\b', 'bermuda', 'cal[çc]a\\b', 'meia',
    'nike', 'adidas', 'puma', 'new balance', 'asics', 'mizuno', 'vans\\b', 'converse', 'olympikus', 'fila\\b',
    'lacoste', 'tommy', 'calvin klein', 'ralph lauren', 'polo\\b', 'oakley', 'ray-?ban', 'reserva\\b',
    // perfumes, cosméticos, cabelo
    'perfume', 'col[ôo]nia', 'eau de', '\\bedt\\b', '\\bedp\\b', 'body splash', 'k[ée]rastase', "l'?or[ée]al",
    'wella', 'truss', 'redken', 'maquiagem', 'batom', 'rimel', 'm[áa]scara de c[íi]lios', 's[ée]rum', 'protetor solar',
    'skincare', 'hidratante', 'creme', 'la roche', 'vichy', 'cerave', 'nivea', 'natura', 'botic[áa]rio',
    // eletrônicos e acessórios
    'fone', 'airpods', 'earbuds', 'headset', 'headphone', '\\bjbl\\b', 'beats', 'carregador', 'cabo usb', 'power ?bank',
    'smartwatch', 'rel[óo]gio', 'apple watch', 'galaxy watch', 'garmin', 'iphone', 'ipad', 'galaxy', 'xiaomi', 'redmi',
    'celular', 'smartphone', '\\bssd\\b', 'pendrive', 'pen drive', 'cart[ãa]o de mem[óo]ria', 'micro ?sd', 'hd externo',
    'controle (ps|xbox|dualsense)', 'dualsense', 'joycon', 'nintendo', 'playstation',
    // outros muito copiados
    'stanley', 'lego', 'pok[ée]mon', 'whey', 'creatina', 'suplemento', '[óo]culos', 'bolsa', 'mochila', 'carteira',
  ].join('|'),
  'i'
);
export const isFakeProne = (title = '') => FAKE_PRONE.test(title);

export function composeMessage(p) {
  const store = p.store === 'amazon' ? 'Amazon' : 'Mercado Livre';
  const title = p.title.length > 100 ? p.title.slice(0, 97).trimEnd() + '…' : p.title;
  const lines = [`🔥 *${title}*`, ''];
  if (p.listPrice && p.listPrice > p.price) lines.push(`De ~${brl(p.listPrice)}~`);
  lines.push(`💰 *${brl(p.price)}*${p.discountPct ? ` (${p.discountPct}% OFF)` : ''}`);
  for (const c of p.coupons || []) lines.push(`🎟️ Cupom: *${c}*`);
  let official = false;
  for (const e of p.extras || []) {
    if (/cupo[mn]|pix|pagamento/i.test(e)) continue;
    // "Loja oficial" / "Vendido por" só aparece quando o produto costuma ser falsificado
    if (/loja oficial|vendido por/i.test(e)) { official = official || /oficial/i.test(e); continue; }
    lines.push(`ℹ️ ${e.replace(/^[^\p{L}\p{N}]+/u, '')}`);
  }
  if (official && isFakeProne(p.title)) lines.push('✅ Vendido pela *loja oficial* — produto original');
  if (p.dealType === 'LIGHTNING_DEAL') lines.push('⚡ Oferta relâmpago — acaba rápido!');
  else if (p.dealType) lines.push('🏷️ Oferta por tempo limitado');
  if (p.lowest30d) lines.push('📉 Menor preço dos últimos 30 dias');
  lines.push('', `🛒 ${store}: ${p.url || LINK_PLACEHOLDER}`, '', '_Preço e estoque podem mudar a qualquer momento._');
  return lines.join('\n');
}

// Registra produto + preço; decide se vira oferta na fila. Retorna a oferta criada ou null.
export async function processProduct(p, { force = false, source = null } = {}) {
  await db.upsert('products', [
    {
      id: p.id,
      store: p.store,
      title: p.title,
      image: p.image || null,
      url: p.url || p.openUrl || null,
      updated_at: new Date().toISOString(),
    },
  ]);

  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const hist = await db.select(
    'price_history',
    `product_id=eq.${encodeURIComponent(p.id)}&seen_at=gte.${since}&select=price&order=seen_at.desc&limit=500`
  );
  await db.insert('price_history', [{ product_id: p.id, price: p.price, list_price: p.listPrice || null }]);

  const prices = hist.map((h) => Number(h.price));
  const min30 = prices.length ? Math.min(...prices) : null;
  p.lowest30d = prices.length >= 3 && p.price < min30;

  if (!p.discountPct && p.listPrice && p.listPrice > p.price)
    p.discountPct = Math.round((1 - p.price / p.listPrice) * 100);

  if (!force) {
    // Evita repetir: já na fila, ou postado/recusado recentemente sem queda de preço relevante
    const recent = await db.select(
      'offers',
      `product_id=eq.${encodeURIComponent(p.id)}&created_at=gte.${new Date(Date.now() - 7 * DAY).toISOString()}&select=status,price,created_at&order=created_at.desc`
    );
    if (recent.some((o) => o.status === 'pending')) return null;
    const last = recent[0];
    if (last && p.price > Number(last.price) * 0.95) return null;
  }

  const score =
    (p.discountPct || 0) + (p.lowest30d ? 20 : 0) + (p.dealType === 'LIGHTNING_DEAL' ? 15 : p.dealType ? 8 : 0);

  const row = {
    product_id: p.id,
    price: p.price,
    old_price: p.listPrice || null,
    discount_pct: p.discountPct || null,
    lowest_30d: p.lowest30d,
    deal_type: p.dealType || null,
    deal_end: p.dealEnd || null,
    score,
    message: composeMessage(p),
  };
  if (source) {
    row.source = source;
    row.coupon = (p.coupons || []).join(', ') || null;
    row.needs_link = !p.url;
  }
  const [offer] = await db.insert('offers', [row]);
  return offer;
}
