// Caçador: chamado a cada 15 min pelo cron-job.org
import { db } from '../lib/db.js';
import { searchItems } from '../lib/amazon.js';
import { processProduct } from '../lib/offers.js';
import { requireCronKey } from '../lib/auth.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TIME_BUDGET_MS = 50_000;

export default async function handler(req, res) {
  if (!requireCronKey(req, res)) return;
  const started = Date.now();
  const summary = { searches: 0, seen: 0, newOffers: 0, errors: [] };

  try {
    // Limpa a fila: ofertas pendentes com mais de 24h saem
    await db.update(
      'offers',
      `status=eq.pending&created_at=lt.${new Date(Date.now() - 86400000).toISOString()}`,
      { status: 'rejected' }
    );

    const searches = await db.select('searches', 'active=eq.true&order=id');
    for (const s of searches) {
      for (let page = 1; page <= (s.pages || 1); page++) {
        if (Date.now() - started > TIME_BUDGET_MS) break;
        try {
          const items = await searchItems(s, page);
          summary.seen += items.length;
          for (const p of items) {
            if (await processProduct(p)) summary.newOffers++;
          }
        } catch (e) {
          summary.errors.push(`${s.keywords || s.browse_node_id} p${page}: ${e.message.slice(0, 200)}`);
        }
        await sleep(1100); // respeita o limite de ~1 requisição/segundo
      }
      summary.searches++;
    }
  } catch (e) {
    summary.errors.push(e.message.slice(0, 300));
  }

  summary.ms = Date.now() - started;
  res.status(summary.errors.length && !summary.seen ? 500 : 200).json(summary);
}
