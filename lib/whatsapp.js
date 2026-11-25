// Envio para o WhatsApp via ponte não oficial: Evolution API (grátis, no seu servidor) ou Z-API (pago)
import { createHash } from 'node:crypto';
import { db } from './db.js';

const env = (k) => (process.env[k] || '').trim();
const envProvider = () => env('WA_PROVIDER').toLowerCase() || 'evolution';

// Provedor em uso: o banco (state wa_provider = 'zapi' | 'evolution') manda; senão a variável WA_PROVIDER.
// Assim dá para trocar (e voltar) sem mexer na Vercel.
let cache = { v: null, at: 0 };
export async function provider() {
  if (Date.now() - cache.at < 20000 && cache.v) return cache.v;
  let v = null;
  try {
    const [row] = await db.select('state', 'key=eq.wa_provider');
    v = row?.value;
  } catch {}
  v = ['zapi', 'evolution', 'evogo'].includes(v) ? v : envProvider();
  cache = { v, at: Date.now() };
  return v;
}
// Modo de envio: 'photo' (foto anexada) ou 'preview' (texto com prévia do link: a imagem vem da página
// do produto e, ao tocar, abre a loja — nada vai para a galeria). Fica no banco: state send_mode.
let modeCache = { v: null, at: 0 };
export async function sendMode() {
  if (Date.now() - modeCache.at < 20000 && modeCache.v) return modeCache.v;
  let v = null;
  try {
    const [row] = await db.select('state', 'key=eq.send_mode');
    v = row?.value;
  } catch {}
  v = v === 'preview' ? 'preview' : 'photo';
  modeCache = { v, at: Date.now() };
  return v;
}
const evoReady = () => !!(env('EVOLUTION_URL') && env('EVOLUTION_APIKEY') && env('EVOLUTION_INSTANCE'));
const goReady = () => !!(env('EVO_GO_URL') && env('EVO_GO_APIKEY'));
const zapiReady = () => !!(env('ZAPI_INSTANCE') && env('ZAPI_TOKEN'));

async function req(url, { method = 'POST', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

// ---------- Evolution API ----------
const evo = {
  url: (path) => `${env('EVOLUTION_URL').replace(/\/$/, '')}/${path}/${encodeURIComponent(env('EVOLUTION_INSTANCE'))}`,
  h: () => ({ apikey: env('EVOLUTION_APIKEY') }),
  // Z-API usa "1203...-group"; a Evolution usa "1203...@g.us" (telefone puro continua igual)
  jid: (id) => (/-group$/.test(id) ? id.replace(/-group$/, '@g.us') : id),
  async send(group, text, image) {
    group = evo.jid(group);
    if (image) {
      return req(evo.url('message/sendMedia'), {
        headers: evo.h(),
        body: { number: group, mediatype: 'image', mimetype: 'image/jpeg', caption: text, media: image, fileName: 'oferta.jpg', delay: 1200 },
      });
    }
    return req(evo.url('message/sendText'), { headers: evo.h(), body: { number: group, text, linkPreview: true, delay: 1200 } });
  },
  async groups() {
    const list = await req(`${evo.url('group/fetchAllGroups')}?getParticipants=false`, { method: 'GET', headers: evo.h() });
    return (Array.isArray(list) ? list : []).map((g) => ({ id: g.id, name: g.subject }));
  },
};


// ---------- Evolution Go (manda prévia de link personalizada: foto + título + link clicável) ----------
const go = {
  base: () => env('EVO_GO_URL').replace(/\/$/, ''),
  name: () => env('EVO_GO_INSTANCE') || 'magnata',
  // Token da instância derivado da chave global (não precisa de outra variável)
  token: () => createHash('sha256').update(`${env('EVO_GO_APIKEY')}:${go.name()}`).digest('hex').slice(0, 32),
  h: (admin = false) => ({ apikey: admin ? env('EVO_GO_APIKEY') : go.token() }),
  jid: (id) => (/-group$/.test(id) ? id.replace(/-group$/, '@g.us') : id),
  async send(to, text, image, link) {
    const number = go.jid(to);
    if (link?.url) {
      // O Evolution Go monta a prévia lendo o PRIMEIRO link do texto. Os links da loja (meli.la, link.amazon)
      // não entregam a foto para ele; a página da oferta (/p/...) entrega foto + nome + preço.
      const target = link.page || link.url;
      const body = link.page ? text.split(link.url).join(link.page) : text;
      return req(`${go.base()}/send/link`, {
        headers: go.h(),
        body: { number, text: body, url: target, title: link.title || '', description: link.description || '', imgUrl: link.image || image || '', delay: 1200 },
      });
    }
    if (image) return req(`${go.base()}/send/media`, { headers: go.h(), body: { number, type: 'image', url: image, caption: text, delay: 1200 } });
    return req(`${go.base()}/send/text`, { headers: go.h(), body: { number, text, delay: 1200 } });
  },
  async groups() {
    const r = await req(`${go.base()}/group/myall`, { method: 'GET', headers: go.h() });
    const list = Array.isArray(r) ? r : r?.data || [];
    return list.map((g) => ({ id: g.JID || g.jid || g.id, name: g.Name || g.name || g.subject }));
  },
};

// ---------- Z-API ----------
// Z-API clássica: api.z-api.io + Client-Token
// Z-API Omni:      zapi.omni.z-api.io + Authorization: Bearer <Secret Key> (defina ZAPI_SECRET_KEY)
const zapi = {
  omni: () => !!env('ZAPI_SECRET_KEY'),
  base: () => (env('ZAPI_BASE_URL') || (zapi.omni() ? 'https://zapi.omni.z-api.io' : 'https://api.z-api.io')).replace(/\/$/, ''),
  url: (path) => `${zapi.base()}/instances/${env('ZAPI_INSTANCE')}/token/${env('ZAPI_TOKEN')}/${path}`,
  h: () => {
    const h = {};
    if (env('ZAPI_SECRET_KEY')) h.Authorization = `Bearer ${env('ZAPI_SECRET_KEY')}`;
    if (env('ZAPI_CLIENT_TOKEN')) h['Client-Token'] = env('ZAPI_CLIENT_TOKEN');
    return h;
  },
  async send(group, text, image) {
    const extra = zapi.omni() ? {} : { delayMessage: 2 }; // a Omni não aceita delayMessage
    if (image) return req(zapi.url('send-image'), { headers: zapi.h(), body: { phone: group, image, caption: text, ...extra } });
    return req(zapi.url('send-text'), { headers: zapi.h(), body: { phone: group, message: text, ...extra } });
  },
  async groups() {
    const list = await req(`${zapi.url('groups')}?page=1&pageSize=100`, { method: 'GET', headers: zapi.h() });
    return (Array.isArray(list) ? list : []).map((g) => ({ id: g.phone, name: g.name }));
  },
};

const impl = async () => {
  const p = await provider();
  return p === 'zapi' ? zapi : p === 'evogo' ? go : evo;
};

export const whatsappConfigured = () => evoReady() || zapiReady() || goReady();

// link = { url, title, description, image }: no modo "preview" do Evolution Go vira a prévia clicável
export const sendToGroup = async (text, image, link = null) => {
  const group = env('WA_GROUP_ID');
  if (!group) throw new Error('WA_GROUP_ID não configurado');
  const preview = (await sendMode()) === 'preview';
  const p = await provider();
  if (p === 'evogo') return go.send(group, text, preview ? null : image || null, preview ? link : null);
  return (await impl()).send(group, text, preview ? null : image || null);
};

export const listGroups = async () => (await impl()).groups();

// Mensagem de texto para um número (alertas)
export const sendToPhone = async (phone, text) => (await impl()).send(phone, text, null);

// ---------- Configuração da Evolution (usada pela página /whatsapp.html) ----------
const evoBase = () => env('EVOLUTION_URL').replace(/\/$/, '');
const inst = () => encodeURIComponent(env('EVOLUTION_INSTANCE'));
export const evoAdmin = {
  ready: evoReady,
  async state() {
    try {
      const r = await req(`${evoBase()}/instance/connectionState/${inst()}`, { method: 'GET', headers: evo.h() });
      return r?.instance?.state || r?.state || 'desconhecido';
    } catch (e) {
      if (/404/.test(e.message)) return 'não criada';
      throw e;
    }
  },
  async qr() {
    if ((await evoAdmin.state()) === 'não criada') {
      const c = await req(`${evoBase()}/instance/create`, {
        headers: evo.h(),
        body: { instanceName: env('EVOLUTION_INSTANCE'), qrcode: true, integration: 'WHATSAPP-BAILEYS' },
      });
      if (c?.qrcode?.base64) return c.qrcode.base64;
    }
    const r = await req(`${evoBase()}/instance/connect/${inst()}`, { method: 'GET', headers: evo.h() });
    return r?.base64 || null;
  },
  groups: () => evo.groups(),
  // Manda a mensagem só como texto com prévia do link para o SEU número, e diz se o WhatsApp gerou a imagem
  async previewTest(text) {
    const phone = env('ALERT_PHONE').replace(/\D/g, '');
    if (!phone) throw new Error('ALERT_PHONE não configurado');
    const r = await evo.send(phone, text, null);
    const raw = JSON.stringify(r || {});
    return { thumb: /jpegThumbnail|thumbnail|previewType/i.test(raw), title: raw.match(/"title":"([^"]{0,80})/)?.[1] || null };
  },
  async raw(text) {
    const phone = env('ALERT_PHONE').replace(/\D/g, '');
    return req(evo.url('message/sendText'), { headers: evo.h(), body: { number: phone, text, linkPreview: true } });
  },
  // Teste vai SEMPRE para o seu número pessoal (ALERT_PHONE), nunca para o grupo de ofertas
  test: (text) => {
    const phone = env('ALERT_PHONE').replace(/\D/g, '');
    if (!phone) throw new Error('ALERT_PHONE não configurado');
    return evo.send(phone, text, null);
  },
};

// ---------- Configuração do Evolution Go (página /whatsapp.html?engine=go) ----------
export const goAdmin = {
  ready: goReady,
  async state() {
    try {
      const r = await req(`${go.base()}/instance/status`, { method: 'GET', headers: go.h() });
      const d = r?.data || r || {};
      if (d.Connected || d.connected) return d.LoggedIn === false || d.loggedIn === false ? 'connecting' : 'open';
      return 'close';
    } catch (e) {
      if (/40[134]/.test(e.message)) return 'não criada';
      throw e;
    }
  },
  async qr() {
    if ((await goAdmin.state()) === 'não criada') {
      await req(`${go.base()}/instance/create`, { headers: go.h(true), body: { name: go.name(), token: go.token() } });
    }
    await req(`${go.base()}/instance/connect`, { headers: go.h(), body: { immediate: true } }).catch(() => {});
    const r = await req(`${go.base()}/instance/qr`, { method: 'GET', headers: go.h() });
    const q = r?.data?.qrcode || r?.qrcode || null;
    return q && !q.startsWith('data:') ? `data:image/png;base64,${q}` : q;
  },
  groups: () => go.groups(),
  async previewTest(o) {
    const phone = env('ALERT_PHONE').replace(/\D/g, '');
    if (!phone) throw new Error('ALERT_PHONE não configurado');
    return go.send(phone, o.text, null, o.link);
  },
};
