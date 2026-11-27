// Tira do site as ofertas cujo anúncio saiu do ar (pausado/finalizado no Mercado Livre).
// Roda aos pouquinhos (poucas páginas por vez) para não chamar atenção do ML.
import { db } from './db.js';
import { readState as getState, writeState as setState } from './alerts.js';
import { mlListingStatus } from './mlLink.js';

export async function checkSome(max = 4) {
  const now = Date.now();
  const newest = new Date(now - 30 * 60000).toISOString(); // dá 30 min depois do envio
  const oldest = new Date(now - 3 * 86400000).toISOString(); // olha até 3 dias para trás
  let cursor = (await getState('avail_cursor')) || newest;
  const ms = Date.parse(cursor);
  cursor = !ms || ms > Date.parse(newest) || ms < Date.parse(oldest) ? newest : new Date(ms).toISOString();
  const rows = await db.select('offers', `status=eq.sent&sent_at=lt.${encodeURIComponent(cursor)}&sent_at=gte.${encodeURIComponent(oldest)}&product_id=like.ml:MLB*&select=id,product_id,sent_at&order=sent_at.desc&limit=${max}`);
  if (!rows.length) { await setState('avail_cursor', newest); return { checked: 0, off: 0 }; }
  let off = 0;
  const done = new Set();
  for (const o of rows) {
    if (done.has(o.product_id)) continue;
    done.add(o.product_id);
    const st = await mlListingStatus(o.product_id);
    if (st === 'off') {
      off++;
      await db.update('offers', `product_id=eq.${encodeURIComponent(o.product_id)}&status=eq.sent`, { status: 'rejected' });
    }
    if (st === 'unknown') break; // bloqueou: para por agora e tenta depois
  }
  await setState('avail_cursor', rows.at(-1).sent_at);
  return { checked: done.size, off };
}
