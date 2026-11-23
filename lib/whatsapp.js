// Envio para o WhatsApp via ponte não oficial: Evolution API (grátis, no seu servidor) ou Z-API (pago)
const env = (k) => (process.env[k] || '').trim();
const provider = () => env('WA_PROVIDER').toLowerCase() || 'evolution';

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
  async send(group, text, image) {
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
const zapi = {
  url: (path) => `https://api.z-api.io/instances/${env('ZAPI_INSTANCE')}/token/${env('ZAPI_TOKEN')}/${path}`,
  h: () => (env('ZAPI_CLIENT_TOKEN') ? { 'Client-Token': env('ZAPI_CLIENT_TOKEN') } : {}),
  async send(group, text, image) {
    if (image) return req(zapi.url('send-image'), { headers: zapi.h(), body: { phone: group, image, caption: text, delayMessage: 2 } });
    return req(zapi.url('send-text'), { headers: zapi.h(), body: { phone: group, message: text, delayMessage: 2 } });
  },
  async groups() {
    const list = await req(`${zapi.url('groups')}?page=1&pageSize=100`, { method: 'GET', headers: zapi.h() });
    return (Array.isArray(list) ? list : []).map((g) => ({ id: g.phone, name: g.name }));
  },
};

const impl = () => (provider() === 'zapi' ? zapi : evo);

export const whatsappConfigured = () =>
  provider() === 'zapi'
    ? !!(env('ZAPI_INSTANCE') && env('ZAPI_TOKEN'))
    : !!(env('EVOLUTION_URL') && env('EVOLUTION_APIKEY') && env('EVOLUTION_INSTANCE'));

export const sendToGroup = (text, image) => {
  const group = env('WA_GROUP_ID');
  if (!group) throw new Error('WA_GROUP_ID não configurado');
  return impl().send(group, text, image || null);
};

export const listGroups = () => impl().groups();
