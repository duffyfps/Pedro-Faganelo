// Imagem da prévia (og:image) com a marca: foto do produto ocupando tudo + logo do Magnata (PNG transparente).
// Uso: /api/og?url=<foto do produto>   → JPEG 1200x1200 (prévia grande no WhatsApp)
import { brand } from '../lib/brand.js';
const ALLOWED = /(^|\.)(media-amazon\.com|ssl-images-amazon\.com|mlstatic\.com|telesco\.pe|supabase\.co)$/i;

export default async function handler(req, res) {
  try {
    const sharp = (await import('sharp')).default;
    const u = new URL(String(req.query.url || ''));
    if (u.protocol !== 'https:' || !(ALLOWED.test(u.hostname) || u.hostname === String(req.headers.host || '').split(':')[0])) return res.status(400).end();
    const S = 1200;
    const [photo, logo] = await Promise.all([
      fetch(u, { signal: AbortSignal.timeout(7000) }).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('foto')))),
      fetch(`https://${req.headers.host}${brand().mark}`, { signal: AbortSignal.timeout(5000) }).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
    ]);
    // Prévia sempre QUADRADA com o produto inteiro e centralizado no fundo branco (o WhatsApp corta fotos
    // compridas: produto alto ou largo perdia o topo/os lados). Tira a borda branca e deixa uma margem igual em volta.
    const flat = await sharp(Buffer.from(photo)).flatten({ background: '#ffffff' }).toBuffer();
    let core = flat;
    try {
      const t = await sharp(flat).trim({ background: '#ffffff', threshold: 18 }).toBuffer();
      const tm = await sharp(t).metadata();
      if (tm.width > 40 && tm.height > 40) core = t;
    } catch {}
    const M = Math.round(S * 0.07), inner = S - 2 * M;
    const fit = await sharp(core).resize(inner, inner, { fit: 'inside' }).toBuffer();
    const fm = await sharp(fit).metadata();
    const pic = await sharp({ create: { width: S, height: S, channels: 3, background: '#ffffff' } })
      .composite([{ input: fit, left: Math.round((S - fm.width) / 2), top: Math.round((S - fm.height) / 2) }])
      .png().toBuffer();
    const pm = await sharp(pic).metadata();
    const layers = [];
    if (logo) {
      // Logo com fundo transparente no canto de baixo, com uma sombra leve para destacar em qualquer foto
      const lg = await sharp(Buffer.from(logo)).resize({ width: Math.round(Math.min(pm.width, pm.height) * (brand().markScale || 0.3)) }).toBuffer();
      const meta = await sharp(lg).metadata();
      const shadow = await sharp(lg).ensureAlpha().extractChannel('alpha').blur(14).linear(0.55, 0).toColourspace('b-w').toBuffer();
      const sh = await sharp({ create: { width: meta.width, height: meta.height, channels: 3, background: '#000000' } }).joinChannel(shadow).png().toBuffer();
      const left = Math.round(pm.width * 0.02), top = pm.height - meta.height - 18;
      if (brand().markShadow !== false) layers.push({ input: sh, left: left + 4, top: top + 8 });
      layers.push({ input: lg, left, top });
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
