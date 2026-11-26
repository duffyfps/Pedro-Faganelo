// Imagem da prévia (og:image) com a marca: foto do produto ocupando tudo + logo do Magnata (PNG transparente).
// Uso: /api/og?url=<foto do produto>   → JPEG 1200x1200 (prévia grande no WhatsApp)
const ALLOWED = /(^|\.)(media-amazon\.com|ssl-images-amazon\.com|mlstatic\.com|telesco\.pe)$/i;

export default async function handler(req, res) {
  try {
    const sharp = (await import('sharp')).default;
    const u = new URL(String(req.query.url || ''));
    if (u.protocol !== 'https:' || !ALLOWED.test(u.hostname)) return res.status(400).end();
    const S = 1200;
    const [photo, logo] = await Promise.all([
      fetch(u, { signal: AbortSignal.timeout(7000) }).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('foto')))),
      fetch(`https://${req.headers.host}/logo-marca.webp`, { signal: AbortSignal.timeout(5000) }).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
    ]);
    // Foto ocupando a imagem inteira (sem bordas brancas)
    const pic = await sharp(Buffer.from(photo)).resize(S, S, { fit: 'cover', position: 'attention' }).flatten({ background: '#ffffff' }).toBuffer();
    const layers = [];
    if (logo) {
      // Logo com fundo transparente no canto de baixo, com uma sombra leve para destacar em qualquer foto
      const lg = await sharp(Buffer.from(logo)).resize({ width: 400 }).toBuffer();
      const meta = await sharp(lg).metadata();
      const shadow = await sharp(lg).ensureAlpha().extractChannel('alpha').blur(14).linear(0.55, 0).toColourspace('b-w').toBuffer();
      const sh = await sharp({ create: { width: meta.width, height: meta.height, channels: 3, background: '#000000' } }).joinChannel(shadow).png().toBuffer();
      const left = 26, top = S - meta.height - 26;
      layers.push({ input: sh, left: left + 4, top: top + 8 }, { input: lg, left, top });
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
