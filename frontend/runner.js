import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import serverHandler from './dist/server/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, 'dist', 'client');

// High-performance mime-types mapping
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

http.createServer(async (req, res) => {
  try {
    // 0. Dedicated lightweight health check endpoint
    const safeUrl = new URL(req.url, 'http://localhost');
    if (safeUrl.pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({ status: 'ok', service: 'frontend' }));
      return;
    }

    // 1. Sanitize the path to prevent directory traversal
    const safePath = path.normalize(safeUrl.pathname).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(CLIENT_DIR, safePath);

    // 2. Check if request matches a static file in dist/client
    let stats;
    try {
      stats = await fs.promises.stat(filePath);
    } catch {}

    if (stats && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.statusCode = 200;
      
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      return;
    }

    // 3. Fallback to TanStack Start dynamic SSR Fetch Handler
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || `localhost:${PORT}`;
    const url = new URL(req.url, `${protocol}://${host}`);

    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      body = Buffer.concat(buffers);
    }

    const fetchHeaders = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => fetchHeaders.append(key, v));
        } else {
          fetchHeaders.set(key, value);
        }
      }
    }

    const fetchReq = new Request(url.toString(), {
      method: req.method,
      headers: fetchHeaders,
      body: body,
      duplex: 'half' // required by node for streaming requests
    });

    const fetchRes = await serverHandler.fetch(fetchReq);

    res.statusCode = fetchRes.status;
    res.statusMessage = fetchRes.statusText;

    fetchRes.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (fetchRes.body) {
      const reader = fetchRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    }
    res.end();
  } catch (err) {
    console.error('SSR server error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}).listen(PORT, () => {
  console.log(`React SSR Server listening on port ${PORT}`);
});
