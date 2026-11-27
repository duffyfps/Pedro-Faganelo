// Mercado Livre: descobre o produto do link do concorrente e gera o SEU meli.la
// (o mesmo do botão "Compartilhar" da barra de afiliados). Usa a sua sessão do ML (ML_COOKIE).
import { getCookie, absorb } from './cookies.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const BASE = 'https://www.mercadolivre.com.br';

const envCookie = () => (process.env.ML_COOKIE || '').trim();
let current = null; // sessão em uso nesta execução (renovada)
const cookie = () => current || envCookie();
async function loadCookie() {
  if (!envCookie()) return '';
  current = await getCookie('ml', envCookie());
  return current;
}
async function keep(res) {
  if (envCookie()) current = await absorb('ml', envCookie(), cookie(), res);
}
const tag = () => (process.env.ML_MATT_WORD || '').trim();

async function getPage(url) {
  const res = await fetch(url, {
    headers: { Cookie: cookie(), 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'pt-BR,pt;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  });
  await keep(res);
  return { status: res.status, url: res.url, html: await res.text() };
}

// Produto em destaque do post no perfil social do concorrente.
// 1º: o card marcado como "card-featured" (é o produto do post).
// 2º (reserva): o PRIMEIRO link de produto da página, pela posição — nunca "o primeiro /p/ em qualquer lugar",
//    porque o resto da página são recomendações de outros produtos.
export function featuredProduct(html) {
  const h = String(html || '').split('\\u002F').join('/').split('\\"').join('"');
  const mark = h.indexOf('c_id=/home/card-featured');
  if (mark > 0) {
    const start = h.lastIndexOf('"metadata":{', mark);
    if (start >= 0 && mark - start < 6000) {
      const blk = h.slice(start, mark);
      const url = blk.match(/"url":"([^"]+)"/)?.[1];
      const id = blk.match(/"id":"(MLB\d+)"/)?.[1];
      if (url) {
        const u = 'https://' + url.replace(/^https?:\/\//, '').split(/[?#]/)[0];
        if (/\/up\/MLBU\d+/i.test(u)) return id ? `${u}?pdp_filters=item_id%3A${id}` : u;
        if (/\/p\/MLB\d+|\/MLB-\d+/i.test(u)) return u;
      }
    }
  }
  const re = /https:\/\/(?:www|produto)\.mercadolivre\.com\.br\/(?:[^"'\s?#]+\/p\/MLB\d+|[^"'\s?#]+\/up\/MLBU\d+([^"'\s#]*)|MLB-\d+[^"'\s?#]*)/;
  const m = h.match(re);
  if (!m) return null;
  const up = m[0].match(/^(.*\/up\/MLBU\d+)/);
  if (up) {
    const item = decodeURIComponent(m[1] || '').match(/item_id[:=](MLB\d+)/i)?.[1];
    return item ? `${up[1]}?pdp_filters=item_id%3A${item}` : up[1];
  }
  return m[0];
}

// Confere se o produto da página é o mesmo do post (evita mandar link de outro produto)
const STOP = new Set(['com', 'para', 'kit', 'por', 'sem', 'the', 'and', 'cores', 'cor', 'original', 'unidades', 'unidade', 'pecas', 'ao', 'de', 'do', 'da']);
const words = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/(\d)([a-z])/g, '$1 $2').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
  .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w))
  .map((w) => w.replace(/s$/, ''));
// iguais, ou quase (erro de digitação / plural): "rabane" ~ "rabanne"
function near(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}
export function sameProduct(postTitle, pageTitle) {
  const a = [...new Set(words(postTitle))]; const b = [...new Set(words(pageTitle))];
  if (!a.length || !b.length) return true; // sem dado para comparar: não bloqueia
  const hit = a.filter((w) => b.some((x) => near(w, x))).length;
  return hit / a.length >= 0.6;
}

export async function resolveCompetitorLink(url) {
  if (!(await loadCookie())) return { product: null, why: 'sem ML_COOKIE' };
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
  if (!(await loadCookie()) || !tag()) return { url: null, why: 'sem ML_COOKIE' };
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
    await keep(res);
    const title = (page.html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/)?.[1]
      || page.html.match(/<title>([^<]+)/)?.[1] || '').replace(/\s*\|\s*Mercado Livre.*$/i, '').trim();
    const image = page.html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/)?.[1] || null;
    // Todas as fotos do anúncio (para escolher uma só com o produto no fundo branco)
    const pics = [...(page.html.match(/"pictures"\s*:\s*\[[\s\S]{0,6000}?\]/)?.[0] || '').matchAll(/(\d{3,}-ML[A-Z]\d+_\d{4,})/g)].map((m) => m[1]);
    const any = [...page.html.matchAll(/D_NQ_NP_(?:2X_)?(\d{3,}-ML[A-Z]\d+_\d{4,})-/g)].map((m) => m[1]);
    const images = [...new Set(pics.length ? pics : any)].slice(0, 8).map((id) => `https://http2.mlstatic.com/D_NQ_NP_2X_${id}-F.jpg`);
    if (res.ok && /^https:\/\/meli\.la\//.test(data.short_url || '')) return { url: data.short_url, why: 'ok', title, image, images };
    return { url: null, why: `ML ${res.status} ${data.error || ''}`.trim() };
  } catch (e) {
    return { url: null, why: `erro ${e.name}` };
  }
}

// Confere se o anúncio ainda está no ar. 'off' = pausado/finalizado; 'ok' = no ar; 'unknown' = não deu para ver (não mexe)
export async function mlListingStatus(id, debug = null) {
  if (!(await loadCookie())) return 'unknown';
  const raw = String(id).replace(/^ml:/, '');
  const urls = /^MLBU/i.test(raw)
    ? [`${BASE}/up/${raw}`]
    : [`https://produto.mercadolivre.com.br/${raw.replace(/^MLB/i, 'MLB-')}`, `${BASE}/p/${raw}`];
  for (const u of urls) {
    try {
      const { status, html } = await getPage(u);
      if (debug) debug.push({ u, status, len: html.length, title: (html.match(/<title>([^<]{0,80})/) || [])[1], pdp: html.includes('ui-pdp'), oos: /OutOfStock/.test(html), paused: /"status":"paused"/.test(html) });
      if (status === 404) continue;
      if (!/ui-pdp|"status":"/.test(html)) return 'unknown'; // tela de segurança/bloqueio
      if (/"status":"(paused|closed|inactive)"/.test(html) || /An[uú]ncio (pausado|finalizado)|Publica[cç][aã]o (pausada|finalizada)/i.test(html)) return 'off';
      if (/schema\.org(\\u002F|\/)OutOfStock/.test(html)) return 'off'; // esgotado
      return 'ok';
    } catch {
      return 'unknown';
    }
  }
  return 'unknown';
}

// Pelo SEU meli.la (o servidor consegue abrir o perfil social, mas não a página do produto):
// anúncio no ar → perfil com o produto em destaque (card-featured); pausado/esgotado → o ML manda para /lists.
// Foto do produto pelo link meli.la (perfil social com o produto em destaque) — reserva quando o post veio sem foto
export async function mlLinkImage(link) {
  if (!/^https:\/\/(meli\.la\/|www\.mercadolivre\.com\.br\/social\/)/.test(String(link || ''))) return null;
  try {
    await loadCookie();
    const { status, html } = await getPage(link);
    if (status !== 200) return null;
    const feat = html.indexOf('card-featured');
    const zone = feat >= 0 ? html.slice(feat, feat + 8000) : '';
    const m = zone.match(/https:\/\/http2\.mlstatic\.com\/D_[A-Za-z0-9_\-]+\.(?:jpe?g|webp|png)/);
    if (m) return m[0].replace(/-[A-Z]\.(webp|jpe?g|png)$/, '-F.$1'); // versão grande (1000px) em vez da miniatura
    const og = html.match(/property=["']og:image["'][^>]+content=["']([^"']+)/)?.[1] || '';
    return /mlstatic\.com\/D_/.test(og) ? og.replace(/-[A-Z]\.(webp|jpe?g|png)$/, '-F.$1') : null;
  } catch {
    return null;
  }
}

export async function mlLinkStatus(link, debug = null) {
  if (!/^https:\/\/meli\.la\//.test(String(link || '')) || !(await loadCookie())) return 'unknown';
  try {
    const { status, url, html } = await getPage(link);
    const feat = html.indexOf('card-featured');
    if (debug) debug.push({ status, url: String(url).slice(0, 90), len: html.length, featured: feat >= 0 });
    if (status !== 200) return 'unknown';
    if (feat >= 0) {
      const card = html.slice(Math.max(0, feat - 3000), feat + 3000);
      return /An[uú]ncio pausado|"paused"|Esgotado|sem estoque/i.test(card) ? 'off' : 'ok';
    }
    if (/\/social\/[^/?#]+\/lists/.test(url)) return 'off';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
