// Envio automático: manda a próxima oferta pronta da fila, respeitando intervalo e horário de silêncio
import { db } from './db.js';
import { sendToGroup, whatsappConfigured } from './whatsapp.js';
import { watch } from './alerts.js';

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
  const quiet = (await getState('quiet_hours')) ?? process.env.QUIET_HOURS ?? '22-8';
  if (inQuietHours(new Date(), quiet)) return { sent: 0, reason: `horário de silêncio (${quiet})` };

  const intervalSec = Number(await getState('send_interval_sec')) || num('SEND_MIN_INTERVAL_SEC', 150);
  const interval = intervalSec * 1000;

  const maxAge = num('MAX_OFFER_AGE_MIN', 40) * 60000;
  const minDiscount = num('MIN_DISCOUNT_PCT', 0);
  const since = new Date(Date.now() - maxAge).toISOString();
  let q = `status=eq.pending&needs_link=eq.false&created_at=gte.${since}&select=*,products(image)&order=created_at.asc&limit=1`;
  if (minDiscount > 0) q += `&discount_pct=gte.${minDiscount}`;
  const [offer] = await db.select('offers', q);
  if (!offer) return { sent: 0, reason: 'nada pronto na fila' };

  // Trava atômica: só UMA execução consegue "pegar a vez" de enviar dentro do intervalo.
  // O banco só atualiza last_send se o valor antigo for mais velho que o intervalo — duas rodadas
  // simultâneas não passam juntas (é isso que evita duas ofertas com 1 segundo de diferença).
  const now = Date.now();
  const prev = await getState('last_send');
  if (prev === null) await db.insert('state', [{ key: 'last_send', value: '0' }]).catch(() => {});
  const threshold = String(now - interval).padStart(13, '0');
  const got = await db.update('state', `key=eq.last_send&value=lt.${threshold}`, { value: String(now).padStart(13, '0') });
  if (!got.length) return { sent: 0, reason: 'aguardando intervalo' };

  // "Reserva" a oferta para que duas execuções simultâneas não mandem a mesma
  const claimed = await db.update('offers', `id=eq.${offer.id}&status=eq.pending`, { status: 'sending' });
  if (!claimed.length) {
    await setState('last_send', String(prev ?? '0').padStart(13, '0')); // devolve a vez
    return { sent: 0, reason: 'outra execução já pegou' };
  }

  try {
    await sendToGroup(offer.message, offer.products?.image || null);
    await db.update('offers', `id=eq.${offer.id}`, { status: 'sent', sent_at: new Date().toISOString() });
    await db.update('state', 'key=eq.send_fail_count', { value: '0' }).catch(() => {});
    await watch('whatsapp', false, '', 'o envio para o grupo do WhatsApp voltou a funcionar.').catch(() => {});
    return { sent: 1, offer: offer.id };
  } catch (e) {
    await db.update('offers', `id=eq.${offer.id}`, { status: 'pending' });
    const fails = (Number(await getState('send_fail_count')) || 0) + 1;
    await setState('send_fail_count', fails);
    if (fails >= 3)
      await watch(
        'whatsapp',
        true,
        `o envio para o grupo do WhatsApp está falhando (${e.message.slice(0, 120)}). ` +
          'Confira na Z-API se o chip está conectado e se o plano está ativo.'
      ).catch(() => {});
    return { sent: 0, error: e.message.slice(0, 300) };
  }
}
