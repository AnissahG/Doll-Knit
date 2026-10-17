// Dolls tab: photo cards, a grouped measurement form in a dialog, a detail view, and doll exchange
// with the Doll crochet and Doll sewing apps. Same look and flow as Doll crochet Pattern Studio.
'use strict';

const DOLL_SIZES = ['YOSD', 'MSD', 'SD', 'Model doll (~68cm)', '70cm+', 'Other'];
const DOLL_GROUPS = [['body', 'Body'], ['arms', 'Arms'], ['lengths', 'Length landmarks'], ['legs', 'Legs & feet'], ['head', 'Head & neck']];
// key, label, group, hint (optional)
const DOLL_MEAS = [
  ['chestCirc', 'Bust / chest', 'body', 'around the fullest part'],
  ['underBustCirc', 'Under-bust', 'body', 'optional — for bras; estimated from the bust if blank'],
  ['waistCirc', 'Waist', 'body'],
  ['hipCirc', 'Hip', 'body', 'around the fullest part'],
  ['neckCirc', 'Neck', 'body', 'around the base of the neck'],
  ['shoulderWidth', 'Shoulder seam (one)', 'body', 'neck point to arm point on one side — not across the back'],
  ['armholeDepth', 'Armhole depth', 'body', 'straight down from the shoulder point to the underarm'],
  ['upperArmCirc', 'Upper arm', 'arms'],
  ['elbowCirc', 'Elbow', 'arms', 'optional — better leg-of-mutton sleeves'],
  ['wristCirc', 'Wrist', 'arms'],
  ['shoulderToElbow', 'Shoulder to elbow', 'arms'],
  ['shoulderToWrist', 'Arm length', 'arms', 'shoulder point to wrist'],
  ['shoulderToWaist', 'Shoulder to waist', 'lengths'],
  ['shoulderToHip', 'Shoulder to hip', 'lengths'],
  ['shoulderToMidThigh', 'Shoulder to mid-thigh', 'lengths'],
  ['shoulderToKnee', 'Shoulder to knee', 'lengths'],
  ['hipToCrotch', 'Rise', 'legs', 'hip line down to the crotch'],
  ['crotchToKnee', 'Crotch to knee', 'legs'],
  ['crotchToAnkle', 'Inseam', 'legs', 'crotch to ankle'],
  ['thighCirc', 'Thigh', 'legs'],
  ['calfCirc', 'Calf', 'legs'],
  ['ankleCirc', 'Ankle', 'legs'],
  ['footLength', 'Foot length', 'legs', 'heel to toe'],
  ['footCirc', 'Foot circumference', 'legs', 'around the ball of the foot'],
  ['headCirc', 'Head circumference', 'head', 'for hats and hoods'],
  ['headHeight', 'Head height', 'head', 'crown down to where a hat brim sits'],
  ['neckToChin', 'Neck base to chin', 'head', 'for turtlenecks and tall collars'],
];
const MEAS_LABEL = Object.fromEntries(DOLL_MEAS.map(r => [r[0], r[1]]));
function measNames(keys) { return keys.map(k => MEAS_LABEL[k] || k).join(', '); }

// What each kind of garment needs, so a doll card can say what it's ready for.
const GARMENT_NEEDS = [
  ['Tops & dresses', ['chestCirc', 'armholeDepth', 'shoulderWidth', 'neckCirc']],
  ['Pants', ['waistCirc', 'hipCirc', 'thighCirc', 'calfCirc', 'ankleCirc', 'hipToCrotch']],
  ['Skirts', ['waistCirc', 'hipCirc']],
  ['Hats', ['headCirc']],
  ['Socks', ['ankleCirc', 'footLength']],
  ['Bras', ['chestCirc']],
  ['Ponchos', ['neckCirc', 'chestCirc']],
  ['Arm warmers', ['wristCirc']],
  ['Leg warmers', ['ankleCirc']],
];
const hasM = (d, k) => Number(d?.m?.[k]) > 0;
const dollFilled = d => DOLL_MEAS.filter(r => hasM(d, r[0])).length;

let dollSearch = '';

function renderDolls() {
  const el = document.getElementById('panel-dolls');
  if (!el) return;
  const list = dolls.slice().sort((a, b) => a.name.localeCompare(b.name));
  const q = dollSearch.trim().toLowerCase();
  const shown = q ? list.filter(d => [d.name, d.sculpt, d.size, d.notes].join(' ').toLowerCase().includes(q)) : list;
  el.innerHTML = `
    <div class="toolbar"><h2>Your dolls</h2>
      <button class="btn" id="dollNew">＋ New doll</button>
      <button class="btn secondary" id="dollImport">Import</button>
      ${list.length ? '<button class="btn ghost" id="dollExportAll">Export all</button>' : ''}</div>
    <p class="help">All measurements in cm, taken on the doll body. Tap a doll to see everything at a glance. Import brings dolls in from a Doll crochet or Doll sewing backup (or a doll file) — importing again later updates the same dolls instead of duplicating them.</p>
    ${backupReminderHtml()}
    ${list.length > 5 ? `<input class="search" id="dollSearch" placeholder="Search dolls…" value="${esc(dollSearch)}">` : ''}
    ${list.length ? `<div class="doll-list">${shown.map(dollCardHtml).join('') || '<p class="empty">No doll matches that search.</p>'}</div>`
      : `<div class="card"><p class="empty">No dolls yet. Tap <b>＋ New doll</b> and fill in what you have measured — you can add the rest later. Or import your dolls from the crochet or sewing app's backup file.</p></div>`}`;
  Photos.hydrate(el);
  $('#dollNew', el).onclick = () => dollForm();
  $('#dollImport', el).onclick = importDollsFlow;
  $('#dollExportAll', el)?.addEventListener('click', () => exportDolls(list));
  $('#backupNow', el)?.addEventListener('click', () => backupAllData());
  const s = $('#dollSearch', el);
  if (s) s.oninput = () => { dollSearch = s.value; const pos = s.selectionStart; renderDolls(); const n = $('#dollSearch'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-view]', el).forEach(b => b.onclick = () => dollDetail(dolls.find(d => d.id === b.dataset.view)));
  $$('[data-edit]', el).forEach(b => b.onclick = () => dollForm(dolls.find(d => d.id === b.dataset.edit)));
  $$('[data-build]', el).forEach(b => b.onclick = () => buildForDoll(b.dataset.build));
  $$('[data-del]', el).forEach(b => b.onclick = () => deleteDoll(b.dataset.del));
}

function dollCardHtml(d) {
  const m = d.m || {};
  const filled = dollFilled(d);
  const ready = GARMENT_NEEDS.filter(([, keys]) => keys.every(k => hasM(d, k))).map(([g]) => g);
  const v = k => hasM(d, k) ? m[k] : '—';
  return `<div class="doll-card">
    <div class="thumb" data-view="${d.id}" title="Details">${d.photoId ? `<img data-photo="${d.photoId}" alt="">` : '♛'}</div>
    <div class="body">
      <div class="entry-name" data-view="${d.id}" style="cursor:pointer">${esc(d.name)}</div>
      <div class="entry-meta">${esc([d.size, d.sculpt, d.heightCm ? d.heightCm + ' cm' : ''].filter(Boolean).join(' · '))}<br>
        chest ${v('chestCirc')} · waist ${v('waistCirc')} · hip ${v('hipCirc')} · head ${v('headCirc')} cm</div>
      <div class="meter" title="${filled} of ${DOLL_MEAS.length} measurements"><i style="width:${Math.round(filled / DOLL_MEAS.length * 100)}%"></i></div>
      <div class="entry-meta">${filled}/${DOLL_MEAS.length} measurements${ready.length ? ' · ready for ' + esc(ready.slice(0, 4).join(', ')) + (ready.length > 4 ? '…' : '') : ''}${d.importedFrom ? ` · <span class="tag soft">from ${esc(d.importedFrom)} app</span>` : ''}</div>
      <div class="btn-row"><button class="btn small" data-build="${d.id}">Build for this doll</button><button class="btn small secondary" data-edit="${d.id}">Edit</button><button class="btn small danger" data-del="${d.id}">Delete</button></div>
    </div></div>`;
}

function dollDetail(d) {
  if (!d) return;
  const rows = DOLL_GROUPS.map(([g, title]) => {
    const r = DOLL_MEAS.filter(x => x[2] === g && hasM(d, x[0]));
    return r.length ? `<div class="section-label">${title}</div><table class="meas-table">${r.map(x => `<tr><td>${esc(x[1])}</td><td>${d.m[x[0]]} cm</td></tr>`).join('')}</table>` : '';
  }).join('');
  const legs = hasM(d, 'hipToCrotch') && hasM(d, 'crotchToAnkle') ? `<p class="help">Full leg length (hip to ankle): ${(d.m.hipToCrotch + d.m.crotchToAnkle).toFixed(1)} cm</p>` : '';
  const needs = GARMENT_NEEDS.map(([g, keys]) => {
    const miss = keys.filter(k => !hasM(d, k));
    return `<tr><td>${g}</td><td style="font-family:var(--sans);text-align:left">${miss.length ? `<span class="muted">needs ${esc(measNames(miss))}</span>` : '✓ ready'}</td></tr>`;
  }).join('');
  const el = Modal.open(d.name, `
    ${d.photoId ? `<img class="doll-photo-big" data-photo="${d.photoId}" data-full="1" alt="">` : ''}
    <p class="entry-meta" style="font-size:.85rem">${esc([d.size, d.sculpt, d.heightCm ? d.heightCm + ' cm tall' : ''].filter(Boolean).join(' · '))}</p>
    ${d.notes ? `<div class="note">${esc(d.notes)}</div>` : ''}
    ${rows || '<p class="empty">No measurements yet.</p>'}${legs}
    <div class="section-label">What you can knit for ${esc(d.name)}</div>
    <table class="meas-table">${needs}</table>`, {
    foot: `<button class="btn" id="dd_build">Build for this doll</button><button class="btn secondary" id="dd_edit">Edit</button><button class="btn ghost" id="dd_export">Export</button>`,
  });
  $('#dd_build', el).onclick = () => { Modal.close(); buildForDoll(d.id); };
  $('#dd_edit', el).onclick = () => { Modal.close(); dollForm(d); };
  $('#dd_export', el).onclick = () => exportDolls([d]);
}

function dollForm(doll) {
  const d = doll ? JSON.parse(JSON.stringify(doll)) : { id: 'doll_' + Date.now(), name: '', size: 'MSD', sculpt: '', heightCm: 0, m: {}, photoId: null, notes: '' };
  d.m = d.m || {};
  const groups = DOLL_GROUPS.map(([g, title]) => `<div class="section-label">${title}</div><div class="grid3">${DOLL_MEAS.filter(r => r[2] === g).map(r =>
    `<div class="field"><label>${esc(r[1])}${r[3] ? ` <span class="hint">(${esc(r[3])})</span>` : ''}</label><input type="number" step="0.1" min="0" inputmode="decimal" data-m="${r[0]}" value="${hasM(d, r[0]) ? d.m[r[0]] : ''}"></div>`).join('')}</div>`).join('');
  const body = `
    <div class="grid2">
      <div class="field"><label>Name</label><input id="df_name" value="${esc(d.name)}" placeholder="e.g. Iris — MSD girl"></div>
      <div class="field"><label>Sculpt / company <span class="hint">(optional)</span></label><input id="df_sculpt" value="${esc(d.sculpt || '')}" placeholder="e.g. Fairyland Minifee"></div>
      <div class="field"><label>Size category</label><select id="df_size">${DOLL_SIZES.map(s => `<option ${s === d.size ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
      <div class="field"><label>Height (cm) <span class="hint">(the real number — "SD" alone can mean 58 to 65 cm+)</span></label><input id="df_height" type="number" step="0.1" min="0" inputmode="decimal" value="${Number(d.heightCm) > 0 ? d.heightCm : ''}"></div>
    </div>
    <div class="field"><label>Photo <span class="hint">(optional — makes dolls easy to tell apart)</span></label><div id="df_photo"></div></div>
    <p class="help">Leave anything you haven't measured blank — you can come back and add it. Each garment tells you exactly which measurements it needs.</p>
    ${groups}
    <p class="help" id="df_legs"></p>
    <div class="field"><label>Notes <span class="hint">(optional)</span></label><textarea id="df_notes" rows="2" placeholder="e.g. wide hips, double-jointed arms, wears MSD shoes">${esc(d.notes || '')}</textarea></div>`;
  const el = Modal.open(doll ? 'Edit ' + doll.name : 'New doll', body, { wide: true, foot: '<button class="btn" id="df_save">Save doll</button><button class="btn ghost" data-close>Cancel</button>' });
  bindPhotoPicker($('#df_photo', el), () => d.photoId, id => { d.photoId = id; });
  const legs = () => {
    const v = k => Number($(`[data-m="${k}"]`, el).value) || 0;
    const rise = v('hipToCrotch'), knee = v('crotchToKnee'), ankle = v('crotchToAnkle');
    const parts = [];
    if (rise && knee) parts.push(`to knee ${(rise + knee).toFixed(1)} cm`);
    if (rise && ankle) parts.push(`to ankle ${(rise + ankle).toFixed(1)} cm`);
    $('#df_legs', el).textContent = parts.length ? 'Full leg length from the hip: ' + parts.join(' · ') : '';
  };
  el.addEventListener('input', legs); legs();
  $('#df_save', el).onclick = async () => {
    d.name = $('#df_name', el).value.trim();
    if (!d.name) { toast('Give the doll a name'); $('#df_name', el).focus(); return; }
    d.sculpt = $('#df_sculpt', el).value.trim();
    d.size = $('#df_size', el).value;
    d.heightCm = Math.max(0, numOr($('#df_height', el).value));
    d.notes = $('#df_notes', el).value.trim();
    // Keep measurements this form doesn't show (e.g. crochet-only ones) so nothing is lost on a round trip.
    $$('[data-m]', el).forEach(i => { const n = numOr(i.value); if (n > 0) d.m[i.dataset.m] = n; else delete d.m[i.dataset.m]; });
    d.updatedAt = Date.now();
    const before = dolls.slice();
    const old = dolls.find(x => x.id === d.id);
    dolls = old ? dolls.map(x => x.id === d.id ? d : x) : dolls.concat(d);
    if (!await safeSet('bjd-dolls', dolls)) { dolls = before; toast('Could not save — storage problem. Make a backup.'); return; }
    if (old?.photoId && old.photoId !== d.photoId) await Photos.remove(old.photoId);
    Modal.close(); renderDolls(); refreshBuilderSelects(); renderCustomGrades();
    toast(old ? 'Doll updated' : 'Doll saved');
  };
}
// Back-compat for anything that still calls the old function name.
function editDoll(id) { dollForm(dolls.find(d => d.id === id)); }

function bindPhotoPicker(container, getId, setId) {
  const draw = () => {
    const id = getId();
    container.innerHTML = `<div class="photo-strip">${id ? `<div class="ph"><img data-photo="${id}" alt=""><button type="button" data-rm aria-label="Remove photo">✕</button></div>` : ''}
      <label class="photo-add">${id ? 'Change photo' : '＋ Add photo'}<input type="file" accept="image/*" hidden></label></div>`;
    Photos.hydrate(container);
    $('[data-rm]', container)?.addEventListener('click', () => { setId(null); draw(); });
    $('input[type=file]', container).addEventListener('change', async e => {
      const f = e.target.files?.[0];
      if (!f) return;
      toast('Compressing photo…', 1500);
      try { setId(await Photos.importFile(f)); } catch (err) { toast('Could not read that image'); }
      draw();
    });
  };
  draw();
}

async function deleteDoll(id) {
  const d = dolls.find(x => x.id === id);
  if (!d || !confirm(`Delete ${d.name}? Saved patterns keep their instructions.`)) return;
  dolls = dolls.filter(x => x.id !== id);
  await safeSet('bjd-dolls', dolls);
  if (d.photoId && !dolls.some(x => x.photoId === d.photoId)) await Photos.remove(d.photoId);
  renderDolls(); refreshBuilderSelects(); renderCustomGrades();
  toast(d.name + ' deleted');
}

function buildForDoll(id) {
  showTab('builder');
  const sel = document.getElementById('b_doll');
  sel.value = id;
  onDollOrModeChange();
  window.scrollTo(0, 0);
}

// ---------- doll exchange with the crochet and sewing apps ----------
const CLASS_TO_SIZE = { 'Tiny': 'Other', 'YoSD': 'YOSD', 'MSD': 'MSD', 'SD': 'SD', 'SD13/SD16': 'SD', '70 cm': '70cm+' };
const OTHER_KEY_ALIASES = { underbustCirc: 'underBustCirc', bustSpan: 'bustPointSpacing', napeToWaist: 'shoulderToWaist' };
function cleanM(m) {
  const out = {};
  for (const [k, v] of Object.entries(m || {})) { const n = numOr(v); if (n > 0) out[k] = n; }
  for (const [from, to] of Object.entries(OTHER_KEY_ALIASES)) if (out[from] && !out[to]) out[to] = out[from];
  return out;
}
const APP_NAMES = { 'doll-crochet-pattern-studio': 'crochet', 'doll-sew-studio': 'sewing', 'bjd-pattern-studio': 'knit' };
function dollsFromFile(data) {
  let list = [];
  if (Array.isArray(data)) list = data;
  else if (Array.isArray(data?.dolls)) list = data.dolls;
  else if (data?.m && data?.name) list = [data];
  const from = APP_NAMES[data?.app] || 'file';
  return list.filter(d => d && d.name).map(d => ({
    id: d.id || uid('doll'),
    name: String(d.name),
    sculpt: d.sculpt || '',
    size: DOLL_SIZES.includes(d.size) ? d.size : (CLASS_TO_SIZE[d.sizeClass] || 'Other'),
    heightCm: numOr(d.heightCm),
    m: cleanM(d.m),
    notes: d.notes || '',
    importedFrom: from === 'knit' ? '' : from,
  }));
}
async function importDollsFlow() {
  const f = await pickFile('.json,application/json');
  if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); } catch (e) { toast('That file is not a valid backup or doll file'); return; }
  const found = dollsFromFile(data);
  if (!found.length) { toast('No dolls found in that file'); return; }
  const existing = new Set(dolls.map(d => d.id));
  const src = { crochet: 'a Doll crochet backup', sewing: 'a Doll sewing backup', knit: 'a Doll knit backup' }[APP_NAMES[data?.app]] || 'doll profiles';
  const el = Modal.open('Import dolls', `
    <p class="help">Found ${src}. Choose which dolls to bring in. Dolls already here are updated with the new measurements; their photo and notes are kept.</p>
    ${found.map((d, i) => `<label class="check"><input type="checkbox" data-i="${i}" checked> <b>${esc(d.name)}</b> <span class="muted">${esc(d.size)} · ${Object.keys(d.m).length} measurements</span> ${existing.has(d.id) ? '<span class="tag gold">update</span>' : '<span class="tag sage">new</span>'}</label>`).join('')}`,
    { foot: '<button class="btn" id="imp_go">Import selected</button><button class="btn ghost" data-close>Cancel</button>' });
  $('#imp_go', el).onclick = async () => {
    const chosen = $$('[data-i]', el).filter(c => c.checked).map(c => found[+c.dataset.i]);
    for (const d of chosen) {
      const i = dolls.findIndex(x => x.id === d.id);
      if (i > -1) { const old = dolls[i]; dolls[i] = { ...old, ...d, m: { ...old.m, ...d.m }, photoId: old.photoId, notes: old.notes || d.notes, sculpt: d.sculpt || old.sculpt, importedFrom: old.importedFrom || d.importedFrom, updatedAt: Date.now() }; }
      else dolls.push({ ...d, photoId: null, updatedAt: Date.now() });
    }
    await safeSet('bjd-dolls', dolls);
    Modal.close(); renderDolls(); refreshBuilderSelects(); renderCustomGrades();
    toast(`Imported ${chosen.length} doll${chosen.length === 1 ? '' : 's'}`);
  };
}
// Same shape the crochet and sewing apps read (id, name, size, heightCm, m).
async function exportDolls(list) {
  const payload = { format: 'bjd-doll-v1', app: APP_ID, exportedAt: new Date().toISOString(),
    dolls: list.map(d => ({ id: d.id, name: d.name, sculpt: d.sculpt || '', size: d.size, heightCm: d.heightCm || 0, m: cleanM(d.m), notes: d.notes || '' })) };
  const name = list.length === 1 ? `doll-${list[0].name.replace(/[^\w-]+/g, '_')}.json` : `dolls-${stamp()}.json`;
  await saveFile(name, JSON.stringify(payload, null, 2), 'application/json');
}
