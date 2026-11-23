// Envio automático: manda a próxima oferta pronta da fila, respeitando intervalo e horário de silêncio
import { db } from './db.js';
import { sendToGroup, whatsappConfigured } from './whatsapp.js';

const num = (k, d) => (Number.isFinite(Number(process.env[k])) && process.env[k] !== '' ? Number(process.env[k]) : d);

async function getState(key) {
  const [row] = await db.select('state', `key=eq.${encodeURIComponent(key)}`);
  return row ? row.value : null;
}
const setState = (key, value) => db.upsert('state', [{ key, value: String(value) }], 'key');

export async function autoSendEnabled() {
  const v = await getState('autosend');
  if (v === 'on' || v === 'off') return v === 'on';
  return (process.env.AUTO_SEND || 'true') === 'true';
}
export const setAutoSend = (on) => setState('autosend', on ? 'on' : 'off');

// Hora atual em São Paulo
function hourSP(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(now));
}
export function inQuietHours(now = new Date(), spec = process.env.QUIET_HOURS ?? '23-7') {
  const m = String(spec).match(/^(\d{1,2})-(\d{1,2})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  const h = hourSP(now);
  return a === b ? false : a < b ? h >= a && h < b : h >= a || h < b;
}

export async function sendDue() {
  if (!whatsappConfigured()) return { sent: 0, reason: 'whatsapp não configurado' };
  if (!(await autoSendEnabled())) return { sent: 0, reason: 'envio automático pausado' };
  if (inQuietHours()) return { sent: 0, reason: 'horário de silêncio' };

  const interval = num('SEND_MIN_INTERVAL_SEC', 150) * 1000;
  const last = Number(await getState('last_send')) || 0;
  if (Date.now() - last < interval) return { sent: 0, reason: 'aguardando intervalo' };

  const maxAge = num('MAX_OFFER_AGE_MIN', 40) * 60000;
  const minDiscount = num('MIN_DISCOUNT_PCT', 0);
  const since = new Date(Date.now() - maxAge).toISOString();
  let q = `status=eq.pending&needs_link=eq.false&created_at=gte.${since}&select=*,products(image)&order=created_at.asc&limit=1`;
  if (minDiscount > 0) q += `&discount_pct=gte.${minDiscount}`;
  const [offer] = await db.select('offers', q);
  if (!offer) return { sent: 0, reason: 'nada pronto na fila' };

  // "Reserva" a oferta para que duas execuções simultâneas não mandem em dobro
  const claimed = await db.update('offers', `id=eq.${offer.id}&status=eq.pending`, { status: 'sending' });
  if (!claimed.length) return { sent: 0, reason: 'outra execução já pegou' };
  await setState('last_send', Date.now());

  try {
    await sendToGroup(offer.message, offer.products?.image || null);
    await db.update('offers', `id=eq.${offer.id}`, { status: 'sent', sent_at: new Date().toISOString() });
    return { sent: 1, offer: offer.id };
  } catch (e) {
    await db.update('offers', `id=eq.${offer.id}`, { status: 'pending' });
    return { sent: 0, error: e.message.slice(0, 300) };
  }
}
