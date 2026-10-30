// Sync for Doll knit: connects the shared sync.js to this app's storage (lists in IndexedDB 'kv',
// photo Blobs in the 'photos' store). safeSet() calls syncTrackList() so every list save is diffed
// against what was saved last time, and only the records that changed are queued.
'use strict';

const SYNC_LISTS = {
  'bjd-dolls': [() => dolls, v => { dolls = v; }],
  'bjd-gauges': [() => gauges, v => { gauges = v; }],
  'bjd-saved-patterns': [() => savedPatterns, v => { savedPatterns = v; }],
  'bjd-collections': [() => collections, v => { collections = v; }],
  'bjd-custom-grades': [() => customGrades, v => { customGrades = v; }],
};
const syncSnap = {};
const noTs = r => JSON.stringify(Object.assign({}, r, { _ts: undefined }));
function syncSnapAll() {
  for (const [k, [get]] of Object.entries(SYNC_LISTS)) syncSnap[k] = new Map(get().filter(r => r && r.id != null).map(r => [String(r.id), noTs(r)]));
}
// Called by safeSet(key, list) just before the list is written to this device's storage.
function syncTrackList(key, list) {
  if (!SYNC_LISTS[key] || !Array.isArray(list)) return;
  const old = syncSnap[key] || new Map(), next = new Map();
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    if (r.id == null) r.id = uid('rec');
    const id = String(r.id), s = noTs(r);
    next.set(id, s);
    if (old.get(id) !== s) Sync.stamp(key, r);
  }
  for (const id of old.keys()) if (!next.has(id)) Sync.removed(key, id);
  syncSnap[key] = next;
}

Sync.configure({
  app: 'Doll knit', table: 'knit_records', prefix: 'dkps:', what: 'dolls, gauges and patterns',
  stores: [...Object.keys(SYNC_LISTS), 'photos'],
  btn: { main: 'btn', alt: 'btn secondary' },
  async get(store, id) {
    if (store === 'photos') return Store.photoGet(id);
    return SYNC_LISTS[store][0]().find(r => r && String(r.id) === id);
  },
  async list(store) { return store === 'photos' ? Store.photoAll() : SYNC_LISTS[store][0](); },
  async write(store, rec) {
    if (store === 'photos') return Store.photoPutRaw(rec);
    const list = SYNC_LISTS[store][0](), i = list.findIndex(r => r && String(r.id) === String(rec.id));
    if (i >= 0) list[i] = rec; else list.push(rec);
    syncSnap[store].set(String(rec.id), noTs(rec));
  },
  async remove(store, id) {
    if (store === 'photos') { await Photos.remove(id, true); return; }
    const [get, set] = SYNC_LISTS[store];
    set(get().filter(r => !r || String(r.id) !== id)); syncSnap[store].delete(id);
  },
  async flush(stores) { for (const k of stores) if (SYNC_LISTS[k]) await Store.set(k, SYNC_LISTS[k][0]()); },
  async clearAll() {
    for (const [k, [, set]] of Object.entries(SYNC_LISTS)) { set([]); await Store.set(k, []); }
    await Store.photoClearRaw(); Photos.forget(); syncSnapAll();
  },
  async encode(store, r) {
    if (store !== 'photos') return r;
    return { id: r.id, createdAt: r.createdAt, _ts: r._ts, data: await Sync.blobToDataURL(r.blob), thumb: r.thumbBlob ? await Sync.blobToDataURL(r.thumbBlob) : null };
  },
  async decode(store, d) {
    if (store !== 'photos') return d;
    return { id: d.id, createdAt: d.createdAt, blob: await Sync.dataURLToBlob(d.data), thumbBlob: d.thumb ? await Sync.dataURLToBlob(d.thumb) : null };
  },
  async hasData() { return Object.values(SYNC_LISTS).some(([get]) => get().length > 0); },
  refresh() { renderDolls(); renderGauges(); renderSaved(); renderCollections(); renderCustomGrades(); refreshBuilderSelects(); },
  status(text, kind) {
    const b = document.getElementById('syncBtn'); if (!b) return;
    b.title = '☁ ' + text; b.setAttribute('aria-label', 'Sync between devices: ' + text);
    b.querySelector('.dsync-dot').className = 'dsync-dot ' + kind;
    const s = document.getElementById('set_sync'); if (s) s.textContent = text;
  },
});
