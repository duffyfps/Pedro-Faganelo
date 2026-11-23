// Amazon Creators API (Brasil = região NA, credencial versão 3.1)
const TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const API = 'https://creatorsapi.amazon/catalog/v1';
const MARKETPLACE = 'www.amazon.com.br';

let cached = { token: null, exp: 0 };

async function token() {
  if (cached.token && Date.now() < cached.exp) return cached.token;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.AMAZON_CLIENT_ID,
      client_secret: process.env.AMAZON_CLIENT_SECRET,
      scope: 'creatorsapi::default',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`Amazon token: ${res.status} ${JSON.stringify(data)}`);
  cached = { token: data.access_token, exp: Date.now() + (data.expires_in - 120) * 1000 };
  return cached.token;
}

const RESOURCES = [
  'itemInfo.title',
  'images.primary.large',
  'offersV2.listings.price',
  'offersV2.listings.availability',
  'offersV2.listings.dealDetails',
  'offersV2.listings.isBuyBoxWinner',
  'offersV2.listings.merchantInfo',
  'offersV2.listings.type',
];

async function post(op, body) {
  const res = await fetch(`${API}/${op}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await token()}`,
      'Content-Type': 'application/json',
      'x-marketplace': MARKETPLACE,
    },
    body: JSON.stringify({ partnerTag: process.env.AMAZON_TAG, marketplace: MARKETPLACE, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Amazon ${op}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

// Converte o item da API num formato simples
export function normalize(item) {
  const listings = item?.offersV2?.listings || [];
  const l = listings.find((x) => x.isBuyBoxWinner) || listings[0];
  const price = l?.price?.money?.amount;
  if (!price) return null;
  if (l?.availability?.type && l.availability.type !== 'IN_STOCK') return null;
  const img = item.images?.primary;
  return {
    id: `amz:${item.asin}`,
    store: 'amazon',
    title: item.itemInfo?.title?.displayValue || item.asin,
    image: img?.large?.url || img?.medium?.url || img?.small?.url || null,
    url: item.detailPageURL || `https://www.amazon.com.br/dp/${item.asin}?tag=${process.env.AMAZON_TAG}`,
    price: Number(price),
    listPrice: l?.price?.savingBasis?.money?.amount ? Number(l.price.savingBasis.money.amount) : null,
    discountPct: l?.price?.savings?.percentage ?? null,
    dealType: l?.type && l.type !== 'NONE' ? l.type : (l?.dealDetails ? 'DEAL' : null),
    dealEnd: l?.dealDetails?.endTime || null,
    merchant: l?.merchantInfo?.name || null,
  };
}

export async function searchItems(s, page = 1) {
  const body = {
    itemCount: 10,
    itemPage: page,
    searchIndex: s.search_index || 'All',
    minSavingPercent: s.min_saving_pct || undefined,
    minPrice: s.min_price_brl ? s.min_price_brl * 100 : undefined,
    maxPrice: s.max_price_brl ? s.max_price_brl * 100 : undefined,
    condition: 'New',
    resources: RESOURCES,
  };
  if (s.keywords) body.keywords = s.keywords;
  if (s.browse_node_id) body.browseNodeId = s.browse_node_id;
  const data = await post('searchItems', body);
  return (data?.searchResult?.items || []).map(normalize).filter(Boolean);
}

export async function getItems(asins) {
  const data = await post('getItems', { itemIds: asins, itemIdType: 'ASIN', resources: RESOURCES });
  return (data?.itemsResult?.items || []).map(normalize).filter(Boolean);
}

// Extrai o ASIN de um link da Amazon (amazon.com.br/dp/XXXX, /gp/product/XXXX)
export function asinFromUrl(u) {
  const m = String(u).match(/(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/product\/)([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}
