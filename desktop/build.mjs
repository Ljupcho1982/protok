// Builds the portable desktop edition: one self-contained HTML file plus a tiny Windows launcher.
//   node protok/desktop/build.mjs
// Output: protok/dist/Protok/ (copy that folder to a USB stick; nothing to install).
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const out = join(root, 'dist', 'Protok')
const src = f => readFileSync(join(here, 'src', f), 'utf8')

// 1. Engine: the ES modules in dependency order, with import lines and export keywords removed.
const ORDER = ['rng', 'day', 'queue', 'gate', 'montecarlo', 'logistics', 'os']
const seen = new Map()
let engine = '"use strict";\n'
for (const m of ORDER) {
  const code = readFileSync(join(root, 'engine', m + '.mjs'), 'utf8')
  for (const [, name] of code.matchAll(/^(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (seen.has(name)) throw new Error(`top-level name ${name} is declared in both ${seen.get(name)} and ${m}`)
    seen.set(name, m)
  }
  engine += `// ---- engine/${m}.mjs\n` + code.replace(/^import .*$/gm, '').replace(/^export (?=const|let|function|class)/gm, '') + '\n'
}
if (/\bimport\s*\(|^\s*export\b/m.test(engine)) throw new Error('engine still has import/export after stripping')
new Function(engine) // parse check

// 2. three.js (MIT) as a plain script: the ES module's final export list becomes window.THREE.
const threeSrc = readFileSync(join(here, 'vendor', 'three.module.min.js'), 'utf8')
const exp = threeSrc.match(/export\s*\{([^}]*)\}\s*;?\s*$/)
if (!exp) throw new Error('three.js export list not found')
const map = exp[1].split(',').map(s => s.trim()).filter(Boolean).map(s => { const [a, b] = s.split(/\s+as\s+/); return `${b || a}:${a}` }).join(',')
const three = '/* three.js r169 · MIT License · Copyright 2010-2024 three.js authors */\n(function(){' + threeSrc.slice(0, exp.index) + `;window.THREE={${map}}})();`
if (/^\s*(import|export)\b/m.test(three.replace(/\/\*[\s\S]*?\*\//g, ''))) throw new Error('three.js still has import/export')
new Function(three)

// 3. Inline everything into one HTML file.
const guard = s => s.replace(/<\/script/gi, '<\\/script')
const html = src('index.html')
  .replace('/*CSS*/', () => src('app.css'))
  .replace('/*THREE*/', () => guard(three))
  .replace('/*SCENE*/', () => guard(src('scene.js')))
  .replace('/*ENGINE*/', () => guard(engine))
  .replace('/*WORKER*/', () => guard(src('worker.js')))
  .replace('/*APP*/', () => guard(src('app.js')))

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'Protok.html'), html)
writeFileSync(join(out, 'README.txt'), readFileSync(join(here, 'README.txt'), 'utf8').replace(/\r?\n/g, '\r\n'))
writeFileSync(join(out, 'THREE-LICENSE.txt'), readFileSync(join(here, 'vendor', 'LICENSE'), 'utf8').replace(/\r?\n/g, '\r\n'))

// 4. Windows launcher, compiled with the C# compiler that ships with every Windows 10/11 (.NET Framework 4).
const csc = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'
if (process.platform === 'win32' && existsSync(csc)) {
  const ico = join(here, 'launcher', 'protok.ico')
  const args = ['/nologo', '/target:winexe', '/optimize+', '/platform:anycpu', `/out:${join(out, 'Protok.exe')}`]
  if (existsSync(ico)) args.push(`/win32icon:${ico}`)
  args.push(join(here, 'launcher', 'Launcher.cs'))
  execFileSync(csc, args, { stdio: 'inherit' })
} else console.warn('csc.exe not found: skipping Protok.exe (Protok.html still works on its own)')

console.log(`built ${out}\n  Protok.html ${(html.length / 1024).toFixed(0)} KB`)
