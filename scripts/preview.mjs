import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const directory = process.argv[2];
const port = Number(process.argv[3] || 8926);
if (!directory || !Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Usage: npm run preview -- BUILD_DIRECTORY [PORT]');
const root = path.resolve(directory, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain' };
http.createServer(async (request, response) => {
  try {
    let name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (name.endsWith('/')) name += 'index.html';
    const target = path.resolve(root, '.' + name);
    if (!target.startsWith(root + path.sep)) throw Error('Outside preview');
    const bytes = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Comic Panels preview: http://127.0.0.1:${port}/guides/comic-panels/`));
