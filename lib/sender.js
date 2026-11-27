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

// Dados da prévia clicável: link da loja (o mesmo da mensagem), foto e nome do produto
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ');
export function linkOf(offer) {
  const url = (String(offer.message || '').match(/(?:🛒|🛍)[^\n]*?(https?:\/\/\S+)/) || [])[1];
  if (!url) return null;
  const store = offer.products?.store === 'amazon' ? 'Amazon' : 'Mercado Livre';
  const site = (process.env.SITE_URL || 'https://ofertas-pedro.vercel.app').replace(/\/$/, '');
  return {
    url,
    page: offer.id ? `${site}/p/${Number(offer.id).toString(36)}` : null, // página da oferta (prévia com foto)
    title: offer.products?.title || '',
    description: `${brl(offer.price)}${offer.discount_pct ? ` (${offer.discount_pct}% OFF)` : ''} na ${store}`,
    image: offer.products?.image || '',
  };
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
  let minScore = Number(await getState('min_score')) || num('MIN_SCORE', 25);
  const maxPerHour = Number(await getState('max_per_hour')) || num('MAX_PER_HOUR', 20);
  // Vagas extras no pico: passando de soft_per_hour, só entra oferta com nota >= peak_min_score
  const softPerHour = Number(await getState('soft_per_hour')) || maxPerHour;
  const peakMinScore = Number(await getState('peak_min_score')) || 50;
  const since = new Date(Date.now() - maxAge).toISOString();

  // Limite por hora: em horário de pico, só as melhores passam
  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  const sentLastHour = await db.select('offers', `status=eq.sent&sent_at=gte.${hourAgo}&select=id`);
  if (sentLastHour.length >= maxPerHour) return { sent: 0, reason: `limite de ${maxPerHour}/hora` };
  if (sentLastHour.length >= softPerHour) minScore = Math.max(minScore, peakMinScore);

  // Curadoria: entre as prontas, manda a de maior nota (empate: a mais antiga)
  // Teste (state test_nolink=on): manda também as que ainda não têm link de afiliado, apontando para a página do site
  const testNoLink = (await getState('test_nolink')) === 'on';
  let q = `status=eq.pending${testNoLink ? '' : '&needs_link=eq.false'}&created_at=gte.${since}&score=gte.${minScore}` +
    `&select=*,products(image,title,store)&order=score.desc,created_at.asc&limit=1`;
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
    if (testNoLink && String(offer.message || '').includes('[COLE SEU LINK AQUI]')) {
      const site = (process.env.SITE_URL || 'https://ofertas-pedro.vercel.app').replace(/\/$/, '');
      offer.message = offer.message.split('[COLE SEU LINK AQUI]').join(`${site}/p/${Number(offer.id).toString(36)}`);
    }
    await sendToGroup(offer.message, offer.products?.image || null, linkOf(offer));
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
          'Confira em ofertas-pedro.vercel.app/whatsapp.html se o chip está conectado (ou se o servidor da Evolution está no ar).'
      ).catch(() => {});
    return { sent: 0, error: e.message.slice(0, 300) };
  }
}
