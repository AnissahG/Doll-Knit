// Backup & restore (one JSON file with everything, photos included) and the ⚙ settings dialog.
// The backup is assembled as a Blob from many small pieces and written to disk in chunks, so its
// size is limited only by the device's free space — 28 MB, 200 MB, it doesn't matter.
'use strict';

const LAST_BACKUP_KEY = 'dkps:lastBackup';
const lastBackupAt = () => { try { return Number(localStorage.getItem(LAST_BACKUP_KEY)) || 0; } catch (e) { return 0; } };

function backupReminderHtml() {
  if (!dolls.length && !savedPatterns.length) return '';
  const last = lastBackupAt();
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  if (days !== null && days < 14) return '';
  return `<div class="note" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
    <span style="flex:1;min-width:200px">${days === null ? 'You haven\'t made a backup yet.' : `Your last backup was ${days} days ago.`} ${Sync.on ? 'Sync keeps a copy in your cloud; a backup file is a second copy you control.' : 'Everything lives only on this device — a backup file keeps it safe if the tablet is reset or replaced.'}</span>
    <button class="btn small" id="backupNow">⬇ Back up now</button></div>`;
}

async function buildBackupBlob() {
  const photos = await Store.photoAll();
  const head = JSON.stringify({ exportedAt: new Date().toISOString(), app: APP_ID, version: 2, dolls, gauges, savedPatterns, collections, customGrades });
  const parts = [head.slice(0, -1), ',"photos":['];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    parts.push((i ? ',' : '') + JSON.stringify({ id: p.id, createdAt: p.createdAt, data: await blobToDataURL(p.blob), thumb: p.thumbBlob ? await blobToDataURL(p.thumbBlob) : null }));
  }
  parts.push(']}');
  return { blob: new Blob(parts, { type: 'application/json' }), photoCount: photos.length };
}

async function backupAllData() {
  const el = Modal.open('Back up everything', `
    <p id="bk_status">Preparing your backup…</p>
    <div class="progress"><i id="bk_bar"></i></div>
    <p class="help" id="bk_help"></p>`);
  const status = $('#bk_status', el), bar = $('#bk_bar', el), help = $('#bk_help', el);
  const setP = f => { bar.style.width = Math.round(f * 100) + '%'; };
  let blob, photoCount;
  try { ({ blob, photoCount } = await buildBackupBlob()); }
  catch (e) { status.textContent = 'Could not prepare the backup: ' + (e?.message || e); return; }
  const name = `doll-knit-backup-${stamp()}.json`;
  const summary = `${dolls.length} doll(s), ${gauges.length} gauge(s), ${savedPatterns.length} saved pattern(s), ${photoCount} photo(s) — ${fmtMB(blob.size)}`;
  if (!isNative()) {
    status.textContent = summary;
    setP(1);
    await saveFile(name, blob, 'application/json');
    markBackedUp();
    help.textContent = 'The file is in your Downloads folder. Keep a copy somewhere other than this device (cloud drive, computer, USB stick).';
    return;
  }
  status.innerHTML = `<b>${esc(summary)}</b><br>Where should it go?`;
  help.innerHTML = '<b>Share / save to Drive…</b> opens the Android share sheet (Google Drive, Files, email…). <b>Save in Documents</b> puts the file straight into the <i>Documents/Doll knit</i> folder on this device — copy it off the device too.';
  const row = document.createElement('div');
  row.className = 'btn-row';
  row.innerHTML = '<button class="btn" id="bk_share">Share / save to Drive…</button><button class="btn secondary" id="bk_docs">Save in Documents</button>';
  help.before(row);
  $('#bk_share', el).onclick = async () => {
    status.textContent = 'Writing the file… ' + fmtMB(blob.size);
    if (await saveFile(name, blob, 'application/json', { onProgress: setP })) { markBackedUp(); status.textContent = 'Backup handed to Android: ' + summary; }
  };
  $('#bk_docs', el).onclick = async () => {
    status.textContent = 'Writing the file… ' + fmtMB(blob.size);
    try {
      const where = await saveToDocuments(name, blob, setP);
      markBackedUp();
      status.innerHTML = `Saved: <b>${esc(where)}</b><br>${esc(summary)}`;
    } catch (e) {
      status.textContent = 'Could not write to Documents (' + (e?.message || e) + '). Use “Share / save to Drive…” instead.';
    }
  };
}
function markBackedUp() {
  try { localStorage.setItem(LAST_BACKUP_KEY, String(Date.now())); } catch (e) { /* ignore */ }
  if (document.querySelector('#panel-dolls.active')) renderDolls();
}

async function restoreAllData(file) {
  if (!file) return false;
  const note = Modal.open('Restore', `<p>Reading ${esc(file.name)} (${fmtMB(file.size)})…</p>`);
  let data;
  try { data = JSON.parse(await file.text()); }
  catch (e) { Modal.close(); alert('Could not read that file — make sure it is a backup made by Doll knit Pattern Studio.'); return false; }
  Modal.close(); void note;
  if (data?.app !== APP_ID) {
    if (data?.app === 'doll-crochet-pattern-studio' || data?.app === 'doll-sew-studio') alert('That is a backup from the crochet or sewing app. To bring its dolls in, use Import on the Dolls tab.');
    else alert('This doesn\'t look like a Doll knit Pattern Studio backup file.');
    return false;
  }
  const counts = `${(data.dolls || []).length} doll(s), ${(data.gauges || []).length} gauge(s), ${(data.savedPatterns || []).length} saved pattern(s), ${(data.photos || []).length} photo(s)`;
  if ((dolls.length || gauges.length || savedPatterns.length) && !confirm(`Replace everything currently in the app with this backup (${counts})?`)) return false;
  try {
    dolls = data.dolls || []; gauges = data.gauges || []; savedPatterns = data.savedPatterns || [];
    collections = data.collections || []; customGrades = data.customGrades || [];
    await safeSet('bjd-dolls', dolls); await safeSet('bjd-gauges', gauges); await safeSet('bjd-saved-patterns', savedPatterns);
    await safeSet('bjd-collections', collections); await safeSet('bjd-custom-grades', customGrades);
    await Store.photoClear(); Photos.forget();
    for (const p of data.photos || []) {
      await Store.photoPut({ id: p.id, createdAt: p.createdAt || Date.now(), blob: await dataURLToBlob(p.data), thumbBlob: p.thumb ? await dataURLToBlob(p.thumb) : null });
    }
  } catch (e) {
    alert('The restore stopped part-way: ' + (e?.message || e) + '. Try again, or restore an older backup.');
  }
  renderDolls(); renderGauges(); renderSaved(); renderCollections(); renderCustomGrades(); refreshBuilderSelects();
  toast('Restored: ' + counts, 4000);
  return true;
}

function openSettings() {
  const last = lastBackupAt();
  const el = Modal.open('Backup & settings', `
    <div class="section-label">Backup</div>
    <p class="help">One file with everything — dolls (with photos), gauges, saved patterns, collections and custom grades. Any size works. ${last ? 'Last backup: ' + new Date(last).toLocaleDateString() + '.' : 'No backup made on this device yet.'}</p>
    <div class="btn-row"><button class="btn" id="set_backup">⬇ Back up everything</button><button class="btn secondary" id="set_restore">⬆ Restore from backup</button></div>
    <p class="help" style="margin-top:8px">Restore replaces what is in the app with the backup's contents. Backups from the first (browser) version of this app work too — that's how you move your data into the Android app.</p>
    <div class="section-label">Sync between devices</div>
    <p class="help">Keeps your tablet, phone and computer showing the same dolls, gauges, patterns and photos, through the Supabase project you set up for Dollheimr Studio. Now: <b id="set_sync">${esc(($('#syncBtn')?.title || '').replace('☁ ', ''))}</b></p>
    <div class="btn-row"><button class="btn secondary" id="set_syncOpen">☁ Sync settings</button></div>
    <div class="section-label">Storage</div>
    <p class="help" id="set_storage">Checking…</p>
    <div class="section-label">About</div>
    <p class="help">Doll knit Pattern Studio · v1.2 · personal use. All pattern maths runs on this device; nothing is sent anywhere unless you turn on ☁ Sync. Sibling of Doll crochet Pattern Studio — dolls move between the apps with Import / Export on the Dolls tab.</p>`);
  $('#set_syncOpen', el).onclick = () => { Modal.close(); Sync.open(); };
  $('#set_backup', el).onclick = () => { Modal.close(); backupAllData(); };
  $('#set_restore', el).onclick = async () => { const f = await pickFile('.json,application/json'); if (f && await restoreAllData(f)) Modal.close(); };
  (async () => {
    const out = $('#set_storage', el);
    try {
      const est = await navigator.storage?.estimate?.();
      const persisted = await navigator.storage?.persisted?.();
      out.innerHTML = `${est ? `Using ${fmtMB(est.usage || 0)} on this device.` : ''} ${persisted || isNative() ? 'Your data is kept until you uninstall the app.' : 'The browser may clear data if space runs low — keep backups.'}`;
    } catch (e) { out.textContent = 'Storage info unavailable.'; }
  })();
}
