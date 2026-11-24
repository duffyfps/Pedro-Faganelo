// Alertas para o seu WhatsApp pessoal (ALERT_PHONE, ex.: 5511999999999), enviados pelo chip da Z-API
import { db } from './db.js';
import { sendToPhone, whatsappConfigured } from './whatsapp.js';

const HOURS = 3600000;

async function getState(key) {
  const [row] = await db.select('state', `key=eq.${encodeURIComponent(key)}`);
  return row ? row.value : null;
}
const setState = (key, value) => db.upsert('state', [{ key, value: String(value) }], 'key');

const LABEL = {
  amazon: { name: 'o link curto da Amazon', fix: 'pegue o cookie atualizado no Chrome (F12 → Network → getShortUrl → cookie), cole no AMAZON_COOKIE da Vercel' },
  ml: { name: 'o link de afiliado do Mercado Livre', fix: 'pegue o cookie atualizado no Chrome (F12 → Network → links → cookie), cole no ML_COOKIE da Vercel' },
};

export const trackShortLink = (ok, why = '') => trackLink('amazon', ok, why);

// Chame a cada tentativa de gerar link. ok=true quando funcionou; why = motivo da falha.
export async function trackLink(service, ok, why = '') {
  const L = LABEL[service];
  const pre = service === 'amazon' ? 'short' : `${service}_link`;
  const phone = (process.env.ALERT_PHONE || '').replace(/\D/g, '');
  const status = await getState(`${pre}_status`); // 'ok' | 'down' | null
  if (ok) {
    if (status === 'down') {
      await setState(`${pre}_status`, 'ok');
      if (phone && whatsappConfigured())
        await sendToPhone(phone, `✅ *Caça-Ofertas:* ${L.name} voltou a funcionar.`).catch(() => {});
    } else if (status !== 'ok') {
      await setState(`${pre}_status`, 'ok');
    }
    return;
  }
  // Falhas de rede passageiras não contam; só quando a Amazon recusa a sessão
  if (!/(Amazon|ML) \d+/.test(why)) return;
  const last = Number(await getState(`${pre}_alert_at`)) || 0;
  if (status !== 'down') await setState(`${pre}_status`, 'down');
  if (!phone || !whatsappConfigured() || Date.now() - last < 6 * HOURS) return;
  await setState(`${pre}_alert_at`, Date.now());
  const fallback =
    service === 'amazon'
      ? 'As ofertas continuam saindo com o link normal e a sua tag.'
      : 'As ofertas do Mercado Livre ficam paradas no painel esperando o seu link.';
  await sendToPhone(
    phone,
    `⚠️ *Caça-Ofertas:* ${L.name} caiu (${why}).\n\n${fallback}\n\nPara voltar: ${L.fix} e peça para republicar.`
  ).catch(() => {});
}
