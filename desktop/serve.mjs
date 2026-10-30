// Serves Doll Knit Pattern Studio on this computer at http://localhost:5196 (started by "Doll Knit Pattern Studio.vbs").
// Files come straight from the repo's www/ folder, the same files the Android build packs into the APK.
// Keep the port: the app's data (and its sync settings) belong to this exact address in the browser.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', "www");
const PORT = 5196;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});
// already running (app opened twice): nothing to do
server.on('error', (e) => process.exit(e.code === 'EADDRINUSE' ? 0 : 1));
server.listen(PORT, '127.0.0.1', () => console.log(`Doll Knit Pattern Studio running at http://localhost:${PORT}`));
