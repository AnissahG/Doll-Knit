// ===================== SYNC BETWEEN DEVICES =====================
// Shared word-for-word by Doll knit, Doll crochet and Doll embroidery (www/js/sync.js); keep the three in step.
// Same design as Doll sew, Doll accessories, Doll Ledger and Dollheimr Social: the Supabase project already
// set up for Dollheimr Studio (same URL, key, email and password), with this app's own table, so it never
// touches the other apps' data. Every record this device writes is dated (_ts) and queued; the queue goes
// up a few seconds later. Other devices' changes come down on open, every 30 s while the app is visible,
// and after each upload. Newest edit wins.
//
// Each app hands Sync.configure() an adapter that knows its own storage:
//   app, table, prefix (localStorage), stores: [...], btn: { main, alt } (button classes)
//   get(store, id) → record | undefined          list(store) → records
//   write(store, rec), remove(store, id)          raw writes that are not queued again
//   clearAll()                                    empties every synced store (raw)
//   encode(store, rec) / decode(store, data)      optional, e.g. photo Blobs ⇄ data URLs
//   flush(stores)                                 optional, after a pull has written records
//   refresh(stores)                               redraw what came down from other devices
//   hasData()                                     does this device hold any real (non-example) data?
//   status(text, kind)                            show the short status ('on' | 'bad' | '')
//   toast(msg)                                    optional, when the app has no global toast()
(function (root) {
'use strict';

let A = null;
const SY = { cfg: null, outbox: {}, lastOk: null, busy: false, state: 'off', error: '', touched: new Set(), dirty: new Set() };
const lsGet = (k, d) => { try { const v = localStorage.getItem(A.prefix + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(A.prefix + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
const saveCfg = () => lsSet('sync', SY.cfg), saveOutbox = () => lsSet('outbox', SY.outbox);
const nowIso = () => new Date().toISOString();
const on = () => !!(SY.cfg && SY.cfg.url && SY.cfg.key && SY.cfg.session);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const say = msg => (A && A.toast ? A.toast(msg) : root.toast ? root.toast(msg) : console.log(msg));

// ---- tracking: the app calls these from its storage layer, just before a record is written or deleted
let timer;
function queue(key, del) {
  if (!SY.cfg) return;
  SY.outbox[key] = del || '1'; if (SY.busy) SY.touched.add(key);
  saveOutbox(); clearTimeout(timer); timer = setTimeout(() => syncNow(), 2500);
  status();
}
function stamp(store, rec) {
  if (!rec || rec.id == null) return rec;
  rec._ts = nowIso(); queue(store + '|' + rec.id);
  return rec;
}
function removed(store, id) { if (id != null) queue(store + '|' + id, nowIso()); }

// ---- Supabase REST (no library needed)
const sbUrl = p => SY.cfg.url.replace(/\/+$/, '') + p;
async function sb(path, opts, retried) {
  opts = opts || {};
  if (SY.cfg.session.expires_at <= Date.now()) await sbRefresh();
  const r = await fetch(sbUrl(path), Object.assign({}, opts, { headers: Object.assign({ apikey: SY.cfg.key, Authorization: 'Bearer ' + SY.cfg.session.access_token }, opts.headers || {}) }));
  if (r.status === 401 && !retried) { await sbRefresh(); return sb(path, opts, true); }
  if (!r.ok) { let msg = String(r.status); try { const j = await r.json(); msg = j.msg || j.message || j.error_description || j.error || msg; } catch (e) { } const er = new Error(msg); er.status = r.status; throw er; }
  return r;
}
async function sbAuth(kind, body) {
  const r = await fetch(sbUrl(kind === 'signup' ? '/auth/v1/signup' : '/auth/v1/token?grant_type=' + kind), { method: 'POST', headers: { apikey: SY.cfg.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch (e) { }
  if (!r.ok) throw new Error(j.msg || j.error_description || j.message || j.error || ('Sign-in failed (' + r.status + ')'));
  return j;
}
function keepSession(j) { const o = SY.cfg.session || {}; SY.cfg.session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + ((j.expires_in || 3600) - 60) * 1000, user_id: (j.user && j.user.id) || o.user_id, email: (j.user && j.user.email) || o.email || SY.cfg.email }; saveCfg(); }
async function sbRefresh() {
  try { keepSession(await sbAuth('refresh_token', { refresh_token: SY.cfg.session.refresh_token })); }
  catch (e) { SY.cfg.session = null; saveCfg(); SY.state = 'error'; SY.error = 'Signed out. Sign in again (☁ Sync).'; throw e; }
}

async function push() {
  SY.touched.clear();
  const keys = Object.keys(SY.outbox);
  let i = 0;
  while (i < keys.length) {
    // batches of up to 100 records or ~1 MB (photos and saved patterns can be large)
    const chunk = [], rows = []; let bytes = 0;
    while (i < keys.length && chunk.length < 100 && (bytes < 1000000 || !chunk.length)) {
      const k = keys[i++], j = k.indexOf('|'), store = k.slice(0, j), id = k.slice(j + 1), m = SY.outbox[k];
      const r = m === '1' ? await A.get(store, id) : null;
      const row = r ? { id: k.replace('|', ':'), store, rec_id: id, data: A.encode ? await A.encode(store, r) : r, deleted: false, updated_at: r._ts || nowIso() }
        : { id: k.replace('|', ':'), store, rec_id: id, data: null, deleted: true, updated_at: m !== '1' ? m : nowIso() };
      bytes += JSON.stringify(row).length; chunk.push(k); rows.push(row);
    }
    await sb('/rest/v1/' + A.table + '?on_conflict=user_id,id', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
    chunk.forEach(k => { if (!SY.touched.has(k)) delete SY.outbox[k]; }); saveOutbox();
  }
}
async function pull() {
  let n = 0, since = SY.cfg.lastPull || '1970-01-01T00:00:00Z';
  const changed = new Set();
  for (let g = 0; g < 4000; g++) {
    const rows = await (await sb('/rest/v1/' + A.table + '?select=store,rec_id,data,deleted,updated_at,server_ts&server_ts=gt.' + encodeURIComponent(since) + '&order=server_ts.asc&limit=25')).json();
    if (!rows.length) break;
    for (const row of rows) {
      since = row.server_ts; const store = row.store, id = row.rec_id;
      if (!A.stores.includes(store)) continue;
      if (SY.outbox[store + '|' + id]) continue; // a newer change on this device is waiting to go up
      const local = await A.get(store, id), ver = (local && local._ts) || '';
      if (row.deleted) {
        if (local && ver <= row.updated_at) { await A.remove(store, id); changed.add(store); n++; }
        continue;
      }
      if (local && ver >= row.updated_at) continue;
      const rec = A.decode ? await A.decode(store, row.data) : row.data;
      rec._ts = row.updated_at;
      await A.write(store, rec); changed.add(store); n++;
    }
    SY.cfg.lastPull = since; saveCfg();
    if (rows.length < 25) break;
  }
  if (changed.size) {
    if (A.flush) await A.flush(changed);
    changed.forEach(s => SY.dirty.add(s)); refreshUI();
  }
  return n;
}
// Redraw what changed, but never under the user's fingers: if they are typing, wait until they stop.
function refreshUI() {
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.closest('.dsync-sheet')) return;
  if (!SY.dirty.size) return;
  const d = new Set(SY.dirty); SY.dirty.clear();
  Promise.resolve(A.refresh(d)).catch(e => console.warn('sync refresh', e));
}
document.addEventListener('focusout', () => setTimeout(() => { if (SY.dirty.size) refreshUI(); }, 300));

async function syncNow(manual) {
  if (!on() || SY.busy) return;
  if (!navigator.onLine) { SY.state = 'offline'; status(); return; }
  SY.busy = true; SY.state = 'syncing'; status();
  try {
    await push();
    const n = await pull();
    SY.state = 'ok'; SY.error = ''; SY.lastOk = nowIso(); lsSet('syncLastOk', SY.lastOk);
    if (manual) say(n ? 'Synced: ' + n + ' change' + (n === 1 ? '' : 's') + ' from your other devices' : 'Everything is up to date');
  } catch (e) {
    SY.state = navigator.onLine ? 'error' : 'offline';
    SY.error = e.status === 404 ? A.app + '\'s table is missing in Supabase. Run the setup script (☁ Sync → Setup script).' : e.status === 401 || e.status === 403 ? 'Supabase refused access. Sign in again.' : /Failed to fetch|NetworkError|Load failed/i.test(e.message) ? 'Could not reach Supabase. Changes will sync when the connection is back.' : (e.message || String(e));
    if (manual) say('Sync failed: ' + SY.error);
  } finally { SY.busy = false; status(); }
}

// ---- status + sheet
function status() {
  if (!A) return;
  const pend = Object.keys(SY.outbox).length, c = SY.cfg;
  let txt = 'Sync: off', kind = '';
  if (c && c.url) {
    if (!c.session) { txt = 'Signed out'; kind = 'bad'; } else if (SY.state === 'syncing') txt = 'Syncing…'; else if (SY.state === 'error') { txt = 'Sync problem'; kind = 'bad'; }
    else if (pend) txt = pend + ' to sync'; else if (SY.state === 'offline') txt = 'Offline'; else { txt = 'Synced'; kind = 'on'; }
  }
  A.status(txt, kind);
  const box = document.getElementById('dsyncBox'); if (box) box.innerHTML = boxHTML();
}
function boxHTML() {
  const c = SY.cfg, b = A.btn;
  if (!(c && c.url)) return `<p>Keep your phone, tablet and computer showing the same ${esc(A.what)}. It uses the Supabase project you already set up for Dollheimr Studio: same Project URL, key, email and password.</p>
    <div class="dsync-row"><button class="${b.main}" data-sy="setup">Set up sync</button><button class="${b.alt}" data-sy="sql">Setup script</button></div>`;
  const pend = Object.keys(SY.outbox).length;
  return `<p>Signed in as <b>${esc((c.session && c.session.email) || c.email || '')}</b>${c.session ? '' : ' (signed out)'}. ${({ ok: 'Synced', syncing: 'Syncing…', offline: 'Offline', error: 'Problem' }[SY.state] || 'Waiting')} · ${SY.lastOk ? 'last sync ' + new Date(SY.lastOk).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'not synced yet'}${pend ? ' · ' + pend + ' waiting to upload' : ''}</p>
    ${SY.error ? `<div class="dsync-err">${esc(SY.error)}</div>` : ''}
    <div class="dsync-row"><button class="${b.main}" data-sy="now">Sync now</button>${c.session ? '' : `<button class="${b.alt}" data-sy="setup">Sign in again</button>`}<button class="${b.alt}" data-sy="off">Turn off here</button><button class="${b.alt}" data-sy="sql">Setup script</button></div>`;
}
const CSS = `.dsync-sheet{position:fixed;inset:0;z-index:9999;background:rgba(20,14,10,.45);display:flex;align-items:center;justify-content:center;padding:16px}
.dsync-card{background:var(--panel,#fff);color:var(--ink,#222);width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:18px 18px 14px;border:1px solid var(--line,#ccc);border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.25);font-size:15px;line-height:1.45}
.dsync-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}.dsync-head h3{margin:0;flex:1;font-size:1.15rem}
.dsync-card p{margin:0 0 10px}.dsync-row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 6px}
.dsync-field{display:block;margin:0 0 9px;font-size:.85rem;font-weight:600}.dsync-field input{display:block;width:100%;box-sizing:border-box;margin-top:3px;padding:8px 10px;font:inherit;font-weight:400;border:1px solid var(--line,#ccc);border-radius:6px;background:var(--paper,#fff);color:inherit}
.dsync-sql{white-space:pre-wrap;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;background:rgba(0,0,0,.05);padding:10px;max-height:40vh;overflow:auto;border-radius:6px;user-select:all}
.dsync-err{background:rgba(180,48,42,.1);color:#9b2f28;padding:8px 10px;border-radius:6px;margin:0 0 8px}
.dsync-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#aaa;vertical-align:middle}.dsync-dot.on{background:#3c8c5a}.dsync-dot.bad{background:#c0392b}`;
function addCss() {
  if (document.getElementById('dsyncCss')) return;
  const st = document.createElement('style'); st.id = 'dsyncCss'; st.textContent = CSS; document.head.appendChild(st);
}
function sheet(inner) {
  addCss();
  let ov = document.querySelector('.dsync-sheet');
  if (!ov) {
    ov = document.createElement('div'); ov.className = 'dsync-sheet';
    ov.onclick = e => { if (e.target === ov) ov.remove(); else action(e); };
    document.body.appendChild(ov);
  }
  ov.innerHTML = `<div class="dsync-card" role="dialog" aria-modal="true"><div class="dsync-head"><h3>☁ Sync between devices</h3><button class="${A.btn.alt}" data-sy="close">Close</button></div>${inner}</div>`;
}
const home = () => sheet(`<div id="dsyncBox">${boxHTML()}</div>`);
function form() {
  const c = SY.cfg || {}, b = A.btn;
  sheet(`<p>Use the same Project URL, key, email and password as in Dollheimr Studio (also on supabase.com → your project → Project Settings → API). Before the first time, run the <a href="#" data-sy="sql">setup script</a> once.</p>
    <label class="dsync-field">Project URL<input id="dsy-url" value="${esc(c.url || '')}" placeholder="https://abcdefgh.supabase.co" autocomplete="off"></label>
    <label class="dsync-field">Publishable key (anon key)<input id="dsy-key" value="${esc(c.key || '')}" placeholder="sb_publishable_… or eyJ…" autocomplete="off"></label>
    <label class="dsync-field">Email<input id="dsy-email" type="email" value="${esc(c.email || '')}" autocomplete="username"></label>
    <label class="dsync-field">Password<input id="dsy-pass" type="password" autocomplete="current-password"></label>
    <p id="dsy-msg"></p>
    <div class="dsync-row"><button class="${b.main}" data-sy="go">Sign in &amp; sync</button><button class="${b.alt}" data-sy="new">Create an account instead</button><button class="${b.alt}" data-sy="home">Back</button></div>`);
}
function sqlSheet() {
  sheet(`<p>Once, in the same Supabase project as Dollheimr Studio: supabase.com → your project → SQL Editor → New query, paste this, press Run. It adds ${esc(A.app)}'s own table next to the others and changes nothing in the other apps.</p>
    <pre class="dsync-sql">${esc(sql())}</pre><div class="dsync-row"><button class="${A.btn.main}" data-sy="copy">Copy</button><button class="${A.btn.alt}" data-sy="home">Back</button></div>`);
}
async function action(e) {
  const b = e.target.closest('[data-sy]'); if (!b) return;
  e.preventDefault();
  const a = b.dataset.sy;
  if (a === 'close') document.querySelector('.dsync-sheet').remove();
  else if (a === 'home') home();
  else if (a === 'setup') form();
  else if (a === 'sql') sqlSheet();
  else if (a === 'copy') { try { await navigator.clipboard.writeText(sql()); b.textContent = 'Copied'; } catch (er) { const sel = getSelection(), rg = document.createRange(); rg.selectNodeContents(document.querySelector('.dsync-sql')); sel.removeAllRanges(); sel.addRange(rg); b.textContent = 'Selected: copy it'; } }
  else if (a === 'go' || a === 'new') run(a === 'new');
  else if (a === 'how') afterConnect(b.dataset.v);
  else if (a === 'now') syncNow(true);
  else if (a === 'off') { if (confirm('Stop syncing on this device? Your data stays here and in the cloud; you can sign in again later.')) { await syncNow(); SY.cfg = null; saveCfg(); SY.outbox = {}; saveOutbox(); SY.state = 'off'; SY.error = ''; status(); say('Sync is off on this device'); } }
}

const sql = () => { const t = A.table; return `-- ${A.app}: sync table. Run once in Supabase → SQL Editor (the same project as Dollheimr Studio).
-- Safe to run again; it does not touch the other apps' tables or files.
create table if not exists public.${t} (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  store text not null,
  rec_id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at text not null,
  server_ts timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
create index if not exists ${t}_pull on public.${t} (user_id, server_ts);
alter table public.${t} enable row level security;
drop policy if exists "own rows" on public.${t};
create policy "own rows" on public.${t} for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- newest edit wins, and every accepted change gets a fresh server time for pulling
create or replace function public.${t}_stamp() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then return null; end if;
  new.server_ts := clock_timestamp();
  return new;
end $$;
drop trigger if exists ${t}_stamp on public.${t};
create trigger ${t}_stamp before insert or update on public.${t}
  for each row execute function public.${t}_stamp();
`; };
async function connect(url, key, email, password, create) {
  url = url.trim().replace(/\/+$/, ''); key = key.trim(); email = email.trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) throw new Error('The Project URL should look like https://abcdefgh.supabase.co');
  if (key.length < 20) throw new Error('Paste the full publishable (anon) key.');
  const prev = SY.cfg; SY.cfg = { url, key, email, session: null, lastPull: null };
  try {
    if (create) { const j = await sbAuth('signup', { email, password }); if (!j.access_token) { SY.cfg = prev; return 'confirm'; } keepSession(j); }
    else keepSession(await sbAuth('password', { email, password }));
    const remoteHas = (await (await sb('/rest/v1/' + A.table + '?select=id&limit=1&deleted=eq.false')).json()).length > 0;
    const localHas = await A.hasData();
    return remoteHas && localHas ? 'choose' : remoteHas ? 'pull' : 'push';
  } catch (e) { if (!SY.cfg.session) SY.cfg = prev; throw e; }
  finally { saveCfg(); }
}
async function run(create) {
  const msg = document.getElementById('dsy-msg'); msg.textContent = create ? 'Creating account…' : 'Connecting…';
  const v = id => document.getElementById(id).value;
  try {
    const res = await connect(v('dsy-url'), v('dsy-key'), v('dsy-email'), v('dsy-pass'), create);
    if (res === 'confirm') { msg.textContent = 'Account created. Open the confirmation email from Supabase, then come back and tap Sign in & sync.'; return; }
    if (res !== 'choose') return afterConnect(res);
    sheet(`<p>Your cloud already holds ${esc(A.app)} data, and this device has its own too.</p>
      <div class="dsync-row"><button class="${A.btn.main}" data-sy="how" data-v="pull">Use the cloud copy on this device</button></div><p>Best for a new phone or computer. This device's ${esc(A.what)} are replaced (make a backup first if unsure).</p>
      <div class="dsync-row"><button class="${A.btn.alt}" data-sy="how" data-v="merge">Merge both</button></div><p>Keeps everything from both. If the same item is in both, the most recent edit wins.</p>`);
  } catch (e) { msg.textContent = /Failed to fetch|NetworkError|Load failed/i.test(e.message) ? 'Could not reach that address. Check the Project URL and your internet connection.' : e.status === 404 ? 'Signed in, but ' + A.app + '\'s table is missing. Run the setup script in Supabase first.' : e.message; }
}
async function afterConnect(how) {
  if (how === 'pull') {
    await A.clearAll(); SY.outbox = {}; saveOutbox(); SY.cfg.lastPull = null; saveCfg();
    A.stores.forEach(s => SY.dirty.add(s));
  } else {
    for (const s of A.stores) for (const r of await A.list(s)) if (r && r.id != null) SY.outbox[s + '|' + r.id] = '1';
    saveOutbox();
  }
  home(); await syncNow(); refreshUI();
  say({ push: `Sync is on. This device's ${A.what} are now in your cloud`, pull: `Sync is on. Your ${A.what} were downloaded`, merge: `Merged. All your devices now share the same ${A.what}` }[how]);
}

function configure(adapter) {
  A = adapter; addCss();
  SY.cfg = lsGet('sync', null); SY.outbox = lsGet('outbox', {}); SY.lastOk = lsGet('syncLastOk', null);
}
let started = false;
function start() {
  if (started) return; started = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  root.addEventListener('online', () => syncNow());
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 30000);
  status(); syncNow();
}

// Photos and images are kept as Blobs on the device and travel as data URLs.
const blobToDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
const dataURLToBlob = url => fetch(url).then(r => r.blob());

root.Sync = { configure, start, stamp, removed, open: home, now: () => syncNow(true), blobToDataURL, dataURLToBlob, get on() { return on(); } };
})(typeof window !== 'undefined' ? window : globalThis);
