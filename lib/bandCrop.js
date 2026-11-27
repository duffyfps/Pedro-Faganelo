// Acha faixas com texto na borda da foto (ex.: tarja lateral "Creme Firmador Pele Seca", faixa
// "EMBALAGEM ECONÔMICA" no topo), separadas do produto por um vão branco, e devolve o recorte sem elas.
// Divide a foto em blocos (colunas ou linhas com conteúdo, separados por vãos brancos). Faixa = bloco na ponta
// que vai de uma borda à outra da foto (de cima a baixo, ou de lado a lado), o que um produto fotografado quase
// nunca faz. Pixels RGBA ou RGB. Retorna { left, top, right, bottom } em pixels, ou null se não há faixa.
export function findBands(data, W, H, ch = 4) {
  const white = (i) => data[i] > 232 && data[i + 1] > 232 && data[i + 2] > 232;
  const col = new Float32Array(W), row = new Float32Array(H);
  const cFirst = new Int32Array(W).fill(-1), cLast = new Int32Array(W).fill(-1);
  const rFirst = new Int32Array(H).fill(-1), rLast = new Int32Array(H).fill(-1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (white((y * W + x) * ch)) continue;
      col[x]++; row[y]++;
      if (cFirst[x] < 0) cFirst[x] = y;
      cLast[x] = y;
      if (rFirst[y] < 0) rFirst[y] = x;
      rLast[y] = x;
    }
  for (let x = 0; x < W; x++) col[x] /= H;
  for (let y = 0; y < H; y++) row[y] /= W;

  // prof: cobertura por coluna (ou linha); first/last: onde o conteúdo começa e termina nela; len: altura (ou largura)
  const cut = (prof, first, last, n, len) => {
    const minGap = Math.max(2, Math.round(n * 0.015));
    const blocks = [];
    let start = -1, gap = 0;
    for (let k = 0; k <= n; k++) {
      const on = k < n && prof[k] > 0.04;
      if (on) { if (start < 0) start = k; gap = 0; }
      else if (start >= 0 && (++gap >= minGap || k === n)) {
        const end = k - gap;
        let mass = 0, full = 0;
        for (let i = start; i <= end; i++) {
          mass += prof[i];
          if (first[i] >= 0 && first[i] <= len * 0.02 && last[i] >= len * 0.98) full++;
        }
        blocks.push({ a: start, b: end, mass, span: full / (end - start + 1) });
        start = -1; gap = 0;
      }
    }
    if (blocks.length < 2) return [0, n];
    const product = blocks.filter((b) => b.span < 0.5);
    if (!product.length) return [0, n];
    const isBand = (b) => b.span >= 0.8 && b.b - b.a + 1 <= n * 0.4;
    let lo = 0, hi = n;
    if (isBand(blocks[0])) lo = Math.floor((blocks[0].b + blocks[1].a) / 2);
    const L = blocks.length;
    if (isBand(blocks[L - 1])) hi = Math.ceil((blocks[L - 2].b + blocks[L - 1].a) / 2);
    return [lo, hi];
  };
  const [left, right] = cut(col, cFirst, cLast, W, H);
  const [top, bottom] = cut(row, rFirst, rLast, H, W);
  if (left === 0 && right === W && top === 0 && bottom === H) return null;
  if (right - left < W * 0.45 || bottom - top < H * 0.45) return null;
  return { left, top, right, bottom };
}
