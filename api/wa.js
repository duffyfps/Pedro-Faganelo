// Configuração do WhatsApp pela Evolution: status, QR code, grupos, teste e troca de provedor
import { requirePassword } from '../lib/auth.js';
import { evoAdmin, provider } from '../lib/whatsapp.js';
import { db } from '../lib/db.js';

export default async function handler(req, res) {
  if (!requirePassword(req, res)) return;
  const action = req.query.action || 'status';
  try {
    if (!evoAdmin.ready()) return res.status(200).json({ error: 'Faltam EVOLUTION_URL, EVOLUTION_APIKEY e EVOLUTION_INSTANCE na Vercel' });
    if (action === 'status') return res.status(200).json({ state: await evoAdmin.state(), provider: await provider() });
    if (action === 'qr') return res.status(200).json({ qr: await evoAdmin.qr(), state: await evoAdmin.state() });
    if (action === 'groups') return res.status(200).json({ groups: await evoAdmin.groups(), current: (process.env.WA_GROUP_ID || '').trim() });
    if (action === 'test') {
      await evoAdmin.test('✅ Caça-Ofertas: teste da Evolution API — seu chip está conectado e enviando.');
      return res.status(200).json({ ok: true });
    }
    if (action === 'preview-test') {
      // Última oferta enviada de cada loja, mandada no seu privado no formato "prévia do link"
      const out = {};
      for (const store of ['amazon', 'ml']) {
        const [o] = await db.select('offers', `status=eq.sent&product_id=like.${store === 'amazon' ? 'amz' : 'ml'}:*&select=message&order=sent_at.desc&limit=1`);
        if (o) out[store] = await evoAdmin.previewTest(o.message);
      }
      return res.status(200).json(out);
    }
    if (action === 'mode' && req.method === 'POST') {
      const to = req.query.to === 'preview' ? 'preview' : 'photo';
      await db.upsert('state', [{ key: 'send_mode', value: to }], 'key');
      return res.status(200).json({ mode: to });
    }
    if (action === 'use' && req.method === 'POST') {
      const to = req.query.to === 'zapi' ? 'zapi' : 'evolution';
      await db.upsert('state', [{ key: 'wa_provider', value: to }], 'key');
      return res.status(200).json({ provider: to });
    }
    res.status(400).json({ error: 'ação inválida' });
  } catch (e) {
    res.status(500).json({ error: e.message.slice(0, 300) });
  }
}
