// Preview server for the built portable folder (dist/Protok). Only for development;
// the portable app itself needs no server.   node protok/desktop/serve.mjs  → http://127.0.0.1:8823
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, dirname, normalize, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'Protok')
const TYPES = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' }
createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const file = normalize(join(dir, p === '/' ? 'Protok.html' : p))
  if (!file.startsWith(dir)) { res.writeHead(403); return res.end() }
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body) } catch { res.writeHead(404); res.end('not found') }
}).listen(8823, '127.0.0.1', () => console.log('Protok portable preview on http://127.0.0.1:8823'))
