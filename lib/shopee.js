// Shopee Afiliados (Open API, GraphQL): dados do produto e link curto de afiliado (s.shopee.com.br) da conta configurada.
// Precisa de SHOPEE_APP_ID e SHOPEE_APP_SECRET (painel de afiliados › Open API). Sem os dois, a Shopee fica desligada.
import { createHash } from 'node:crypto';

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';
const appId = () => (process.env.SHOPEE_APP_ID || '').trim();
const secret = () => (process.env.SHOPEE_APP_SECRET || '').trim();
export const shopeeEnabled = () => !!(appId() && secret());

// Links da Shopee: shopee.com.br, s.shopee.com.br (curto), shope.ee
export const isShopeeUrl = (u) => /(^|\/\/|\.)(shopee\.com\.br|shope\.ee)(\/|$)/i.test(String(u || ''));

// IDs do produto (loja + item) a partir de um link da Shopee
export function shopeeIds(u) {
  const s = String(u || '');
  const m =
    s.match(/-i\.(\d+)\.(\d+)/) || // .../Nome-do-produto-i.<loja>.<item>
    s.match(/\/product\/(\d+)\/(\d+)/) || // /product/<loja>/<item>
    s.match(/shopee\.com\.br\/[^/?#]+\/(\d+)\/(\d+)/); // /<nome-da-loja>/<loja>/<item>
  return m ? { shopId: m[1], itemId: m[2] } : {};
}

export async function shopeeGql(query) {
  const payload = JSON.stringify({ query });
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHash('sha256').update(`${appId()}${ts}${payload}${secret()}`).digest('hex');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `SHA256 Credential=${appId()}, Timestamp=${ts}, Signature=${sig}`,
    },
    body: payload,
    signal: AbortSignal.timeout(10000),
  });
  const j = await res.json().catch(() => ({}));
  if (j.errors?.length) throw new Error(`Shopee: ${j.errors[0].message || JSON.stringify(j.errors[0]).slice(0, 150)}`);
  if (!res.ok) throw new Error(`Shopee HTTP ${res.status}`);
  return j.data || {};
}

// Nome, foto e preço do produto (com o link de afiliado que a própria API devolve)
export async function shopeeProduct({ shopId, itemId }) {
  if (!itemId) return null;
  const args = `itemId: ${String(itemId).replace(/\D/g, '')}${shopId ? `, shopId: ${String(shopId).replace(/\D/g, '')}` : ''}, limit: 1`;
  const d = await shopeeGql(
    `{ productOfferV2(${args}){ nodes { itemId shopId productName imageUrl price priceMin priceMax priceDiscountRate offerLink productLink shopName } } }`,
  );
  const n = d.productOfferV2?.nodes?.[0];
  if (!n) return null;
  const price = Number(n.priceMin || n.price) || null;
  const rate = Number(n.priceDiscountRate) || 0; // % de desconto
  return {
    title: n.productName,
    image: n.imageUrl || null,
    price,
    listPrice: price && rate > 0 && rate < 95 ? Math.round((price / (1 - rate / 100)) * 100) / 100 : null,
    offerLink: n.offerLink || null,
    productLink: n.productLink || null,
    shopName: n.shopName || null,
  };
}

// Link curto de afiliado (s.shopee.com.br/...) para qualquer link da Shopee
export async function shopeeShortLink(originUrl, subId = 'grupo') {
  const d = await shopeeGql(
    `mutation{ generateShortLink(input: { originUrl: ${JSON.stringify(String(originUrl))}, subIds: [${JSON.stringify(String(subId))}] }){ shortLink } }`,
  );
  return d.generateShortLink?.shortLink || null;
}
