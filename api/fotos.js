// Conserta fotos que sumiram do site: o link da foto do Telegram expira em ~1 dia.
// Para cada produto com foto do Telegram (ou sem foto), busca a foto atual do post, tira o selo de outro canal
// (se tiver) e guarda uma cópia permanente. Uso (com senha): /api/fotos?limit=15
import { requirePassword } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { keepPhoto, needsCopy } from '../lib/photoStore.js';
import { hasWatermark, cleanPhotoUrl, amazonImage } from '../lib/watermark.js';
import { mlLinkStatus, mlLinkImage } from '../lib/mlLink.js';

async function postPhoto(source) {
  const r = await fetch(`https://t.me/${source}?embed=1&mode=tme`, { signal: AbortSignal.timeout(7000) });
  if (!r.ok) return null;
  const html = await r.text();
  return (html.match(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/) || [])[1] || null;
}

export default async function handler(req, res) {
  if (!requirePassword(req, res)) return;
  // Diagnóstico: /api/fotos?check=https://meli.la/xxxx mostra se o robô vê o anúncio no ar
  if (req.query.check) { const debug = []; const st = await mlLinkStatus(String(req.query.check), debug); return res.status(200).json({ status: st, debug }); }
  // /api/fotos?crop=1: tira tarjas de texto da borda das fotos das ofertas recentes
  if (req.query.crop) {
    const { cropBands } = await import('../lib/cleanPhoto.js');
    const { keepBuffer } = await import('../lib/photoStore.js');
    const since = new Date(Date.now() - (Number(req.query.days) || 2) * 864e5).toISOString();
    const list = await db.select('products', `updated_at=gte.${since}&image=not.is.null&image=not.like.*crop_*&select=id,image&order=updated_at.desc&limit=${Math.min(40, Number(req.query.limit) || 25)}&offset=${Number(req.query.offset) || 0}`);
    const t1 = Date.now(), done = [];
    for (const p of list) {
      if (Date.now() - t1 > 50000) break;
      try {
        const c = await cropBands(p.image);
        if (!c) continue;
        const kept = await keepBuffer(c, `crop_${String(p.id).replace(/[^\w-]+/g, '_').slice(-60)}`, 'image/jpeg');
        if (kept) { await db.update('products', `id=eq.${encodeURIComponent(p.id)}`, { image: kept }); done.push(p.id); }
      } catch {}
    }
    return res.status(200).json({ checked: list.length, cropped: done });
  }
  const limit = Math.min(30, Number(req.query.limit) || 15);
  const t0 = Date.now();
  const rows = await db.select('products', `or=(image.like.*telesco.pe*,image.like.*api/img*,image.is.null)&select=*&order=updated_at.desc&limit=${limit}&offset=${Number(req.query.offset) || 0}`);
  const out = [];
  for (const p of rows) {
    if (Date.now() - t0 > 50000) { out.push({ id: p.id, r: 'sem tempo' }); continue; }
    try {
      // 1) Amazon: foto oficial pelo ASIN
      let img = null, why = '';
      if (p.store === 'amazon') { img = await amazonImage(p.id.replace(/^amz:/, '')); why = img ? 'amazon' : ''; }
      // 2) Foto atual do post no Telegram (sem selo; com selo, corta a faixa)
      if (!img) {
        const [o] = await db.select('offers', `product_id=eq.${encodeURIComponent(p.id)}&source=not.is.null&select=source&order=created_at.desc&limit=1`);
        const src = o?.source ? await postPhoto(o.source) : null;
        if (src) {
          const wm = await hasWatermark(src);
          if (wm.wm === false) { img = src; why = 'post'; }
          else if (wm.wm && wm.hit) {
            const c = cleanPhotoUrl(src, wm.hit);
            if (c && (await hasWatermark(c)).wm === false) { img = c; why = 'post sem selo'; }
          }
        }
      }
      // 3) Mercado Livre: foto do anúncio pelo link meli.la (do produto ou da mensagem)
      if (!img && p.store === 'ml') {
        const [o2] = await db.select('offers', `product_id=eq.${encodeURIComponent(p.id)}&select=message&order=created_at.desc&limit=1`);
        if (/^https:\/\/http2\.mlstatic\.com\/D_/.test(String(p.url || ''))) img = p.url; // às vezes o link guardado já é a foto do anúncio
        const link = [p.url, p.open_url, ...(String(o2?.message || '').match(/https:\/\/meli\.la\/\S+/g) || [])].find((u) => /^https:\/\/(meli\.la\/|www\.mercadolivre\.com\.br\/social\/)/.test(String(u || '')));
        if (!img) img = await mlLinkImage(link);
        why = img ? 'meli.la' : '';
      }
      if (!img) { out.push({ id: p.id, r: 'não achei foto limpa' }); continue; }
      const kept = await keepPhoto(img, `${p.id}_fix`);
      if (needsCopy(kept)) { out.push({ id: p.id, r: 'falhou ao guardar' }); continue; }
      await db.update('products', `id=eq.${encodeURIComponent(p.id)}`, { image: kept });
      out.push({ id: p.id, r: why });
    } catch (e) {
      out.push({ id: p.id, r: `erro ${String(e.message).slice(0, 50)}` });
    }
  }
  res.status(200).json({ total: rows.length, ok: out.filter((x) => ['amazon', 'post', 'post sem selo', 'meli.la'].includes(x.r)).length, out });
}
