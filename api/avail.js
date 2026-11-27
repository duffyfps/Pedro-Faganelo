// Diagnóstico (com senha): /api/avail?id=ml:MLBU123 — mostra o que o robô vê na página do anúncio
import { requirePassword } from '../lib/auth.js';
import { mlListingStatus } from '../lib/mlLink.js';

export default async function handler(req, res) {
  if (!requirePassword(req, res)) return;
  const debug = [];
  const st = await mlListingStatus(String(req.query.id || ''), debug);
  res.status(200).json({ status: st, debug });
}
