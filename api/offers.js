// Fila de ofertas: GET lista as pendentes; POST marca como enviada/recusada
import { db } from '../lib/db.js';
import { requirePassword } from '../lib/auth.js';

export default async function handler(req, res) {
  if (!requirePassword(req, res)) return;
  try {
    if (req.method === 'GET') {
      const status = ['pending', 'sent'].includes(req.query.status) ? req.query.status : 'pending';
      const order = status === 'sent' ? 'sent_at.desc' : 'score.desc,created_at.desc';
      const rows = await db.select(
        'offers',
        `status=eq.${status}&select=*,products(title,image,url,store)&order=${order}&limit=60`
      );
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { id, action, message } = req.body || {};
      if (!Number.isInteger(id) || !['sent', 'rejected'].includes(action))
        return res.status(400).json({ error: 'pedido inválido' });
      const patch = { status: action };
      if (action === 'sent') patch.sent_at = new Date().toISOString();
      if (typeof message === 'string' && message.trim()) patch.message = message;
      const [row] = await db.update('offers', `id=eq.${id}`, patch);
      return res.status(200).json(row || {});
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
