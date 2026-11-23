// Acesso ao Supabase pela API REST (sem dependências)
// Aceita a URL com ou sem "/rest/v1" no final
const URL_BASE = () => `${process.env.SUPABASE_URL.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')}/rest/v1`;

function headers(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function call(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${URL_BASE()}/${path}`, {
    method,
    headers: headers(prefer ? { Prefer: prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export const db = {
  select: (table, query = '') => call(`${table}?${query}`),
  insert: (table, rows) =>
    call(table, { method: 'POST', body: rows, prefer: 'return=representation' }),
  upsert: (table, rows, onConflict = 'id') =>
    call(`${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      body: rows,
      prefer: 'resolution=merge-duplicates,return=minimal',
    }),
  update: (table, query, patch) =>
    call(`${table}?${query}`, { method: 'PATCH', body: patch, prefer: 'return=representation' }),
};
