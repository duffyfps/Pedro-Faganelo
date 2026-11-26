// Imagem da prévia (og:image) com a marca: foto do produto + logo do Magnata + selo de desconto.
// Uso: /api/og?url=<foto do produto>&off=50   → JPEG 1200x1200 (prévia grande no WhatsApp)
const ALLOWED = /(^|\.)(media-amazon\.com|ssl-images-amazon\.com|mlstatic\.com|telesco\.pe)$/i;

export default async function handler(req, res) {
  try {
    const sharp = (await import('sharp')).default;
    const u = new URL(String(req.query.url || ''));
    if (u.protocol !== 'https:' || !ALLOWED.test(u.hostname)) return res.status(400).end();
    const off = Math.max(0, Math.min(99, parseInt(req.query.off, 10) || 0));
    const S = 1200;
    const [photo, logo] = await Promise.all([
      fetch(u, { signal: AbortSignal.timeout(7000) }).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('foto')))),
      fetch(`https://${req.headers.host}/logo.webp`, { signal: AbortSignal.timeout(5000) }).then((r) => r.arrayBuffer()).catch(() => null),
    ]);
    const pic = await sharp(Buffer.from(photo)).resize(S, S, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).toBuffer();
    const layers = [];
    if (logo) {
      const lw = 300;
      const lg = await sharp(Buffer.from(logo)).resize({ width: lw }).toBuffer();
      const meta = await sharp(lg).metadata();
      const pad = 18;
      const box = await sharp({ create: { width: lw + pad * 2, height: meta.height + pad * 2, channels: 4, background: '#000000' } })
        .composite([{ input: Buffer.from(`<svg width="${lw + pad * 2}" height="${meta.height + pad * 2}"><rect width="100%" height="100%" rx="28" fill="#fff"/></svg>`), blend: 'dest-in' }, { input: lg, left: pad, top: pad }])
        .png().toBuffer();
      layers.push({ input: box, left: 34, top: S - meta.height - pad * 2 - 34 });
    }
    if (off) {
      const badge = Buffer.from(`<svg width="300" height="130" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="130" rx="26" fill="#e0262f"/><text x="150" y="92" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="78" fill="#fff">-${off}%</text></svg>`);
      layers.push({ input: badge, left: S - 300 - 34, top: 34 });
    }
    const out = await sharp(pic).composite(layers).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    res.status(200).send(out);
  } catch {
    // Se algo falhar, manda a foto original
    res.redirect(302, `/api/img?url=${encodeURIComponent(String(req.query.url || ''))}`);
  }
}
