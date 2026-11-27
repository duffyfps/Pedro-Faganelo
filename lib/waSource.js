// Fonte de ofertas: grupos de WhatsApp (ex.: os grupos que o Baratinho acompanha).
// Lê as mensagens guardadas pela Evolution API e devolve no mesmo formato dos posts do Telegram:
// { id (número crescente), text, image (link permanente), links[] }.
import { keepBuffer } from './photoStore.js';
import { storeOf } from './telegram.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
// Links que não são de produto (convite de grupo, redes sociais…)
const SKIP = /chat\.whatsapp|api\.whatsapp|wa\.me|linktr\.ee|redirectmais|instagram\.com|tiktok\.com|t\.me\//i;

// Alguns grupos mandam o link do próprio site (página da oferta) e só lá dentro está o link da loja.
// A página também traz a foto do produto (og:image) — serve quando a mensagem veio só com texto.
async function resolveLanding(u) {
  try {
    const r = await fetch(u, { redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    if (storeOf(r.url)) return { store: r.url, image: null };
    const html = await r.text();
    const store = (html.match(/https?:\/\/[^"'\s<>]+/g) || []).map((x) => x.replace(/&amp;/g, '&')).find((x) => storeOf(x)) || null;
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return { store, image: og ? og[1].replace(/&amp;/g, '&') : null };
  } catch {
    return { store: null, image: null };
  }
}

const env = (k) => (process.env[k] || '').trim();
const base = () => env('EVOLUTION_URL').replace(/\/$/, '');
const inst = () => encodeURIComponent(env('SOURCE_WA_INSTANCE') || env('EVOLUTION_INSTANCE'));
const H = () => ({ apikey: env('EVOLUTION_APIKEY'), 'Content-Type': 'application/json' });

export const waGroups = () => env('SOURCE_WA_GROUPS').split(',').map((s) => s.trim()).filter(Boolean);

async function post(path, body) {
  const r = await fetch(`${base()}${path}/${inst()}`, { method: 'POST', headers: H(), body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Evolution ${path}: ${r.status}`);
  return r.json();
}

const textOf = (m) =>
  m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || '';

export async function fetchWaGroup(jid, last = null, firstRun = 5) {
  const r = await post('/chat/findMessages', { where: { key: { remoteJid: jid } }, limit: 40, page: 1, offset: 40 });
  const list = (r?.messages?.records || r?.records || (Array.isArray(r) ? r : [])).filter((m) => m?.key && !m.key.fromMe);
  // id crescente: horário (segundos) * 100 + ordem dentro do mesmo segundo
  list.sort((a, b) => Number(a.messageTimestamp) - Number(b.messageTimestamp));
  const seen = {};
  let posts = list.map((m) => {
    const ts = Number(m.messageTimestamp) || 0;
    seen[ts] = (seen[ts] || 0) + 1;
    const text = textOf(m);
    return { id: ts * 100 + seen[ts], text, msg: m, links: [...new Set(text.match(/https?:\/\/[^\s*_~)>\]]+/g) || [])] };
  }).filter((p) => p.text && p.links.length);
  posts = last === null ? posts.slice(-firstRun) : posts.filter((p) => p.id > last);
  // Foto só das mensagens novas: baixa da Evolution e guarda de vez
  for (const p of posts) {
    let landingImage = null;
    if (!p.links.some((u) => storeOf(u))) {
      for (const u of p.links.filter((x) => !SKIP.test(x)).slice(0, 2)) {
        const { store, image } = await resolveLanding(u);
        if (store) { p.links.unshift(store); landingImage = image; break; }
      }
    }
    p.image = /^https:\/\//.test(landingImage || '') ? landingImage : null;
    p.altImage = p.image; // foto do anúncio: reserva se a foto da mensagem for um banner
    if (p.msg.message?.imageMessage) {
      try {
        const m = await post('/chat/getBase64FromMediaMessage', { message: { key: p.msg.key }, convertToMp4: false });
        if (m?.base64) p.image = await keepBuffer(Buffer.from(m.base64, 'base64'), `wa_${jid.split('@')[0]}_${p.id}`, m.mimetype || 'image/jpeg');
      } catch {}
    }
    delete p.msg;
  }
  return posts;
}
