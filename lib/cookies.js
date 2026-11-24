// Sessões que se renovam: a Amazon e o ML devolvem cookies atualizados a cada resposta (Set-Cookie).
// Guardamos a versão mais recente no banco (tabela state) e usamos ela nas próximas chamadas.
// Se você colar um cookie novo na Vercel, ele passa a valer na hora (o sistema percebe a troca).
import { createHash } from 'node:crypto';
import { db } from './db.js';

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

function parse(str) {
  const m = new Map();
  for (const part of String(str || '').split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    m.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  return m;
}
const serialize = (m) => [...m].map(([k, v]) => `${k}=${v}`).join('; ');

export async function getCookie(name, envValue) {
  const env = (envValue || '').trim();
  if (!env) return '';
  try {
    const [row] = await db.select('state', `key=eq.cookie_${name}`);
    if (row) {
      const st = JSON.parse(row.value);
      if (st.base === hash(env) && st.value) return st.value; // ainda é a sessão que você colou, já renovada
    }
  } catch {}
  return env;
}

// Junta os Set-Cookie da resposta ao cookie atual e salva se algo mudou
export async function absorb(name, envValue, current, res) {
  const env = (envValue || '').trim();
  if (!env || !res?.headers) return current;
  const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (!set.length) return current;
  const jar = parse(current);
  let changed = false;
  for (const line of set) {
    const first = line.split(';')[0];
    const i = first.indexOf('=');
    if (i <= 0) continue;
    const k = first.slice(0, i).trim();
    const v = first.slice(i + 1).trim();
    const expired = /max-age=0\b/i.test(line) || /expires=[^;]*19[0-7]\d/i.test(line);
    if (!v || expired) {
      // não apagamos cookies de login por causa de uma resposta isolada
      continue;
    }
    if (jar.get(k) !== v) { jar.set(k, v); changed = true; }
  }
  if (!changed) return current;
  const value = serialize(jar);
  try {
    await db.upsert('state', [{ key: `cookie_${name}`, value: JSON.stringify({ base: hash(env), value, at: Date.now() }) }], 'key');
  } catch {}
  return value;
}
