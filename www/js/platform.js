// Shared plumbing for the APK and the PWA: on-device storage (IndexedDB), doll photos, dialogs,
// toasts, and saving files — including very large backups, which are written to disk in small
// chunks so Android never has to pass one huge string between the web view and the system.
'use strict';

const APP_ID = 'bjd-pattern-studio';            // kept from the first version so old backups (and the crochet app's importer) still recognise it
const isNative = () => !!window.Capacitor?.isNativePlatform?.();
const capPlugin = name => window.Capacitor?.Plugins?.[name] || window.Capacitor?.registerPlugin?.(name);

function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }
function uid(prefix) { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const stamp = () => new Date().toISOString().slice(0, 10);
const fmtMB = bytes => (bytes / 1048576).toFixed(bytes > 10 * 1048576 ? 0 : 1) + ' MB';

// ---------- IndexedDB: a key/value store for the app's lists, and a store for photo blobs ----------
const Store = (() => {
  const DB_NAME = 'doll-knit-pattern-studio', DB_VERSION = 1;
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  function run(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      let result;
      const r = fn(t.objectStore(store));
      if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Storage transaction aborted'));
    }));
  }
  return {
    get: key => run('kv', 'readonly', s => s.get(key)),
    set: (key, value) => run('kv', 'readwrite', s => s.put(value, key)),
    photoAll: () => run('photos', 'readonly', s => s.getAll()),
    photoGet: id => run('photos', 'readonly', s => s.get(id)),
    photoPut: rec => run('photos', 'readwrite', s => s.put(rec)),
    photoDel: id => run('photos', 'readwrite', s => s.delete(id)),
    photoClear: () => run('photos', 'readwrite', s => s.clear()),
  };
})();

// The first version kept everything in localStorage (about 5 MB at most). Copy it into IndexedDB
// once; the old copy is left untouched as a safety net but is never read again.
const LEGACY_PREFIX = 'bjd-pattern-studio:';
const DATA_KEYS = ['bjd-dolls', 'bjd-gauges', 'bjd-saved-patterns', 'bjd-collections', 'bjd-custom-grades'];
async function migrateLegacyStorage() {
  if (await Store.get('__migrated')) return;
  for (const k of DATA_KEYS) {
    let raw = null;
    try { raw = localStorage.getItem(LEGACY_PREFIX + k); } catch (e) { /* storage blocked */ }
    if (raw === null) continue;
    try { if ((await Store.get(k)) === undefined) await Store.set(k, JSON.parse(raw)); } catch (e) { console.warn('could not migrate', k, e); }
  }
  await Store.set('__migrated', Date.now());
}

// ---------- photos: compressed on import, originals never stored ----------
const Photos = (() => {
  const urlCache = new Map();
  const canvasBlob = (canvas, quality) => new Promise(res => canvas.toBlob(b => {
    if (b && b.type === 'image/webp') return res(b);
    canvas.toBlob(j => res(j), 'image/jpeg', quality);
  }, 'image/webp', quality));
  async function loadImage(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fall through */ }
    }
    return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file); });
  }
  async function scaled(src, maxEdge, quality) {
    const k = Math.min(1, maxEdge / Math.max(src.width, src.height));
    const c = document.createElement('canvas');
    c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return canvasBlob(c, quality);
  }
  async function importFile(file) {
    const img = await loadImage(file);
    const rec = { id: uid('ph'), blob: await scaled(img, 1600, 0.82), thumbBlob: await scaled(img, 320, 0.8), createdAt: Date.now() };
    await Store.photoPut(rec);
    return rec.id;
  }
  async function url(id, thumb = true) {
    if (!id) return null;
    const key = id + (thumb ? ':t' : ':f');
    if (urlCache.has(key)) return urlCache.get(key);
    const rec = await Store.photoGet(id);
    if (!rec) return null;
    const u = URL.createObjectURL(thumb ? (rec.thumbBlob || rec.blob) : rec.blob);
    urlCache.set(key, u);
    return u;
  }
  async function remove(id) {
    if (!id) return;
    for (const k of [id + ':t', id + ':f']) if (urlCache.has(k)) { URL.revokeObjectURL(urlCache.get(k)); urlCache.delete(k); }
    await Store.photoDel(id);
  }
  function forget() { for (const u of urlCache.values()) URL.revokeObjectURL(u); urlCache.clear(); }
  // Fill every <img data-photo="id"> inside root once its blob URL is ready.
  async function hydrate(root = document) {
    for (const img of root.querySelectorAll('img[data-photo]')) {
      const u = await url(img.dataset.photo, img.dataset.full !== '1');
      if (u) img.src = u; else img.remove();
    }
  }
  return { importFile, url, remove, hydrate, forget };
})();

// ---------- toasts and dialogs ----------
function toast(msg, ms = 2800) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// Modal stack, so the Android back button closes the top one first.
const Modal = (() => {
  const stack = [];
  function open(title, bodyHtml, { wide = false, foot = '', onClose } = {}) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="modal-body">${bodyHtml}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) close(); });
    document.body.appendChild(back);
    document.body.style.overflow = 'hidden';
    stack.push({ el: back, onClose });
    Photos.hydrate(back);
    return back;
  }
  function close() {
    const entry = stack.pop();
    if (!entry) return false;
    entry.el.remove();
    if (!stack.length) document.body.style.overflow = '';
    entry.onClose?.();
    return true;
  }
  return { open, close, get isOpen() { return stack.length > 0; } };
})();

// ---------- files ----------
function blobToBase64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
function blobToDataURL(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
async function dataURLToBlob(u) { return (await fetch(u)).blob(); }

function pickFile(accept) {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => resolve(inp.files?.[0] || null);
    inp.click();
  });
}

// Writes a Blob to the app's storage in ~1.5 MB pieces (a multiple of 3 bytes, so each piece is
// valid base64 on its own). One giant write is what fails for big backups in an Android app.
const CHUNK = 3 * 512 * 1024;
async function writeNativeFile(name, blob, directory, onProgress) {
  const Filesystem = capPlugin('Filesystem');
  const path = name;
  if (!blob.size) { await Filesystem.writeFile({ path, data: '', directory, recursive: true }); }
  for (let off = 0; off < blob.size; off += CHUNK) {
    const data = await blobToBase64(blob.slice(off, off + CHUNK));
    if (off === 0) await Filesystem.writeFile({ path, data, directory, recursive: true });
    else await Filesystem.appendFile({ path, data, directory });
    onProgress?.(Math.min(1, (off + CHUNK) / blob.size));
  }
  const st = await Filesystem.stat({ path, directory });
  if (st && typeof st.size === 'number' && st.size !== blob.size) throw new Error(`file is ${st.size} bytes, expected ${blob.size}`);
  return (await Filesystem.getUri({ path, directory })).uri;
}

// Save a file. In the APK it is written to the app's cache in chunks and handed to the Android share
// sheet (Files, Drive, email…); in a browser it downloads. Returns true when it went through.
async function saveFile(name, data, mime, { onProgress } = {}) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  if (isNative()) {
    let uri;
    try { uri = await writeNativeFile(name, blob, 'CACHE', onProgress); }
    catch (e) { toast('Could not prepare the file: ' + (e?.message || e), 5000); return false; }
    try { await capPlugin('Share').share({ title: name, url: uri, dialogTitle: name }); return true; }
    catch (e) { if (!/cancel/i.test(String(e?.message || e))) toast('Could not share the file: ' + (e?.message || e), 5000); return false; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

// APK only: save straight into the phone's Documents/Doll knit folder (no share sheet).
async function saveToDocuments(name, blob, onProgress) {
  const Filesystem = capPlugin('Filesystem');
  try { await Filesystem.requestPermissions?.(); } catch (e) { /* not needed on newer Android */ }
  await writeNativeFile('Doll knit/' + name, blob, 'DOCUMENTS', onProgress);
  return 'Documents/Doll knit/' + name;
}
