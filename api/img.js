// Repassa a foto do produto (para o painel/WhatsApp). Com ?top= ou ?bottom= (fração 0–0.25),
// corta essa faixa da foto — usado para tirar o selo de outro canal sem perder a foto.
const ALLOWED = /(^|\.)(media-amazon\.com|ssl-images-amazon\.com|mlstatic\.com|telesco\.pe)$/i;

export default async function handler(req, res) {
  try {
    const u = new URL(String(req.query.url || ''));
    if (u.protocol !== 'https:' || !ALLOWED.test(u.hostname)) return res.status(400).end();
    const r = await fetch(u);
    if (!r.ok) return res.status(502).end();
    let buf = Buffer.from(await r.arrayBuffer());
    let type = r.headers.get('content-type') || 'image/jpeg';
    const top = Math.min(0.25, Math.max(0, Number(req.query.top) || 0));
    const bottom = Math.min(0.25, Math.max(0, Number(req.query.bottom) || 0));
    if (top || bottom) {
      const sharp = (await import('sharp')).default;
      const { width, height } = await sharp(buf).metadata();
      const y0 = Math.round(height * top);
      const h = Math.round(height * (1 - top - bottom));
      buf = await sharp(buf).extract({ left: 0, top: y0, width, height: h }).jpeg({ quality: 88 }).toBuffer();
      type = 'image/jpeg';
    }
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    res.status(200).send(buf);
  } catch {
    res.status(400).end();
  }
}
