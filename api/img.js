// Repassa a foto do produto para o painel poder compartilhá-la no WhatsApp
const ALLOWED = /(^|\.)(media-amazon\.com|ssl-images-amazon\.com|mlstatic\.com|telesco\.pe)$/i;

export default async function handler(req, res) {
  try {
    const u = new URL(String(req.query.url || ''));
    if (u.protocol !== 'https:' || !ALLOWED.test(u.hostname)) return res.status(400).end();
    const r = await fetch(u);
    if (!r.ok) return res.status(502).end();
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(Buffer.from(await r.arrayBuffer()));
  } catch {
    res.status(400).end();
  }
}
