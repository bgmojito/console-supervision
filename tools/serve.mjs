// Serveur statique de développement (les modules ES ne se chargent pas en file://).
// Usage : node tools/serve.mjs [port] [dossier]   (par défaut : 8000, src/)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = +(process.argv[2] || 8000);
const dir = path.resolve(ROOT, process.argv[3] || 'src');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

function start(p = port) {
  return new Promise(ok => {
    const server = http.createServer((req, res) => {
      let f = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!f.startsWith(dir)) { res.writeHead(403).end(); return; }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { res.writeHead(404).end('404'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    server.listen(p, '127.0.0.1', () => ok(server));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await start();
  console.log(`http://localhost:${port}/  (${path.relative(ROOT, dir) || '.'})`);
}

export { start };
