// Copies the fonts the app needs into www/vendor so the app runs fully offline
// (in the APK and as a PWA). Run after `npm install`.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const out = path.join(root, 'www', 'vendor');
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });

const copy = (from, to) => fs.copyFileSync(path.join(root, 'node_modules', from), path.join(out, to));

const fonts = [
  ['@fontsource/fraunces/files/fraunces-latin-400-normal.woff2', 'fraunces-400.woff2'],
  ['@fontsource/fraunces/files/fraunces-latin-600-normal.woff2', 'fraunces-600.woff2'],
  ['@fontsource/fraunces/files/fraunces-latin-700-normal.woff2', 'fraunces-700.woff2'],
  ['@fontsource/inter/files/inter-latin-400-normal.woff2', 'inter-400.woff2'],
  ['@fontsource/inter/files/inter-latin-600-normal.woff2', 'inter-600.woff2'],
  ['@fontsource/inter/files/inter-latin-700-normal.woff2', 'inter-700.woff2'],
  ['@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', 'jetbrains-mono-400.woff2'],
  ['@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2', 'jetbrains-mono-600.woff2'],
];
for (const [from, to] of fonts) copy(from, 'fonts/' + to);
console.log('vendor files copied to www/vendor');
