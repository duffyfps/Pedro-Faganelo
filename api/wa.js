// Configuração do WhatsApp: status, QR code, grupos, testes (sempre no SEU privado) e troca de provedor
// ?engine=go usa o Evolution Go; sem isso, a Evolution API.
import { requirePassword } from '../lib/auth.js';
import { evoAdmin, goAdmin, provider } from '../lib/whatsapp.js';
import { linkOf } from '../lib/sender.js';
import { db } from '../lib/db.js';

export default async function handler(req, res) {
  if (!requirePassword(req, res)) return;
  const action = req.query.action || 'status';
  const isGo = req.query.engine === 'go';
  const A = isGo ? goAdmin : evoAdmin;
  try {
    if (action === 'use' && req.method === 'POST') {
      const to = ['zapi', 'evolution', 'evogo'].includes(req.query.to) ? req.query.to : 'evolution';
      await db.upsert('state', [{ key: 'wa_provider', value: to }], 'key');
      return res.status(200).json({ provider: to });
    }
    if (action === 'mode' && req.method === 'POST') {
      const to = req.query.to === 'preview' ? 'preview' : 'photo';
      await db.upsert('state', [{ key: 'send_mode', value: to }], 'key');
      return res.status(200).json({ mode: to });
    }
    if (!A.ready()) return res.status(200).json({ error: isGo ? 'Faltam EVO_GO_URL e EVO_GO_APIKEY na Vercel' : 'Faltam EVOLUTION_URL, EVOLUTION_APIKEY e EVOLUTION_INSTANCE na Vercel' });
    if (action === 'status') return res.status(200).json({ state: await A.state(), provider: await provider() });
    if (action === 'qr') return res.status(200).json({ qr: await A.qr(), state: await A.state() });
    if (action === 'groups') return res.status(200).json({ groups: await A.groups(), current: (process.env.WA_GROUP_ID || '').trim() });
    if (action === 'join' && req.method === 'POST' && !isGo) {
      const code = String(req.query.code || '').replace(/^.*chat\.whatsapp\.com\//, '').replace(/[?#].*$/, '');
      return res.status(200).json(await evoAdmin.join(code));
    }
    if (action === 'test' && !isGo) {
      await evoAdmin.test('✅ Caça-Ofertas: teste da Evolution API — seu chip está conectado e enviando.');
      return res.status(200).json({ ok: true });
    }
    if (action === 'preview-test') {
      // Última oferta enviada de cada loja, mandada no SEU privado no formato prévia clicável
      const out = {};
      const n = Math.min(10, Number(req.query.n) || 0);
      if (n) {
        // As N últimas ofertas enviadas (qualquer loja), da mais antiga para a mais nova
        const list = (await db.select('offers', `status=eq.sent&select=*,products(image,title,store)&order=sent_at.desc&limit=${n}`)).reverse();
        for (const [i, o] of list.entries()) {
          const L = linkOf(o);
          if (isGo) out[i + 1] = await goAdmin.previewTest({ text: o.message, link: L });
          else if (req.query.site) {
            // Evolution API (Baileys): texto com o link da página do site, para a prévia grande
            const r = await evoAdmin.raw(o.message.split(L.url).join(L.page));
            const m = r?.message?.extendedTextMessage || {};
            out[i + 1] = { keys: Object.keys(m), hq: !!m.thumbnailDirectPath, w: m.thumbnailWidth || null, h: m.thumbnailHeight || null };
          } else out[i + 1] = await evoAdmin.previewTest(o.message);
          await new Promise((r) => setTimeout(r, 300));
        }
        return res.status(200).json(out);
      }
      for (const pre of ['amz', 'ml']) {
        const [o] = await db.select('offers', `status=eq.sent&product_id=like.${pre}:*&select=*,products(image,title,store)&order=sent_at.desc&limit=1`);
        if (!o) continue;
        out[pre] = isGo ? await goAdmin.previewTest({ text: o.message, link: linkOf(o) }) : await evoAdmin.previewTest(o.message);
      }
      return res.status(200).json(out);
    }
    res.status(400).json({ error: 'ação inválida' });
  } catch (e) {
    res.status(500).json({ error: e.message.slice(0, 300) });
  }
}
