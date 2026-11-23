import { timingSafeEqual } from 'node:crypto';

function same(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

// Painel: senha enviada no cabeçalho x-senha
export function requirePassword(req, res) {
  if (same(req.headers['x-senha'], process.env.PANEL_PASSWORD)) return true;
  res.status(401).json({ error: 'senha incorreta' });
  return false;
}

// Caçador: chave secreta na URL (?key=...) ou no cabeçalho x-cron-key
export function requireCronKey(req, res) {
  if (same(req.query.key || req.headers['x-cron-key'], process.env.CRON_SECRET)) return true;
  res.status(401).json({ error: 'chave inválida' });
  return false;
}
