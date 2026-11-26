// Detecta o selo de marca d'água de outro canal na foto do post (ex.: "@xetdaspromocoes").
// O selo é uma "pílula" escura de cor sólida (~RGB 24,24,26) com texto branco por cima.
// Procura uma mancha dessa cor com formato de pílula: larga, baixa, quase sem variação de tom e com texto branco dentro.

export function findBadge(data, W, H, ch = 3) {
  const n = W * H;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * ch], g = data[i * ch + 1], b = data[i * ch + 2];
    if (Math.abs(r - 24) <= 9 && Math.abs(g - 24) <= 9 && Math.abs(b - 26) <= 9) mask[i] = 1;
  }
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (!mask[i] || seen[i]) continue;
    let sp = 0, count = 0, x0 = W, x1 = 0, y0 = H, y1 = 0, sum = 0, sum2 = 0;
    stack[sp++] = i; seen[i] = 1;
    while (sp) {
      const j = stack[--sp]; count++;
      const x = j % W, y = (j / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const v = Math.max(data[j * ch], data[j * ch + 1], data[j * ch + 2]); sum += v; sum2 += v * v;
      const nb = [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1];
      for (const k of nb) if (k >= 0 && mask[k] && !seen[k]) { seen[k] = 1; stack[sp++] = k; }
    }
    if (count < 0.004 * n) continue;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w < 0.18 * W || h < 0.035 * H || h > 0.16 * H || w / h < 2.5) continue;
    const fill = count / (w * h);
    const m = sum / count, sd = Math.sqrt(Math.max(0, sum2 / count - m * m));
    let white = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = (y * W + x) * ch;
      if (data[k] > 200 && data[k + 1] > 200 && data[k + 2] > 200) white++;
    }
    const wr = white / (w * h);
    if (fill >= 0.45 && sd < 8 && wr >= 0.015 && wr <= 0.35) return { x: x0 / W, y: y0 / H, w: w / W, h: h / H };
  }
  return null;
}

// true = tem selo; false = limpa; null = não deu para conferir (trate como dúvida)
export async function hasWatermark(url) {
  try {
    const sharp = (await import('sharp')).default;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { wm: null, why: `foto ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(buf).resize(400, 400, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const hit = findBadge(data, info.width, info.height, info.channels);
    return { wm: !!hit, why: hit ? 'selo encontrado' : 'limpa', hit };
  } catch (e) {
    return { wm: null, why: `erro ${e.name}: ${String(e.message).slice(0, 60)}` };
  }
}

// Foto oficial da Amazon pelo ASIN (sem login). Devolve null se a Amazon não tiver.
export async function amazonImage(asin) {
  if (!asin) return null;
  const url = `https://m.media-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_.jpg`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const len = Number(res.headers.get('content-length') || 0) || (await res.arrayBuffer()).byteLength;
    return res.ok && len > 2000 ? url : null; // imagem "vazia" da Amazon tem ~43 bytes
  } catch {
    return null;
  }
}

// Foto do post SEM o selo: corta a faixa de cima (ou de baixo) onde o selo está.
// Só corta se sobrar pelo menos 75% da foto. Devolve o endereço da foto limpa (servida pelo nosso /api/img) ou null.
export function cleanPhotoUrl(url, hit) {
  if (!url || !hit) return null;
  const site = (process.env.SITE_URL || 'https://ofertas-pedro.vercel.app').replace(/\/$/, '');
  const m = 0.015;
  const top = hit.y + hit.h + m; // corta tudo acima do fim do selo
  const bottom = 1 - (hit.y - m); // corta tudo abaixo do começo do selo
  if (hit.y + hit.h / 2 < 0.5 && top <= 0.25) return `${site}/api/img?top=${top.toFixed(3)}&url=${encodeURIComponent(url)}`;
  if (hit.y + hit.h / 2 >= 0.5 && bottom <= 0.25) return `${site}/api/img?bottom=${bottom.toFixed(3)}&url=${encodeURIComponent(url)}`;
  return null;
}
