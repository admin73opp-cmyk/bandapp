// Tiny static server with SPA fallback, mirroring Vercel's rewrite of any
// non-/api, extensionless path to index.html. Used only for local preview.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 4317;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, urlPath);
  if (urlPath === '/go') {
    filePath = path.join(ROOT, 'go.html');            // mirrors the vercel.json /go rewrite
  } else if (urlPath === '/' || !path.extname(filePath) || !fs.existsSync(filePath)) {
    filePath = path.join(ROOT, 'index.html'); // SPA fallback (covers /rsvp)
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Preview on http://localhost:${PORT}`));
