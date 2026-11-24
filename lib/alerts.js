// Alertas para o seu WhatsApp pessoal (ALERT_PHONE, ex.: 5511999999999), enviados pelo chip da Z-API
import { db } from './db.js';
import { sendToPhone, whatsappConfigured } from './whatsapp.js';

const HOURS = 3600000;

async function getState(key) {
  const [row] = await db.select('state', `key=eq.${encodeURIComponent(key)}`);
  return row ? row.value : null;
}
const setState = (key, value) => db.upsert('state', [{ key, value: String(value) }], 'key');

// Horário em que NÃO manda aviso pro seu celular (padrão 22h–8h). Avisos pendentes saem às 8h.
function hourSP(d = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(d));
}
export async function alertsMuted(now = new Date()) {
  const spec = (await getState('alert_quiet')) ?? process.env.ALERT_QUIET ?? '22-8';
  const m = String(spec).match(/^(\d{1,2})-(\d{1,2})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  const h = hourSP(now);
  return a === b ? false : a < b ? h >= a && h < b : h >= a || h < b;
}

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
      if (phone && whatsappConfigured() && !(await alertsMuted()))
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
  if (await alertsMuted()) return; // de madrugada não avisa; se continuar caído, avisa às 8h
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

// ---------- Vigia: alerta genérico com aviso de "voltou" ----------
// problem=true quando há problema. Avisa no máximo 1 vez a cada cooldownH horas; avisa quando normaliza.
export async function watch(key, problem, downMsg, upMsg, cooldownH = 3) {
  const phone = (process.env.ALERT_PHONE || '').replace(/\D/g, '');
  const status = await getState(`watch_${key}`);
  if (!problem) {
    if (status === 'down') {
      await setState(`watch_${key}`, 'ok');
      if (phone && whatsappConfigured() && !(await alertsMuted())) await sendToPhone(phone, `✅ *Caça-Ofertas:* ${upMsg}`).catch(() => {});
    }
    return;
  }
  if (status !== 'down') await setState(`watch_${key}`, 'down');
  const last = Number(await getState(`watch_${key}_at`)) || 0;
  if (!phone || !whatsappConfigured() || Date.now() - last < cooldownH * HOURS) return;
  if (await alertsMuted()) return; // de madrugada não avisa; se continuar, avisa às 8h
  await setState(`watch_${key}_at`, Date.now());
  await sendToPhone(phone, `⚠️ *Caça-Ofertas:* ${downMsg}`).catch(() => {});
}

// Contador simples guardado no banco
export async function bump(key, reset = false) {
  const n = reset ? 0 : (Number(await getState(key)) || 0) + 1;
  await setState(key, n);
  return n;
}
export const readState = getState;
export const writeState = setState;
