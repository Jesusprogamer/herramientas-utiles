/**
 * Servidor estatico minimo, sin dependencias, solo para probar en local:
 *   node scripts/serve.js            -> http://localhost:4173
 *   node scripts/serve.js 5000       -> otro puerto
 * No hace falta para publicar: GitHub Pages sirve los archivos tal cual.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = Number(process.argv[2]) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, url);
  if (url.endsWith('/')) filePath = path.join(filePath, 'index.html');

  // No se sale nunca de la carpeta del proyecto.
  if (!filePath.startsWith(ROOT)) { res.writeHead(403).end('403'); return; }

  fs.stat(filePath, (err, stat) => {
    if (err || stat.isDirectory()) {
      const notFound = path.join(ROOT, '404.html');
      fs.readFile(notFound, (e2, body) => {
        res.writeHead(404, { 'content-type': TYPES['.html'] });
        res.end(e2 ? '404' : body);
      });
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'service-worker-allowed': '/'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}).listen(PORT, () => {
  console.log(`A mano -> http://localhost:${PORT}`);
});
