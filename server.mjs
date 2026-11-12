// Проток server: serves the dashboard and the shared engine modules. The
// engine is plain ES modules that run the same in the browser and in node tests.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, normalize, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8820)
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' }

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x')
    let path = decodeURIComponent(url.pathname)
    let base = join(ROOT, 'public')
    if (path.startsWith('/engine/')) { base = join(ROOT, 'engine'); path = path.slice('/engine'.length) }
    if (path === '/') path = '/index.html'
    const file = normalize(join(base, path))
    if (!file.startsWith(base)) { res.writeHead(403); return res.end() }
    const data = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    res.end(data)
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' })
    res.end(e.code === 'ENOENT' ? 'not found' : String(e.message || e))
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Проток on http://127.0.0.1:${PORT}`))
