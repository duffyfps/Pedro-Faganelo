// Liga/desliga o envio automático pelo painel
import { autoSendEnabled, setAutoSend, inQuietHours } from '../lib/sender.js';
import { whatsappConfigured } from '../lib/whatsapp.js';
import { requirePassword } from '../lib/auth.js';

export default async function handler(req, res) {
  if (!requirePassword(req, res)) return;
  try {
    if (req.method === 'POST') await setAutoSend(!!(req.body || {}).autosend);
    res.status(200).json({
      autosend: await autoSendEnabled(),
      whatsapp: whatsappConfigured(),
      quiet: inQuietHours(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
