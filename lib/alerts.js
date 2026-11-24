// Alertas para o seu WhatsApp pessoal (ALERT_PHONE, ex.: 5511999999999), enviados pelo chip da Z-API
import { db } from './db.js';
import { sendToPhone, whatsappConfigured } from './whatsapp.js';

const HOURS = 3600000;

async function getState(key) {
  const [row] = await db.select('state', `key=eq.${encodeURIComponent(key)}`);
  return row ? row.value : null;
}
const setState = (key, value) => db.upsert('state', [{ key, value: String(value) }], 'key');

// Chame a cada tentativa de link curto. ok=true quando funcionou; why = motivo da falha.
export async function trackShortLink(ok, why = '') {
  const phone = (process.env.ALERT_PHONE || '').replace(/\D/g, '');
  const status = await getState('short_status'); // 'ok' | 'down' | null
  if (ok) {
    if (status === 'down') {
      await setState('short_status', 'ok');
      if (phone && whatsappConfigured())
        await sendToPhone(phone, '✅ *Caça-Ofertas:* o link curto da Amazon voltou a funcionar.').catch(() => {});
    } else if (status !== 'ok') {
      await setState('short_status', 'ok');
    }
    return;
  }
  // Falhas de rede passageiras não contam; só quando a Amazon recusa a sessão
  if (!/Amazon \d+/.test(why)) return;
  const last = Number(await getState('short_alert_at')) || 0;
  if (status !== 'down') await setState('short_status', 'down');
  if (!phone || !whatsappConfigured() || Date.now() - last < 6 * HOURS) return;
  await setState('short_alert_at', Date.now());
  await sendToPhone(
    phone,
    '⚠️ *Caça-Ofertas:* o link curto da Amazon caiu (' + why + ').\n\n' +
      'As ofertas continuam saindo com o link normal e a sua tag.\n\n' +
      'Para voltar: pegue o cookie atualizado no Chrome (F12 → Network → getShortUrl → cookie), ' +
      'cole no AMAZON_COOKIE da Vercel e peça para republicar.'
  ).catch(() => {});
}
