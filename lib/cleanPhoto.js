// Foto "limpa": só o produto no fundo branco, sem banner com texto em volta.
// Mede: borda (quase toda branca), quantidade de contornos (texto gera muitos) e se o conteúdo
// é um bloco só ou está dividido (texto de um lado, produto do outro = banner).
import sharp from 'sharp';

const N = 128;

async function load(input) {
  if (Buffer.isBuffer(input)) return input;
  const r = await fetch(input, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`foto ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

export async function photoScore(input) {
  const { data } = await sharp(await load(input))
    .flatten({ background: '#ffffff' })
    .resize(N, N, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const lum = new Float32Array(N * N);
  const col = new Array(N).fill(0);
  let edge = 0, edgeWhite = 0;
  for (let i = 0; i < N * N; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    lum[i] = 0.3 * r + 0.59 * g + 0.11 * b;
    const white = r > 232 && g > 232 && b > 232;
    const x = i % N, y = (i / N) | 0;
    if (!white) col[x]++;
    if (x < 8 || x >= N - 8 || y < 8 || y >= N - 8) { edge++; if (white) edgeWhite++; }
  }
  let edges = 0;
  for (let y = 1; y < N - 1; y++)
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      if (Math.abs(lum[i] - lum[i + 1]) > 60 || Math.abs(lum[i] - lum[i + N]) > 60) edges++;
    }
  // Blocos de colunas com conteúdo, separados por 4+ colunas brancas
  let blocks = 0, on = false, gap = 0;
  for (let x = 0; x < N; x++) {
    if (col[x] > 3) { if (!on) blocks++; on = true; gap = 0; }
    else if (on && ++gap >= 4) on = false;
  }
  const s = { border: edgeWhite / edge, edges: edges / ((N - 2) * (N - 2)), blocks };
  s.clean = s.border >= 0.85 && (s.edges < 0.05 || (s.edges < 0.1 && blocks === 1));
  return s;
}

export async function isCleanPhoto(input) {
  try {
    return (await photoScore(input)).clean;
  } catch {
    return null; // não deu para conferir
  }
}

// Entre as fotos candidatas, a primeira limpa; se nenhuma for, null (fica a que já estava)
export async function pickCleanPhoto(urls, max = 6) {
  for (const u of [...new Set(urls.filter(Boolean))].slice(0, max)) {
    try {
      if ((await photoScore(u)).clean) return u;
    } catch {}
  }
  return null;
}

// Tira faixas com texto da borda da foto (tarja lateral, faixa no topo) e devolve a foto só com o produto,
// quadrada e com fundo branco. Sem faixa: null (a foto fica como está).
export async function cropBands(input) {
  const { findBands } = await import('./bandCrop.js');
  const buf = await sharp(await load(input)).flatten({ background: '#ffffff' }).toBuffer();
  const meta = await sharp(buf).metadata();
  const S = 300, w = S, h = Math.max(1, Math.round((S * meta.height) / meta.width));
  const small = await sharp(buf).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  let box = findBands(small, w, h, 3);
  if (!box) return null;
  // segunda passada no que sobrou (ex.: tarja lateral + faixa no topo)
  const sub = await sharp(small, { raw: { width: w, height: h, channels: 3 } })
    .extract({ left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top })
    .raw().toBuffer();
  const b2 = findBands(sub, box.right - box.left, box.bottom - box.top, 3);
  if (b2) box = { left: box.left + b2.left, top: box.top + b2.top, right: box.left + b2.right, bottom: box.top + b2.bottom };
  const k = meta.width / w;
  const region = {
    left: Math.max(0, Math.floor(box.left * k)),
    top: Math.max(0, Math.floor(box.top * k)),
    width: Math.min(meta.width, Math.ceil((box.right - box.left) * k)),
    height: Math.min(meta.height, Math.ceil((box.bottom - box.top) * k)),
  };
  region.width = Math.min(region.width, meta.width - region.left);
  region.height = Math.min(region.height, meta.height - region.top);
  // (extract e trim em etapas separadas: no mesmo comando o sharp faz o trim antes do recorte)
  const part = await sharp(buf).extract(region).toBuffer();
  const cut = await sharp(part).trim({ background: '#ffffff', threshold: 20 }).toBuffer();
  const cm = await sharp(cut).metadata();
  // Quadrado com margem branca em volta do produto (um resize só por comando: o sharp usa apenas o último)
  const side = Math.round(Math.max(cm.width, cm.height) * 1.12);
  const padX = side - cm.width, padY = side - cm.height;
  const square = await sharp(cut)
    .extend({ left: Math.floor(padX / 2), right: Math.ceil(padX / 2), top: Math.floor(padY / 2), bottom: Math.ceil(padY / 2), background: '#ffffff' })
    .toBuffer();
  return sharp(square).resize(1000, 1000).jpeg({ quality: 88 }).toBuffer();
}
