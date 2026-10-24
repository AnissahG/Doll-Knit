// Technical drawings ("flats") of the finished piece, drawn to scale from the finished measurements
// each pattern generator calculated (its drawSpec), with knit texture, ribbing, closures, collars and
// dimension lines. Same idea and look as the drawings in Doll crochet Pattern Studio.
'use strict';

let TD_SEQ = 0;
const TD = { ink: '#2C2418', dim: '#7B2D3A', soft: '#8a7d63', fill: '#FBF7EE', band: '#F1E8D3', tex: '#BFAF8A' };
const cmTxt = v => (Math.round(v * 10) / 10) + ' cm';

class TechCanvas {
  constructor(texture) { this.id = 'kd' + (++TD_SEQ); this.texture = texture || 'stocking'; this.out = []; this.k = 1; this.ox = 0; this.oy = 0; this.left = 50; this.right = 300; }
  // Map the cm box [x0..x1]×[y0..y1] into the pixel box (bx, by, bw, bh), centred.
  frame(x0, y0, x1, y1, bx, by, bw, bh) {
    this.k = Math.min(bw / Math.max(x1 - x0, 0.1), bh / Math.max(y1 - y0, 0.1));
    this.ox = bx + (bw - (x1 - x0) * this.k) / 2 - x0 * this.k;
    this.oy = by + (bh - (y1 - y0) * this.k) / 2 - y0 * this.k;
  }
  // Scale to the view width (capped by maxH) and size the view height to the content.
  fit(x0, y0, x1, y1, W, maxH, side = 62) {
    this.W = W;
    const k = Math.min((W - side * 2) / Math.max(x1 - x0, 0.1), (maxH - 100) / Math.max(y1 - y0, 0.1));
    this.H = Math.max(220, Math.round((y1 - y0) * k + 100));
    this.frame(x0, y0, x1, y1, side, 44, W - side * 2, this.H - 100);
    this.left = side - 4; this.right = W - side + 4;
    return this.H;
  }
  X(x) { return +(this.ox + x * this.k).toFixed(1); }
  Y(y) { return +(this.oy + y * this.k).toFixed(1); }
  // Path from commands in cm: ['M',x,y] ['L',x,y] ['Q',cx,cy,x,y] ['C',c1x,c1y,c2x,c2y,x,y] ['Z']
  d(cmds) {
    return cmds.map(([t, ...a]) => {
      if (t === 'Z') return 'Z';
      const pts = [];
      for (let i = 0; i < a.length; i += 2) pts.push(`${this.X(a[i])} ${this.Y(a[i + 1])}`);
      return t + pts.join(' ');
    }).join('');
  }
  poly(pts, close = true) { return pts.map((p, i) => [i ? 'L' : 'M', p[0], p[1]]).concat(close ? [['Z']] : []); }
  shape(cmds, { texture = this.texture, fill = TD.fill, dash = false, width = 1.5 } = {}) {
    const dd = this.d(cmds);
    this.out.push(`<path d="${dd}" fill="${fill}"/>`);
    if (texture) this.out.push(`<path d="${dd}" fill="url(#${this.id}-${texture})"/>`);
    this.out.push(`<path d="${dd}" fill="none" stroke="${TD.ink}" stroke-width="${width}" stroke-linejoin="round"${dash ? ' stroke-dasharray="4 3"' : ''}/>`);
  }
  band(cmds) { this.shape(cmds, { texture: 'rib', fill: TD.band, width: 1.2 }); }
  line(cmds, { dash = true, width = 1, color = TD.soft } = {}) {
    this.out.push(`<path d="${this.d(cmds)}" fill="none" stroke="${color}" stroke-width="${width}"${dash ? ' stroke-dasharray="4 3"' : ''} stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  ink(cmds, width = 1.3) { this.line(cmds, { dash: false, width, color: TD.ink }); }
  dot(x, y, r = 2.6, fill = '#fff') { this.out.push(`<circle cx="${this.X(x)}" cy="${this.Y(y)}" r="${r}" fill="${fill}" stroke="${TD.ink}" stroke-width="1"/>`); }
  text(x, y, s, { anchor = 'middle', size = 11, color = TD.ink, px = false, italic = false, weight = 400 } = {}) {
    if (!s) return;
    const xx = px ? x : this.X(x), yy = px ? y : this.Y(y);
    this.out.push(`<text x="${xx}" y="${yy}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${color}" stroke="#fff" stroke-width="3" paint-order="stroke" stroke-linejoin="round"${italic ? ' font-style="italic"' : ''}>${esc(s)}</text>`);
  }
  // Dimension lines, offset in px from the measured edge.
  dimH(x1, x2, y, label, off = -16) {
    const yy = +(this.Y(y) + off).toFixed(1), a = this.X(x1), b = this.X(x2);
    this.out.push(`<path d="M${a} ${yy}H${b}M${a} ${yy - 4}v8M${b} ${yy - 4}v8" stroke="${TD.dim}" stroke-width="1" fill="none"/>`);
    this.out.push(`<path d="M${a} ${this.Y(y)}V${yy}M${b} ${this.Y(y)}V${yy}" stroke="${TD.dim}" stroke-width=".5" stroke-dasharray="2 2" fill="none"/>`);
    this.text((a + b) / 2, yy + (off < 0 ? -5 : 14), label, { px: true, size: 10.5, color: TD.dim, weight: 600 });
  }
  dimV(x, y1, y2, label, off = 18) {
    const xx = +(this.X(x) + off).toFixed(1), a = this.Y(y1), b = this.Y(y2);
    this.out.push(`<path d="M${xx} ${a}V${b}M${xx - 4} ${a}h8M${xx - 4} ${b}h8" stroke="${TD.dim}" stroke-width="1" fill="none"/>`);
    this.out.push(`<path d="M${this.X(x)} ${a}H${xx}M${this.X(x)} ${b}H${xx}" stroke="${TD.dim}" stroke-width=".5" stroke-dasharray="2 2" fill="none"/>`);
    const tx = +(xx + (off > 0 ? 7 : -7)).toFixed(1), ty = +((a + b) / 2).toFixed(1);
    this.out.push(`<text x="${tx}" y="${ty}" font-size="10.5" font-weight="600" fill="${TD.dim}" stroke="#fff" stroke-width="3" paint-order="stroke" text-anchor="middle" transform="rotate(${off > 0 ? 90 : -90} ${tx} ${ty})">${esc(label)}</text>`);
  }
  // Leader from a point on the garment to a label in the side margin.
  callout(x, y, s, side = 1, dy = 0) {
    if (!s) return;
    const px = this.X(x), py = this.Y(y);
    const est = String(s).length * 5.2 + 6, W = this.W || 360;
    const tx = side > 0 ? Math.min(Math.max(px + 22, this.right), W - est) : Math.max(Math.min(px - 22, this.left), est);
    this.out.push(`<path d="M${px} ${py}L${tx} ${+(py + dy).toFixed(1)}" stroke="${TD.soft}" stroke-width=".8" fill="none"/><circle cx="${px}" cy="${py}" r="2" fill="${TD.soft}"/>`);
    this.text(tx + (side > 0 ? 3 : -3), +(py + dy + 4).toFixed(1), s, { px: true, anchor: side > 0 ? 'start' : 'end', size: 10, color: TD.soft, italic: true });
  }
  defs() {
    const id = this.id, c = TD.tex;
    return `<defs>
      <pattern id="${id}-stocking" patternUnits="userSpaceOnUse" width="6" height="5"><path d="M1 .8l2 3.2l2-3.2" stroke="${c}" stroke-width=".55" fill="none"/></pattern>
      <pattern id="${id}-garter" patternUnits="userSpaceOnUse" width="6" height="4"><path d="M0 2q1.5-1.6 3 0t3 0" stroke="${c}" stroke-width=".6" fill="none"/></pattern>
      <pattern id="${id}-seed" patternUnits="userSpaceOnUse" width="6" height="6"><circle cx="1.5" cy="1.5" r=".7" fill="${c}"/><circle cx="4.5" cy="4.5" r=".7" fill="${c}"/></pattern>
      <pattern id="${id}-doubleseed" patternUnits="userSpaceOnUse" width="8" height="8"><circle cx="1.2" cy="1.2" r=".6" fill="${c}"/><circle cx="3" cy="1.2" r=".6" fill="${c}"/><circle cx="5.2" cy="5.2" r=".6" fill="${c}"/><circle cx="7" cy="5.2" r=".6" fill="${c}"/></pattern>
      <pattern id="${id}-rice" patternUnits="userSpaceOnUse" width="6" height="8"><path d="M1 .8l2 3l2-3" stroke="${c}" stroke-width=".55" fill="none"/><circle cx="3" cy="6.2" r=".7" fill="${c}"/></pattern>
      <pattern id="${id}-hurdle" patternUnits="userSpaceOnUse" width="6" height="8"><path d="M1 .8l2 3l2-3M0 6q1.5-1.6 3 0t3 0" stroke="${c}" stroke-width=".55" fill="none"/></pattern>
      <pattern id="${id}-garterrib" patternUnits="userSpaceOnUse" width="8" height="4"><path d="M1.5 0v4" stroke="${c}" stroke-width=".55"/><path d="M4 2q2-1.4 4 0" stroke="${c}" stroke-width=".55" fill="none"/></pattern>
      <pattern id="${id}-basketweave" patternUnits="userSpaceOnUse" width="12" height="12"><path d="M1 1.5h4M1 3.5h4M1 5.5h4M7 7.5h4M7 9.5h4M7 11.5h4M7.5 0.5v5M9.5 0.5v5M1.5 6.5v5M3.5 6.5v5" stroke="${c}" stroke-width=".55" fill="none"/></pattern>
      <pattern id="${id}-k2p2rib" patternUnits="userSpaceOnUse" width="6" height="5"><path d="M1.2 0v5M2.6 0v5" stroke="${c}" stroke-width=".6"/></pattern>
      <pattern id="${id}-rib" patternUnits="userSpaceOnUse" width="3.4" height="5"><path d="M1.2 0v5" stroke="#A8976F" stroke-width=".8"/></pattern>
      <pattern id="${id}-lace" patternUnits="userSpaceOnUse" width="10" height="9"><circle cx="2.5" cy="2.5" r="1.3" fill="none" stroke="${c}" stroke-width=".6"/><circle cx="7.5" cy="7" r="1.3" fill="none" stroke="${c}" stroke-width=".6"/></pattern>
    </defs>`;
  }
  svg(W, H, title) {
    H = this.H || H;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, sans-serif" role="img" aria-label="${esc(title)}">${this.defs()}<rect width="${W}" height="${H}" fill="#fff"/>`
      + `<text x="${W / 2}" y="22" font-size="13" font-weight="600" text-anchor="middle" fill="${TD.ink}" font-family="Fraunces, Georgia, serif">${esc(title)}</text>${this.out.join('')}</svg>`;
  }
}

const TD_STITCH = { stocking: 'stocking', rice: 'rice', garter: 'garter', seed: 'seed', doubleseed: 'doubleseed', hurdle: 'hurdle', garterrib: 'garterrib', basketweave: 'basketweave', k2p2rib: 'k2p2rib' };
const stitchName = k => (STITCHES[k]?.label || 'stocking stitch');
const lerp = (a, b, t) => a + (b - a) * t;
// Smooth interpolation through [t, value] keys.
function keyed(keys, t) {
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) { const u = (t - t0) / Math.max(t1 - t0, 1e-6); return lerp(v0, v1, (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, u)))) / 2); }
  }
  return keys[keys.length - 1][1];
}
const NECK_NAMES = { crew: 'crew neck', vneck: 'V-neck', scoop: 'scoop neck', square: 'square neck', boat: 'boat neck', placket: 'placket neck', slit: 'slit neck', offshoulder: 'off-shoulder' };
const COLLAR_NAMES = { ribbed: 'rib band', mockturtle: 'mock turtleneck', turtleneck: 'turtleneck', funnelneck: 'funnel neck', mandarin: 'mandarin collar', convertible: 'convertible collar',
  buttonedhighneck: 'buttoned high neck', zipperedhighneck: 'zipped high neck', henleyplacket: 'henley placket', campcollar: 'camp collar', peterpan: 'Peter Pan collar', cowl: 'draped cowl',
  hood: 'hood', lace: 'lace collar', johnny: 'Johnny collar', vcrossover: 'crossover V trim', vmitered: 'mitred V trim', squaremiteredrib: 'mitred rib trim', squaremiteredgarter: 'mitred garter trim',
  splitribbed: 'split rib collar', shawl: 'shawl collar', offshoulderband: 'off-shoulder band' };
const SLEEVE_NAMES = { setin: 'fitted sleeve', bishop: 'bishop sleeve', flare: 'bell sleeve', balloon: 'balloon sleeve', puffshort: 'short puff sleeve', legofmutton: 'leg-of-mutton sleeve',
  legofmuttonreverse: 'reverse leg-of-mutton', lantern: 'lantern sleeve', cap: 'cap sleeve', sleeveless: 'sleeveless' };

// Long sleeves hang closer to the body so the drawing stays compact.
const sleeveAngle = s => (s.sleeveLen > (s.armhole || 4) * 2.2 ? 66 : 50);

// ---------- shared pieces ----------
// Sleeve as a shaped tube hanging from the armhole segment a→b, angled down and out.
function drawSleeve(c, side, a, b, len, cuffHalf, kind, ribCm, angle = 50) {
  if (!(len > 0)) return null;
  const ang = angle * Math.PI / 180;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const top = Math.hypot(a[0] - b[0], a[1] - b[1]) / 2;
  const dx = side * Math.cos(ang), dy = Math.sin(ang), nx = -dy * side, ny = dx * side;
  const cuff = Math.max(cuffHalf, top * 0.25);
  const W = {
    setin: [[0, top], [1, cuff]],
    bishop: [[0, top], [0.82, top * 1.3], [0.9, top * 1.2], [0.91, cuff], [1, cuff]],
    flare: [[0, top], [0.4, top * 0.92], [1, Math.max(cuff, top * 1.3)]],
    balloon: [[0, top], [0.5, top * 1.55], [0.92, cuff * 1.1], [1, cuff]],
    puffshort: [[0, top], [0.55, top * 1.45], [0.85, top * 1.05], [1, top * 0.9]],
    legofmutton: [[0, top * 1.05], [0.22, top * 1.55], [0.6, cuff * 1.15], [1, cuff]],
    legofmuttonreverse: [[0, top], [0.45, top * 0.75], [0.78, top * 1.25], [0.93, cuff * 1.05], [1, cuff]],
    lantern: [[0, top], [0.35, top * 0.82], [0.55, top * 1.4], [0.76, cuff * 1.05], [1, cuff]],
    cap: [[0, top], [1, top * 0.95]],
  }[kind] || [[0, top], [1, cuff]];
  const N = 18, Lp = [], Rp = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, w = keyed(W, t), px = mx + dx * len * t, py = my + dy * len * t;
    Lp.push([px - nx * w, py - ny * w]); Rp.push([px + nx * w, py + ny * w]);
  }
  // Pin the sleeve's top corners to the armhole so it joins the body cleanly.
  Lp[0] = side > 0 ? a : b; Rp[0] = side > 0 ? b : a;
  c.shape(c.poly(Lp.concat(Rp.reverse())));
  const end = [mx + dx * len, my + dy * len];
  const wEnd = keyed(W, 1);
  const rect = (from, to, w) => c.band(c.poly([[from[0] - nx * w, from[1] - ny * w], [to[0] - nx * w, to[1] - ny * w], [to[0] + nx * w, to[1] + ny * w], [from[0] + nx * w, from[1] + ny * w]]));
  if (!['flare', 'cap'].includes(kind) && ribCm > 0) {
    const r = kind === 'puffshort' ? Math.min(0.4, len * 0.2) : Math.min(ribCm, len * 0.25);
    rect([end[0] - dx * r, end[1] - dy * r], end, wEnd);
  }
  if (['bishop', 'balloon', 'lantern', 'puffshort', 'legofmutton'].includes(kind)) {
    const t = kind === 'legofmutton' ? 0.2 : 0.55;
    for (const f of [-0.5, 0, 0.5]) {
      const w = keyed(W, t) * f;
      c.line([['M', mx + dx * len * (t - 0.18) + nx * w, my + dy * len * (t - 0.18) + ny * w], ['L', mx + dx * len * (t + 0.18) + nx * w * 0.8, my + dy * len * (t + 0.18) + ny * w * 0.8]], { dash: false, color: TD.tex });
    }
  }
  return { end };
}

// Neckline opening from the right neck point (nw,0) back to the left one (-nw,0).
function neckCurve(s, nw, A, back) {
  if (back) return [['Q', 0, A * 0.2, -nw, 0]];
  switch (s.neck) {
    case 'vneck': return [['L', 0, A * 0.85], ['L', -nw, 0]];
    case 'scoop': return [['C', nw, A * 0.62, -nw, A * 0.62, -nw, 0]];
    case 'square': return [['L', nw, A * 0.42], ['L', -nw, A * 0.42], ['L', -nw, 0]];
    case 'boat': return [['Q', 0, A * 0.22, -nw, 0]];
    default: return [['Q', 0, A * 0.68, -nw, 0]];
  }
}
function neckWidth(s, half) {
  const base = Math.max(0.5, (s.neckCirc || half * 1.2) / Math.PI * 0.55);
  const f = { scoop: 1.35, boat: 1.75, square: 1.2, slit: 1.6 }[s.neck] || 1;
  return Math.min(base * f, half * 0.78);
}

// Collar / neck finish over the neckline. Pushes short labels for the callouts into lab.
function drawCollar(c, s, nw, A, back, lab) {
  const col = s.collar || 'ribbed';
  const tall = h => c.band([['M', -nw * 0.96, 0.05], ['L', -nw * 0.92, -h], ['L', nw * 0.92, -h], ['L', nw * 0.96, 0.05], ['Q', 0, A * 0.18, -nw * 0.96, 0.05], ['Z']]);
  const ribAlong = () => {
    const path = c.d([['M', nw, 0], ...neckCurve(s, nw, A, back)]);
    const w = Math.max(3.5, Math.min(0.8, A * 0.12) * c.k);
    c.out.push(`<path d="${path}" fill="none" stroke="${TD.band}" stroke-width="${w.toFixed(1)}" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="url(#${c.id}-rib)" stroke-width="${w.toFixed(1)}" stroke-linejoin="round"/>`);
    c.ink([['M', nw, 0], ...neckCurve(s, nw, A, back)], 1);
  };
  switch (col) {
    case 'mockturtle': tall(A * 0.32); break;
    case 'turtleneck': tall(A * 0.75); c.line([['M', -nw * 0.94, -A * 0.38], ['L', nw * 0.94, -A * 0.38]]); break;
    case 'funnelneck': c.band([['M', -nw * 0.96, 0.05], ['L', -nw * 1.18, -A * 0.5], ['L', nw * 1.18, -A * 0.5], ['L', nw * 0.96, 0.05], ['Q', 0, A * 0.18, -nw * 0.96, 0.05], ['Z']]); break;
    case 'mandarin': tall(A * 0.18); if (!back) c.ink([['M', 0, -A * 0.18], ['L', 0, A * 0.1]], 1); break;
    case 'buttonedhighneck': case 'zipperedhighneck':
      tall(A * 0.45);
      if (!back) {
        c.ink([['M', 0, -A * 0.45], ['L', 0, A * 0.35]], 1);
        if (col === 'buttonedhighneck') for (const y of [-A * 0.32, -A * 0.08, A * 0.2]) c.dot(0.25, y, 2.2);
        else c.line([['M', 0.12, -A * 0.44], ['L', 0.12, A * 0.34]], { dash: true, color: TD.ink });
      }
      break;
    case 'cowl':
      ribAlong();
      if (!back) for (const f of [0.35, 0.65, 0.95]) c.ink([['M', -nw * (0.9 + f * 0.25), 0.1], ['Q', 0, A * (0.35 + f * 0.7), nw * (0.9 + f * 0.25), 0.1]], 1.1);
      break;
    case 'hood': {
      const hw = Math.max(nw * 1.9, A * 0.95), hh = A * 1.75;   // hood half-width and height
      c.shape([['M', -nw * 1.05, 0.1], ['C', -hw * 1.25, -hh * 0.2, -hw * 1.1, -hh, 0, -hh], ['C', hw * 1.1, -hh, hw * 1.25, -hh * 0.2, nw * 1.05, 0.1], ['Q', 0, A * 0.3, -nw * 1.05, 0.1], ['Z']]);
      if (!back) c.shape([['M', -nw * 0.75, 0], ['C', -hw * 0.95, -hh * 0.2, -hw * 0.75, -hh * 0.85, 0, -hh * 0.86], ['C', hw * 0.75, -hh * 0.85, hw * 0.95, -hh * 0.2, nw * 0.75, 0], ['Q', 0, A * 0.2, -nw * 0.75, 0], ['Z']], { texture: null, fill: '#fff', width: 1.2 });
      else c.line([['M', 0, -hh], ['L', 0, 0.2]]);
      break;
    }
    case 'peterpan': case 'campcollar': case 'convertible':
      if (back) { tall(A * 0.12); break; }
      for (const sg of [-1, 1]) {
        const tip = col === 'peterpan' ? [['Q', sg * nw * 1.5, A * 0.75, sg * 0.2, A * 0.62]] : [['L', sg * nw * 1.35, A * 0.75], ['L', sg * 0.15, A * 0.55]];
        c.shape([['M', sg * nw * 1.02, -0.05], ...tip, ['Q', sg * nw * 0.6, A * 0.25, sg * nw * 1.02, -0.05], ['Z']], { texture: null, fill: TD.band, width: 1.2 });
      }
      break;
    case 'henleyplacket': case 'johnny':
      ribAlong();
      if (!back) { const e = col === 'johnny' ? 0.95 : 0.9; c.band(c.poly([[-0.35, A * 0.25], [0.35, A * 0.25], [0.35, A * e], [-0.35, A * e]])); for (const y of [0.4, 0.6, 0.8]) c.dot(0, A * y, 2.1); }
      break;
    case 'shawl':
      if (!back) for (const sg of [-1, 1]) c.shape([['M', sg * nw, -0.05], ['Q', sg * nw * 1.5, A * 0.5, sg * 0.3, A * 1.25], ['L', 0, A * 1.25], ['Q', sg * nw * 0.4, A * 0.4, sg * nw * 0.55, 0.1], ['Z']], { texture: 'rib', fill: TD.band, width: 1.2 });
      else tall(A * 0.25);
      break;
    case 'lace':
      ribAlong();
      c.shape([['M', -nw * 1.25, 0.1], ['Q', 0, A * (back ? 0.45 : 0.95), nw * 1.25, 0.1], ['Q', 0, A * (back ? 0.25 : 0.7), -nw * 1.25, 0.1], ['Z']], { texture: 'lace', fill: '#fff', width: 0.9 });
      break;
    case 'offshoulderband': break;
    default: ribAlong();
  }
  if (!back) lab.push(COLLAR_NAMES[col] || 'neckband');
}

// Half-width of the body below the underarm (t: 0 at the underarm, 1 at the hem).
function silhouetteHalf(s, half, hemHalf, t, waistT) {
  const w = Math.max(0.15, Math.min(0.85, waistT || 0.35));
  switch (s.silhouette) {
    case 'aline': return keyed([[0, half], [0.12, half], [1, hemHalf]], t);
    case 'tapered': return keyed([[0, half], [0.15, half], [1, hemHalf]], t);
    case 'shaped': return keyed([[0, half], [w, half * 0.88], [1, Math.max(hemHalf, half * 0.95)]], t);
    case 'peplum': { const j = Math.min(0.8, w + 0.2); return keyed([[0, half], [j, half * 0.9], [j + 0.02, half * 0.95], [1, hemHalf]], t); }
    case 'cocoon': return keyed([[0, half], [0.5, half * 1.3], [1, hemHalf]], t);
    case 'fitflare': return keyed([[0, half], [w, half * 0.86], [1, hemHalf]], t);
    case 'empire': return keyed([[0, half], [0.08, half * 0.95], [1, hemHalf]], t);
    case 'dropwaist': { const j = Math.min(0.8, w + 0.25); return keyed([[0, half], [j, half], [1, hemHalf]], t); }
    case 'mermaid': return keyed([[0, half], [0.75, half * 0.95], [1, hemHalf]], t);
    default: return keyed([[0, half], [1, hemHalf]], t);
  }
}

// ---------- tops, dresses, cardigans (and the bodice of bodysuits/jumpsuits) ----------
function drawTopView(c, s, back, opt = {}) {
  const lab = [];
  const half = s.chest / 4;                      // flat half-width at the bust
  const A = Math.max(1, s.armhole || half * 0.6);
  const L = Math.max(A * 1.15, opt.bodyLen || s.length || A * 2.4);
  const hemHalf = Math.max(0.3, (opt.hem || s.hem || s.chest) / 4);
  const off = s.neck === 'offshoulder';
  const nw = neckWidth(s, half);
  const dy = A * 0.12;
  const cons = s.construction || 'setin';
  const drop = cons === 'square';
  const sx = drop ? half : half * 0.88;
  const sleeveKind = s.sleeve || 'setin';
  const grown = cons === 'dolman' || cons === 'kimono';
  const hasSleeve = sleeveKind !== 'sleeveless' && s.sleeveLen > 0 && !grown;
  const waistT = s.waistY > A ? Math.min(0.9, (s.waistY - A) / Math.max(0.1, L - A)) : 0.35;
  const offY = A * 0.3;

  // sleeves first, so the body outline sits on top of the armhole seam
  let slv = null;
  if (hasSleeve) {
    for (const sg of [-1, 1]) {
      let a, b;
      if (cons === 'raglan') { a = [sg * nw, 0.05]; b = [sg * half, A]; }
      else if (drop) { a = [sg * half, dy]; b = [sg * half, dy + A * 0.95]; }
      else if (off) { a = [sg * half * 0.97, offY]; b = [sg * half, A]; }
      else { a = [sg * sx, dy]; b = [sg * half, A]; }
      const r = drawSleeve(c, sg, a, b, s.sleeveLen, (s.cuff || s.upperArm * 0.7) / 4, sleeveKind, Math.min(1, s.rib || 0.6), drop ? Math.max(62, sleeveAngle(s)) : sleeveAngle(s));
      if (sg > 0) slv = r;
    }
  }
  const side = sg => {
    if (grown) {
      const len = s.sleeveLen || A * 2, cuffH = Math.max(0.4, (s.cuff || A) / 4);
      if (cons === 'kimono') { const tip = [sg * (half + len * 0.98), dy * 0.6]; return [[sg * nw, 0], tip, [tip[0], tip[1] + cuffH * 2], [sg * half * 1.02, A * 0.95]]; }
      const tip = [sg * (half * 0.6 + len * 0.9), dy + len * 0.42];
      return [[sg * nw, 0], tip, [tip[0], tip[1] + cuffH * 2], [sg * half * 1.05, Math.min(L * 0.75, A * 1.9)]];
    }
    if (off) return [[sg * half * 0.97, offY], [sg * half, A]];
    if (cons === 'raglan') return [[sg * nw, 0], [sg * half, A]];
    if (drop) return [[sg * nw, 0], [sg * half, dy], [sg * half, A]];
    return [[sg * nw, 0], [sg * sx, dy], [sg * half * 0.96, A * 0.55], [sg * half, A]];
  };
  const leftSide = side(-1), rightSide = side(1);
  const startY = leftSide[leftSide.length - 1][1];
  const hx = y => silhouetteHalf(s, half, hemHalf, Math.max(0, (y - A) / Math.max(0.1, L - A)), waistT);
  const pts = [...leftSide];
  for (let i = 1; i <= 16; i++) { const y = lerp(startY, L, i / 16); pts.push([-hx(y), y]); }
  for (let i = 16; i >= 1; i--) { const y = lerp(startY, L, i / 16); pts.push([hx(y), y]); }
  pts.push(...rightSide.slice().reverse());
  const cmds = c.poly(pts, false);
  if (off) cmds.push(['L', -half * 0.97, offY]); else cmds.push(...neckCurve(s, nw, A, back));
  cmds.push(['Z']);
  c.shape(cmds);
  // construction lines
  if (cons === 'raglan') for (const sg of [-1, 1]) c.line([['M', sg * nw, 0.05], ['L', sg * half, A]]);
  if (cons === 'saddle') for (const sg of [-1, 1]) c.line([['M', sg * nw, A * 0.08], ['L', sg * sx, dy + A * 0.08]]);
  if (cons === 'circularyoke') { c.line([['M', -half * 0.98, A * 0.95], ['Q', 0, A * 1.25, half * 0.98, A * 0.95]]); c.line([['M', -nw * 1.5, A * 0.2], ['Q', 0, A * 0.75, nw * 1.5, A * 0.2]], { dash: false, color: TD.tex, width: 2.4 }); }
  if (s.waistY > A && s.waistY < L && ['shaped', 'fitflare', 'peplum', 'empire', 'dropwaist'].includes(s.silhouette)) {
    const f = { empire: 0.08, dropwaist: Math.min(0.8, waistT + 0.25), peplum: Math.min(0.8, waistT + 0.2) }[s.silhouette];
    const wy = f != null ? A + (L - A) * f : s.waistY;
    c.line([['M', -hx(wy), wy], ['L', hx(wy), wy]]);
  }
  // hem finish
  const hemW = hx(L);
  if (s.hemStyle === 'rib') {
    const ribH = Math.min(s.rib || 0.8, (L - A) * 0.3), yb = L - ribH;
    c.band(c.poly([[-hx(yb), yb], [hx(yb), yb], [hemW, L], [-hemW, L]]));
  } else if (s.hemStyle === 'picot') {
    const n = Math.max(6, Math.round(hemW * 2 * c.k / 9));
    let d = '';
    for (let i = 0; i < n; i++) { const x0 = c.X(-hemW + 2 * hemW * i / n), x1 = c.X(-hemW + 2 * hemW * (i + 1) / n), y = c.Y(L); d += `M${x0} ${y}Q${((x0 + x1) / 2).toFixed(1)} ${(y + 5).toFixed(1)} ${x1} ${y}`; }
    c.out.push(`<path d="${d}" fill="none" stroke="${TD.ink}" stroke-width="1"/>`);
  } else if (s.hemStyle === 'rolled') {
    c.line([['M', -hemW, L - 0.25], ['L', hemW, L - 0.25]], { dash: false, color: TD.tex, width: 2 });
  }
  // cardigan fronts
  if (s.cardigan && !back) {
    const cl = s.closure || 'buttoned';
    const topY = s.neck === 'vneck' ? A * 0.85 : A * 0.62;
    if (cl === 'open') c.ink([['M', 0, topY], ['L', 0, L]]);
    else if (cl === 'zippered') { c.ink([['M', 0, topY * 0.3], ['L', 0, L]]); c.line([['M', 0.15, topY * 0.3], ['L', 0.15, L]], { dash: true, color: TD.ink }); lab.push('zip front'); }
    else if (cl === 'wraptie') { c.ink([['M', -nw, 0.05], ['L', half * 0.55, L * 0.62]]); c.ink([['M', half * 0.5, L * 0.62], ['Q', half * 0.95, L * 0.7, half * 0.75, L * 0.86]], 1.1); lab.push('wrap front, tie'); }
    else {
      c.band(c.poly([[-0.45, topY], [0.45, topY], [0.45, L], [-0.45, L]]));
      const nb = Math.max(1, Math.min(12, Math.round(s.buttons || 5)));
      const xs = cl === 'doublebreasted' ? [-half * 0.35, half * 0.35] : [0];
      for (const x of xs) for (let i = 0; i < nb; i++) c.dot(x, topY + 0.5 + (L - topY - 1) * (i + 0.5) / nb, 2.4);
      lab.push(cl === 'doublebreasted' ? `double-breasted, ${nb} buttons a side` : `${nb} buttons`);
    }
    if (s.frontShape === 'rounded') for (const sg of [-1, 1]) c.ink([['M', sg * 0.1, L - 1], ['Q', sg * 0.1, L, sg * 1, L]], 1);
    if (s.frontShape === 'vfront') for (const sg of [-1, 1]) c.ink([['M', sg * 0.1, L - (L - A) * 0.35], ['L', sg * half * 0.5, L]], 1);
  }
  if (!back && ['zip', 'button', 'henley'].includes(s.opening)) { c.ink([['M', 0, A * 0.5], ['L', 0, A * (s.opening === 'zip' ? 1.6 : 1.1)]], 1); if (s.opening !== 'zip') for (const y of [0.7, 0.95]) c.dot(0.25, A * y, 2); }
  if (s.pocket && !back) { const pw = half * 0.42, py = L - (L - A) * 0.42; c.shape(c.poly([[-half * 0.62, py], [-half * 0.62 + pw, py], [-half * 0.62 + pw, py + pw * 0.85], [-half * 0.62, py + pw * 0.85]]), { width: 1.1 }); lab.push('pocket'); }
  if (s.coldShoulder && hasSleeve && !back && !off) for (const sg of [-1, 1]) c.shape([['M', sg * sx * 1.02, dy + 0.3], ['Q', sg * (sx + A * 0.4), dy + A * 0.15, sg * (sx + A * 0.15), dy + A * 0.45], ['Q', sg * sx * 0.98, dy + A * 0.4, sg * sx * 1.02, dy + 0.3], ['Z']], { texture: null, fill: '#fff', width: 1 });
  if (off) { c.band(c.poly([[-half * 0.97, offY - 0.6], [half * 0.97, offY - 0.6], [half * 0.97, offY], [-half * 0.97, offY]])); if (!back) lab.push('off-shoulder band'); }
  else drawCollar(c, s, nw, A, back, lab);
  return { half, A, L, hemHalf: hemW, slv, lab, nw };
}

function frameTop(c, s, W, H, bodyLen) {
  const half = s.chest / 4, A = s.armhole || half * 0.6, L = Math.max(A * 1.15, bodyLen || s.length || A * 2.4);
  const hasSl = s.sleeveLen > 0 && s.sleeve !== 'sleeveless';
  const ang = sleeveAngle(s) * Math.PI / 180;
  const slvReach = hasSl ? Math.cos(ang) * s.sleeveLen + (s.upperArm || 0) / 4 : 0;
  let ext = Math.max(half + slvReach, (s.hem || s.chest) / 4, half * 1.15);
  if (s.construction === 'kimono') ext = Math.max(ext, half + (s.sleeveLen || 0));
  if (s.construction === 'dolman') ext = Math.max(ext, half * 0.6 + (s.sleeveLen || 0) * 0.9);
  const top = s.collar === 'hood' ? -A * 1.85 : s.collar === 'turtleneck' ? -A * 0.85 : -A * 0.55;
  const bottom = Math.max(L, hasSl ? A * 0.6 + Math.sin(ang) * s.sleeveLen + (s.cuff || 0) / 4 : 0);
  c.fit(-ext - 0.3, top, ext + 0.3, bottom + 0.6, W, H);
}

function topViews(s) {
  const W = 360, H = 420, views = [];
  const tex = TD_STITCH[s.stitch] || 'stocking';
  for (const back of [false, true]) {
    const c = new TechCanvas(tex);
    frameTop(c, s, W, H);
    const r = drawTopView(c, s, back);
    if (!back) {
      c.dimH(-r.half, r.half, r.A, `bust ${cmTxt(s.chest)} round`, -14);
      c.dimH(-r.hemHalf, r.hemHalf, r.L, `hem ${cmTxt(s.hem || s.chest)} round`, 18);
      if (r.slv) c.text(c.X(r.slv.end[0]), c.Y(r.slv.end[1]) + 24, `sleeve ${cmTxt(s.sleeveLen)}`, { px: true, size: 10, color: TD.dim, weight: 600 });
      const front = r.lab.filter(x => /button|zip|wrap|pocket/.test(x));
      const neckLab = [s.neck && s.neck !== 'crew' ? NECK_NAMES[s.neck] : '', ...r.lab.filter(x => !front.includes(x))].filter(Boolean).join(' · ');
      c.callout(-r.nw * 0.6, 0.15, neckLab, -1, -16);
      c.callout(-r.half * 0.45, r.A + (r.L - r.A) * 0.45, stitchName(s.stitch), -1, 6);
      if (front.length) c.callout(r.half * 0.3, r.A + (r.L - r.A) * 0.62, front.join(' · '), 1, 12);
      c.callout(-r.hemHalf * 0.6, r.L - 0.2, { rib: '1x1 rib hem', picot: 'picot hem', rolled: 'rolled hem' }[s.hemStyle], -1, 18);
      if (r.slv && s.sleeve && s.sleeve !== 'setin') c.callout(r.slv.end[0], r.slv.end[1], SLEEVE_NAMES[s.sleeve], 1, -30);
      const consLab = { raglan: 'raglan sleeves', saddle: 'saddle shoulders', square: 'drop shoulders', dolman: 'dolman / batwing sleeves', kimono: 'kimono sleeves', circularyoke: 'circular yoke, worked top-down in the round' }[s.construction];
      c.text(W / 2, c.H - 12, consLab, { px: true, size: 10, color: TD.soft, italic: true });
    }
    else c.dimV(0, r.A * 0.2, r.L, `length ${cmTxt(r.L)} (shoulder to hem)`, 0);
    views.push(c.svg(W, H, back ? 'Back' : 'Front'));
  }
  return views;
}

// ---------- bodysuit / jumpsuit ----------
function bodysuitViews(s) {
  const W = 360, H = 430, views = [];
  for (const back of [false, true]) {
    const c = new TechCanvas(TD_STITCH[s.stitch] || 'stocking');
    const A = s.armhole, L = A + s.torso, yb = L - s.torso * 0.42;
    frameTop(c, s, W, H, L);
    const r = drawTopView(c, { ...s, hemStyle: null }, back, { bodyLen: yb + 0.05, hem: s.chest * 0.95 });
    const w = r.hemHalf, cr = Math.max(0.4, s.chest * 0.04);
    // high-cut leotard base: filled without a seam line at the join, legs edged with rib
    const base = [['M', -w, yb - 0.3], ['L', w, yb - 0.3], ['L', w, yb], ['Q', w * 0.3, yb + s.torso * 0.12, cr, L], ['L', -cr, L], ['Q', -w * 0.3, yb + s.torso * 0.12, -w, yb], ['Z']];
    c.out.push(`<path d="${c.d(base)}" fill="${TD.fill}"/><path d="${c.d(base)}" fill="url(#${c.id}-${c.texture})"/>`);
    for (const sg of [-1, 1]) {
      const leg = [['M', sg * w, yb], ['Q', sg * w * 0.3, yb + s.torso * 0.12, sg * cr, L]];
      c.out.push(`<path d="${c.d(leg)}" fill="none" stroke="#C9B994" stroke-width="4"/>`);
      c.ink(leg, 1.5);
    }
    c.ink([['M', -cr, L], ['L', cr, L]], 1.5);
    if (!back) {
      c.dimH(-r.half, r.half, A, `bust ${cmTxt(s.chest)} round`, -14);
      c.text(0, L + 0.9, `leg opening ${cmTxt(s.legOpen)} each`, { size: 10, color: TD.dim, weight: 600 });
      if (s.closure === 'snapcrotch') c.callout(0, L - 0.2, 'snap crotch', 1, 10);
      c.callout(-r.half * 0.4, A + s.torso * 0.35, stitchName(s.stitch), -1);
      c.callout(-r.nw * 0.6, 0.15, [s.neck !== 'crew' ? NECK_NAMES[s.neck] : '', ...r.lab].filter(Boolean).join(' · '), -1, -16);
    } else c.dimV(0, A, L, `underarm to crotch ${cmTxt(s.torso)}`, 0);
    views.push(c.svg(W, H, back ? 'Back' : 'Front'));
  }
  return views;
}
function jumpsuitViews(s) {
  const W = 360, H = 450, views = [];
  for (const back of [false, true]) {
    const c = new TechCanvas(TD_STITCH[s.stitch] || 'stocking');
    const A = s.armhole, yW = A + s.bodice, yC = yW + s.rise, yH = yC + s.legLen;
    frameTop(c, { ...s, hem: s.hip }, W, H, yH);
    const hipH = s.hip / 4, waistH = s.waist / 4, open = s.legOpen / 2;
    for (const sg of [-1, 1]) {
      const outBot = sg * Math.max(open + 0.2, hipH * (s.shorts ? 1 : 0.85)), inBot = outBot - sg * open;
      c.shape(c.poly([[sg * waistH, yW], [sg * hipH, yW + s.rise * 0.7], [outBot, yH], [inBot, yH], [sg * 0.12, yC], [0, yC - s.rise * 0.08], [0, yW]]));
      c.band(c.poly([[outBot, yH - Math.min(0.6, s.legLen * 0.15)], [inBot, yH - Math.min(0.6, s.legLen * 0.15)], [inBot, yH], [outBot, yH]]));
    }
    const r = drawTopView(c, { ...s, hemStyle: null, hem: s.waist }, back, { bodyLen: yW, hem: s.waist });
    c.line([['M', -waistH, yW], ['L', waistH, yW]]);
    if (!back) {
      c.dimH(-r.half, r.half, A, `bust ${cmTxt(s.chest)} round`, -14);
      c.dimV(Math.max(hipH, r.half), yC, yH, `leg ${cmTxt(s.legLen)}`, 22);
      c.dimV(-Math.max(hipH, r.half), yW, yC, `rise ${cmTxt(s.rise)}`, -22);
      c.text(0, yH + 1, `waist ${cmTxt(s.waist)} · hip ${cmTxt(s.hip)} · leg opening ${cmTxt(s.legOpen)}`, { size: 9.5, color: TD.dim, weight: 600 });
      c.callout(-hipH * 0.5, yC + s.legLen * 0.4, stitchName(s.stitch), -1);
      c.callout(-r.nw * 0.6, 0.15, [s.neck !== 'crew' ? NECK_NAMES[s.neck] : '', ...r.lab].filter(Boolean).join(' · '), -1, -16);
    }
    views.push(c.svg(W, H, back ? 'Back' : 'Front'));
  }
  return views;
}

// ---------- pants ----------
function pantsViews(s) {
  const W = 360, H = 420;
  const c = new TechCanvas(TD_STITCH[s.stitch] || 'stocking');
  const hipH = s.hip / 4, waistH = s.waist / 4, band = Math.min(s.band, s.rise * 0.5);
  const yC = s.rise, yH = s.rise + s.legLen, open = s.legOpen / 2;
  const ext = Math.max(hipH, open * 2) + 0.5;
  c.fit(-ext, -1, ext, yH + 1, W, H, 62);
  for (const sg of [-1, 1]) {
    const outB = sg * Math.max(open + 0.2, hipH * ({ wideleg: 1.05, bootcut: 0.95 }[s.style] || 0.85)), inB = outB - sg * open;
    c.shape(c.poly([[0, 0], [sg * waistH, 0], [sg * hipH, yC * 0.75], [outB, yH], [inB, yH], [sg * 0.12, yC], [0, yC * 0.92]]));
    const cuffH = s.style === 'jogger' ? Math.min(0.8, s.legLen * 0.15) : Math.min(0.35, s.legLen * 0.1);
    c.band(c.poly([[outB, yH - cuffH], [inB, yH - cuffH], [inB, yH], [outB, yH]]));
  }
  c.band(c.poly([[-waistH, 0], [waistH, 0], [waistH * 1.01, band], [-waistH * 1.01, band]]));
  c.line([['M', 0, band], ['L', 0, yC * 0.9]]);
  if (s.pocket) c.shape(c.poly([[-hipH * 0.75, band + 0.6], [-hipH * 0.35, band + 0.6], [-hipH * 0.35, band + 0.6 + hipH * 0.4], [-hipH * 0.75, band + 0.6 + hipH * 0.4]]), { width: 1 });
  c.dimH(-waistH, waistH, 0, `waist ${cmTxt(s.waist)}`, -14);
  c.dimV(Math.max(hipH, open * 2), yC, yH, `leg ${cmTxt(s.legLen)}`, 20);
  c.dimV(-Math.max(hipH, open * 2), 0, yC, `rise ${cmTxt(s.rise)}`, -20);
  c.text(0, yH + 1.1, `hip ${cmTxt(s.hip)} · leg opening ${cmTxt(s.legOpen)} round`, { size: 10, color: TD.dim, weight: 600 });
  c.callout(-hipH * 0.55, yC + s.legLen * 0.35, stitchName(s.stitch), -1);
  if (s.waistband === 'elastic') c.callout(waistH * 0.6, band / 2, 'elastic channel', 1, -8);
  return [c.svg(W, H, 'Front')];
}

// ---------- skirts ----------
function skirtViews(s) {
  const W = 360, H = 400;
  const c = new TechCanvas(TD_STITCH[s.stitch] || 'stocking');
  const ww = s.waist / 4, len = s.length, band = Math.min(s.band, len * 0.3);
  const hw = Math.min(s.hem / 4, ww * (s.style === 'circle' ? 2.8 : 2.3));
  const sag = s.style === 'circle' ? len * 0.16 : ['aline', 'gored', 'wrap'].includes(s.style) ? len * 0.05 : 0.001;
  const ext = Math.max(hw, ww * 1.25) + 0.6;
  c.fit(-ext, -1, ext, len + sag + 1, W, H, 62);
  const y0 = band;
  let outline;
  if (s.mode === 'bubble') outline = [['M', -ww, y0], ['L', ww, y0], ['C', hw * 1.1, len * 0.45, hw * 1.05, len * 0.85, ww * 0.95, len], ['L', -ww * 0.95, len], ['C', -hw * 1.05, len * 0.85, -hw * 1.1, len * 0.45, -ww, y0], ['Z']];
  else if (s.mode === 'mermaid') {
    const hip = Math.min(s.hipY || len * 0.35, len * 0.6);
    outline = [['M', -ww, y0], ['L', ww, y0], ['Q', ww * 1.25, hip * 0.6, ww * 1.15, hip], ['L', ww * 1.05, len * 0.68], ['Q', ww * 1.1, len * 0.85, hw, len], ['L', -hw, len], ['Q', -ww * 1.1, len * 0.85, -ww * 1.05, len * 0.68], ['L', -ww * 1.15, hip], ['Q', -ww * 1.25, hip * 0.6, -ww, y0], ['Z']];
  } else if (s.mode === 'tiers') {
    const t1 = y0 + (len - y0) / 3, t2 = y0 + (len - y0) * 2 / 3, w1 = lerp(ww, hw, 0.45), w2 = lerp(ww, hw, 0.75);
    outline = c.poly([[-ww, y0], [ww, y0], [w1 * 0.92, t1], [w1, t1], [w2 * 0.95, t2], [w2, t2], [hw, len], [-hw, len], [-w2, t2], [-w2 * 0.95, t2], [-w1, t1], [-w1 * 0.92, t1]]);
  } else if (s.mode === 'burst') outline = [['M', -ww, y0], ['L', ww, y0], ['Q', hw * 0.95, len * 0.35, hw, len], ['Q', 0, len + sag, -hw, len], ['Q', -hw * 0.95, len * 0.35, -ww, y0], ['Z']];
  else outline = [['M', -ww, y0], ['L', ww, y0], ['L', hw, len], ['Q', 0, len + sag, -hw, len], ['Z']];
  c.shape(outline);
  c.band(c.poly([[-ww, 0], [ww, 0], [ww, y0], [-ww, y0]]));
  const xAt = y => lerp(ww, hw, (y - y0) / Math.max(0.1, len - y0));
  if (s.mode === 'tiers') for (const [f, w] of [[1 / 3, lerp(ww, hw, 0.45)], [2 / 3, lerp(ww, hw, 0.75)]]) { const y = y0 + (len - y0) * f; c.ink([['M', -w, y], ['L', w, y]], 1); }
  if (s.mode === 'burst') for (let i = -3; i <= 3; i++) c.line([['M', i * ww / 3.4, y0 + 0.2], ['L', i * hw / 3.6, len - 0.3]], { dash: false, color: TD.tex });
  if (s.mode === 'pleat') { const n = Math.max(3, Math.min(12, Math.round((s.pleats || 12) / 2))); for (let i = -n + 1; i < n; i++) c.line([['M', i * ww / n, y0], ['L', i * hw / n, len]], { dash: false, color: TD.soft }); }
  if (s.mode === 'gored') { const n = Math.max(1, Math.round((s.gores || 6) / 2)); for (let i = -n + 1; i < n; i++) c.line([['M', i * ww / n, y0], ['L', i * hw / n, len]]); }
  if (s.mode === 'wrap') { c.ink([['M', ww * 0.35, y0], ['Q', -hw * 0.1, len * 0.6, -hw * 0.55, len]], 1.2); c.ink([['M', ww * 0.35, y0 + 0.3], ['Q', ww * 1.1, y0 + 1.2, ww * 0.9, y0 + 2.4]], 1); }
  if (s.slit && s.slitDepth > 0) { const x = s.slit === 'side' ? hw * 0.96 : 0; c.ink([['M', x * 0.97, len - s.slitDepth], ['L', x, len]], 1.6); c.callout(x, len - s.slitDepth * 0.5, `${s.slit} slit ${cmTxt(s.slitDepth)}`, 1, -6); }
  if (s.godets) for (const sg of [-1, 1]) { const y = len * 0.58; c.shape(c.poly([[sg * xAt(y) * 0.45, y], [sg * hw * 0.3, len], [sg * hw * 0.6, len]]), { width: 1 }); }
  if (s.pocket) c.shape(c.poly([[-ww * 0.85, y0 + 0.8], [-ww * 0.3, y0 + 0.8], [-ww * 0.3, y0 + 0.8 + ww * 0.5], [-ww * 0.85, y0 + 0.8 + ww * 0.5]]), { width: 1 });
  c.dimH(-ww, ww, 0, `waist ${cmTxt(s.waist)}`, -14);
  c.dimH(-hw, hw, len + sag, `hem ${cmTxt(s.hem)} round`, 18);
  c.dimV(Math.max(hw, ww), 0, len, `length ${cmTxt(len)}`, 20);
  c.callout(-ww * 0.4, y0 + (len - y0) * 0.45, stitchName(s.stitch), -1);
  if (s.waistband === 'elastic') c.callout(ww * 0.6, y0 / 2, 'elastic waist', 1, -8);
  const name = { straight: 'straight / pencil', aline: 'A-line', circle: 'circle skirt', gathered: 'gathered', tiered: 'tiered', bubble: 'bubble', pleated: 'pleated', wrap: 'wrap skirt', gored: `${s.gores}-gore skirt`, mermaid: 'mermaid / trumpet' }[s.style];
  c.text(W / 2, c.H - 12, name, { px: true, size: 10, color: TD.soft, italic: true });
  return [c.svg(W, H, 'Front')];
}

// ---------- hats ----------
function hatViews(s) {
  const W = 360, H = 380;
  const c = new TechCanvas(TD_STITCH[s.stitch] || 'stocking');
  const fw = s.circ / 4, bw = s.bodyCirc / 4, d = s.height, brim = Math.min(s.brim, d * 0.45), pt = s.point || 0;
  const pom = s.pompom ? d * 0.3 : 0;
  const flaps = s.bodyStyle === 'earflap' ? d * 0.45 : 0;
  const peak = s.brimStyle === 'peaked' ? fw * 0.45 : 0;
  const ext = Math.max(fw, bw) * 1.25 + 0.5;
  c.fit(-ext, -pt - pom - 0.5, ext, d + Math.max(flaps * 1.7, peak) + 0.8, W, H, 62);
  const yb = d - brim;
  if (s.crownStyle === 'pointed') c.shape([['M', -fw, yb], ['Q', -fw * 1.05, 0, -fw * 0.25, -pt * 0.2], ['Q', -fw * 0.1, -pt * 0.7, fw * 0.15, -pt], ['Q', fw * 0.25, -pt * 0.5, fw * 0.4, 0], ['Q', fw * 1.05, d * 0.15, fw, yb], ['Z']]);
  else if (s.bodyStyle === 'beret' || s.crownStyle === 'flatround') {
    const w = s.bodyStyle === 'beret' ? bw * 1.05 : Math.max(bw, fw);
    c.shape([['M', -fw, yb], ['Q', -w * 1.15, yb * 0.7, -w, yb * 0.35], ['Q', -w * 0.9, 0, 0, 0], ['Q', w * 0.9, 0, w, yb * 0.35], ['Q', w * 1.15, yb * 0.7, fw, yb], ['Z']]);
  } else if (s.bodyStyle === 'slouchy') {
    c.shape([['M', -fw, yb], ['L', -bw, yb * 0.5], ['Q', -bw * 1.1, -d * 0.05, bw * 0.2, d * 0.02], ['Q', bw * 1.2, d * 0.15, bw * 1.05, yb * 0.45], ['L', fw, yb], ['Z']]);
    c.line([['M', -bw * 0.7, yb * 0.3], ['Q', 0, yb * 0.45, bw * 0.7, yb * 0.25]]);
  } else {
    c.shape([['M', -fw, yb], ['L', -fw, yb * 0.42], ['Q', -fw, 0, 0, 0], ['Q', fw, 0, fw, yb * 0.42], ['L', fw, yb], ['Z']]);
    for (const f of [-0.5, 0, 0.5]) c.line([['M', f * fw * 0.5, 0.15], ['L', f * fw, yb * 0.35]]);
  }
  if (flaps) for (const sg of [-1, 1]) { c.shape(c.poly([[sg * fw * 0.95, d - 0.1], [sg * fw * 0.35, d - 0.1], [sg * fw * 0.65, d + flaps]]), { width: 1.2 }); c.ink([['M', sg * fw * 0.65, d + flaps], ['Q', sg * fw * 0.7, d + flaps * 1.4, sg * fw * 0.55, d + flaps * 1.7]], 1.1); }
  c.band(c.poly([[-fw, yb], [fw, yb], [fw, d], [-fw, d]]));
  if (s.brimStyle === 'folded' || s.brimStyle === 'watchcap') c.line([['M', -fw, yb + brim * 0.5], ['L', fw, yb + brim * 0.5]], { dash: true, color: TD.ink });
  if (peak) c.shape([['M', -fw * 0.75, d], ['Q', 0, d + peak, fw * 0.75, d], ['Z']], { texture: null, fill: '#EFE6D2', width: 1.2 });
  if (pom) { const r = pom / 2; c.out.push(`<circle cx="${c.X(s.crownStyle === 'pointed' ? fw * 0.15 : 0)}" cy="${c.Y(-pt - r * 0.9)}" r="${(r * c.k).toFixed(1)}" fill="${TD.band}" stroke="${TD.ink}" stroke-width="1.2" stroke-dasharray="2 1.5"/>`); }
  c.dimH(-fw, fw, d, `brim ${cmTxt(s.circ)} round`, 18 + Math.max(flaps * 1.7, peak) * c.k);
  c.dimV(Math.max(fw, bw), 0, d, `height ${cmTxt(d)}`, 20);
  c.callout(-fw * 0.4, yb * 0.6, stitchName(s.stitch), -1);
  c.callout(fw * 0.7, yb + brim / 2, { ribbed: 'ribbed brim', folded: 'folded brim', watchcap: 'watch-cap cuff', peaked: 'peaked brim' }[s.brimStyle], 1);
  if (s.bodyCirc > s.circ * 1.05) c.text(W / 2, c.H - 12, `body ${cmTxt(s.bodyCirc)} round`, { px: true, size: 10, color: TD.dim, weight: 600 });
  return [c.svg(W, H, 'Front')];
}

// ---------- socks, warmers, scarves ----------
function socksViews(s) {
  const W = 380, H = 360;
  const c = new TechCanvas(TD_STITCH[s.stitch] || 'stocking');
  const tw = s.top / 4, aw = s.ankle / 4, fl = s.footLen, leg = s.leg, fh = Math.max(s.foot / 3.2, aw * 1.3);
  c.fit(-tw - 0.5, -0.6, fl + 0.5, leg + fh * 1.05 + 1, W, H, 62);
  c.shape([['M', -tw, 0], ['L', tw, 0], ['L', aw, leg], ['Q', aw * 1.1, leg + fh * 0.4, aw * 2, leg + fh * 0.45], ['L', fl - fh * 1.2, leg + fh * 0.45], ['Q', fl - fh * 0.3, leg + fh * 0.45, fl - fh * 0.3, leg + fh * 0.75], ['Q', fl - fh * 0.3, leg + fh * 1.05, fl - fh * 1.2, leg + fh * 1.05], ['L', -aw * 0.4, leg + fh * 1.05], ['Q', -aw * 1.4, leg + fh * 1.05, -aw, leg], ['Z']]);
  const cuff = Math.min(s.cuff, leg * 0.6);
  c.band(c.poly([[-tw, 0], [tw, 0], [tw - (tw - aw) * cuff / leg, cuff], [-tw + (tw - aw) * cuff / leg, cuff]]));
  c.line([['M', -aw, leg - fh * 0.1], ['Q', aw * 0.2, leg + fh * 0.6, -aw * 0.3, leg + fh * 1.05]]);
  c.line([['M', fl - fh * 1.25, leg + fh * 0.45], ['Q', fl - fh * 1.0, leg + fh * 0.75, fl - fh * 1.25, leg + fh * 1.05]]);
  c.dimH(-tw, tw, 0, `top ${cmTxt(s.top)} round`, -14);
  c.dimV(tw, 0, leg, `leg ${cmTxt(leg)}`, 20);
  c.dimH(-aw * 1.2, fl - fh * 0.3, leg + fh * 1.05, `foot ${cmTxt(fl)}`, 18);
  c.callout(-aw * 0.2, leg + fh * 0.5, 'short-row heel', -1, 14);
  c.callout(fl - fh * 0.8, leg + fh * 0.6, 'short-row toe', 1, -26);
  c.callout(0, leg * 0.55, stitchName(s.stitch), -1);
  return [c.svg(W, H, 'Side view')];
}
function warmerViews(s) {
  const W = 340, H = 380;
  const c = new TechCanvas(TD_STITCH[s.stitch] || 'stocking');
  const tw = s.top / 4, bw = s.bottom / 4, L = s.length, cf = Math.min(s.cuff, L * 0.3);
  c.fit(-Math.max(tw, bw) - 0.5, -0.6, Math.max(tw, bw) + 0.5, L + 0.8, W, H, 62);
  c.shape(c.poly([[-tw, 0], [tw, 0], [bw, L], [-bw, L]]));
  c.band(c.poly([[-tw, 0], [tw, 0], [lerp(tw, bw, cf / L), cf], [-lerp(tw, bw, cf / L), cf]]));
  c.band(c.poly([[-lerp(tw, bw, 1 - cf / L), L - cf], [lerp(tw, bw, 1 - cf / L), L - cf], [bw, L], [-bw, L]]));
  c.dimH(-tw, tw, 0, `${cmTxt(s.top)} round`, -14);
  c.dimH(-bw, bw, L, `${cmTxt(s.bottom)} round`, 18);
  c.dimV(Math.max(tw, bw), 0, L, `length ${cmTxt(L)}`, 20);
  c.callout(-Math.min(tw, bw) * 0.4, L * 0.5, stitchName(s.stitch), -1);
  return [c.svg(W, H, s.isLeg ? 'Leg warmer (make 2)' : 'Arm warmer (make 2)')];
}
function scarfViews(s) {
  const W = 380, H = 300;
  const c = new TechCanvas(TD_STITCH[s.stitch] || 'stocking');
  if (s.style === 'scarf') {
    const L = s.length, w = s.width, r = Math.min(s.rib, L * 0.2);
    c.fit(-L / 2 - 0.5, -w / 2 - 1, L / 2 + 0.5, w / 2 + 1.5, W, H, 40);
    c.shape(c.poly([[-L / 2, -w / 2], [L / 2, -w / 2], [L / 2, w / 2], [-L / 2, w / 2]]));
    for (const sg of [-1, 1]) c.band(c.poly([[sg * L / 2, -w / 2], [sg * (L / 2 - r), -w / 2], [sg * (L / 2 - r), w / 2], [sg * L / 2, w / 2]]));
    c.dimH(-L / 2, L / 2, w / 2, `length ${cmTxt(L)}`, 18);
    c.dimV(L / 2, -w / 2, w / 2, cmTxt(w), 16);
    c.text(0, -w / 2 - 0.4, stitchName(s.stitch), { size: 10, color: TD.soft, italic: true });
    return [c.svg(W, H, 'Scarf, laid flat')];
  }
  const circ = s.width, D = s.length, fw = circ / 2;
  c.fit(-fw / 2 - 0.5, -0.8, fw / 2 + 0.5, D + 1, W, H, 62);
  c.shape([['M', -fw / 2, 0], ['Q', 0, -fw * 0.12, fw / 2, 0], ['L', fw / 2, D], ['Q', 0, D + fw * 0.12, -fw / 2, D], ['Z']]);
  c.line([['M', -fw / 2, 0], ['Q', 0, fw * 0.12, fw / 2, 0]]);
  c.dimH(-fw / 2, fw / 2, D, `${cmTxt(circ)} round`, 22);
  c.dimV(fw / 2, 0, D, `depth ${cmTxt(D)}`, 18);
  c.callout(-fw * 0.2, D * 0.5, stitchName(s.stitch), -1);
  return [c.svg(W, H, s.style === 'snood' ? 'Snood' : 'Cowl')];
}

// ---------- ponchos ----------
function ponchoViews(s) {
  const W = 360, H = 380;
  const c = new TechCanvas(TD_STITCH[s.stitch] || 'stocking');
  const nw = s.neck / Math.PI / 2 * 1.1, L = s.length, hemW = Math.max(nw * 1.5, Math.min(s.hem / 4, L * 1.6 + nw));
  const hood = s.hood ? Math.max(L * 0.9, nw * 3) : 0;
  c.fit(-hemW - 0.6, -hood - 0.8, hemW + 0.6, L + (s.style === 'flared' ? L * 0.2 : 0) + 1.2, W, H, 62);
  if (s.hood) c.shape([['M', -nw * 1.1, 0.1], ['C', -nw * 2.4, -hood * 0.4, -nw * 1.7, -hood, 0, -hood], ['C', nw * 1.7, -hood, nw * 2.4, -hood * 0.4, nw * 1.1, 0.1], ['Z']]);
  if (s.hood) c.shape([['M', -nw * 0.8, 0], ['C', -nw * 1.8, -hood * 0.35, -nw * 1.2, -hood * 0.85, 0, -hood * 0.86], ['C', nw * 1.2, -hood * 0.85, nw * 1.8, -hood * 0.35, nw * 0.8, 0], ['Z']], { texture: null, fill: '#fff', width: 1.1 });
  const r = Math.min(s.rib, L * 0.2);
  if (s.style === 'flared') {
    c.shape([['M', -nw, 0], ['Q', -hemW * 0.75, L * 0.25, -hemW, L], ['Q', 0, L * 1.18, hemW, L], ['Q', hemW * 0.75, L * 0.25, nw, 0], ['Q', 0, L * 0.12, -nw, 0], ['Z']]);
    c.out.push(`<path d="${c.d([['M', -hemW, L], ['Q', 0, L * 1.18, hemW, L]])}" fill="none" stroke="#C9B994" stroke-width="${Math.max(3, r * c.k).toFixed(1)}"/>`);
  } else {
    c.shape([['M', -nw, 0], ['L', -hemW, L * 0.55], ['L', -hemW, L], ['L', hemW, L], ['L', hemW, L * 0.55], ['L', nw, 0], ['Q', 0, L * 0.12, -nw, 0], ['Z']]);
    c.band(c.poly([[-hemW, L - r], [hemW, L - r], [hemW, L], [-hemW, L]]));
  }
  if (s.style === 'splitfront') c.ink([['M', 0, L * 0.06], ['L', 0, L]], 1.4);
  if (!s.hood) c.out.push(`<path d="${c.d([['M', nw, 0], ['Q', 0, L * 0.12, -nw, 0]])}" fill="none" stroke="#C9B994" stroke-width="3.5"/>`);
  c.dimH(-hemW, hemW, L, `hem ${cmTxt(s.hem)} round`, s.style === 'flared' ? 18 + L * 0.1 * c.k : 18);
  c.dimV(hemW, 0, L, `length ${cmTxt(L)}`, 20);
  c.text(0, -0.5 - hood, `neck ${cmTxt(s.neck)}`, { size: 10, color: TD.dim, weight: 600 });
  c.callout(-hemW * 0.5, L * 0.6, stitchName(s.stitch), -1);
  const name = { straight: 'straight poncho', flared: 'flared, worked top-down', hooded: 'hooded poncho', splitfront: 'open-front cape', capelet: 'capelet' }[s.style];
  c.text(W / 2, c.H - 12, name, { px: true, size: 10, color: TD.soft, italic: true });
  return [c.svg(W, H, 'Front')];
}

// ---------- bras ----------
function braViews(s) {
  const W = 360, H = 320;
  const c = new TechCanvas(TD_STITCH[s.stitch] || 'stocking');
  const bandW = s.band / 4, bh = s.bandH + (s.longline || 0);
  const bandeau = s.style === 'bandeau';
  const cupW = Math.min(s.cupW, bandW * 0.95), cupH = bandeau ? 0 : s.cupH;
  const strapH = bandeau || s.strap === 'strapless' ? 0 : cupH * 0.8;
  c.fit(-bandW - 1.4, -cupH - strapH - (bandeau ? s.bandH * 1.3 : 0) - 0.5, bandW + 1.4, bh + 1.4, W, H, 62);
  if (bandeau) {
    c.shape(c.poly([[-bandW, -s.bandH * 1.2], [bandW, -s.bandH * 1.2], [bandW, bh], [-bandW, bh]]), { texture: 'rib', fill: TD.band });
    for (const f of [-0.3, 0, 0.3]) c.line([['M', f * bandW, -s.bandH * 1.2], ['Q', f * bandW * 0.8, bh * 0.4, f * bandW * 0.9, bh]], { dash: false, color: TD.tex });
  } else {
    for (const sg of [-1, 1]) {
      const cx = sg * (cupW / 2 + 0.15);
      if (s.style === 'balconette') c.shape([['M', cx - cupW / 2, 0], ['Q', cx - cupW / 2, -cupH * 0.9, cx, -cupH], ['Q', cx + cupW / 2, -cupH * 0.9, cx + cupW / 2, 0], ['Z']]);
      else c.shape([['M', cx - cupW / 2, 0], ['L', cx + cupW / 2, 0], ['Q', cx + cupW * 0.25, -cupH * 0.5, cx, -cupH], ['Q', cx - cupW * 0.25, -cupH * 0.5, cx - cupW / 2, 0], ['Z']]);
      if (s.cup === 'darted') c.line([['M', cx, 0], ['L', cx, -cupH * 0.5]]);
      if (s.cup === 'gathered') for (const f of [-0.25, 0, 0.25]) c.line([['M', cx + f * cupW, -0.1], ['L', cx + f * cupW * 0.6, -cupH * 0.45]], { dash: false, color: TD.tex });
      const tip = [cx, -cupH], top = -cupH - strapH;
      if (s.strap === 'halter') c.ink([['M', ...tip], ['L', 0, top]], 1.6);
      else if (s.strap === 'wide') c.band(c.poly([[tip[0] - 0.35, tip[1]], [tip[0] + 0.35, tip[1]], [tip[0] + sg * 0.3 + 0.35, top], [tip[0] + sg * 0.3 - 0.35, top]]));
      else if (s.strap === 'offshoulder') c.ink([['M', ...tip], ['Q', sg * bandW * 0.9, -cupH * 0.6, sg * bandW * 1.1, -cupH * 0.2]], 1.6);
      else if (s.strap !== 'strapless') c.ink([['M', ...tip], ['L', tip[0] + sg * 0.25, top]], 1.4);
    }
    c.band(c.poly([[-bandW, 0], [bandW, 0], [bandW, bh], [-bandW, bh]]));
    if (s.longline) c.line([['M', -bandW, s.bandH], ['L', bandW, s.bandH]]);
  }
  if (s.closure === 'tieback') for (const sg of [-1, 1]) c.ink([['M', sg * bandW, bh / 2], ['Q', sg * (bandW + 1.2), bh * 1.5, sg * (bandW + 0.9), bh * 2.2]], 1.1);
  c.dimH(-bandW, bandW, bh, `band ${cmTxt(s.band)} round`, 18);
  if (!bandeau) c.dimV(bandW, -cupH, 0, `cup ${cmTxt(cupH)}`, 18);
  c.callout(-bandW * 0.6, bh / 2, s.closure === 'hookeye' ? 'hook & eye at back' : stitchName(s.stitch), -1, 10);
  return [c.svg(W, H, 'Front')];
}

// Returns HTML for the drawing (one or more SVG views side by side), or '' if there is nothing to draw.
function techDrawingSvg(spec) {
  if (!spec) return '';
  const fn = { top: topViews, bodysuit: bodysuitViews, jumpsuit: jumpsuitViews, pants: pantsViews, skirt: skirtViews, hat: hatViews, socks: socksViews, warmer: warmerViews, scarf: scarfViews, poncho: ponchoViews, bra: braViews }[spec.kind];
  const views = fn ? fn(spec) : [];
  return views.length ? `<div class="td-views">${views.join('')}</div>` : '';
}
