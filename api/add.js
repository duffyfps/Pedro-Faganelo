// Adicionar oferta manualmente: cole um link da Amazon ou do Mercado Livre
import { getItems, asinFromUrl } from '../lib/amazon.js';
import { lookup } from '../lib/ml.js';
import { processProduct } from '../lib/offers.js';
import { requirePassword } from '../lib/auth.js';

const num = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function finalUrl(u) {
  try {
    const r = await fetch(u, { redirect: 'follow' });
    return r.url || u;
  } catch {
    return u;
  }
}

export default async function handler(req, res) {
  if (!requirePassword(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const b = req.body || {};
    const url = String(b.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'cole um link começando com https://' });

    let p;
    if (/amazon\.com\.br|amzn\.to|a\.co\//i.test(url)) {
      const full = /amzn\.to|a\.co\//i.test(url) ? await finalUrl(url) : url;
      const asin = asinFromUrl(full);
      if (!asin) return res.status(400).json({ error: 'não achei o código do produto (ASIN) nesse link' });
      [p] = await getItems([asin]);
      if (!p) return res.status(404).json({ error: 'produto sem oferta disponível na Amazon agora' });
    } else if (/mercadoli[vb]re\.com|meli\.la/i.test(url)) {
      p = await lookup(url);
      p.dealType = null;
    } else {
      return res.status(400).json({ error: 'só aceito links da Amazon ou do Mercado Livre' });
    }

    // Campos digitados por você têm prioridade
    if (b.title) p.title = String(b.title).trim();
    if (num(b.price)) p.price = num(b.price);
    if (num(b.listPrice)) p.listPrice = num(b.listPrice);
    if (b.image) p.image = String(b.image).trim();

    const missing = ['title', 'price'].filter((k) => !p[k]);
    if (missing.length) return res.status(422).json({ needs: missing, found: p });

    const offer = await processProduct(p, { force: true });
    res.status(200).json(offer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
