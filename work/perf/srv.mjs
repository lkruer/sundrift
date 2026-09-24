// Static server for A/B perf runs: several game folders side by side.
//   /<name>/...       -> that folder
//   /<name>-city/...  -> the same folder, index.html with localStorage minidrift.map = city set first
// CLI: node srv.mjs <port> name=dir [name=dir ...]
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };

export function startServer(mounts, port = 0) {
  const server = createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    const m = rel.match(/^\/([^/]+)(\/.*)?$/);
    if (!m) { res.writeHead(404); return res.end(); }
    let name = m[1], city = false;
    if (name.endsWith('-city')) { name = name.slice(0, -5); city = true; }
    const root = mounts[name];
    if (!root) { res.writeHead(404); return res.end(); }
    let sub = m[2] || '/';
    if (!m[2]) { res.writeHead(302, { Location: rel + '/' }); return res.end(); }
    if (sub.endsWith('/')) sub += 'index.html';
    const file = path.join(root, sub);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    const type = MIME[path.extname(file)] || 'application/octet-stream';
    if (city && sub === '/index.html') {
      let html = fs.readFileSync(file, 'utf8');
      html = html.replace('<head>', "<head><script>try{localStorage.setItem('minidrift.map','city')}catch(e){}</script>");
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      return res.end(html);
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

if (process.argv[1] && process.argv[1].endsWith('srv.mjs')) {
  const port = Number(process.argv[2]);
  const mounts = {};
  for (const a of process.argv.slice(3)) { const [k, v] = a.split('='); mounts[k] = path.resolve(v); }
  const s = await startServer(mounts, port);
  console.log('serving', JSON.stringify(mounts), 'on', s.address().port);
}
