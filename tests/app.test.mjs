// Headless check of the whole pattern engine: loads the real app in jsdom, then generates every
// garment with every option (one option changed at a time, plus random combinations) for several
// dolls and gauges. Fails on exceptions, unexpected alerts, NaN/undefined/negative counts, or a
// missing technical drawing.   Run: npm test   (add --quick for a shorter run)
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'www');
const QUICK = process.argv.includes('--quick');

const problems = [];
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push(String(e?.detail?.stack || e?.stack || e?.message || e)));
vc.on('error', (...a) => errors.push(a.join(' ')));

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
const w = dom.window;
w.indexedDB = indexedDB; w.IDBKeyRange = IDBKeyRange;
let alerts = [];
w.alert = m => alerts.push(String(m));
w.confirm = () => true;
w.prompt = () => 'Test';
w.scrollTo = () => {};
w.Element.prototype.scrollIntoView = function () {};

for (const src of [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1])) {
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(root, src), 'utf8');
  w.document.body.appendChild(s);
}
const E = code => w.eval(code);
await new Promise(r => setTimeout(r, 300));
if (errors.length) { console.error('Errors while loading the app:\n' + errors.join('\n')); process.exit(1); }

// ---------- test data ----------
const fullDoll = { id: 'doll_full', name: 'Full SD', size: 'SD', heightCm: 60, m: {
  chestCirc: 28, underBustCirc: 24, waistCirc: 21, hipCirc: 29, neckCirc: 9.5, shoulderWidth: 3.2, armholeDepth: 5, upperArmCirc: 8, elbowCirc: 6.5, wristCirc: 5,
  shoulderToElbow: 9, shoulderToWrist: 17, shoulderToWaist: 11, shoulderToHip: 16, shoulderToMidThigh: 21, shoulderToKnee: 27,
  hipToCrotch: 4, crotchToKnee: 12, crotchToAnkle: 24, thighCirc: 15, calfCirc: 9, ankleCirc: 5.5, footLength: 7, footCirc: 7.5,
  headCirc: 21, headHeight: 6, neckToChin: 2 } };
const msdDoll = { id: 'doll_msd', name: 'MSD', size: 'MSD', heightCm: 43, m: {
  chestCirc: 19, waistCirc: 14, hipCirc: 20, neckCirc: 7, shoulderWidth: 2.2, armholeDepth: 3.5, upperArmCirc: 5.5, wristCirc: 3.5,
  shoulderToWaist: 8, shoulderToHip: 11.5, shoulderToKnee: 19, shoulderToElbow: 6, shoulderToWrist: 12,
  hipToCrotch: 3, crotchToKnee: 8, crotchToAnkle: 16, thighCirc: 10.5, calfCirc: 6.5, ankleCirc: 4, footLength: 5, footCirc: 5.5, headCirc: 18 } };
// Only the measurements every garment strictly requires — exercises all the estimated fallbacks.
const sparseDoll = { id: 'doll_sparse', name: 'Sparse YOSD', size: 'YOSD', heightCm: 0, m: {
  chestCirc: 16, armholeDepth: 3, shoulderWidth: 1.8, neckCirc: 6, waistCirc: 12, hipCirc: 17, thighCirc: 9, calfCirc: 6, ankleCirc: 3.5, hipToCrotch: 2.5,
  headCirc: 17, footLength: 4, wristCirc: 3 } };
const gaugesData = [
  { id: 'g_hand', name: 'Fine hand', method: 'hand', yarn: 'Sock', tool: '2mm', tension: null, stsPer10: 32, rowsPer10: 44, notes: '', yardagePer100cm2: 12 },
  { id: 'g_mach', name: 'Machine', method: 'machine', yarn: 'Lace', tool: 'T6', tension: 6, stsPer10: 36, rowsPer10: 50, notes: '', yardagePer100cm2: null },
  { id: 'g_coarse', name: 'Coarse', method: 'hand', yarn: 'DK', tool: '3.5mm', tension: null, stsPer10: 22, rowsPer10: 30, notes: '', yardagePer100cm2: 20 },
];
E(`dolls = ${JSON.stringify([fullDoll, msdDoll, sparseDoll])}; gauges = ${JSON.stringify(gaugesData)}; refreshBuilderSelects();`);

const doc = w.document;
const byId = id => doc.getElementById(id);
const fire = el => el.dispatchEvent(new w.Event(el.type === 'checkbox' ? 'change' : 'change', { bubbles: true }));
const LENGTHS = { b_lengthOverride: 12, b_sleeveLengthOverride: 8, b_pantLengthOverride: 10, b_skirtLengthOverride: 6, b_sockLegHeight: 3, b_warmerLength: 8, b_scarfLength: 20, b_scarfWidth: 5, b_ponchoLength: 8 };
const EXPECTED_ALERT = /isn't available for this garment|available for Pullover|doesn't have a|needs both/;

function hidden(el) {
  for (let n = el; n && n !== doc.body; n = n.parentElement) {
    if (n.style?.display === 'none') return true;
    if ((n.classList.contains('drawer') || n.classList.contains('sub-fields')) && !n.classList.contains('show')) return true;
  }
  return false;
}
const controls = () => [...doc.querySelectorAll('#panel-builder select, #panel-builder input[type=checkbox]')]
  .filter(el => !['b_doll', 'b_gauge', 'b_garment'].includes(el.id) && !el.disabled && !hidden(el));
const optionsOf = el => el.type === 'checkbox' ? [false, true] : [...el.options].filter(o => !o.disabled && !o.parentElement.disabled).map(o => o.value);
function setCtl(el, v) { if (el.type === 'checkbox') el.checked = v; else el.value = v; fire(el); }

function reset(garment, dollId, gaugeId) {
  alerts = [];
  byId('b_doll').value = dollId; byId('b_gauge').value = gaugeId;
  for (const el of doc.querySelectorAll('#panel-builder select')) if (!['b_doll', 'b_gauge'].includes(el.id)) el.selectedIndex = el.id === 'b_fit' ? 1 : 0;
  for (const el of doc.querySelectorAll('#panel-builder input[type=checkbox]')) el.checked = false;
  for (const el of doc.querySelectorAll('#panel-builder input[type=number]')) el.value = '';
  byId('b_buttons').value = 5; byId('b_goreCount').value = '6'; byId('b_flareStart').value = 'lowhip';
  for (const [id, v] of Object.entries(LENGTHS)) byId(id).value = v;
  byId('b_garment').value = garment; fire(byId('b_garment'));
  E('toggleGarmentFields(); updateCollarOptions(); togglePocketFields(); toggleSleeveLengthFields();');
}


// Record shaping calls with a negative or half-stitch amount: the engine would silently round them away.
E(String.raw`(function(){
  window.__bad = [];
  const where = () => (new Error().stack.split("\n")[3] || "").replace(/^\s*at\s*/, "").replace(/\(?[a-z]+:[^)]*?(\d+):\d+\)?$/, "@$1");
  const od = distribute; distribute = function(t, r, v){ if(t < 0 || Math.abs(t - Math.round(t)) > 1e-9) __bad.push("distribute(" + t + ", " + r + ", " + v + ") " + where()); return od(t, r, v); };
  const ops = planShape; planShape = function(p, e, tr, a, fa){ if(e < 0 || Math.abs(e - Math.round(e)) > 1e-9) __bad.push("planShape(" + e + ", " + tr + ", " + a + ") " + where()); return ops(p, e, tr, a, fa); };
})()`);
const seen = new Set();
let runs = 0;
function generate(label) {
  const before = errors.length;
  E('__bad = []');
  try { E('lastGenerated = null; generatePattern();'); } catch (e) { problems.push(`${label}: EXCEPTION ${e.stack || e}`); return; }
  runs++;
  if (errors.length > before) { problems.push(`${label}: ERROR ${errors.slice(before).join(' | ')}`); return; }
  const landmarkMissing = alerts.some(a => /doesn.t have a|needs both/.test(a));
  const bad = alerts.filter(a => !EXPECTED_ALERT.test(a) && !(landmarkMissing && /^Enter a/.test(a)));
  if (bad.length) { problems.push(`${label}: ALERT ${bad.join(' | ')}`); return; }
  if (alerts.length) return; // an expected "not for this garment" reset
  const out = byId('outputHolder');
  const text = out.textContent;
  const checks = [
    [/\bNaN\b/, 'NaN'], [/\bundefined\b/, 'undefined'], [/Infinity/, 'Infinity'], [/\[object /, '[object]'], [/\bnull\b/, 'null'],
    [/(?<![\w.])-\d+(\.\d+)?\s*(sts?|rows?|rounds?|stitches)\b/, 'negative count'],
    [/\b(cast on|pick up|bind off)\s+0 sts\b/i, 'zero-stitch step'],
  ];
  for (const [re, what] of checks) {
    const m = text.match(re);
    if (m) {
      const key = label.split(' :: ')[0] + what + text.slice(Math.max(0, m.index - 60), m.index + 40);
      if (!seen.has(key)) { seen.add(key); problems.push(`${label}: ${what} … ${text.slice(Math.max(0, m.index - 90), m.index + 50).replace(/\s+/g, ' ')}`); }
    }
  }
  for (const b of E('__bad')) { const key = 'bad' + b.replace(/\(.*?\)/, ''); if (!seen.has(key)) { seen.add(key); problems.push(`${label}: ROUNDED SHAPING ${b}`); } }
  for (const m of text.matchAll(/(increase|decrease)[^.]{0,40}?from (\d+) sts? to (\d+) sts?/gi)) {
    const [, verb, a, b] = m; const wrong = verb.toLowerCase() === 'increase' ? +b < +a : +b > +a;
    if (wrong || +a === +b) { const key = 'dir' + label.split('/')[0] + m[0].replace(/\d+/g, '#'); if (!seen.has(key)) { seen.add(key); problems.push(`${label}: WRONG DIRECTION … ${m[0]}`); } }
  }
  const shoulders = [...text.matchAll(/bind off (\d+) sts \(right shoulder\); bind off (\d+) sts \(left shoulder\)/g)].flatMap(m => [+m[1], +m[2]]);
  if (shoulders.length > 2 && new Set(shoulders).size > 1) { const key = 'sh' + label.split(' :: ')[0]; if (!seen.has(key)) { seen.add(key); problems.push(`${label}: SHOULDERS DON'T MATCH ${shoulders.join('/')}`); } }
  if (!E('lastGenerated')) problems.push(`${label}: no lastGenerated`);
  const svg = out.querySelector('.techdraw svg');
  if (!svg) { if (!process.env.NODRAW) problems.push(`${label}: no technical drawing`); }
  else if (/NaN|undefined|Infinity/.test(svg.outerHTML)) problems.push(`${label}: bad numbers in drawing ${svg.outerHTML.match(/.{40}(NaN|undefined|Infinity).{20}/)?.[0]}`);
}

const garments = [...byId('b_garment').options].map(o => o.value);
const gaugePlan = QUICK ? ['g_hand'] : ['g_hand', 'g_mach'];
for (const g of garments) {
  for (const gaugeId of gaugePlan) {
    reset(g, 'doll_full', gaugeId);
    const baseline = controls().map(el => [el.id, optionsOf(el)]);
    generate(`${g}/${gaugeId}/full :: defaults`);
    for (const [id, opts] of baseline) {
      for (const v of opts) {
        reset(g, 'doll_full', gaugeId);
        const el = byId(id);
        if (!el || hidden(el) || el.disabled) continue;
        setCtl(el, v);
        // a select may reveal sub-options (e.g. pleats, gores): sweep those too
        for (const sub of controls().filter(c => !baseline.some(b => b[0] === c.id))) {
          for (const sv of optionsOf(sub)) { setCtl(sub, sv); generate(`${g}/${gaugeId}/full :: ${id}=${v}, ${sub.id}=${sv}`); }
        }
        generate(`${g}/${gaugeId}/full :: ${id}=${v}`);
      }
    }
  }
  for (const dollId of ['doll_msd', 'doll_sparse']) for (const gaugeId of ['g_hand', 'g_coarse']) { reset(g, dollId, gaugeId); generate(`${g}/${gaugeId}/${dollId} :: defaults`); }
}

// random combinations
let seed = 12345;
const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor(seed / 65536) % n; };
const dollIds = ['doll_full', 'doll_msd', 'doll_sparse'], gaugeIds = gaugesData.map(g => g.id);
for (let i = 0; i < (QUICK ? 150 : 1500); i++) {
  const g = garments[rnd(garments.length)], d = dollIds[rnd(3)], ga = gaugeIds[rnd(3)];
  reset(g, d, ga);
  const picks = [];
  for (let pass = 0; pass < 2; pass++) for (const el of controls()) { const o = optionsOf(el); const v = o[rnd(o.length)]; setCtl(el, v); if (pass) picks.push(`${el.id}=${v}`); }
  generate(`${g}/${ga}/${d} :: random#${i} ${picks.join(',')}`);
}

// "Duplicate & tweak" must restore every setting: regenerate from the saved options and compare.
const contentText = () => (byId('patternContent')?.textContent || '').replace(/\s+/g, ' ');
const restoreFails = new Map(); let compared = 0;
for (let i = 0; i < (QUICK ? 120 : 600); i++) {
  const g = garments[rnd(garments.length)], d = dollIds[rnd(2)], ga = gaugeIds[rnd(3)];
  reset(g, d, ga);
  for (let pass = 0; pass < 2; pass++) for (const el of controls()) { const o = optionsOf(el); setCtl(el, o[rnd(o.length)]); }
  alerts = [];
  E('lastGenerated = null; generatePattern();');
  if (alerts.length || !E('lastGenerated')) continue;
  const before = contentText();
  E(`savedPatterns = [{id:'rt', label:'rt', html:'', dollId:lastGenerated.doll.id, gaugeId:lastGenerated.gauge.id, opts:lastGenerated.opts, adjustments:{lengthDeltaCm:0, sleeveLengthDeltaCm:0}}];`);
  reset(garments[(garments.indexOf(g) + 1) % garments.length], d, ga);
  E(`loadPatternIntoBuilder('rt'); lastGenerated = null; generatePattern();`);
  const after = contentText(); compared++;
  if (after !== before) {
    let k = 0; while (k < before.length && before[k] === after[k]) k++;
    const key = g + ':' + before.slice(Math.max(0, k - 30), k).replace(/\d+/g, '#');
    if (!restoreFails.has(key)) restoreFails.set(key, `${g}/${d}/${ga}: DUPLICATE & TWEAK CHANGED THE PATTERN … was "${before.slice(Math.max(0, k - 60), k + 50)}" now "${after.slice(Math.max(0, k - 60), k + 50)}"`);
  }
}
problems.push(...restoreFails.values());
E('savedPatterns = []');
console.log(`duplicate & tweak round trips compared: ${compared}`);

// saved pattern round trip: save, view, duplicate & tweak
reset('pullover', 'doll_full', 'g_hand'); generate('save-test');
E(`savePatternNow(); document.getElementById('saveNameInput').value='T'; confirmSavePattern();`);
await new Promise(r => setTimeout(r, 200));
const saved = E('savedPatterns');
if (saved.length !== 1) problems.push('saving a pattern failed');
else {
  if (/contenteditable="true"/.test(saved[0].html)) problems.push('saved pattern kept edit mode');
  E(`viewSaved('${saved[0].id}'); loadPatternIntoBuilder('${saved[0].id}');`);
  if (errors.length) problems.push('view/duplicate errors: ' + errors.join(' | '));
}

console.log(`${runs} patterns generated, ${problems.length} problem(s).`);
if (problems.length) { console.log(problems.slice(0, +(process.env.MAXP||80)).join('\n')); process.exit(1); }
process.exit(0);
