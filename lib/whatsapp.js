// Envio para o WhatsApp via ponte não oficial: Evolution API (grátis, no seu servidor) ou Z-API (pago)
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
  v = v === 'zapi' || v === 'evolution' ? v : envProvider();
  cache = { v, at: Date.now() };
  return v;
}
const evoReady = () => !!(env('EVOLUTION_URL') && env('EVOLUTION_APIKEY') && env('EVOLUTION_INSTANCE'));
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

const impl = async () => ((await provider()) === 'zapi' ? zapi : evo);

export const whatsappConfigured = () => evoReady() || zapiReady();

export const sendToGroup = async (text, image) => {
  const group = env('WA_GROUP_ID');
  if (!group) throw new Error('WA_GROUP_ID não configurado');
  return (await impl()).send(group, text, image || null);
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
  // Teste vai SEMPRE para o seu número pessoal (ALERT_PHONE), nunca para o grupo de ofertas
  test: (text) => {
    const phone = env('ALERT_PHONE').replace(/\D/g, '');
    if (!phone) throw new Error('ALERT_PHONE não configurado');
    return evo.send(phone, text, null);
  },
};
