// Link curto oficial da Amazon (link.amazon / amzn.to), o mesmo do botão "Obter link" do SiteStripe.
// Usa a sua sessão logada da Amazon (AMAZON_COOKIE), renovada automaticamente (lib/cookies.js).
// Se falhar, devolve null e o sistema usa o link normal com a sua tag — nenhuma oferta sai sem link.
import { getCookie, absorb } from './cookies.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

export async function shortAmazon(asin) {
  const env = process.env.AMAZON_COOKIE || '';
  const tag = (process.env.AMAZON_TAG || '').trim();
  if (!env.trim() || !tag || !asin) return { url: null, why: 'sem AMAZON_COOKIE' };
  const cookie = await getCookie('amazon', env);
  const longUrl = `https://www.amazon.com.br/dp/${asin}`;
  const api =
    'https://www.amazon.com.br/associates/sitestripe/getShortUrl' +
    `?longUrl=${encodeURIComponent(longUrl)}&marketplaceId=526970&storeId=${encodeURIComponent(tag)}`;
  try {
    const res = await fetch(api, {
      headers: { Cookie: cookie, 'User-Agent': UA, Accept: 'application/json, text/plain, */*', Referer: longUrl },
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    const url = data?.shortUrl;
    if (res.ok && typeof url === 'string' && /^https:\/\/(link\.amazon|amzn\.to)\//.test(url)) {
      await absorb('amazon', env, cookie, res); // guarda a sessão renovada
      return { url, why: 'ok' };
    }
    return { url: null, why: `Amazon ${res.status}${data ? '' : ' (sessão expirada?)'}` };
  } catch (e) {
    return { url: null, why: `erro ${e.name}` };
  }
}
