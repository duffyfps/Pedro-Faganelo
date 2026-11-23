// Lista os grupos do número conectado, para você achar o ID do seu grupo (WA_GROUP_ID)
import { listGroups } from '../lib/whatsapp.js';
import { requireCronKey } from '../lib/auth.js';

export default async function handler(req, res) {
  if (!requireCronKey(req, res)) return;
  try {
    res.status(200).json(await listGroups());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
