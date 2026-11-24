// Mercado Livre: descobre o produto do link do concorrente e gera o SEU meli.la
// (o mesmo do botão "Compartilhar" da barra de afiliados). Usa a sua sessão do ML (ML_COOKIE).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const BASE = 'https://www.mercadolivre.com.br';

const cookie = () => (process.env.ML_COOKIE || '').trim();
const tag = () => (process.env.ML_MATT_WORD || '').trim();

async function getPage(url) {
  const res = await fetch(url, {
    headers: { Cookie: cookie(), 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'pt-BR,pt;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  });
  return { status: res.status, url: res.url, html: await res.text() };
}

// Primeiro produto da página (no perfil social do concorrente, é a oferta em destaque do post)
export function featuredProduct(html) {
  const m =
    html.match(/https:\/\/www\.mercadolivre\.com\.br\/[^"'\s?#]+\/p\/MLB\d+/) ||
    html.match(/https:\/\/www\.mercadolivre\.com\.br\/[^"'\s?#]+\/up\/MLBU\d+/) ||
    html.match(/https:\/\/(?:produto|www)\.mercadolivre\.com\.br\/MLB-\d+[^"'\s?#]*/);
  return m ? m[0] : null;
}

export async function resolveCompetitorLink(url) {
  if (!cookie()) return { product: null, why: 'sem ML_COOKIE' };
  try {
    const page = await getPage(url);
    if (/account-verification|\/login|registration/.test(page.url)) return { product: null, why: 'ML pediu verificação' };
    const product = featuredProduct(page.html);
    return { product, why: product ? 'ok' : `produto não encontrado (${page.status})` };
  } catch (e) {
    return { product: null, why: `erro ${e.name}` };
  }
}

export async function createMlLink(productUrl) {
  if (!cookie() || !tag()) return { url: null, why: 'sem ML_COOKIE' };
  try {
    const page = await getPage(productUrl);
    if (/account-verification|\/login|registration/.test(page.url)) return { url: null, why: 'ML 401 (pediu login/verificação)' };
    const csrf = page.html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)/)?.[1];
    if (!csrf) return { url: null, why: `ML ${page.status} (sessão expirada?)` };
    const res = await fetch(`${BASE}/affiliate-program/api/v2/stripe/user/links`, {
      method: 'POST',
      headers: {
        Cookie: cookie(),
        'User-Agent': UA,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-csrf-token': csrf,
        Origin: BASE,
        Referer: productUrl,
      },
      body: JSON.stringify({ url: productUrl, tag: tag() }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && /^https:\/\/meli\.la\//.test(data.short_url || '')) return { url: data.short_url, why: 'ok' };
    return { url: null, why: `ML ${res.status} ${data.error || ''}`.trim() };
  } catch (e) {
    return { url: null, why: `erro ${e.name}` };
  }
}
