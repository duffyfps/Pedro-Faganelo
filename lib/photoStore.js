// Guarda uma cópia PERMANENTE da foto no Supabase Storage (bucket público "fotos").
// Motivo: os links de foto do Telegram (cdn*.telesco.pe) expiram em ~1 dia e a foto some do site.
// Fotos da Amazon/ML (links permanentes) ficam como estão.
const base = () => `${process.env.SUPABASE_URL.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')}/storage/v1`;
const H = () => ({ apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` });
const BUCKET = 'fotos';
let bucketOk = false;

export const needsCopy = (url) => /(^https:\/\/[^/]*telesco\.pe\/)|(\/api\/img\?)/i.test(String(url || ''));

async function ensureBucket() {
  if (bucketOk) return;
  const r = await fetch(`${base()}/bucket/${BUCKET}`, { headers: H() });
  if (!r.ok) {
    await fetch(`${base()}/bucket`, {
      method: 'POST',
      headers: { ...H(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });
  }
  bucketOk = true;
}

// Devolve o link permanente (ou o original, se não precisar/conseguir copiar)
export async function keepPhoto(url, name) {
  if (!needsCopy(url) || !process.env.SUPABASE_URL) return url;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return url;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 2000) return url;
    await ensureBucket();
    const file = `${String(name).replace(/[^a-z0-9_-]+/gi, '_')}.jpg`;
    const up = await fetch(`${base()}/object/${BUCKET}/${file}`, {
      method: 'POST',
      headers: { ...H(), 'Content-Type': r.headers.get('content-type') || 'image/jpeg', 'x-upsert': 'true', 'Cache-Control': '31536000' },
      body: buf,
    });
    if (!up.ok) return url;
    return `${base()}/object/public/${BUCKET}/${file}`;
  } catch {
    return url;
  }
}
