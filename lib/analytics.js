// Métricas do site (sem serviço de fora): o navegador manda eventos para /ev e o painel /analytics lê o resumo.
// Eventos: pv (página vista), card (abriu uma oferta pela lista), buy (clicou para ir à loja),
// group (clicou para entrar no grupo), nav (menu), cat (categoria), out (outro link).
import { db } from './db.js';

const T = new Set(['pv', 'card', 'buy', 'group', 'nav', 'cat', 'out']);
const cut = (v, n) => (v == null ? null : String(v).slice(0, n));

// Script que vai em todas as páginas
export function trackScript() {
  return `<script>(function(){try{
if(/bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse/i.test(navigator.userAgent)||navigator.webdriver)return;
var ls=window.localStorage,ss=window.sessionStorage,rid=function(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36)};
var vid,sid;try{vid=ls.getItem('_v')||(ls.setItem('_v',vid=rid()),vid);sid=ss.getItem('_s')||(ss.setItem('_s',sid=rid()),sid)}catch(e){vid=sid=rid()}
var dev=/Mobi|Android|iPhone/i.test(navigator.userAgent)?'celular':/iPad|Tablet/i.test(navigator.userAgent)?'tablet':'computador';
var qs=new URLSearchParams(location.search),src=qs.get('utm_source')||qs.get('s')||'';
var ref='';try{var r=document.referrer&&new URL(document.referrer);if(r&&r.host!==location.host)ref=r.host}catch(e){}
var pm=location.pathname.match(/^\\/p\\/([0-9a-z]+)/),oid=pm?parseInt(pm[1],36):null;
function send(e){e.path=location.pathname;e.vid=vid;e.sid=sid;e.dev=dev;e.src=src;e.ref=ref;var b=JSON.stringify([e]);
if(navigator.sendBeacon){navigator.sendBeacon('/ev',new Blob([b],{type:'text/plain'}))}else{fetch('/ev',{method:'POST',body:b,keepalive:true})}}
send({t:'pv',oid:oid,label:qs.get('q')||qs.get('loja')||qs.get('ordem')||''});
document.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('a');if(!a)return;var h=a.getAttribute('href')||'',txt=(a.innerText||a.getAttribute('aria-label')||'').trim().slice(0,60),u;
try{u=new URL(h,location.href)}catch(e){return}
var cm=u.host===location.host&&u.pathname.match(/^\\/p\\/([0-9a-z]+)/);
if(cm){send({t:'card',oid:parseInt(cm[1],36),label:a.closest('section')&&a.closest('section').querySelector('h2')?a.closest('section').querySelector('h2').innerText.slice(0,60):''});return}
if(/chat\\.whatsapp\\.com|wa\\.me/.test(u.host)){send({t:'group',oid:oid,label:txt||'grupo'});return}
if(/mercadolivre|mercadolibre|meli\\.la|amazon\\.|amzn\\.|a\\.co$/.test(u.host)){send({t:'buy',oid:oid,label:txt,store:/amazon|amzn|a\\.co/.test(u.host)?'amazon':'ml'});return}
if(u.host===location.host&&/^\\/categoria\\//.test(u.pathname)){send({t:'cat',label:txt||u.pathname});return}
if(u.host===location.host&&a.closest('nav')){send({t:'nav',label:txt});return}
if(u.host!==location.host)send({t:'out',oid:oid,label:u.host});
},true);
}catch(e){}})();</script>`;
}

// Recebe os eventos do navegador e guarda
export async function saveEvents(req) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (Buffer.isBuffer(body)) { try { body = JSON.parse(body.toString()); } catch { body = null; } }
  const list = (Array.isArray(body) ? body : [body]).filter((e) => e && T.has(e.t)).slice(0, 20);
  if (!list.length) return 0;
  const rows = list.map((e) => ({
    t: e.t,
    path: cut(e.path, 200),
    oid: Number.isSafeInteger(Number(e.oid)) && Number(e.oid) > 0 ? Number(e.oid) : null,
    label: cut(e.label, 120),
    store: e.store === 'amazon' || e.store === 'ml' ? e.store : null,
    ref: cut(e.ref, 80),
    dev: cut(e.dev, 20),
    vid: cut(e.vid, 40),
    sid: cut(e.sid, 40),
    src: cut(e.src, 40),
  }));
  await db.insert('events', rows);
  return rows.length;
}

// Resumo para o painel (função analytics no banco)
export async function stats(days) {
  const base = `${process.env.SUPABASE_URL.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')}/rest/v1`;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(`${base}/rpc/analytics`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_days: Math.min(90, Math.max(1, Number(days) || 7)) }),
  });
  if (!r.ok) throw new Error(`analytics ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
