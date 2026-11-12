// Protok desktop edition. The engine is inlined above this script and runs in a worker built from a blob,
// so the whole app works from a single file opened straight from disk. This file only draws.
(() => {
'use strict'

// ---------------------------------------------------------------- text
const ZDESC = { A: 'Schengen · A1–A9', B: 'Schengen · B1–B8', C: 'Non-Schengen · C1–C4' }
const EV_SHORT = { gate: 'gate change', delay: 'delayed', swap: 'larger aircraft', add: 'new flight', cancel: 'cancelled' }
const RULE_TXT = { zones: 'Valid zones', notice: `At least ${NOTICE} min notice`, stay: `Stay ${MIN_STAY}–${MAX_STAY} min`, donorMin: 'Donor keeps its minimum', targetMax: 'Not above physical lanes', pool: 'Within staff on duty', pingpong: 'No back-and-forth', reserve: 'Reserve limit per day' }
const WHO = { feed: 'Feed', sim: 'Simulation', log: 'Logistics', gate: 'Gate', staff: 'Staff' }
const LEVEL_TXT = { ok: 'On target', limited: 'Tight', critical: 'Critical', over: 'Over target' }
const ACTION = {
  move: a => `Move 1 team (2 officers) from Zone ${a.from} to Zone ${a.to}`,
  reserve: a => `Call a reserve team to Zone ${a.to}`
}
const EV = {
  gate: (e, f) => `${e.flight} (${cityEn(f?.dest || '')}) moves to Zone ${e.zone}${f?.base ? ` from Zone ${f.base.zone}` : ''}.`,
  swap: e => `${e.flight}: larger aircraft, ${e.pax} passengers.`,
  add: e => `New flight ${e.flight.id} to ${cityEn(e.flight.dest)} at ${hhmm(e.flight.std)}, ${e.flight.pax} passengers, Zone ${e.flight.zone}.`,
  delay: e => `${e.flight} delayed, new departure ${hhmm(e.std)}.`,
  cancel: e => `${e.flight} cancelled.`,
  staff: e => `Zone ${e.zone}: one team absent ${hhmm(slotStart(e.from))}–${hhmm(slotStart(e.to))}.`
}
const MSG = {
  ask: x => `Forecast the next <b>${x.horizon} min</b> over ${x.runs} possible futures`,
  forecast: x => `${x.runs} futures, ~${x.pax} passengers in <b>${x.ms} ms</b>` + (x.hot.length ? `. Hotspots: ${x.hot.map(h => `<b>${h.zone} ${hhmm(slotStart(h.s))}</b> (P90 ${h.p90.toFixed(1)})`).join(', ')}` : '. No hotspots.'),
  correlate: x => `Zone ${x.zone} ${hhmm(slotStart(x.s))} is filled by ` + x.corr.flights.slice(0, 3).map(f => `<b>${f.id}</b> ${Math.round(f.share * 100)}%${f.events.length ? ' (' + f.events.map(e => EV_SHORT[e]).join(', ') + ')' : ''}`).join(', ') + (x.corr.staff ? ', team absent' : ''),
  whatif: x => `<b>${x.n}</b> what-ifs in ${x.ms} ms. ${x.rejected} stopped by the gate, ${x.unsafe} would break another zone`,
  hold: x => `Zone ${x.zone} ${hhmm(slotStart(x.s))}: no move worth it (${Math.round(x.gain)} min saved), holding`,
  pass: x => `<b>${x.id}</b> passed all ${x.checks} rules`,
  alert: x => `<b>${x.id}</b> sent to the teams`
}
const PARTY = { event: ['feed', 'log'], ask: ['log', 'sim'], forecast: ['sim', 'log'], correlate: ['log', 'log'], whatif: ['log', 'sim'], hold: ['log', 'log'], pass: ['gate', 'log'], alert: ['log', 'staff'] }

// ---------------------------------------------------------------- icons
const I = {
  play: '<svg viewBox="0 0 16 16"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16"><path d="M4 2.8h2.8v10.4H4zM9.2 2.8H12v10.4H9.2z" fill="currentColor"/></svg>',
  step: '<svg viewBox="0 0 16 16"><path d="M3 2.8v10.4L9.8 8zM11 2.8h2.2v10.4H11z" fill="currentColor"/></svg>',
  reset: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 6.5A5 5 0 1 1 3 9.5"/><path d="M2.6 2.8v3.9h3.9"/></svg>',
  sun: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 16 16"><path d="M13.2 10.4A6 6 0 0 1 5.6 2.8a6 6 0 1 0 7.6 7.6z" fill="currentColor"/></svg>',
  auto: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11A5.5 5.5 0 0 0 8 2.5z" fill="currentColor"/></svg>',
  delay: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="5.6"/><path d="M8 5v3.2l2 1.4"/></svg>',
  gate: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10M9 4.5L12.5 8 9 11.5"/></svg>',
  swap: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5c.6 0 1 .6 1 1.4v3.3l5 2.8v1.5l-5-1.4v2.7l1.5 1.1V14L8 13.3 5.5 14v-1.1L7 11.8V9.1L2 10.5V9l5-2.8V2.9c0-.8.4-1.4 1-1.4z"/></svg>',
  add: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
  cancel: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  staff: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="6.5" cy="5.5" r="2.4"/><path d="M2 13.5c.6-3 8.4-3 9 0M11 7h4"/></svg>',
  ok: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>',
  warn: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3.5v5.5M8 12.2v.1"/></svg>',
  bolt: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M9.2 1.5L3.5 9h4l-1 5.5L12.5 7h-4z"/></svg>',
  clock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="5.6"/><path d="M8 5v3.2l2 1.4"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  chart: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 17h14"/><path d="M6 14V9M10 14V5M14 14v-3"/></svg>',
  arrow: '<svg viewBox="0 0 24 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h19M16 1.5L21 6l-5 4.5"/></svg>'
}
const EV_LETTER = { delay: '!', gate: '→', swap: '+', add: '+', cancel: '×', staff: '−' }

// ---------------------------------------------------------------- state
const $ = s => document.querySelector(s)
const store = { get (k, d) { try { return localStorage.getItem('protok-en2.' + k) ?? d } catch { return d } }, set (k, v) { try { localStorage.setItem('protok-en2.' + k, v) } catch {} } }
const DEFAULTS = { seed: 1, schedSeed: 7, agent: true, runs: 100, horizon: 180, reserveLimit: 2, feed: true, flights: null, dataName: null }
let opts = { ...DEFAULTS }
try { Object.assign(opts, JSON.parse(store.get('opts', '{}'))) } catch {}
let draft = { ...opts }
let theme = store.get('theme', 'auto')
let view = 'guide' // every time the app opens it starts on the Guide tab
let ptab = store.get('ptab', 'scenario')
let zoneSel = store.get('zone', 'A')
let range = store.get('range', '6h')
let speed = Number(store.get('speed', 4))
let busFilter = 'all'
let benchDays = 10
let S = null
let playing = false
let jumping = null
let jumpFrom = 0
let busAll = []
let seenAlerts = new Set()
let firstState = true
const SPEEDS = [[1, 1300], [4, 330], [16, 0]]
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const f1 = x => (Math.round(x * 10) / 10).toFixed(1)
const sNowOf = now => Math.min(NSLOT - 1, Math.max(0, Math.floor((now - DAY_START) / SLOT)))
const fmt = n => Math.round(n).toLocaleString('en-US')
const levelOf = p90 => p90 > SLA ? 'over' : p90 > SLA * 0.8 ? 'critical' : p90 > SLA * DONOR_P90 ? 'limited' : 'ok'
const utilLevel = u => u > 1 ? 'over' : u > 0.85 ? 'critical' : u > 0.7 ? 'limited' : 'ok'

// ---------------------------------------------------------------- worker
let workerUrl = null
function makeWorker () {
  if (!workerUrl) {
    const src = $('#engine').textContent + '\n;\n' + $('#worker-src').textContent
    workerUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
  }
  return new Worker(workerUrl)
}
const worker = makeWorker()
worker.onmessage = (e) => {
  const m = e.data
  if (m.type !== 'state') return
  if (m.reset) { busAll = []; seenAlerts = new Set(); firstState = true }
  S = m.state
  busAll.push(...S.log)
  if (busAll.length > 800) busAll = busAll.slice(-800)
  if (m.partial) {
    $('#busyText').textContent = `Simulating to ${hhmm(m.target)} · ${hhmm(S.now)}`
    $('#busyBar').style.width = Math.max(0, Math.min(100, (S.now - jumpFrom) / Math.max(1, m.target - jumpFrom) * 100)) + '%'
    renderTimeline(); $('#clock').textContent = hhmm(S.now); return
  }
  const fresh = S.alerts.filter(a => !seenAlerts.has(a.id))
  fresh.forEach(a => seenAlerts.add(a.id))
  if (jumping != null || m.jumped) {
    jumping = null
    $('#busy').hidden = true
    sc?.setBusy(false)
    if (fresh.length > 1 && !firstState) toast(null, `${fresh.length} new staff notifications`)
    else if (fresh.length === 1 && !firstState) toast(fresh[0])
  } else if (!firstState) fresh.forEach(a => toast(a))
  firstState = false
  render()
  if (playing && !S.done) setTimeout(() => { if (playing && jumping == null) worker.postMessage({ type: 'tick' }) }, SPEEDS.find(s => s[0] === speed)?.[1] ?? 330)
  if (S.done && playing) { playing = false; renderControls() }
}
worker.onerror = (e) => { const el = $('#status'); el.className = 'banner error'; el.innerHTML = `<div class="ic">${I.warn}</div><div class="tx"><b>The simulation engine could not start.</b><span>${esc(e.message || 'Unknown error')}. Try opening Protok.html in Edge, Chrome or Firefox.</span></div>` }
function reset () { playing = false; jumping = null; worker.postMessage({ type: 'reset', opts }); renderControls() }
function jump (to, fresh = false) {
  if (!S) return
  to = Math.max(DAY_START, Math.min(DAY_END, Math.round((to - DAY_START) / SLOT) * SLOT + DAY_START))
  if (to === S.now && !fresh) return
  playing = false
  jumping = to
  jumpFrom = to < S.now || fresh ? DAY_START : S.now
  $('#busyText').textContent = `Simulating to ${hhmm(to)}…`
  $('#busyBar').style.width = '0%'
  if (Math.abs(to - jumpFrom) > SLOT * 3) { $('#busy').hidden = false; sc?.setBusy(true) }
  worker.postMessage({ type: 'jump', to, opts, fresh })
  renderControls()
}

// ---------------------------------------------------------------- 3D scene
const sc = window.ProtokScene ? window.ProtokScene($('#scene'), { onSelect: z => selectZone(z) }) : null
if (!sc) $('#sceneFallback').hidden = false

// ---------------------------------------------------------------- parameters
const PARAMS = {
  scenario: [
    { h: 'Simulated day', fields: [
      { k: 'seed', label: 'Passenger day', sub: 'who shows up, and when', type: 'num', min: 1, max: 9999, rand: true },
      { k: 'schedSeed', label: 'Flight schedule', sub: '55 departures in 6 banks', type: 'num', min: 1, max: 9999, rand: true },
      { k: 'feed', label: 'Scripted disruptions', sub: 'the demo live feed', type: 'bool' }
    ], note: 'The live feed (gate changes, delays, a new flight, a cancellation, an absent team) is picked from the schedule by rules, so it stays sensible for any schedule. To run your own schedule, open Your data.' },
    { h: 'Terminal', fields: [
      { label: 'Security zones', ro: 'A · B · C' },
      { label: 'Physical lanes', ro: `${ZONE_MAX.A} · ${ZONE_MAX.B} · ${ZONE_MAX.C}` },
      { label: 'Screening rate per lane', ro: LANE_RATE, unit: 'pax/h' },
      { label: 'Service time variation', ro: 'CV ' + SVC_CV },
      { label: 'Hidden daily speed spread', ro: '± ' + Math.round(RATE_SD * 100) + ' %' },
      { label: 'Boarding closes', ro: BOARD_CLOSE, unit: 'min before' }
    ] }
  ],
  agents: [
    { h: 'Simulation agent', fields: [
      { k: 'runs', label: 'Monte Carlo futures', sub: 'per 15-minute step', type: 'sel', options: [20, 50, 100, 200] },
      { k: 'horizon', label: 'Forecast horizon', type: 'sel', options: [60, 120, 180, 240], unit: 'min' }
    ], note: 'More futures give a steadier forecast and take longer. 100 futures run a whole day in roughly 15–25 seconds.' },
    { h: 'Logistics agent', fields: [
      { k: 'agent', label: 'Agent moves staff', sub: 'off = the roster only', type: 'bool' },
      { k: 'reserveLimit', label: 'Reserve teams per day', type: 'num', min: 0, max: 4 }
    ], note: 'With the agent off, the "with agent" and "roster only" numbers are the same day on the same roster.' }
  ],
  rules: [
    { h: 'Gate rules (checked in code)', fields: [
      { label: 'Notice before a move', ro: '≥ ' + NOTICE, unit: 'min' },
      { label: 'Team stays', ro: `${MIN_STAY}–${MAX_STAY}`, unit: 'min' },
      { label: 'No opposite move within', ro: PINGPONG, unit: 'min' },
      { label: 'Donor keeps at least', ro: '1', unit: 'lane' },
      { label: 'Target stays within', ro: 'physical lanes' },
      { label: 'Teams on duty', ro: 'fixed pool' }
    ] },
    { h: 'Decision thresholds', fields: [
      { label: 'Wait target (SLA)', ro: SLA, unit: 'min' },
      { label: 'Donor P90 must stay under', ro: f1(SLA * DONOR_P90), unit: 'min' },
      { label: 'Minimum gain of a move', ro: MIN_GAIN, unit: 'wait-min' },
      { label: 'Cost of a reserve team', ro: RESERVE_COST, unit: 'wait-min' },
      { label: 'Moves per step at most', ro: MAX_ACTIONS },
      { label: 'Weight of a minute over SLA', ro: '× ' + W_OVER },
      { label: 'Cost of a missed boarding', ro: W_MISS, unit: 'wait-min' }
    ] }
  ]
}
const dirty = () => Object.keys(DEFAULTS).some(k => draft[k] !== opts[k])
function renderParams () {
  document.querySelectorAll('#ptabs .tab').forEach(b => b.classList.toggle('active', b.dataset.p === ptab))
  const groups = PARAMS[ptab].map(g => ({ ...g, fields: g.fields.map(f => f.k === 'schedSeed' && draft.flights ? { label: 'Flight schedule', sub: `your data · ${draft.flights.length} flights`, custom: true, dirty: draft.flights !== opts.flights } : f) }))
  $('#params').innerHTML = groups.map(g => `<div class="input-group"><h3>${g.h}</h3>${g.fields.map(f => {
    const d = (f.k && draft[f.k] !== opts[f.k]) || f.dirty ? ' dirty' : ''
    let ctl
    if (f.custom) ctl = `<span class="badge-data">your data</span><button class="mini-btn${d}" data-builtin title="Go back to the built-in schedule">Built-in</button>`
    else if (f.ro != null) ctl = `<span class="ro">${f.ro}</span>`
    else if (f.type === 'num') ctl = `<input type="number" data-k="${f.k}" min="${f.min}" max="${f.max}" step="1" value="${draft[f.k]}" class="${d}">${f.rand ? `<button class="mini-btn" data-rand="${f.k}" title="Random">↻</button>` : ''}`
    else if (f.type === 'sel') ctl = `<select data-k="${f.k}" class="${d}">${f.options.map(o => `<option value="${o}"${o === draft[f.k] ? ' selected' : ''}>${o}</option>`).join('')}</select>`
    else if (f.type === 'bool') ctl = `<button class="switch${d}" role="switch" data-k="${f.k}" aria-checked="${draft[f.k]}" aria-label="${f.label}"></button>`
    return `<div class="field"><span class="field-label">${f.label}${f.sub ? `<small>${f.sub}</small>` : ''}</span><span class="field-control">${ctl}${f.unit ? `<span class="unit">${f.unit}</span>` : ''}</span></div>`
  }).join('')}${g.note ? `<p class="note">${g.note}</p>` : ''}</div>`).join('')
  $('#applyBar').hidden = !dirty()
}
function setDraft (k, v) {
  const f = Object.values(PARAMS).flat().flatMap(g => g.fields).find(x => x.k === k)
  if (f.type === 'num') { v = Math.round(Number(v)); if (!Number.isFinite(v)) v = opts[k]; v = Math.max(f.min, Math.min(f.max, v)) }
  if (f.type === 'sel') v = Number(v)
  draft[k] = v
  renderParams()
}
$('#ptabs').onclick = e => { const b = e.target.closest('.tab'); if (!b) return; ptab = b.dataset.p; store.set('ptab', ptab); renderParams() }
$('#params').addEventListener('change', e => { const el = e.target.closest('[data-k]'); if (el && el.tagName !== 'BUTTON') setDraft(el.dataset.k, el.value) })
$('#params').addEventListener('click', e => {
  const sw = e.target.closest('.switch'); if (sw) setDraft(sw.dataset.k, sw.getAttribute('aria-checked') !== 'true')
  const r = e.target.closest('[data-rand]'); if (r) setDraft(r.dataset.rand, 1 + Math.floor(Math.random() * 9999))
  if (e.target.closest('[data-builtin]')) { draft.flights = null; draft.dataName = null; renderParams() }
})
function applyParams () {
  opts = { ...draft }
  store.set('opts', JSON.stringify(opts))
  renderParams(); renderScenario(); renderHow()
  const at = S?.now ?? DAY_START
  if (at > DAY_START) jump(at, true); else reset()
}
$('#btnApply').onclick = applyParams
$('#btnDiscard').onclick = () => { draft = { ...opts }; renderParams() }
$('#btnDefaults').onclick = () => { draft = { ...DEFAULTS }; applyParams() }
function renderScenario () {
  const sched = opts.flights ? `${opts.dataName || 'your data'} (${opts.flights.length} flights)` : `schedule ${opts.schedSeed}`
  $('#scenarioName').textContent = `Day ${opts.seed} · ${sched} · ${opts.runs} futures${opts.agent ? '' : ' · agent off'}${opts.feed ? '' : ' · no feed'}`
}

// ---------------------------------------------------------------- controls
function isDark () { return theme === 'auto' ? matchMedia('(prefers-color-scheme: dark)').matches : theme === 'dark' }
let lastDark = null
function renderControls () {
  const play = $('#btnPlay')
  play.innerHTML = (playing ? I.pause : I.play) + `<span>${playing ? 'Pause' : 'Play'}</span>`
  play.disabled = !!S?.done
  const step = $('#btnStep'); step.innerHTML = I.step; step.title = 'Next 15 min (→)'; step.setAttribute('aria-label', 'Next 15 minutes'); step.disabled = !!S?.done
  const rs = $('#btnReset'); rs.innerHTML = I.reset; rs.title = 'Restart the day (R)'; rs.setAttribute('aria-label', 'Restart the day')
  $('#speed').innerHTML = SPEEDS.map(([s]) => `<button role="radio" aria-checked="${s === speed}" data-s="${s}" title="Speed ${s}×">${s}×</button>`).join('')
  $('#range').innerHTML = [['6h', '±3 h'], ['day', 'Whole day']].map(([k, l]) => `<button role="radio" aria-checked="${k === range}" data-r="${k}">${l}</button>`).join('')
  $('#benchDays').innerHTML = [5, 10, 20].map(d => `<button role="radio" aria-checked="${d === benchDays}" data-d="${d}">${d} days</button>`).join('')
  $('#theme').innerHTML = [['light', I.sun, 'Light'], ['auto', I.auto, 'System'], ['dark', I.moon, 'Dark']].map(([k, ic, l]) => `<button role="radio" aria-checked="${k === theme}" data-th="${k}" title="${l}" aria-label="${l} theme">${ic}</button>`).join('')
  document.querySelectorAll('.toptabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === view))
  for (const v of ['ops', 'data', 'bench', 'how', 'guide']) $('#view-' + v).hidden = v !== view
  const dark = isDark()
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  if (dark !== lastDark) { lastDark = dark; sc?.applyTheme(); if (S) renderDetail() }
  if (!bench.running) $('#btnBench').textContent = bench.rows.length ? 'Run again' : 'Run comparison'
}
$('#btnPlay').onclick = () => { if (!S || S.done || jumping != null) return; playing = !playing; renderControls(); if (playing) worker.postMessage({ type: 'tick' }) }
$('#btnStep').onclick = () => { if (jumping != null || S?.done) return; playing = false; renderControls(); worker.postMessage({ type: 'tick' }) }
$('#btnReset').onclick = reset
$('#theme').onclick = e => { const b = e.target.closest('button'); if (!b) return; theme = b.dataset.th; store.set('theme', theme); renderControls() }
$('#speed').onclick = e => { const b = e.target.closest('button'); if (!b) return; speed = Number(b.dataset.s); store.set('speed', speed); renderControls() }
$('#range').onclick = e => { const b = e.target.closest('button'); if (!b) return; range = b.dataset.r; store.set('range', range); renderControls(); renderDetail() }
$('#benchDays').onclick = e => { const b = e.target.closest('button'); if (!b || bench.running) return; benchDays = Number(b.dataset.d); renderControls() }
$('.toptabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; view = b.dataset.tab; store.set('view', view); renderControls(); window.scrollTo({ top: 0 }) }
$('#zoneTable').onclick = e => { const r = e.target.closest('[data-zone]'); if (r) selectZone(r.dataset.zone) }
$('#busFilter').onclick = e => { const b = e.target.closest('button'); if (!b) return; busFilter = b.dataset.f; renderBus() }
function selectZone (z) { zoneSel = z; store.set('zone', z); if (S) { renderZones(); renderDetail(); renderScene() } }
// the target can be the document itself (no closest()); use the element or the body instead
const targetEl = e => e.target instanceof Element ? e.target : document.body
document.addEventListener('keydown', e => {
  const t = targetEl(e)
  if (t.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return
  if (t.closest('#tlTrack')) return
  if (e.code === 'Space' && !t.closest('button')) { e.preventDefault(); $('#btnPlay').click() } else if (e.key === 'ArrowRight' && !t.closest('[role=radiogroup]')) $('#btnStep').click()
  else if (e.key === 'r' || e.key === 'R') reset()
  else if (['1', '2', '3'].includes(e.key)) selectZone(ZONES[Number(e.key) - 1])
})

// ---------------------------------------------------------------- timeline
const tlX = tm => (tm - DAY_START) / (DAY_END - DAY_START) * 100
function renderTimeline () {
  if (!S) return
  const tr = $('#tlTrack')
  let h = `<div class="tl-fill" style="width:${tlX(S.now)}%"></div>`
  for (let tm = 300; tm < DAY_END; tm += 60) h += `<div class="tl-hour" style="left:${tlX(tm)}%"><span>${hhmm(tm).slice(0, 2)}</span></div>`
  for (const e of S.events) h += `<div class="tl-pin ev" style="left:${tlX(e.t)}%" title="${hhmm(e.t)} ${esc(evText(e))}">${EV_LETTER[e.type]}</div>`
  for (const a of S.alerts) h += `<div class="tl-pin al${a.kind === 'reserve' ? ' res' : ''}" style="left:${tlX(a.t)}%" title="${a.id} ${hhmm(a.t)}"></div>`
  h += `<div class="tl-now" style="left:${tlX(S.now)}%"></div><div class="tl-ghost" id="tlGhost"></div>`
  tr.innerHTML = h
  tr.setAttribute('aria-valuenow', S.now)
  tr.setAttribute('aria-valuetext', hhmm(S.now))
}
const tlTime = e => { const r = $('#tlTrack').getBoundingClientRect(); return DAY_START + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (DAY_END - DAY_START) }
$('#tlTrack').addEventListener('pointermove', e => {
  const tm = Math.round((tlTime(e) - DAY_START) / SLOT) * SLOT + DAY_START
  const g = $('#tlGhost'); if (g) g.style.left = tlX(tm) + '%'
  showTip(e.clientX, e.clientY - 70, `<h4>Jump to ${hhmm(tm)}</h4>${S && tm < S.now ? '<span class="muted">Replays the day from 04:00</span>' : ''}`)
})
$('#tlTrack').addEventListener('pointerleave', hideTip)
$('#tlTrack').addEventListener('click', e => { hideTip(); jump(tlTime(e)) })
$('#tlTrack').addEventListener('keydown', e => {
  if (!S) return
  if (e.key === 'ArrowRight') { e.preventDefault(); $('#btnStep').click() } else if (e.key === 'ArrowLeft') { e.preventDefault(); jump(S.now - SLOT) } else if (e.key === 'PageUp') { e.preventDefault(); jump(S.now + 60) } else if (e.key === 'PageDown') { e.preventDefault(); jump(S.now - 60) } else if (e.key === 'Home') { e.preventDefault(); reset() } else if (e.key === 'End') { e.preventDefault(); jump(DAY_END) }
})

// ---------------------------------------------------------------- derived numbers
function p90Next (z) {
  const fc = S.fc?.[z]?.slots || []
  const next = fc.filter(f => slotStart(f.s) >= S.now && slotStart(f.s) < S.now + 60)
  return next.length ? Math.max(...next.map(f => f.p90)) : 0
}
function utilNext (z) {
  const fc = (S.fc?.[z]?.slots || []).filter(f => slotStart(f.s) >= S.now && slotStart(f.s) < S.now + 60)
  let arr = 0, cap = 0
  for (const f of fc) { arr += f.pax; cap += S.plan[z][f.s] * LANE_RATE / 4 }
  return { u: cap ? arr / cap : 0, arr, cap }
}
function firstBreach () {
  let best = null
  for (const z of ZONES) for (const f of S.fc?.[z]?.slots || []) if (f.p90 > SLA && (!best || f.s < best.s)) { best = { z, s: f.s, p90: f.p90 }; break }
  return best
}
function laneTiles (z, s) {
  const open = S.plan[z][s], base = S.base[z][s]
  let h = ''
  for (let i = 0; i < ZONE_MAX[z]; i++) h += `<i class="${i < Math.min(open, base) ? 'on' : i < open ? 'add' : i < base ? 'gone' : ''}"></i>`
  return `<span class="lanes-mini">${h}</span>`
}

// ---------------------------------------------------------------- render
function render () {
  if (!S) return
  $('#clock').textContent = hhmm(S.now)
  $('#clockSub').textContent = S.done ? 'end of day' : 'simulated time'
  renderTimeline(); renderStatus(); renderKpis(); renderZones(); renderScene(); renderDetail(); renderUtil(); renderAlerts(); renderBoard(); renderFeed(); renderBus()
  renderControls()
}

function renderScene () {
  if (!sc || !S) return
  const sNow = sNowOf(S.now)
  const zones = {}
  for (const z of ZONES) {
    const p90 = p90Next(z)
    zones[z] = { open: S.plan[z][sNow], base: S.base[z][sNow], max: ZONE_MAX[z], queue: S.truth[z].queueNow, wait: S.truth[z].waitingNow, p90, level: levelOf(p90) }
    sc.setLabel(z, `<span class="zl-h"><span class="zb" style="--zc:var(--z${z})">${z}</span>Zone ${z}<span class="pill lvl-${zones[z].level}">${LEVEL_TXT[zones[z].level]}</span></span><span class="zl-s">Queue <b>${zones[z].queue}</b> · wait <b>${f1(zones[z].wait)}</b> · P90 <b>${f1(p90)}</b> min</span>`, zones[z].level)
  }
  const moves = S.alerts.filter(a => a.t <= S.now && a.until > S.now).map(a => ({ from: a.kind === 'reserve' ? 'R' : a.from, to: a.to, active: a.effective <= S.now }))
  sc.update({ zones, sel: zoneSel, moves })
}

function renderStatus () {
  let cls = 'ok', icon = I.ok, msg, cta = ''
  const fresh = S.alerts.filter(a => a.t === S.now)
  const evNow = S.events.filter(e => e.t > S.now - SLOT && e.t <= S.now)
  const br = firstBreach()
  if (S.done) {
    msg = [`End of day. ${fmt(S.truth.total.over)} passengers waited over ${SLA} min; on the roster alone it would have been ${fmt(S.shadow.total.over)}.`, 'Click the timeline to go back to any moment, change a parameter, or restart the day.']
    cls = 'idle'; icon = I.clock; cta = `<button class="btn" id="ctaReset">${I.reset}<span>Restart</span></button>`
  } else if (S.now === DAY_START) {
    msg = ['The day starts at 04:00.', opts.feed ? 'The first feed change arrives at 06:15. Press Play, or click anywhere on the timeline to jump.' : 'No scripted disruptions today: only your schedule and the hidden passenger draw. Press Play, or click the timeline to jump.']
    cls = 'idle'; icon = I.clock; cta = `<button class="btn primary" id="ctaJump">${I.play}<span>Jump to 06:15</span></button>`
  } else if (fresh.length) {
    const a = fresh[fresh.length - 1]
    msg = [`The agent sent ${fresh.map(x => x.id).join(', ')}.`, `${ACTION[a.kind](a)}, ${hhmm(a.effective)}–${hhmm(a.until)}.`]; cls = 'act'; icon = I.bolt
  } else if (br && slotStart(br.s) < S.now + 120) {
    msg = [`Watch: Zone ${br.z} may break the target around ${hhmm(slotStart(br.s))}.`, `P90 ${f1(br.p90)} min. ${opts.agent ? 'The agent has no move worth making, or has already used them.' : 'The agent is switched off in Parameters.'}`]; cls = 'warn'; icon = I.warn
  } else if (evNow.length) {
    msg = [evText(evNow[evNow.length - 1]), 'The agents re-checked the forecast. No change needed.']
  } else msg = ['All zones are on target.', 'No hotspots in the next 3 hours.']
  const el = $('#status')
  el.className = 'banner ' + cls
  el.innerHTML = `<div class="ic">${icon}</div><div class="tx"><b>${esc(msg[0])}</b><span>${esc(msg[1])}</span></div>${cta}`
  const cj = $('#ctaJump'); if (cj) cj.onclick = () => jump(375)
  const cr = $('#ctaReset'); if (cr) cr.onclick = reset
  const worst = Math.max(...ZONES.map(p90Next)), lv = levelOf(worst)
  $('#hudStatus').innerHTML = `<span class="pill lvl-${lv}" style="box-shadow:var(--shadow)">${LEVEL_TXT[lv]} · worst P90 ${f1(worst)} min</span>`
}

function delta (a, b) {
  if (!b && !a) return '<span class="delta flat">±0</span>'
  if (!b) return '<span class="delta bad">new</span>'
  const p = Math.round((a - b) / b * 100)
  if (p === 0) return '<span class="delta flat">0%</span>'
  return `<span class="delta ${p < 0 ? 'good' : 'bad'}">${p > 0 ? '+' : '−'}${Math.abs(p)}%</span>`
}
const cmpLvl = (a, b) => a < b ? 'lvl-ok' : a > b ? 'lvl-over' : ''
function renderKpis () {
  const a = S.truth.total, b = S.shadow.total
  const q = ZONES.reduce((x, z) => x + S.truth[z].queueNow, 0)
  const qb = ZONES.reduce((x, z) => x + S.shadow[z].queueNow, 0)
  const k = (lbl, val, unit, sub, d, cls = '') => `<div class="kpi ${cls}"><div class="kpi-label"><span>${lbl}</span>${d ?? ''}</div><div class="kpi-value">${val}${unit ? `<span class="kpi-unit">${unit}</span>` : ''}</div><div class="kpi-sub">${sub}</div></div>`
  $('#kpis').innerHTML = [
    k('In queue now', fmt(q), 'pax', `roster only <b>${fmt(qb)}</b>`, delta(q, qb), cmpLvl(q, qb)),
    k('Average wait', f1(a.meanWait), 'min', `roster only <b>${f1(b.meanWait)}</b>`, delta(a.meanWait, b.meanWait), cmpLvl(a.meanWait, b.meanWait)),
    k(`Waited over ${SLA} min`, fmt(a.over), 'pax', `roster only <b>${fmt(b.over)}</b>`, delta(a.over, b.over), cmpLvl(a.over, b.over)),
    k('Boarding at risk', fmt(a.missed), 'pax', `roster only <b>${fmt(b.missed)}</b>`, delta(a.missed, b.missed), cmpLvl(a.missed, b.missed)),
    k('Notifications', S.alerts.length, '', `reserves used <b>${S.reserves.used}/${S.reserves.limit}</b>`, '', 'lvl-accent')
  ].join('')
}

function renderZones () {
  const sNow = sNowOf(S.now)
  const rows = ZONES.map(z => {
    const p90 = p90Next(z), lv = levelOf(p90), u = utilNext(z), r = S.truth[z]
    return `<tr class="click${z === zoneSel ? ' sel' : ''}" data-zone="${z}"><td><span class="zb" style="--zc:var(--z${z})">${z}</span> <b>Zone ${z}</b> <span class="dim">${ZDESC[z]}</span></td>
      <td>${laneTiles(z, sNow)}${S.plan[z][sNow]} / ${S.base[z][sNow]}</td>
      <td class="num">${r.queueNow}</td><td class="num">${f1(r.waitingNow)}</td><td class="num">${f1(p90)}</td><td class="num">${Math.round(u.u * 100)} %</td>
      <td><span class="pill lvl-${lv}">${LEVEL_TXT[lv]}</span></td></tr>`
  }).join('')
  $('#zoneTable').innerHTML = `<thead><tr><th>Zone</th><th>Lanes<small>open / roster</small></th><th class="num">In queue<small>pax</small></th><th class="num">Longest wait<small>min, now</small></th><th class="num">P90 wait<small>min, next hour</small></th><th class="num">Utilisation<small>next hour</small></th><th>Status</th></tr></thead><tbody>${rows}</tbody>`
}

function renderUtil () {
  const MAXU = 1.3
  $('#util').innerHTML = ZONES.map(z => {
    const u = utilNext(z), lv = utilLevel(u.u)
    return `<div class="bar-row" title="~${Math.round(u.arr)} arrivals, capacity ${Math.round(u.cap)}"><span class="bar-name"><span class="zb" style="--zc:var(--z${z})">${z}</span>Zone ${z}</span><span class="bar-track"><span class="bar-fill lvl-${lv}" style="width:${Math.min(100, u.u / MAXU * 100)}%"></span><span class="bar-mark" style="left:${100 / MAXU}%"></span></span><span class="bar-value">${Math.round(u.u * 100)} %</span></div>`
  }).join('') + '<p class="bars-note">The mark is 100 %: above it, more people arrive than the open lanes can screen.</p>'
}

// ---------------------------------------------------------------- detail chart
const CW = 920, CH1 = 210, CH2 = 56, CGAP = 24, PADL = 34, PADR = 10, CTOP = 12
let geo = null
function renderDetail () {
  if (!S) return
  const z = zoneSel
  $('#detailTitle').innerHTML = `<span class="zdot" style="background:var(--z${z})"></span>Zone ${z} · wait and lanes`
  const from = range === 'day' ? DAY_START : Math.max(DAY_START, Math.min(S.now - 180, DAY_END - 360))
  const to = range === 'day' ? DAY_END : Math.min(DAY_END, from + 360)
  const x = tm => PADL + (tm - from) / (to - from) * (CW - PADL - PADR)
  const s0 = Math.max(0, Math.floor((from - DAY_START) / SLOT)), s1 = Math.min(NSLOT, Math.ceil((to - DAY_START) / SLOT))
  const real = S.truth[z], sh = S.shadow[z]
  const fc = (S.fc?.[z]?.slots || []).filter(f => slotStart(f.s) >= from && slotStart(f.s) < to)
  let ymax = 15
  for (let s = s0; s < s1; s++) if (slotStart(s + 1) <= S.now) ymax = Math.max(ymax, real.slotMean[s] ?? 0, sh.slotMean[s] ?? 0)
  for (const f of fc) ymax = Math.max(ymax, f.p90)
  ymax = Math.min(70, Math.ceil(ymax * 1.12 / 5) * 5)
  const y = w => CTOP + (1 - Math.min(w, ymax) / ymax) * (CH1 - CTOP - 4)
  const mid = s => x(slotStart(s) + SLOT / 2)
  let g = `<defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--z${z})" stop-opacity=".28"/><stop offset="1" stop-color="var(--z${z})" stop-opacity="0"/></linearGradient></defs>`
  if (S.now < to) g += `<rect class="future-bg" x="${x(Math.max(from, S.now))}" y="${CTOP}" width="${x(to) - x(Math.max(from, S.now))}" height="${CH1 - CTOP}"/>`
  const stepY = ymax > 40 ? 10 : 5
  for (let v = 0; v <= ymax; v += stepY) g += `<line class="grid" x1="${PADL}" x2="${CW - PADR}" y1="${y(v)}" y2="${y(v)}"/><text x="${PADL - 6}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`
  const hstep = range === 'day' ? 120 : 60
  for (let tm = Math.ceil(from / hstep) * hstep; tm <= to; tm += hstep) g += `<text x="${x(tm)}" y="${CH1 + CGAP + CH2 + 16}" text-anchor="middle">${hhmm(tm)}</text>`
  for (const e of S.events) {
    const fl = typeof e.flight === 'string' ? S.flights.find(f => f.id === e.flight) : e.flight
    const touches = e.type === 'staff' ? e.zone === z : e.type === 'gate' ? (e.zone === z || fl?.base?.zone === z) : fl?.zone === z
    if (!touches || e.t < from || e.t > to) continue
    g += `<line class="ev" x1="${x(e.t)}" x2="${x(e.t)}" y1="${CTOP}" y2="${CH1}"/><text class="ev-l" x="${x(e.t) + 4}" y="${CTOP + 10}">${EV_LETTER[e.type]} ${typeof e.flight === 'string' ? e.flight : e.flight?.id || 'staff'}</text>`
  }
  g += `<line class="sla" x1="${PADL}" x2="${CW - PADR}" y1="${y(SLA)}" y2="${y(SLA)}"/><text class="sla-l" x="${CW - PADR - 2}" y="${y(SLA) - 5}" text-anchor="end">${SLA} min target</text>`
  if (fc.length) {
    g += `<path class="band" d="M${fc.map(f => `${mid(f.s)},${y(f.p90)}`).join('L')}L${fc.slice().reverse().map(f => `${mid(f.s)},${y(f.p10)}`).join('L')}Z"/>`
    g += `<path class="p50" d="M${fc.map(f => `${mid(f.s)},${y(f.p50)}`).join('L')}"/>`
  }
  const pts = arr => { const p = []; for (let s = s0; s < s1; s++) if (slotStart(s + 1) <= S.now && arr[s] != null) p.push([mid(s), y(arr[s])]); return p }
  const sp = pts(sh.slotMean), rp = pts(real.slotMean)
  if (sp.length) g += `<path class="shadow" d="M${sp.map(p => p.join(',')).join('L')}"/>`
  if (rp.length) g += `<path fill="url(#rg)" d="M${rp[0][0]},${y(0)}L${rp.map(p => p.join(',')).join('L')}L${rp[rp.length - 1][0]},${y(0)}Z"/><path class="real" d="M${rp.map(p => p.join(',')).join('L')}"/>`
  const ly = CH1 + CGAP, lh = v => v / 7 * CH2
  let roster = ''
  for (let s = s0; s < s1; s++) {
    const xa = x(Math.max(from, slotStart(s))), xb = x(Math.min(to, slotStart(s + 1)))
    const v = S.plan[z][s], b = S.base[z][s], w = Math.max(0, xb - xa - 1), fut = slotStart(s) >= S.now ? ' future' : ''
    g += `<rect class="lane${fut}" x="${xa}" y="${ly + CH2 - lh(Math.min(v, b))}" width="${w}" height="${lh(Math.min(v, b))}" rx="1.5"/>`
    if (v > b) g += `<rect class="lane extra" x="${xa}" y="${ly + CH2 - lh(v)}" width="${w}" height="${lh(v - b)}" rx="1.5"/>`
    roster += (s === s0 ? 'M' : 'L') + `${xa},${ly + CH2 - lh(b)}L${xb},${ly + CH2 - lh(b)}`
  }
  g += `<path class="roster" d="${roster}"/><line class="axis" x1="${PADL}" x2="${CW - PADR}" y1="${ly + CH2}" y2="${ly + CH2}"/><text x="${PADL - 6}" y="${ly + 8}" text-anchor="end">7</text><text x="${PADL - 6}" y="${ly + CH2}" text-anchor="end">0</text><text x="${CW - PADR}" y="${ly - 6}" text-anchor="end">lanes</text>`
  for (const a of S.alerts) {
    if ((a.to !== z && a.from !== z) || a.effective < from || a.effective > to) continue
    const cls = a.from === z ? 'mk out' : a.kind === 'reserve' ? 'mk res' : 'mk in'
    g += `<circle class="${cls}" cx="${x(a.effective)}" cy="${ly - 10}" r="6" data-alert="${a.id}" tabindex="0" role="button" aria-label="${a.id}"/>`
  }
  if (S.now >= from && S.now <= to) g += `<line class="now" x1="${x(S.now)}" x2="${x(S.now)}" y1="${CTOP - 2}" y2="${ly + CH2}"/><rect class="now-bg" x="${x(S.now) - 20}" y="${CTOP - 16}" width="40" height="14" rx="4"/><text class="now-l" x="${x(S.now)}" y="${CTOP - 5.5}" text-anchor="middle">${hhmm(S.now)}</text>`
  g += `<line class="cross" id="cross" x1="0" x2="0" y1="${CTOP}" y2="${ly + CH2}"/><rect class="hit" x="${PADL}" y="${CTOP}" width="${CW - PADL - PADR}" height="${ly + CH2 - CTOP}"/>`
  const H = CH1 + CGAP + CH2 + 22
  $('#detail').innerHTML = `<svg class="chart" id="chart" viewBox="0 -8 ${CW} ${H + 8}" style="--zc:var(--z${z})" role="img" aria-label="Zone ${z} wait and lanes">${g}</svg>`
  geo = { from, to, x, z }
  $('#legend').innerHTML = `<span><i style="border-color:var(--z${z})"></i>real wait</span><span><i style="border-color:var(--ink-dim);border-top-style:dotted"></i>same day, roster only</span><span><i class="box" style="background:var(--band)"></i>forecast P10–P90</span><span><i style="border-color:var(--accent);border-top-style:dashed"></i>P50</span><span><i style="border-color:var(--over);border-top-style:dashed"></i>${SLA} min target</span><span><i class="box" style="background:var(--accent2)"></i>team added by the agent</span><span><i style="border-color:var(--ink-soft);border-top-style:dashed"></i>roster</span>`
}
$('#detail').addEventListener('pointermove', e => {
  if (!geo || !S) return
  const svg = $('#chart'); if (!svg) return
  if (e.target.closest('[data-alert]')) { const a = S.alerts.find(x => x.id === e.target.closest('[data-alert]').dataset.alert); if (a) showTip(e.clientX + 14, e.clientY + 14, `<h4>${a.id} · ${hhmm(a.t)}</h4>${esc(ACTION[a.kind](a))}`); return }
  const r = svg.getBoundingClientRect()
  const vx = (e.clientX - r.left) / r.width * CW
  if (vx < PADL || vx > CW - PADR) { hideTip(); svg.classList.remove('hovering'); return }
  const tm = geo.from + (vx - PADL) / (CW - PADL - PADR) * (geo.to - geo.from)
  const s = Math.min(NSLOT - 1, Math.max(0, Math.floor((tm - DAY_START) / SLOT)))
  const z = geo.z
  const c = $('#cross'); c.setAttribute('x1', geo.x(slotStart(s) + SLOT / 2)); c.setAttribute('x2', geo.x(slotStart(s) + SLOT / 2))
  svg.classList.add('hovering')
  let rows = ''
  const past = slotStart(s + 1) <= S.now
  if (past) {
    const rv = S.truth[z].slotMean[s], sv = S.shadow[z].slotMean[s]
    rows += `<div><span><i style="background:var(--z${z})"></i>real</span><b>${rv == null ? '–' : f1(rv) + ' min'}</b></div>`
    rows += `<div><span><i style="background:var(--ink-dim)"></i>roster only</span><b>${sv == null ? '–' : f1(sv) + ' min'}</b></div>`
    rows += `<div><span>passengers</span><b>${S.truth[z].slotPax[s]}</b></div>`
  }
  const f = (S.fc?.[z]?.slots || []).find(q => q.s === s)
  if (f && !past) {
    rows += `<div><span><i style="background:var(--accent)"></i>forecast P50</span><b>${f1(f.p50)} min</b></div>`
    rows += `<div><span><i style="background:var(--band)"></i>P10–P90</span><b>${f1(f.p10)}–${f1(f.p90)}</b></div>`
    rows += `<div><span>passengers</span><b>~${Math.round(f.pax)}</b></div>`
  }
  rows += `<div><span>lanes / roster</span><b>${S.plan[z][s]} / ${S.base[z][s]}</b></div>`
  showTip(e.clientX + 16, e.clientY + 16, `<h4>${hhmm(slotStart(s))}–${hhmm(slotStart(s + 1))}</h4>${rows}`)
})
$('#detail').addEventListener('pointerleave', () => { hideTip(); $('#chart')?.classList.remove('hovering') })
document.addEventListener('click', e => { const m = targetEl(e).closest('[data-alert]'); if (m) focusAlert(m.dataset.alert) })
function focusAlert (id) {
  const el = document.getElementById('al-' + id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('fresh'); setTimeout(() => el.classList.remove('fresh'), 1800)
}
function showTip (x, y, html) {
  const tip = $('#tip')
  tip.innerHTML = html
  tip.hidden = false
  const w = tip.offsetWidth, h = tip.offsetHeight
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px'
  tip.style.top = Math.max(8, y + h > innerHeight - 8 ? y - h - 28 : y) + 'px'
}
function hideTip () { $('#tip').hidden = true }

// ---------------------------------------------------------------- alerts
function alertHtml (a, fresh) {
  const pct = x => Math.round(x * 100)
  const scale = Math.max(a.target.before.p90, SLA) * 1.15
  const w = v => Math.min(100, v / scale * 100)
  const from = a.kind === 'reserve' ? '<span class="zchip R">Reserve</span>' : `<span class="zchip" style="--zc:var(--z${a.from})">Zone ${a.from}</span>`
  const chips = a.corr.flights.slice(0, 3).map(f => `<span class="chip${f.events.length ? ' ev' : ''}">${f.id} ${esc(cityEn(f.dest || ''))} · ${Math.round(f.share * 100)}%${f.events.length ? ' · ' + f.events.map(e => EV_SHORT[e]).join(', ') : ''}</span>`).join('') + (a.corr.staff ? '<span class="chip ev">team absent</span>' : '')
  const passed = a.gate.filter(c => c.ok).length
  return `<article class="alert${a.kind === 'reserve' ? ' res' : ''}${fresh ? ' fresh' : ''}" id="al-${a.id}">
    <div class="alert-h"><span class="id">${a.id}</span><span class="pill ${a.kind === 'reserve' ? 'lvl-limited' : 'add'}">${a.kind === 'reserve' ? 'reserve' : 'move'}</span><span class="t">${hhmm(a.t)}</span><span class="st pill ${a.status === 'ack' ? 'lvl-ok' : ''}">${a.status === 'ack' ? 'acknowledged' : 'sent'}</span></div>
    <div class="alert-msg">${esc(ACTION[a.kind](a))}</div>
    <div class="route">${from}<span class="arrow">${I.arrow}</span><span class="zchip" style="--zc:var(--z${a.to})">Zone ${a.to}</span><span class="when">${hhmm(a.effective)}–${hhmm(a.until)}</span></div>
    <div class="ba">
      <span class="lbl">before</span><span class="ba-bar"><i class="b" style="width:${w(a.target.before.p90)}%"></i><span class="sl" style="left:${w(SLA)}%"></span></span><span class="v">P90 ${f1(a.target.before.p90)}</span>
      <span class="lbl">after</span><span class="ba-bar"><i class="a" style="width:${w(a.target.after.p90)}%"></i><span class="sl" style="left:${w(SLA)}%"></span></span><span class="v">P90 ${f1(a.target.after.p90)}</span>
    </div>
    <div class="why">Risk over ${SLA} min <b>${pct(a.target.before.pOver)}% → ${pct(a.target.after.pOver)}%</b>.${a.donor ? ` Zone ${a.from} stays at P90 <b>${f1(a.donor.after.p90)}</b> min.` : ''} Saves about <b>${fmt(a.gain)}</b> waiting minutes.</div>
    <div class="chips" aria-label="Who fills the queue">${chips}</div>
    <details class="gate-d"><summary>✓ Gate: ${passed}/${a.gate.length} rules passed</summary><ul>${a.gate.map(c => `<li>${RULE_TXT[c.id]}${c.note ? ` <span class="mono">(${esc(c.note)})</span>` : ''}</li>`).join('')}</ul></details>
  </article>`
}
function renderAlerts () {
  const open = new Set([...document.querySelectorAll('.alert details[open]')].map(d => d.closest('.alert').id))
  $('#alertCount').textContent = S.alerts.length || ''
  $('#alerts').innerHTML = S.alerts.length ? S.alerts.slice().reverse().map(a => alertHtml(a, a.t === S.now)).join('') : `<div class="empty">${I.bell}<b>No notifications yet</b><span>${opts.agent ? `The agent acts when the forecast breaks the ${SLA}-minute target.` : 'The agent is switched off in Parameters.'}</span></div>`
  open.forEach(id => { const d = document.querySelector('#' + id + ' details'); if (d) d.open = true })
}
function toast (a, text) {
  const el = document.createElement('div')
  el.className = 'toast' + (a?.kind === 'reserve' ? ' res' : '')
  el.innerHTML = '<div>' + (a ? `<small>${a.id} · ${hhmm(a.t)}</small>${esc(ACTION[a.kind](a))}, ${hhmm(a.effective)}–${hhmm(a.until)}` : esc(text)) + '</div>'
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260) }
  el.onclick = () => { if (a) { view = 'ops'; renderControls(); focusAlert(a.id) } close() }
  $('#toasts').append(el)
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove()
  setTimeout(close, 6500)
}

// ---------------------------------------------------------------- board & feed
function renderBoard () {
  const fl = S.flights.filter(f => f.std >= S.now - 20 && f.std <= S.now + 300).slice(0, 14)
  const row = f => {
    let st = ['', 'on time']
    if (f.cancelled) st = ['lvl-over', 'cancelled']
    else if (f.std < S.now) st = ['', 'departed']
    else if (f.delayed) st = ['lvl-limited', 'delayed']
    else if (f.gateChanged) st = ['acc', 'gate change']
    else if (f.added) st = ['acc', 'new flight']
    else if (f.swapped) st = ['lvl-limited', 'larger aircraft']
    else if (f.std - S.now <= 40) st = ['lvl-ok', 'boarding']
    const time = f.delayed ? `<span class="strike">${hhmm(f.base.std)}</span> ${hhmm(f.std)}` : hhmm(f.std)
    const changed = f.delayed || f.gateChanged || f.added || f.swapped
    return `<tr class="${f.cancelled || f.std < S.now ? 'gone' : changed ? 'hl' : ''}"><td class="mono">${time}</td><td><b>${f.id}</b></td><td>${esc(cityEn(f.dest))}</td><td><span class="zb" style="--zc:var(--z${f.zone})">${f.zone}</span><span class="gt">${f.gate}</span></td><td><span class="pill ${st[0]}" title="${f.pax} passengers">${st[1]}</span></td></tr>`
  }
  $('#board').innerHTML = `<thead><tr><th>Time</th><th>Flight</th><th>To</th><th>Zone</th><th>Status</th></tr></thead><tbody>${fl.map(row).join('') || '<tr><td colspan="5" class="dim">No more departures today.</td></tr>'}</tbody>`
}
function evText (e) {
  const f = S.flights.find(x => x.id === (typeof e.flight === 'string' ? e.flight : e.flight?.id))
  return EV[e.type](e, f)
}
function renderFeed () {
  const evs = S.events.slice().reverse()
  $('#feedCount').textContent = evs.length || ''
  $('#feed').innerHTML = evs.length ? evs.map(e => `<li><span class="ico ${e.type}">${I[e.type]}</span><time>${hhmm(e.t)}</time><span>${esc(evText(e))}</span></li>`).join('') : `<li><span class="ico">${I.ok}</span><time>—</time><span class="dim">Everything is on schedule.</span></li>`
}

// ---------------------------------------------------------------- bus
function renderBus () {
  if (!S) return
  $('#busFilter').innerHTML = Object.entries({ all: 'All', ...WHO }).map(([k, v]) => `<button role="radio" aria-checked="${k === busFilter}" data-f="${k}">${k === 'all' ? '' : `<i class="c-${k}"></i>`}<span>${v}</span></button>`).join('')
  $('#busCount').textContent = S.sim.evals ? `${fmt(S.sim.evals)} simulations · ${(S.sim.pax / 1e6).toFixed(1)}M simulated passengers so far` : ''
  const recent = busAll.filter(m => busFilter === 'all' || PARTY[m.kind].includes(busFilter)).slice(-200)
  const ticks = [...new Set(recent.map(m => m.t))].sort((a, b) => b - a).slice(0, 24)
  $('#bus').innerHTML = ticks.map(tk => `<div class="tick"><time>${hhmm(tk)}</time><div class="msgs">${recent.filter(m => m.t === tk).map(m => {
    const [p, q] = PARTY[m.kind]
    const txt = m.kind === 'event' ? esc(evText(m.event)) : MSG[m.kind](m)
    return `<div class="msg"><span class="who c-${p}"><i></i>${WHO[p]}${p !== q ? `<em>→ ${WHO[q]}</em>` : ''}</span><span class="txt">${txt}</span></div>`
  }).join('')}</div></div>`).join('') || '<div class="empty"><b>Quiet so far</b><span>The agents start talking after the first step.</span></div>'
}

// ---------------------------------------------------------------- bench
const bench = { rows: [], days: 0, running: false }
let bw = null
$('#btnBench').onclick = () => {
  if (bench.running) return
  if (!bw) { bw = makeWorker(); bw.onmessage = e => { const m = e.data; if (m.type !== 'bench') return; bench.rows = m.rows; bench.days = m.days; bench.running = m.done < m.days; renderBench(); renderControls() } }
  bench.rows = []; bench.days = benchDays; bench.running = true
  renderBench()
  bw.postMessage({ type: 'bench', days: benchDays, runs: 60, opts: { schedSeed: opts.schedSeed, horizon: opts.horizon, reserveLimit: opts.reserveLimit, agent: true, feed: opts.feed, flights: opts.flights } })
}
function renderBench () {
  const prog = $('#benchProg')
  prog.hidden = !bench.running
  prog.querySelector('i').style.width = (bench.days ? bench.rows.length / bench.days * 100 : 0) + '%'
  $('#btnBench').disabled = bench.running
  $('#btnBench').textContent = bench.running ? `Running · ${bench.rows.length} of ${bench.days} days` : bench.rows.length ? 'Run again' : 'Run comparison'
  const rows = bench.rows
  if (!rows.length) { $('#benchOut').innerHTML = `<div class="panel empty">${bench.running ? '<div class="spinner"></div><b>Simulating the first day…</b>' : `${I.chart}<b>No results yet</b>`}<span>Pick how many days and run. Results appear day by day. Uses schedule ${opts.schedSeed}, horizon ${opts.horizon} min, ${opts.reserveLimit} reserves.</span></div>`; return }
  const sum = k => rows.reduce((a, r) => a + k(r), 0)
  const n = rows.length
  const cal = sum(r => r.calib.inside * r.calib.n) / Math.max(1, sum(r => r.calib.n))
  const big = (lbl, a, b, d = 0) => `<div class="kpi ${cmpLvl(a, b)}"><div class="kpi-label"><span>${lbl}</span>${delta(a, b)}</div><div class="kpi-value">${d ? f1(a) : fmt(a)}</div><div class="kpi-sub">roster only <b>${d ? f1(b) : fmt(b)}</b></div></div>`
  const W = 900, H = 220, pl = 44, pb = 24
  const vmax = Math.max(10, ...rows.map(r => r.roster.over))
  const step = (W - pl) / Math.max(n, bench.days)
  const bwid = Math.min(20, step * 0.32)
  const yy = v => 10 + (1 - v / vmax) * (H - pb - 10)
  let bars = ''
  const gstep = Math.ceil(vmax / 4 / 100) * 100 || 100
  for (let v = 0; v <= vmax; v += gstep) bars += `<line class="grid" x1="${pl}" x2="${W}" y1="${yy(v)}" y2="${yy(v)}"/><text x="${pl - 8}" y="${yy(v) + 3}" text-anchor="end">${fmt(v)}</text>`
  rows.forEach((r, i) => {
    const cx = pl + step * i + step / 2
    bars += `<rect class="rb" x="${cx - bwid - 1.5}" y="${yy(r.roster.over)}" width="${bwid}" height="${H - pb - yy(r.roster.over)}" rx="2"><title>Day ${i + 1}, roster only: ${r.roster.over}</title></rect>`
    bars += `<rect class="ra" x="${cx + 1.5}" y="${yy(r.agent.over)}" width="${bwid}" height="${Math.max(1, H - pb - yy(r.agent.over))}" rx="2"><title>Day ${i + 1}, with agent: ${r.agent.over}</title></rect>`
    bars += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${i + 1}</text>`
  })
  const ring = (() => { const r = 28, c = 2 * Math.PI * r; return `<svg class="ring" viewBox="0 0 68 68"><circle cx="34" cy="34" r="${r}" fill="none" stroke="var(--track)" stroke-width="7"/><circle cx="34" cy="34" r="${r}" fill="none" stroke="var(--accent)" stroke-width="7" stroke-dasharray="${c * cal} ${c}" transform="rotate(-90 34 34)"/><circle cx="34" cy="6" r="2.6" fill="var(--ink)" transform="rotate(${0.8 * 360} 34 34)"/><text x="34" y="38.5" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)">${Math.round(cal * 100)}%</text></svg>` })()
  $('#benchOut').innerHTML = `<div class="kpis">
      ${big('Average wait (min)', sum(r => r.agent.meanWait) / n, sum(r => r.roster.meanWait) / n, 1)}
      ${big(`Passengers over ${SLA} min`, sum(r => r.agent.over), sum(r => r.roster.over))}
      ${big('Boarding at risk', sum(r => r.agent.missed), sum(r => r.roster.missed))}
      ${big('Longest wait (min)', Math.max(...rows.map(r => r.agent.maxWait)), Math.max(...rows.map(r => r.roster.maxWait)), 1)}
    </div>
    <div class="bench-grid">
      <section class="panel"><div class="panel-h"><h3>Passengers over ${SLA} min, per day</h3><div class="legend" style="margin:0"><span><i class="box" style="background:var(--accent)"></i>with agent</span><span><i class="box" style="background:var(--muted-fill)"></i>roster only</span></div></div>
        <svg class="bars-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Passengers over ${SLA} minutes per day">${bars}</svg></section>
      <section class="panel calib">${ring}<div><h3>Forecast calibration</h3><p>Forecasts issued one hour ahead: the real average wait fell inside P10–P90 in <b>${Math.round(cal * 100)}%</b> of cases. The target is 80% (the tick on the ring), so the forecast is a little overconfident.</p></div></section>
    </div>
    <section class="panel"><div class="table-scroll"><table class="results"><thead><tr><th>Day</th><th class="num">Wait</th><th class="num">roster</th><th class="num">Over ${SLA} min</th><th class="num">roster</th><th class="num">At risk</th><th class="num">roster</th><th class="num">Notifications</th><th class="num">P10–P90</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td>${i + 1}</td><td class="num">${f1(r.agent.meanWait)}</td><td class="num dim">${f1(r.roster.meanWait)}</td><td class="num">${fmt(r.agent.over)}</td><td class="num dim">${fmt(r.roster.over)}</td><td class="num">${r.agent.missed}</td><td class="num dim">${r.roster.missed}</td><td class="num">${r.alerts}</td><td class="num">${Math.round(r.calib.inside * 100)}%</td></tr>`).join('')}
    </tbody><tfoot><tr><td>Total</td><td class="num">${f1(sum(r => r.agent.meanWait) / n)}</td><td class="num dim">${f1(sum(r => r.roster.meanWait) / n)}</td><td class="num">${fmt(sum(r => r.agent.over))}</td><td class="num dim">${fmt(sum(r => r.roster.over))}</td><td class="num">${sum(r => r.agent.missed)}</td><td class="num dim">${sum(r => r.roster.missed)}</td><td class="num">${sum(r => r.alerts)}</td><td class="num">${Math.round(cal * 100)}%</td></tr></tfoot></table></div></section>`
}

// ---------------------------------------------------------------- your data: import, check, analyse
const COLS = [['time', 'Time'], ['id', 'Flight'], ['dest', 'To'], ['zone', 'Zone'], ['pax', 'Pax'], ['type', 'Type']]
const HEAD = {
  time: ['time', 'std', 'departure', 'dep', 'etd', 'sched', 'време', 'vreme', 'заминување', 'zaminuvanje', 'час', 'cas', 'poletuvanje', 'полетување'],
  id: ['flight', 'flt', 'id', 'number', 'лет', 'let', 'број', 'broj', 'callsign'],
  dest: ['to', 'dest', 'destination', 'city', 'airport', 'дестинација', 'destinacija', 'за', 'za', 'град', 'grad'],
  zone: ['zone', 'security', 'checkpoint', 'terminal', 'pier', 'зона', 'zona'],
  pax: ['pax', 'passengers', 'passenger', 'pass', 'load', 'патници', 'patnici', 'број патници'],
  type: ['type', 'category', 'kind', 'service', 'тип', 'tip', 'вид', 'vid']
}
const TYPE_ALIAS = { short: 'short', regular: 'short', network: 'short', legacy: 'short', full: 'short', fsc: 'short', redoven: 'short', 'редовен': 'short',
  lowcost: 'lowcost', lcc: 'lowcost', budget: 'lowcost', low: 'lowcost', niskobudzeten: 'lowcost', 'нискобуџетен': 'lowcost',
  long: 'long', longhaul: 'long', wide: 'long', widebody: 'long', intercontinental: 'long', dolg: 'long', 'долг': 'long' }
let data = { name: '', rows: [] }
try { const d = JSON.parse(store.get('data', 'null')); if (d && Array.isArray(d.rows)) data = d } catch {}
let dataFeed = store.get('dataFeed', 'false') === 'true'
let analysis = null
let aw = null
const saveData = () => store.set('data', JSON.stringify(data))

function parseTime (v) {
  if (v == null || v === '') return null
  if (typeof v === 'number' || /^\d+([.,]\d+)?$/.test(String(v).trim())) {
    const n = Number(String(v).replace(',', '.'))
    if (!Number.isFinite(n)) return null
    if (!Number.isInteger(n)) {
      if (n < 1 || n > 1000) return Math.round((n % 1) * 1440) // Excel time or date-time
      if (typeof v === 'string' && n < 24) { const [h, mm] = v.trim().split(/[.,]/); return Number(h) * 60 + Number(mm.padEnd(2, '0').slice(0, 2)) } // "6.10" = 06:10
      return null
    }
    if (Number.isInteger(n) && n <= 24) return n * 60
    if (Number.isInteger(n) && n >= 100 && n <= 2400) return Math.floor(n / 100) * 60 + (n % 100)
    return null
  }
  const m = String(v).match(/(\d{1,2})[:.h](\d{2})(?:[:.]\d{2})?\s*(am|pm)?/i)
  if (!m) return null
  let h = Number(m[1]); const mm = Number(m[2])
  if (m[3]) { const pm = m[3].toLowerCase() === 'pm'; if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12 }
  if (h > 24 || mm > 59) return null
  return h * 60 + mm
}
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-zа-шѓќљњџѕј0-9 ]/gi, '').trim()
function gridToRows (grid) {
  grid = grid.filter(r => r.some(c => String(c ?? '').trim() !== ''))
  if (!grid.length) return { rows: [], note: 'The file has no rows.' }
  const head = grid[0].map(norm)
  const map = {}
  head.forEach((h, i) => { for (const [k, words] of Object.entries(HEAD)) if (map[k] == null && words.some(w => h === w || h.startsWith(w + ' ') || h.endsWith(' ' + w) || (w.length > 3 && h.includes(w)))) { map[k] = i; break } })
  const hasHeader = map.time != null || map.pax != null || map.zone != null
  let note = ''
  if (!hasHeader) { COLS.forEach(([k], i) => { map[k] = i }); note = 'No header row found, so columns were read in the order Time, Flight, To, Zone, Pax, Type.' }
  const body = hasHeader ? grid.slice(1) : grid
  const rows = body.map(r => {
    const cell = k => map[k] == null ? '' : r[map[k]]
    const t = parseTime(cell('time'))
    return { time: t == null ? String(cell('time') ?? '') : hhmm(t), id: String(cell('id') ?? '').trim(), dest: String(cell('dest') ?? '').trim(), zone: String(cell('zone') ?? '').trim(), pax: String(cell('pax') ?? '').trim(), type: String(cell('type') ?? '').trim() }
  })
  const missing = ['time', 'zone', 'pax'].filter(k => map[k] == null)
  if (hasHeader && missing.length) note = `Could not find a column for ${missing.join(', ')}. Check the header names.`
  return { rows, note }
}
function parseDelimited (text) {
  text = text.replace(/^﻿/, '')
  const first = text.split(/\r?\n/).find(l => l.trim()) || ''
  const delim = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',')
  const out = []; let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c; continue }
    if (c === '"' && cell === '') q = true
    else if (c === delim) { row.push(cell); cell = '' } else if (c === '\n') { row.push(cell.replace(/\r$/, '')); out.push(row); row = []; cell = '' } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell.replace(/\r$/, '')); out.push(row) }
  return out
}
// Minimal .xlsx reader: the file is a zip; the first sheet and the shared strings are inflated with the browser's own DecompressionStream.
async function readXlsx (buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder()
  let e = buf.byteLength - 22
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--
  if (e < 0) throw new Error('This is not an .xlsx file (no zip directory found).')
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true)
  const files = {}
  for (let i = 0; i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true)
    files[dec.decode(u8.subarray(p + 46, p + 46 + nlen))] = { method: dv.getUint16(p + 10, true), csize: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) }
    p += 46 + nlen + xlen + clen
  }
  const read = async name => {
    const f = files[name]; if (!f) return null
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true)
    const raw = u8.subarray(start, start + f.csize)
    if (f.method === 0) return dec.decode(raw)
    if (f.method !== 8) throw new Error('Unsupported compression in the .xlsx file.')
    if (!window.DecompressionStream) throw new Error('This browser cannot open .xlsx files. Save the sheet as CSV instead.')
    return dec.decode(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())
  }
  const xml = s => new DOMParser().parseFromString(s, 'application/xml')
  // every worksheet, in workbook order: [{ name, grid }]
  const wb = await read('xl/workbook.xml'), rels = await read('xl/_rels/workbook.xml.rels')
  const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const targets = []
  if (wb && rels) {
    const relx = xml(rels)
    for (const s of xml(wb).getElementsByTagName('sheet')) {
      const rid = s.getAttribute('r:id') || s.getAttributeNS(REL_NS, 'id')
      const rel = [...relx.getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === rid)
      if (rel) { const t = rel.getAttribute('Target').replace(/^\//, ''); targets.push({ name: s.getAttribute('name') || 'Sheet', path: t.startsWith('xl/') ? t : 'xl/' + t }) }
    }
  }
  if (!targets.length) Object.keys(files).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort().forEach((k, i) => targets.push({ name: `Sheet ${i + 1}`, path: k }))
  if (!targets.length) throw new Error('No worksheet found in the .xlsx file.')
  const ssx = await read('xl/sharedStrings.xml')
  const shared = ssx ? [...xml(ssx).getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : []
  const colIdx = ref => { let c = 0; for (const ch of ref.replace(/\d+$/, '')) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1 }
  const readSheet = async path => {
    const grid = []
    for (const row of xml(await read(path)).getElementsByTagName('row')) {
      const r = []
      for (const c of row.getElementsByTagName('c')) {
        const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0]?.textContent
        let val = ''
        if (t === 's') val = shared[Number(v)] ?? ''
        else if (t === 'inlineStr') val = [...c.getElementsByTagName('t')].map(x => x.textContent).join('')
        else if (t === 'str' || t === 'b' || t === 'e') val = v ?? ''
        else val = v == null ? '' : Number(v)
        r[colIdx(c.getAttribute('r') || '')] = val
      }
      grid.push(Array.from(r, x => x ?? ''))
    }
    return grid
  }
  const sheets = []
  for (const t of targets) if (files[t.path]) sheets.push({ name: t.name, grid: await readSheet(t.path) })
  return sheets
}
// A flight list has a time column and a zone or pax column. Hourly departures have hour labels (08:00, 0:00-0:59) and a passenger column.
const HOURLY_PAX_PER_FLIGHT = 160
const isFlightTable = grid => { const r = gridToRows(grid); return r.rows.length > 0 && !/No header|Could not find/.test(r.note || '') }
function hourOf (v) {
  // only "08:00" or "0:00-0:59" style labels: a bare 2026 is a year, not an hour
  const m = String(v ?? '').trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1]), mm = Number(m[2])
  return h <= 23 && mm <= 59 ? h : null
}
function hourlyFromGrid (grid, zone) {
  const start = grid.findIndex(r => hourOf(r[0]) != null)
  if (start < 0) return null
  let hdr = start - 1
  while (hdr >= 0 && !grid[hdr].some(c => typeof c === 'string' && c.trim())) hdr--
  const headerCells = hdr >= 0 ? grid[hdr].map(norm) : []
  let col = headerCells.findIndex(h => /dep|depart|отпрат|заминув|полетув/.test(h))
  if (col < 0) grid[start].forEach((c, i) => { if (i > 0 && typeof c === 'number') col = i })
  if (col < 0) return null
  const rows = [], seen = new Set()
  for (let i = start; i < grid.length; i++) {
    const h = hourOf(grid[i][0])
    if (h == null || seen.has(h)) break // a blank line or the next table ends this block
    seen.add(h)
    const pax = Number(grid[i][col])
    if (!Number.isFinite(pax) || pax <= 0) continue
    const n = Math.max(1, Math.round(pax / HOURLY_PAX_PER_FLIGHT))
    for (let k = 0; k < n; k++) rows.push({ time: hhmm(h * 60 + Math.round((k + 0.5) * 60 / n)), id: '', dest: '', zone, pax: String(Math.round(pax / n)), type: 'short' })
  }
  if (!rows.length) return null
  const note = seen.size < 12 ? `This table has only ${seen.size} hour rows, not a full day. Check it is the table you meant.` : ''
  return { rows, hours: seen.size, note }
}
let book = null // { name, sheets, info, index, mode }
async function loadFile (file) {
  const dz = $('#dropzone'); dz.classList.add('busy')
  try {
    const sheets = /\.xlsx$/i.test(file.name) ? await readXlsx(await file.arrayBuffer()) : [{ name: file.name, grid: parseDelimited(await file.text()) }]
    book = { name: file.name, sheets }
    pickSheet()
  } catch (err) { book = null; setRows({ rows: [] }, file.name); dataMsg(err.message || String(err), 'over') } finally { dz.classList.remove('busy') }
}
// Several files at once: each file contributes its flight list (or its hourly table, if it has no flight list),
// and the rows are merged into one table that can then be checked and analysed as usual.
async function loadFiles (files) {
  const list = [...files]
  if (list.length === 1) return loadFile(list[0])
  const dz = $('#dropzone'); dz.classList.add('busy')
  book = null
  $('#sheetBox').hidden = true
  const rows = [], notes = []
  try {
    for (const f of list) {
      try {
        const sheets = /\.xlsx$/i.test(f.name) ? await readXlsx(await f.arrayBuffer()) : [{ name: f.name, grid: parseDelimited(await f.text()) }]
        const info = sheets.map(s => ({ flight: isFlightTable(s.grid), hourly: hourlyFromGrid(s.grid, 'A') }))
        const fi = info.findIndex(x => x.flight), hi = info.findIndex(x => x.hourly && x.hourly.hours >= 12)
        if (fi >= 0) { const r = gridToRows(sheets[fi].grid); rows.push(...r.rows); notes.push(`${f.name} · ${sheets[fi].name}: ${r.rows.length} flights`) }
        else if (hi >= 0) { const h = hourlyFromGrid(sheets[hi].grid, $('#hourZone').value); rows.push(...h.rows); notes.push(`${f.name} · ${sheets[hi].name} (hourly): ${h.rows.length} flights`) }
        else notes.push(`${f.name}: no flight list or hourly table, skipped`)
      } catch (err) { notes.push(`${f.name}: ${err.message || err}, skipped`) }
    }
  } finally { dz.classList.remove('busy') }
  setRows({ rows }, `${list.length} files`)
  dataMsg(notes.join(' · '), rows.length ? 'limited' : 'over')
}
function pickSheet () {
  book.info = book.sheets.map(s => ({ flight: isFlightTable(s.grid), hourly: hourlyFromGrid(s.grid, 'A') }))
  const fi = book.info.findIndex(x => x.flight), hi = book.info.findIndex(x => x.hourly && x.hourly.hours >= 12)
  book.index = fi >= 0 ? fi : hi >= 0 ? hi : 0
  book.mode = book.info[book.index].flight || !book.info[book.index].hourly ? 'flights' : 'hourly'
  renderSheetBox()
  applySheet()
}
function renderSheetBox () {
  const box = $('#sheetBox')
  box.hidden = false
  $('#sheetMeta').textContent = `${book.name} · ${book.sheets.length} sheet${book.sheets.length === 1 ? '' : 's'}`
  $('#sheetSel').innerHTML = book.sheets.map((s, i) => { const inf = book.info[i]; const what = inf.flight ? 'flight list' : inf.hourly ? `hourly, ${inf.hourly.hours} h` : 'no table'; return `<option value="${i}"${i === book.index ? ' selected' : ''}>${esc(s.name)} — ${what}</option>` }).join('')
  $('#modeSel').value = book.mode
  $('#hourZoneWrap').hidden = book.mode !== 'hourly'
}
function applySheet () {
  const s = book.sheets[book.index]
  const inf = book.info[book.index]
  msgNote = null
  renderSheetBox()
  if (book.mode === 'flights') {
    if (!inf.flight) { setRows({ rows: [] }, book.name); dataMsg(`«${s.name}» is not a flight list: it needs a Time column and a Zone or Pax column. Choose another sheet in the list above, or read it as hourly departures.`, 'over'); return }
    setRows(gridToRows(s.grid), `${book.name} · ${s.name}`)
  } else {
    const h = hourlyFromGrid(s.grid, $('#hourZone').value)
    if (!h) { setRows({ rows: [] }, book.name); dataMsg(`«${s.name}» has no hour rows (for example 08:00 or 0:00-0:59) with a passenger column.`, 'over'); return }
    setRows({ rows: h.rows, note: h.note }, `${book.name} · ${s.name} (hourly)`)
  }
}
$('#sheetSel').onchange = e => { book.index = Number(e.target.value); book.mode = book.info[book.index].flight || !book.info[book.index].hourly ? 'flights' : 'hourly'; applySheet() }
$('#modeSel').onchange = e => { book.mode = e.target.value; applySheet() }
$('#hourZone').onchange = () => { if (book && book.mode === 'hourly') applySheet() }
function setRows ({ rows, note }, name) {
  if (rows.length > 600) { note = `Only the first 600 of ${rows.length} rows were kept.`; rows = rows.slice(0, 600) }
  data = { name, rows }
  saveData(); analysis = null
  renderData(); renderReport()
  if (note) dataMsg(note, 'limited')
}
let msgNote = null
function dataMsg (text, lvl) { msgNote = { text, lvl }; renderChecks() }

function checkRow (r) {
  const errors = [], warns = []
  const std = parseTime(r.time)
  if (std == null) errors.push(r.time ? `time "${r.time}" is not HH:MM` : 'time is missing')
  else if (std < DAY_START || std > DAY_END) errors.push(`${hhmm(std)} is outside the simulated day, 04:00–23:00`)
  else if (std < 360) warns.push(`${hhmm(std)}: some passengers would arrive before the day starts at 04:00`)
  const zone = String(r.zone).trim().toUpperCase().replace(/^ZONE\s*|^ЗОНА\s*/, '').replace('А', 'A').replace('В', 'B').replace('С', 'C')
  if (!ZONES.includes(zone)) errors.push(r.zone ? `zone "${r.zone}" is not A, B or C` : 'zone is missing')
  const pax = Number(String(r.pax).replace(/[\s,]/g, ''))
  if (!r.pax || !Number.isFinite(pax) || pax <= 0) errors.push(r.pax ? `pax "${r.pax}" is not a number` : 'pax is missing')
  else if (pax > 600) errors.push(`${pax} passengers is more than any aircraft`)
  else if (pax > 420) warns.push(`${pax} passengers is a very large aircraft`)
  let type = null
  const tk = norm(r.type).replace(/[\s-]/g, '')
  if (tk) { type = TYPE_ALIAS[tk] || null; if (!type) warns.push(`type "${r.type}" unknown, guessed from size`) }
  if (!r.id) warns.push('no flight number, one is made up')
  return { errors, warns, f: errors.length ? null : { std, zone, pax, id: r.id, dest: r.dest, type } }
}
function checkAll () {
  const res = data.rows.map(checkRow)
  const ids = new Map()
  res.forEach((c, i) => { const id = data.rows[i].id; if (id) { if (ids.has(id)) c.warns.push(`flight ${id} appears twice`); ids.set(id, i) } })
  return res
}
const validFlights = () => checkAll().map(c => c.f).filter(Boolean)

function renderData () {
  $('#rowCount').textContent = data.rows.length || ''
  $('#dataTable').innerHTML = `<thead><tr><th></th>${COLS.map(([, l]) => `<th>${l}</th>`).join('')}<th></th></tr></thead><tbody>${data.rows.map((r, i) => `<tr data-i="${i}"><td class="n">${i + 1}</td>${COLS.map(([k]) => `<td class="c-${k}"><input data-f="${k}" value="${esc(r[k])}" aria-label="${k} row ${i + 1}"${k === 'zone' ? ' maxlength="6"' : ''}></td>`).join('')}<td><button class="del" data-del="${i}" title="Delete row" aria-label="Delete row ${i + 1}">×</button></td></tr>`).join('')}</tbody>`
  renderChecks()
}
function renderChecks () {
  const res = checkAll()
  const err = res.filter(c => c.errors.length).length, warn = res.filter(c => !c.errors.length && c.warns.length).length, ok = res.length - err - warn
  const fl = res.filter(c => c.f)
  const paxSum = fl.reduce((a, c) => a + c.f.pax, 0)
  $('#sev').innerHTML = data.rows.length ? `<span class="sev-chip lvl-ok"><b>${ok}</b> ok</span><span class="sev-chip lvl-limited"><b>${warn}</b> warnings</span><span class="sev-chip lvl-over"><b>${err}</b> errors (skipped)</span><span class="sev-chip"><b>${fl.length}</b> flights · <b>${fmt(paxSum)}</b> pax</span>` : ''
  const items = []
  if (msgNote) items.push(`<li class="${msgNote.lvl === 'over' ? 'err' : 'warn'}"><b>File</b><span>${esc(msgNote.text)}</span></li>`)
  res.forEach((c, i) => { for (const m of c.errors) items.push(`<li class="err"><b>Row ${i + 1}</b><span>${esc(m)}</span></li>`); for (const m of c.warns) items.push(`<li class="warn"><b>Row ${i + 1}</b><span>${esc(m)}</span></li>`) })
  $('#issues').innerHTML = items.slice(0, 200).join('') + (items.length > 200 ? `<li><b>…</b><span>${items.length - 200} more</span></li>` : '')
  document.querySelectorAll('#dataTable tbody tr').forEach((tr, i) => { const c = res[i]; tr.className = c?.errors.length ? 'err' : c?.warns.length ? 'warn' : '' })
  $('#btnAnalyse').disabled = !fl.length
  $('#btnUse').disabled = !fl.length
  $('#feedSw').setAttribute('aria-checked', dataFeed)
  if (!data.rows.length) $('#dataTable').innerHTML = '<tbody><tr><td class="dim" style="padding:18px!important;text-align:center">No rows yet. Load a file, paste rows, load the example or add rows by hand.</td></tr></tbody>'
}
$('#dataTable').addEventListener('input', e => { const inp = e.target.closest('[data-f]'); if (!inp) return; const i = Number(inp.closest('tr').dataset.i); data.rows[i][inp.dataset.f] = inp.value; saveData() })
$('#dataTable').addEventListener('change', () => { analysis = null; renderChecks() })
$('#dataTable').addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (!d) return; data.rows.splice(Number(d.dataset.del), 1); saveData(); renderData() })
$('#btnAddRow').onclick = () => { const last = data.rows[data.rows.length - 1]; const t = last ? parseTime(last.time) : null; data.rows.push({ time: t != null ? hhmm(Math.min(DAY_END, t + 15)) : '06:00', id: '', dest: '', zone: last?.zone || 'A', pax: '150', type: '' }); data.name = data.name || 'entered by hand'; saveData(); renderData(); const ins = document.querySelectorAll('#dataTable tbody tr:last-child input'); ins[1]?.focus(); $('.data-table-wrap').scrollTop = 1e6 }
$('#btnClear').onclick = () => { if (data.rows.length && !confirm(`Remove all ${data.rows.length} rows?`)) return; data = { name: '', rows: [] }; msgNote = null; analysis = null; saveData(); renderData(); renderReport() }
$('#btnExample').onclick = () => { msgNote = null; setRows({ rows: makeSchedule(opts.schedSeed).map(f => ({ time: hhmm(f.std), id: f.id, dest: cityEn(f.dest), zone: f.zone, pax: String(f.pax), type: f.type })) }, `example day (schedule ${opts.schedSeed})`) }
$('#btnPaste').onclick = () => { const t = $('#pasteIn').value; if (!t.trim()) return; msgNote = null; setRows(gridToRows(parseDelimited(t)), 'pasted rows') }
$('#fileIn').onchange = e => { const list = [...e.target.files]; e.target.value = ''; if (list.length) { msgNote = null; loadFiles(list) } }
const dz = $('#dropzone')
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragging') })
dz.addEventListener('dragleave', () => dz.classList.remove('dragging'))
dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragging'); const list = [...e.dataTransfer.files]; if (list.length) { msgNote = null; loadFiles(list) } })
$('#feedSw').onclick = () => { dataFeed = !dataFeed; store.set('dataFeed', dataFeed); analysis = null; renderChecks() }

function download (name, text) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }))
  a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500)
}
const csvCell = v => /[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)
$('#btnTemplate').onclick = () => download('protok-schedule-template.csv', 'Time,Flight,To,Zone,Pax,Type\r\n05:40,F101,Vienna,A,142,short\r\n06:05,F102,Basel,B,176,lowcost\r\n07:30,F103,Dubai,C,268,long\r\n')
$('#btnExport').onclick = () => download('protok-schedule.csv', 'Time,Flight,To,Zone,Pax,Type\r\n' + data.rows.map(r => COLS.map(([k]) => csvCell(r[k])).join(',')).join('\r\n') + '\r\n')

// --- analysis run (own worker, so the Overview keeps its state)
$('#btnAnalyse').onclick = () => {
  const flights = validFlights(); if (!flights.length) return
  if (!aw) {
    aw = makeWorker()
    aw.onmessage = e => {
      const m = e.data
      if (m.type === 'aprog') { $('#aProg i').style.width = ((m.now - DAY_START) / (DAY_END - DAY_START) * 100) + '%'; $('#btnAnalyse').textContent = `Analysing · ${hhmm(m.now)}` }
      if (m.type === 'analysis') { analysis = m; $('#aProg').hidden = true; $('#btnAnalyse').disabled = false; $('#btnAnalyse').textContent = 'Analyse again'; renderReport() }
      if (m.type === 'aerror') analysisFailed(m.message)
    }
    aw.onerror = e => analysisFailed(e.message || 'the analysis stopped unexpectedly')
  }
  $('#aProg').hidden = false; $('#aProg i').style.width = '0%'
  $('#btnAnalyse').disabled = true; $('#btnAnalyse').textContent = 'Analysing…'
  aw.postMessage({ type: 'analyze', opts: { seed: opts.seed, runs: Number($('#aRuns').value), horizon: opts.horizon, reserveLimit: opts.reserveLimit, agent: true, flights, feed: dataFeed } })
}
function analysisFailed (message) {
  $('#aProg').hidden = true
  $('#btnAnalyse').disabled = false
  $('#btnAnalyse').textContent = 'Analyse the day'
  dataMsg(`The analysis did not finish: ${message}. Check the rows, or try fewer futures in "Monte Carlo futures".`, 'over')
}
$('#btnUse').onclick = () => {
  const flights = validFlights(); if (!flights.length) return
  draft = { ...opts, flights, dataName: data.name || 'your data', feed: dataFeed }
  applyParams()
  view = 'ops'; store.set('view', view); renderControls(); window.scrollTo({ top: 0 })
}

function peakOf (pax, from = 0) {
  let best = { pax: 0, s: 0 }
  for (let s = from; s + 4 <= NSLOT; s++) { const v = pax[s] + pax[s + 1] + pax[s + 2] + pax[s + 3]; if (v > best.pax) best = { pax: v, s } }
  return best
}
function miniChart (z, a) {
  const W = 900, H1 = 120, H2 = 70, G = 22, PL = 40, PR = 8, T = 8
  const x = s => PL + s / NSLOT * (W - PL - PR), bw = (W - PL - PR) / NSLOT
  const t = a.truth[z], sh = a.shadow[z]
  const rate = t.slotPax.map(v => v * 4)
  const capMax = ZONE_MAX[z] * LANE_RATE
  // slot 0 also holds everyone who would come before 04:00, so it is left out of the scale and clipped
  const ymax = Math.ceil(Math.max(capMax, ...rate.slice(1)) * 1.08 / 100) * 100
  const y = v => T + (1 - Math.min(v, ymax) / ymax) * H1
  let g = ''
  for (let v = 0; v <= ymax; v += ymax > 1000 ? 400 : 200) g += `<line class="grid" x1="${PL}" x2="${W - PR}" y1="${y(v)}" y2="${y(v)}"/><text x="${PL - 5}" y="${y(v) + 3}" text-anchor="end">${v}</text>`
  rate.forEach((v, s) => { if (v) g += `<rect class="arr" x="${x(s) + 0.5}" y="${y(v)}" width="${Math.max(0.5, bw - 1)}" height="${T + H1 - y(v)}"><title>${hhmm(slotStart(s))} · ${Math.round(v)} pax/h arriving${s === 0 ? ' (includes everyone who would come before 04:00)' : ''}</title></rect>` })
  if (rate[0] > ymax) g += `<text x="${x(1) + 3}" y="${T + 9}" style="fill:var(--ink-soft)">↑ ${fmt(rate[0])} at 04:00, early arrivals</text>`
  const step = arr => arr.map((l, s) => `${s ? 'L' : 'M'}${x(s)},${y(l * LANE_RATE)}L${x(s + 1)},${y(l * LANE_RATE)}`).join('')
  g += `<path class="cap-m" d="M${PL},${y(capMax)}L${W - PR},${y(capMax)}"/><path class="cap-r" d="${step(a.base[z])}"/><path class="cap-a" d="${step(a.plan[z])}"/>`
  // waits
  const y2 = (() => { const wm = Math.max(SLA * 1.6, ...t.slotMean.map(v => v || 0), ...sh.slotMean.map(v => v || 0)); const top = T + H1 + G; return { f: v => top + (1 - Math.min(v, wm) / wm) * H2, top, wm } })()
  const line = arr => { let d = '', pen = false; arr.forEach((v, s) => { if (v == null) { pen = false; return } d += `${pen ? 'L' : 'M'}${x(s + 0.5)},${y2.f(v)}`; pen = true }); return d }
  g += `<line class="grid" x1="${PL}" x2="${W - PR}" y1="${y2.f(0)}" y2="${y2.f(0)}"/><line class="sla" x1="${PL}" x2="${W - PR}" y1="${y2.f(SLA)}" y2="${y2.f(SLA)}"/><text x="${PL - 5}" y="${y2.f(SLA) + 3}" text-anchor="end">${SLA}</text><text x="${PL - 5}" y="${y2.f(0) + 3}" text-anchor="end">0</text>`
  g += `<path class="w-r" d="${line(sh.slotMean)}"/><path class="w-a" d="${line(t.slotMean)}"/>`
  for (let h = 300; h < DAY_END; h += 120) g += `<text x="${x((h - DAY_START) / SLOT)}" y="${y2.top + H2 + 14}" text-anchor="middle">${hhmm(h)}</text>`
  g += `<text x="${PL}" y="${T - 0}" dy="-1">pax/h</text><text x="${PL}" y="${y2.top - 4}">wait, min</text>`
  return `<svg class="mini" viewBox="0 -6 ${W} ${T + H1 + G + H2 + 22}" style="--zc:var(--z${z})" role="img" aria-label="Zone ${z} arrivals, capacity and wait">${g}</svg>`
}
function renderReport () {
  const el = $('#report')
  if (!analysis) {
    el.innerHTML = `<div class="panel report-empty">${I.chart}<b>${data.rows.length ? 'Ready to analyse' : 'Load your schedule to start'}</b><p>${data.rows.length ? 'Press <b>Analyse the day</b>. Protok runs the whole day twice on your schedule, with the agents and on a roster planned the week before, and shows where the queues build, how many lanes each zone needs and what the agent would change.' : 'Drop an Excel or CSV file on the left, paste rows from Excel, or load an example day. Then check the rows and press <b>Analyse the day</b>.'}</p></div>`
    return
  }
  const a = analysis
  const t = a.truth.total, sh = a.shadow.total
  const kpi = (lbl, va, vb, unit, d = 0) => `<div class="kpi ${cmpLvl(va, vb)}"><div class="kpi-label"><span>${lbl}</span>${delta(va, vb)}</div><div class="kpi-value">${d ? f1(va) : fmt(va)}${unit ? `<span class="kpi-unit">${unit}</span>` : ''}</div><div class="kpi-sub">roster only <b>${d ? f1(vb) : fmt(vb)}</b></div></div>`
  const paxTotal = a.flights.reduce((s, f) => s + f.pax, 0)
  // peak hour per zone: required lanes vs roster vs physical
  const peaks = ZONES.map(z => {
    const pax = a.truth[z].slotPax, pk = peakOf(pax, 1) // slot 0 also holds everyone who would arrive before 04:00
    const need = Math.ceil(pk.pax / LANE_RATE)
    const roster = Math.max(...a.base[z].slice(pk.s, pk.s + 4)), agent = Math.max(...a.plan[z].slice(pk.s, pk.s + 4))
    const util = pk.pax / (ZONE_MAX[z] * LANE_RATE)
    const lvl = need > ZONE_MAX[z] ? 'over' : need > roster ? (need > agent ? 'critical' : 'limited') : 'ok'
    const txt = { ok: 'Roster covers it', limited: 'Agent adds lanes', critical: 'Short of lanes', over: 'Over physical capacity' }[lvl]
    return { z, pk, need, roster, agent, util, lvl, txt, flights: a.flights.filter(f => f.zone === z).length }
  })
  // findings
  const fnd = []
  const red = sh.over ? Math.round((1 - t.over / sh.over) * 100) : 0
  fnd.push(sh.over ? [t.over < sh.over ? 'ok' : 'limited', `With the agent <b>${fmt(t.over)}</b> ${t.over === 1 ? 'passenger waits' : 'passengers wait'} over ${SLA} min, against <b>${fmt(sh.over)}</b> on the roster alone (${red === 0 ? 'the same' : (red > 0 ? '−' : '+') + Math.abs(red) + ' %'}).${red === 0 ? ' The roster already fits this day; the agent had nothing worth moving.' : ''}`] : ['ok', `On the roster alone nobody waits over ${SLA} min. The agent has nothing to fix on this day.`])
  for (const p of peaks) {
    const when = `${hhmm(slotStart(p.pk.s))}–${hhmm(slotStart(p.pk.s + 4))}`
    if (p.lvl === 'over') fnd.push(['over', `Zone ${p.z} peaks at <b>${fmt(p.pk.pax)} pax/h</b> (${when}). That needs <b>${p.need}</b> lanes, but only ${ZONE_MAX[p.z]} exist: queues will build whatever the staffing. Move departures out of the bank or open another checkpoint.`])
    else if (p.lvl === 'critical') fnd.push(['critical', `Zone ${p.z} needs <b>${p.need}</b> lanes at ${when} (${fmt(p.pk.pax)} pax/h). The roster has ${p.roster} and even with the agent only ${p.agent} were open; <b>${fmt(a.truth[p.z].over)}</b> passengers in this zone waited over ${SLA} min. Plan more staff for this window.`])
    else if (p.lvl === 'limited') fnd.push(['limited', `Zone ${p.z} needs <b>${p.need}</b> lanes at ${when}; the roster has ${p.roster}. The agent covered it by moving staff (${p.agent} lanes open).`])
  }
  const worst = ZONES.map(z => ({ z, w: a.truth[z].maxWait })).sort((x, y) => y.w - x.w)[0]
  if (worst.w > SLA) fnd.push(['limited', `Longest single wait with the agent: <b>${f1(worst.w)} min</b> in Zone ${worst.z}.`])
  if (t.missed) fnd.push(['critical', `<b>${fmt(t.missed)}</b> passengers would clear security less than ${BOARD_CLOSE} min before departure (roster only: ${fmt(sh.missed)}).`])
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
  if (a.alerts.length) fnd.push(['accent', `The agent sent <b>${plural(a.alerts.length, 'notification')}</b>: ${plural(a.alerts.filter(x => x.kind === 'move').length, 'team move')} and ${plural(a.alerts.filter(x => x.kind === 'reserve').length, 'reserve call')}. Every one passed all 8 gate rules.`])
  const early = a.flights.filter(f => f.std < 360)
  if (early.length) fnd.push(['limited', `${plural(early.length, 'departure')} before 06:00 (${early.map(f => f.id).slice(0, 4).join(', ')}${early.length > 4 ? '…' : ''}): passengers who would come before the simulated day starts at 04:00 are all counted at 04:00, so the first minutes look busier than they are.`])
  const zoneRows = ZONES.map(z => { const A = a.truth[z], R = a.shadow[z], p = peaks.find(q => q.z === z); return `<tr><td><span class="zb" style="--zc:var(--z${z})">${z}</span> Zone ${z}</td><td class="num">${p.flights}</td><td class="num">${fmt(A.served)}</td><td class="num">${fmt(p.pk.pax)}<small class="dim"> ${hhmm(slotStart(p.pk.s))}</small></td><td class="num">${p.need}</td><td class="num">${p.roster}</td><td class="num">${p.agent}</td><td class="num">${ZONE_MAX[z]}</td><td class="num">${Math.round(p.util * 100)} %</td><td><span class="pill lvl-${p.lvl}">${p.txt}</span></td></tr>` }).join('')
  const resRows = [...ZONES, 'total'].map(z => { const A = a.truth[z], R = a.shadow[z]; return `<tr${z === 'total' ? ' style="font-weight:650"' : ''}><td>${z === 'total' ? 'All zones' : `<span class="zb" style="--zc:var(--z${z})">${z}</span> Zone ${z}`}</td><td class="num">${f1(A.meanWait)}</td><td class="num dim">${f1(R.meanWait)}</td><td class="num">${fmt(A.over)}</td><td class="num dim">${fmt(R.over)}</td><td class="num">${f1(A.maxWait)}</td><td class="num dim">${f1(R.maxWait)}</td><td class="num">${fmt(A.missed)}</td><td class="num dim">${fmt(R.missed)}</td></tr>` }).join('')
  const moves = a.alerts.map(x => `<tr><td class="mono">${x.id}</td><td class="mono">${hhmm(x.t)}</td><td>${x.kind === 'reserve' ? '<span class="pill lvl-limited">reserve</span>' : '<span class="pill add">move</span>'}</td><td>${x.kind === 'reserve' ? 'Reserve' : 'Zone ' + x.from} → Zone ${x.to}</td><td class="mono">${hhmm(x.effective)}–${hhmm(x.until)}</td><td class="num">${f1(x.target.before.p90)} → ${f1(x.target.after.p90)}</td><td class="num">${fmt(x.gain)}</td></tr>`).join('')
  el.innerHTML = `
    <div class="banner ${t.over <= sh.over ? 'ok' : 'warn'}"><div class="ic">${I.ok}</div><div class="tx"><b>Analysis of ${esc(data.name || 'your schedule')}: ${a.flights.length} departures, ${fmt(paxTotal)} passengers</b><span>Passenger day ${opts.seed} · ${a.opts.feed ? 'with' : 'without'} scripted disruptions · ${fmt(a.sim.evals)} simulations, ${(a.sim.pax / 1e6).toFixed(1)}M simulated passengers.</span></div>
      <div class="report-actions"><button class="btn" id="btnResCsv">Download results (CSV)</button><button class="btn primary" id="btnUse2">Open in Overview</button></div></div>
    <div class="kpis">${kpi('Average wait', t.meanWait, sh.meanWait, 'min', 1)}${kpi(`Waited over ${SLA} min`, t.over, sh.over, 'pax')}${kpi('Boarding at risk', t.missed, sh.missed, 'pax')}${kpi('Longest wait', t.maxWait, sh.maxWait, 'min', 1)}</div>
    <section class="panel"><h3>Findings</h3><ul class="findings">${fnd.map(([l, h]) => `<li class="lvl-${l}">${h}</li>`).join('')}</ul></section>
    <section class="panel"><h3>Peak hour and lanes needed <span class="h-sub">capacity ${LANE_RATE} pax/h per lane</span></h3><div class="table-scroll"><table class="results"><thead><tr><th>Zone</th><th class="num">Flights</th><th class="num">Screened</th><th class="num">Peak hour<small>pax/h, start</small></th><th class="num">Lanes needed</th><th class="num">Roster</th><th class="num">With agent</th><th class="num">Physical</th><th class="num">Peak load<small>of physical</small></th><th>Status</th></tr></thead><tbody>${zoneRows}</tbody></table></div></section>
    <section class="panel"><h3>Results: with the agent and on the roster alone</h3><div class="table-scroll"><table class="results"><thead><tr><th>Zone</th><th class="num">Avg wait<small>min</small></th><th class="num">roster</th><th class="num">Over ${SLA} min<small>pax</small></th><th class="num">roster</th><th class="num">Longest<small>min</small></th><th class="num">roster</th><th class="num">At risk<small>pax</small></th><th class="num">roster</th></tr></thead><tbody>${resRows}</tbody></table></div></section>
    <section class="panel"><div class="panel-h"><h3>Arrivals, lanes and wait through the day</h3><div class="legend" style="margin:0"><span><i class="box" style="background:var(--muted-fill)"></i>arrivals at security</span><span><i style="border-color:var(--ink-soft);border-top-style:dashed"></i>roster capacity</span><span><i style="border-color:var(--accent2)"></i>with agent</span><span><i style="border-color:var(--over);border-top-style:dotted"></i>all lanes open</span><span><i style="border-color:var(--ink-dim);border-top-style:dotted"></i>wait, roster only</span></div></div>
      <div class="zone-cards">${ZONES.map(z => `<div class="zone-card"><h4><span class="zb" style="--zc:var(--z${z})">${z}</span>Zone ${z} <span class="h-sub">${ZDESC[z]}</span></h4>${miniChart(z, a)}</div>`).join('')}</div></section>
    <section class="panel"><h3>What the agent would do <span class="count">${a.alerts.length || ''}</span></h3>${a.alerts.length ? `<div class="table-scroll"><table class="results"><thead><tr><th>ID</th><th>Sent</th><th>Kind</th><th>Route</th><th>Window</th><th class="num">P90 before → after<small>min</small></th><th class="num">Saves<small>wait-min</small></th></tr></thead><tbody>${moves}</tbody></table></div>` : '<p class="dim" style="margin:0">No move was worth making on this day.</p>'}</section>`
  el.insertAdjacentHTML('beforeend', `<section class="panel ask-panel"><h3>Ask about this analysis</h3>
    <form id="askForm" class="ask-form" autocomplete="off"><input id="askIn" placeholder="нпр. Кој е преоптоварен? / Кога е врвот во C?" aria-label="Question"><button class="btn primary" type="submit">Ask</button></form>
    <div class="ask-chips">${ASK_CHIPS.map(c => `<button type="button" data-ask="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div id="askOut" class="ask-out" aria-live="polite"></div>
    <p class="note">Answers are worked out from this analysis by the code (no language model). Write a zone letter (A, B or C) to ask about one zone.</p></section>`)
  $('#btnUse2').onclick = () => $('#btnUse').click()
  $('#btnResCsv').onclick = () => {
    const lines = ['Time,Zone,Arrivals,Roster lanes,Agent lanes,Avg wait with agent (min),Avg wait roster only (min),Over 10 min with agent,Over 10 min roster only']
    for (let s = 0; s < NSLOT; s++) for (const z of ZONES) { const A = a.truth[z], R = a.shadow[z]; lines.push([hhmm(slotStart(s)), z, A.slotPax[s], a.base[z][s], a.plan[z][s], A.slotMean[s] == null ? '' : f1(A.slotMean[s]), R.slotMean[s] == null ? '' : f1(R.slotMean[s]), A.slotOver[s], R.slotOver[s]].join(',')) }
    download('protok-analysis.csv', lines.join('\r\n') + '\r\n')
  }
}

// ---------------------------------------------------------------- ask about the analysis
const ASK_CHIPS = ['Кој е преоптоварен?', 'Кога е врвот во A?', 'Колку линии му требаат на C?', 'Кои летови го полнат врвот во C?', 'Колку патници чекаат над 10 минути?', 'Што прави агентот?', 'Помош']
const ZMAP = { a: 'A', 'а': 'A', b: 'B', 'в': 'B', c: 'C', 'с': 'C' }
function zoneOf (q) {
  const m = q.toLowerCase().match(/(?:зона|zona|zone)\s*([abcабвс])(?![\p{L}])/u)
  if (m) return ZMAP[m[1]]
  const u = q.match(/(?<![\p{L}])([ABCАВС])(?![\p{L}])/u)
  return u ? ZMAP[u[1].toLowerCase()] : null
}
function askAnswer (q, a) {
  const s = q.toLowerCase().trim()
  if (!s) return ''
  const z = zoneOf(q)
  const has = re => re.test(s)
  const zones = z ? [z] : ZONES
  const cap = zz => ZONE_MAX[zz] * LANE_RATE
  const pk = zz => peakOf(a.truth[zz].slotPax, 1)
  const win = zz => { const p = pk(zz); return `${hhmm(slotStart(p.s))}–${hhmm(slotStart(p.s + 4))}` }
  const plural = (n, w) => `${fmt(n)} ${w}`
  if (has(/помош|help|што можам|what can|примери/))
    return 'Можам да одговорам на: кој е преоптоварен, кога е врвот, колку линии треба, кои летови го полнат врвот, колку патници чекаат над 10 минути, вкупниот број патници и што прави агентот. Напиши зона A, B или C за да ја разгледам таа зона.'
  if (has(/агент|agent|известув|notif|префрл|move|потег/)) {
    if (!a.alerts.length) return 'Агентот не испратил ниту едно известување на овој ден: ниту еден потег не беше доволно вреден или не ја поминуваше портата.'
    const mv = a.alerts.map(x => `${hhmm(x.t)}: ${x.kind === 'reserve' ? `повик на резервен тим во Зона ${x.to}` : `префрлање од Зона ${x.from} во Зона ${x.to}`} (${hhmm(x.effective)}–${hhmm(x.until)}, заштеда ${fmt(x.gain)} мин чекање)`)
    return `Агентот испратил <b>${plural(a.alerts.length, 'известување')}</b>. Сите поминале сите 8 правила на портата.<br>${mv.join('<br>')}`
  }
  if (has(/над 10|10 мин|чекаат|чекање|wait|over 10|над десет/)) {
    const rows = zones.map(zz => `Зона ${zz}: <b>${fmt(a.truth[zz].over)}</b> ${a.truth[zz].over === 1 ? "патник" : "патници"} над 10 мин со агент, <b>${fmt(a.shadow[zz].over)}</b> без агент; најдолго чекање ${f1(a.truth[zz].maxWait)} мин.`)
    return rows.join('<br>')
  }
  if (has(/колку патн|вкупно|total|how many pax|патници/) && !has(/линии|лет|чекаат/)) {
    const pax = a.flights.reduce((s, f) => s + f.pax, 0)
    return `На денот има <b>${plural(a.flights.length, 'лет')}</b> и <b>${fmt(pax)}</b> очекувани патници. Со агент над 10 минути чекаат <b>${fmt(a.truth.total.over)}</b>, на распоредот без агент <b>${fmt(a.shadow.total.over)}</b>.`
  }
  if (has(/линии|lane|треба|потреб|need/)) {
    return zones.map(zz => {
      const p = pk(zz), need = Math.ceil(p.pax / LANE_RATE)
      const end = slotStart(p.s + 4)
      const roster = Math.max(...a.base[zz].slice(p.s, p.s + 4)), agent = Math.max(...a.plan[zz].slice(p.s, p.s + 4))
      const verdict = need > ZONE_MAX[zz] ? `<b>Не стигаат</b> физички (${ZONE_MAX[zz]}); ќе има ред` : need > roster ? (need > agent ? 'Распоредот и агентот не покриваат' : 'Агентот ги покрива со префрлање') : 'Распоредот покрива'
      return `Зона ${zz}: во врвот ${win(zz)} (${fmt(p.pax)} патници/ч) треба <b>${need}</b> линии. Физички има ${ZONE_MAX[zz]}, распоред ${roster}, со агент ${agent}. ${verdict}.`
    }).join('<br>')
  }
  if (has(/лет|flight|причин/)) {
    if (!z) return 'За кои летови да барам? Напиши зона, на пример: „Кои летови го полнат врвот во C?“'
    const p = pk(z), start = slotStart(p.s)
    const fl = a.flights.filter(f => f.zone === z && f.std >= start + 40 && f.std <= start + 180).sort((x, y) => y.pax - x.pax).slice(0, 6)
    if (!fl.length) return `Нема летови во Зона ${z} што ги полнат патниците во врвот ${win(z)}.`
    return `Летовите што најмногу ги полнат врвот ${win(z)} во Зона ${z} (приближно, патниците доаѓаат околу 95 мин пред полетување):<br>` + fl.map(f => `${f.id} · ${hhmm(f.std)} · ${esc(cityEn(f.dest))} · <b>${fmt(f.pax)}</b> патници`).join('<br>')
  }
  if (has(/кога|врв|peak|час|when|најголем/)) {
    return zones.map(zz => {
      const p = pk(zz)
      return `Зона ${zz}: врвот е ${win(zz)}, <b>${fmt(p.pax)}</b> патници/ч, капацитет ${fmt(cap(zz))}/ч.`
    }).join('<br>')
  }
  if (has(/преоптов|гужв|overload|bottleneck|тесн|најлош|кој е|which|ред|queue|проблем/)) {
    const bad = ZONES.filter(zz => pk(zz).pax > cap(zz))
    const lines = zones.map(zz => {
      const p = pk(zz)
      return p.pax > cap(zz)
        ? `Зона ${zz}: <b>преоптоварена</b>. Врвот ${win(zz)}: ${fmt(p.pax)} патници/ч наспроти ${fmt(cap(zz))}/ч, па ${fmt(p.pax - cap(zz))} патници/ч се натрупуваат во ред.`
        : `Зона ${zz}: во рамки. Врвот ${win(zz)} е ${fmt(p.pax)} од ${fmt(cap(zz))} патници/ч.`
    })
    return (bad.length ? `Преоптоварени се: <b>${bad.join(', ')}</b>.<br>` : 'Ниедна зона не е преоптоварена во врвот.<br>') + lines.join('<br>')
  }
  return 'Не го разбрав прашањето. Пробај со: „Кој е преоптоварен?“, „Кога е врвот во A?“, „Колку линии му требаат на C?“ или „Што прави агентот?“. Помош дава повеќе примери.'
}
$('#report').addEventListener('submit', e => {
  if (e.target.id !== 'askForm') return
  e.preventDefault()
  const q = $('#askIn').value
  if (analysis) $('#askOut').innerHTML = askAnswer(q, analysis)
})
$('#report').addEventListener('click', e => {
  const b = e.target.closest('[data-ask]')
  if (!b || !analysis) return
  $('#askIn').value = b.dataset.ask
  $('#askOut').innerHTML = askAnswer(b.dataset.ask, analysis)
})

// ---------------------------------------------------------------- methodology
const FLOW = `<svg class="flow" viewBox="0 0 860 190" role="img" aria-label="Flow: feed, logistics agent, simulation agent, gate, staff">
<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z"/></marker></defs>
<rect class="box" x="10" y="66" width="130" height="58" rx="10"/><text x="75" y="91" text-anchor="middle">Live feed</text><text class="sub" x="75" y="109" text-anchor="middle">flights, staff</text>
<rect class="box hl" x="190" y="66" width="170" height="58" rx="10"/><text x="275" y="91" text-anchor="middle">Logistics agent</text><text class="sub" x="275" y="109" text-anchor="middle">correlates, proposes</text>
<rect class="box hl2" x="190" y="146" width="170" height="38" rx="10"/><text x="275" y="170" text-anchor="middle">Simulation agent</text>
<rect class="box" x="410" y="66" width="140" height="58" rx="10"/><text x="480" y="91" text-anchor="middle">Gate</text><text class="sub" x="480" y="109" text-anchor="middle">8 rules in code</text>
<rect class="box" x="600" y="66" width="120" height="58" rx="10"/><text x="660" y="91" text-anchor="middle">Staff</text><text class="sub" x="660" y="109" text-anchor="middle">notification</text>
<rect class="box dim" x="600" y="6" width="250" height="40" rx="10"/><text x="725" y="31" text-anchor="middle">The real day (hidden)</text>
<path class="arr" d="M140 95H188"/><path class="arr" d="M260 124V144"/><path class="arr" d="M290 146V126"/><path class="arr" d="M360 95H408"/><path class="arr" d="M550 95H598"/><path class="arr" d="M720 80C800 80 800 52 770 48"/>
</svg>`
// ---------------------------------------------------------------- user guide (MK / EN)
const K = k => `<kbd>${k}</kbd>`
const GUIDE = {
  mk: {
    title: 'Прирачник за користење',
    lead: 'Protok симулира безбедносна контрола на аеродром: колку патници чекаат, каде се создава гужва и што би направил агентот што префрла персонал. Сè работи на вашиот компјутер, без инсталација и без интернет.',
    sections: [
      ['start', 'Почеток', `
        <ol class="steps">
          <li>Отворете ја папката <b>Protok</b> (може да е на USB).</li>
          <li>На Windows кликнете двапати на <b>Protok.exe</b>. Се отвора прозорец без лента од прелистувач.</li>
          <li>На друг компјутер (Mac, Linux) кликнете двапати на <b>Protok.html</b>.</li>
        </ol>
        <p>Ако Windows покаже „Windows protected your PC“ (кога папката е преземена од интернет), кликнете <b>More info</b>, па <b>Run anyway</b>, или отворете го Protok.html.</p>
        <p>Горе има пет таба: <b>Overview</b> (симулацијата), <b>Your data</b> (ваш распоред и анализа), <b>Compare days</b> (повеќе денови), <b>Methodology</b> (како работи) и <b>Guide</b> (овој прирачник). Десно горе се избира светла, системска или темна тема.</p>`],
      ['overview', 'Overview: симулацијата во живо', `
        <p><b>3Д салата</b> ги покажува трите безбедносни зони A, B и C. Секоја линија има светло: зелено (отворена), тиркизно (тимот го донел агентот), црвено (тимот е префрлен) и сиво (затворена). Патниците во редот се бојат според чекањето: сино, жолто над 7 мин, црвено над 10 мин. Лак меѓу зоните значи префрлање на тим.</p>
        <ul class="dots">
          <li><b>Глувче:</b> влечете за ротирање, тркалце за зум, двоен клик за враќање. Клик на зона или на нејзината етикета ја избира.</li>
          <li><b>Play / Pause</b> го пушта денот во чекори од 15 минути. Копчето до него оди еден чекор. <b>1× 4× 16×</b> е брзината, а стрелката во круг го почнува денот одново.</li>
          <li><b>Временската линија</b>: кликнете каде било за да скокнете на тоа време. Назад во времето значи пресметување од 04:00. Знаците на линијата се настани од фидот, точките се известувања на агентот.</li>
        </ul>
        <p>Под сцената се: <b>банерот</b> (што се случува сега), <b>картичките</b> (во ред, просечно чекање, над 10 мин, ризик за качување, известувања; секоја со споредба „roster only“, т.е. без агент), табелата <b>Security zones now</b>, графикот на избраната зона (чекање, прогноза P10–P90 и линии), <b>Utilisation next hour</b>, <b>Live feed</b>, <b>Staff notifications</b> со правилата на портата и <b>Agent log</b> со разговорот меѓу агентите.</p>`],
      ['params', 'Параметри', `
        <p>Лево на Overview. Измените се бојат жолто и не важат додека не притиснете <b>Apply and rerun</b>, кој го пресметува денот одново до истото време. <b>Discard</b> ги отфрла, <b>Restore defaults</b> враќа сè на почеток.</p>
        <ul class="dots">
          <li><b>Scenario:</b> денот на патници (кој доаѓа и кога) и распоредот на летови, со ↻ за случаен број. <b>Scripted disruptions</b> ги вклучува демо-настаните (промена на излез, доцнење, нов лет, откажување, отсутен тим). Ако користите ваши податоци, тука пишува „your data“, со копче <b>Built-in</b> за враќање на вградениот распоред.</li>
          <li><b>Agents:</b> број на Monte Carlo иднини, хоризонт на прогнозата, дали агентот префрла персонал и колку резервни тимови смее да повика.</li>
          <li><b>Fixed rules:</b> правилата на портата и праговите. Само за читање.</li>
        </ul>`],
      ['data', 'Your data: ваш распоред', `
        <h4>1 · Внесете распоред</h4>
        <ul class="dots">
          <li>Превлечете една или <b>повеќе</b> Excel (.xlsx) или CSV датотеки во полето, или кликнете за избор. Со повеќе датотеки, редовите се спојуваат во една табела.</li>
          <li>Или залепете редови копирани од Excel, или <b>Load an example day</b>. <b>Download template</b> дава готов CSV.</li>
          <li>Потребни колони: <b>Time</b> (поаѓање, ЧЧ:ММ), <b>Zone</b> (A, B или C) и <b>Pax</b> (патници). По избор: <b>Flight</b>, <b>To</b>, <b>Type</b> (short, lowcost, long: колку рано доаѓаат патниците). Заглавијата може да се на македонски или англиски, во кој било редослед.</li>
          <li>Ако Excel има повеќе листови, се појавува <b>Sheet</b>: изберете го листот со летови. Ако листот има патници по час (08:00, 0:00-0:59), изберете <b>Read as: Hourly departures</b> и зона; секој час се дели на летови од околу 160 патници.</li>
        </ul>
        <h4>2 · Проверете</h4>
        <p>Редовите со грешка се црвени и се прескокнуваат, предупредувањата се жолти. Секоја ќелија може да се менува; <b>+ Row</b>, <b>×</b> (бришење), <b>Export CSV</b> и <b>Clear</b> се над табелата. Летовите мора да се меѓу 04:00 и 23:00, бидејќи тоа е симулираниот ден.</p>
        <h4>3 · Анализирајте</h4>
        <p><b>Analyse the day</b> го пушта целиот ден двапати: со агентите и само со распоредот. Резултатот: главни бројки, наоди со зборови, врвен час и потребни линии по зона, споредба, графици по зона и потезите на агентот. <b>Download results (CSV)</b> ги зачувува бројките на секои 15 минути. <b>Use in Overview</b> го пушта денот во 3Д.</p>
        <h4>Прашајте</h4>
        <p>Под анализата, во <b>Ask about this analysis</b>, напишете прашање или кликнете на готово: „Кој е преоптоварен?“, „Кога е врвот во A?“, „Колку линии му требаат на C?“, „Кои летови го полнат врвот во C?“, „Колку патници чекаат над 10 минути?“, „Што прави агентот?“. Одговорите ги пресметува кодот од анализата.</p>`],
      ['compare', 'Compare days', `<p>Изберете 5, 10 или 20 дена и <b>Run comparison</b>. Секој ден е нов случаен примерок на патници со истиот распоред; секој се игра со агент и без. Резултатот: збир, график по ден, табела и колку често прогнозата била точна (целта е 80%).</p>`],
      ['keys', 'Тастатура', `<div class="keys"><span>${K('Space')} пушти / пауза</span><span>${K('→')} следни 15 мин</span><span>${K('1')} ${K('2')} ${K('3')} избери зона</span><span>${K('R')} почни одново</span><span>Временска линија: ${K('←')} ${K('→')} ${K('PgUp')} ${K('PgDn')} ${K('Home')} ${K('End')}</span></div>`],
      ['faq', 'Чести проблеми', `
        <dl class="faq">
          <dt>„is not a flight list“ при вчитување на Excel</dt><dd>Листот нема колони за време, зона и патници. Изберете друг лист во <b>Sheet</b>, или <b>Hourly departures</b> ако има патници по час. Модели на капацитет, прегледи по датуми и прогнози по години не се списоци на летови.</dd>
          <dt>Копчето „Analyse the day“ е сиво</dt><dd>Нема ниту еден исправен ред. Поправете ги црвените редови или вчитајте друга датотека.</dd>
          <dt>Анализата трае долго</dt><dd>Голем распоред со многу иднини бара време. Намалете <b>Monte Carlo futures</b> на 30. Ако анализата падне, се појавува порака и копчето се враќа.</dd>
          <dt>„outside the simulated day, 04:00–23:00“</dt><dd>Летот е надвор од симулираниот ден. Поместете го или избришете го.</dd>
          <dt>„3D view is not available here“</dt><dd>Прелистувачот нема 3Д графика (WebGL). Сите табели и графици работат и без неа.</dd>
          <dt>Исчезнаа моите податоци?</dt><dd>Податоците и поставките се чуваат во прелистувачот на овој компјутер. На друг компјутер или во друг прелистувач почнувате одново; користете <b>Export CSV</b> за пренос.</dd>
        </dl>`],
      ['limits', 'Што е вистинско', `
        <ul class="dots">
          <li>Вградените летови, патници и настани се измислени. Апликацијата не е поврзана со вистински аеродром.</li>
          <li>Терминалот е фиксен: 7, 6 и 5 линии, 138 патници на час по линија. Вашите податоци го менуваат распоредот, не терминалот.</li>
          <li>Прогнозата е малку премногу самоуверена: околу 3 од 4 вистински чекања се во опсегот P10–P90, наспроти целта од 80%.</li>
          <li>Нема јазичен модел: одлуките ги носи кодот, а известувањата и одговорите се шаблони.</li>
        </ul>`]
    ]
  },
  en: {
    title: 'User guide',
    lead: 'Protok simulates airport security screening: how many passengers wait, where queues build and what an agent that moves staff would do. Everything runs on your computer, with no installation and no internet.',
    sections: [
      ['start', 'Getting started', `
        <ol class="steps">
          <li>Open the <b>Protok</b> folder (it can live on a USB stick).</li>
          <li>On Windows double-click <b>Protok.exe</b>. It opens a window without browser bars.</li>
          <li>On any other computer (Mac, Linux) double-click <b>Protok.html</b>.</li>
        </ol>
        <p>If Windows shows "Windows protected your PC" (when the folder came from the internet), click <b>More info</b>, then <b>Run anyway</b>, or open Protok.html.</p>
        <p>The five tabs at the top: <b>Overview</b> (the simulation), <b>Your data</b> (your schedule and analysis), <b>Compare days</b>, <b>Methodology</b> and <b>Guide</b>. The theme switch is top right.</p>`],
      ['overview', 'Overview: the live simulation', `
        <p>The <b>3D hall</b> shows the three security zones A, B and C. Each lane has a light: green (open), teal (team brought in by the agent), red (team moved away) and grey (closed). Queuing passengers are coloured by their wait: blue, amber over 7 min, red over 10 min. An arc between zones is a team move.</p>
        <ul class="dots">
          <li><b>Mouse:</b> drag to rotate, scroll to zoom, double-click to reset. Click a zone or its label to select it.</li>
          <li><b>Play / Pause</b> runs the day in 15-minute steps; the button next to it does one step. <b>1× 4× 16×</b> is the speed; the circular arrow restarts the day.</li>
          <li><b>Timeline:</b> click anywhere to jump there. Going back recomputes from 04:00. Marks are feed events, dots are agent notifications.</li>
        </ul>
        <p>Below the scene: the <b>banner</b>, the <b>KPI cards</b> (each compared with "roster only", i.e. without the agent), <b>Security zones now</b>, the chart of the selected zone, <b>Utilisation next hour</b>, <b>Live feed</b>, <b>Staff notifications</b> with the gate rules and the <b>Agent log</b>.</p>`],
      ['params', 'Parameters', `
        <p>On the left of Overview. Changes turn amber and only apply after <b>Apply and rerun</b>, which recomputes the day to the same time. <b>Discard</b> drops them, <b>Restore defaults</b> resets everything.</p>
        <ul class="dots">
          <li><b>Scenario:</b> passenger day and flight schedule (↻ for random), and <b>Scripted disruptions</b>. With your own data it shows "your data" and a <b>Built-in</b> button to go back.</li>
          <li><b>Agents:</b> Monte Carlo futures, forecast horizon, whether the agent moves staff, reserve teams per day.</li>
          <li><b>Fixed rules:</b> gate rules and thresholds, read only.</li>
        </ul>`],
      ['data', 'Your data: your schedule', `
        <h4>1 · Load a schedule</h4>
        <ul class="dots">
          <li>Drop one or <b>several</b> Excel (.xlsx) or CSV files, or click to choose. Several files are merged into one table.</li>
          <li>Or paste rows copied from Excel, or <b>Load an example day</b>. <b>Download template</b> gives a ready CSV.</li>
          <li>Required columns: <b>Time</b> (departure, HH:MM), <b>Zone</b> (A, B or C), <b>Pax</b>. Optional: <b>Flight</b>, <b>To</b>, <b>Type</b> (short, lowcost, long). English or Macedonian headers, any order.</li>
          <li>For a workbook with several sheets, choose the flight sheet in <b>Sheet</b>. For passengers per hour (08:00, 0:00-0:59) choose <b>Read as: Hourly departures</b> and a zone; each hour becomes flights of about 160 passengers.</li>
        </ul>
        <h4>2 · Check</h4>
        <p>Rows with errors are red and skipped, warnings are amber. Every cell can be edited; <b>+ Row</b>, <b>×</b>, <b>Export CSV</b> and <b>Clear</b> are above the table. Flights must be between 04:00 and 23:00, the simulated day.</p>
        <h4>3 · Analyse</h4>
        <p><b>Analyse the day</b> runs the whole day with the agents and on the roster alone: key numbers, findings, peak hour and lanes needed per zone, charts and the agent's moves. <b>Download results (CSV)</b> saves the 15-minute numbers; <b>Use in Overview</b> plays the day in 3D.</p>
        <h4>Ask</h4>
        <p>Under the analysis, <b>Ask about this analysis</b> answers questions such as "Which zone is overloaded?", "When is the peak in A?", "How many lanes does C need?", "Which flights fill the peak in C?" or "What is the agent doing?". The answers are computed from the analysis.</p>`],
      ['compare', 'Compare days', `<p>Pick 5, 10 or 20 days and <b>Run comparison</b>. Each day is a new random draw of passengers on the same schedule, played with and without the agent. You get totals, a chart per day, a table and the forecast calibration (target 80%).</p>`],
      ['keys', 'Keyboard', `<div class="keys"><span>${K('Space')} play / pause</span><span>${K('→')} next 15 min</span><span>${K('1')} ${K('2')} ${K('3')} select zone</span><span>${K('R')} restart</span><span>Timeline: ${K('←')} ${K('→')} ${K('PgUp')} ${K('PgDn')} ${K('Home')} ${K('End')}</span></div>`],
      ['faq', 'Common problems', `
        <dl class="faq">
          <dt>"is not a flight list" when loading Excel</dt><dd>The sheet has no time, zone and pax columns. Choose another sheet in <b>Sheet</b>, or <b>Hourly departures</b> for passengers per hour. Capacity models, daily summaries and yearly forecasts are not flight lists.</dd>
          <dt>"Analyse the day" is greyed out</dt><dd>There is no valid row. Fix the red rows or load another file.</dd>
          <dt>The analysis takes long</dt><dd>Large schedules with many futures take time. Set <b>Monte Carlo futures</b> to 30. If the analysis fails, a message appears and the button comes back.</dd>
          <dt>"outside the simulated day, 04:00–23:00"</dt><dd>Move or delete the flight.</dd>
          <dt>"3D view is not available here"</dt><dd>The browser has no WebGL. All tables and charts still work.</dd>
          <dt>My data is gone</dt><dd>Data and settings are kept in this browser on this computer. Use <b>Export CSV</b> to move them.</dd>
        </dl>`],
      ['limits', 'What is real', `
        <ul class="dots">
          <li>The built-in flights, passengers and events are invented; there is no real airport behind them.</li>
          <li>The terminal is fixed: 7, 6 and 5 lanes at 138 passengers per hour per lane. Your data changes the schedule, not the terminal.</li>
          <li>The forecast is a little overconfident: about 3 in 4 real waits fall inside P10–P90 against a target of 80%.</li>
          <li>There is no language model: code makes the decisions; notifications and answers are templates.</li>
        </ul>`]
    ]
  }
}
let guideLang = store.get('guideLang', 'mk')

// ---------------------------------------------------------------- step-by-step tours: what to click, what to enter
// Each step: [view, selector, title, text]. Steps whose element is hidden are skipped.
const TOURS = {
  sim: {
    mk: { name: 'Пушти симулација', steps: [
      ['ops', '.toptabs button[data-tab=ops]', 'Табот Overview', 'Тука се гледа денот на безбедносната контрола. <b>Кликнете</b> на <b>Overview</b> кога сакате да се вратите тука.'],
      ['ops', '#btnPlay', 'Пушти го денот', '<b>Кликнете Play</b>. Часовникот почнува од 04:00 и оди по 15 минути. Кликнете повторно за пауза. Тастатура: ' + K('Space') + '.'],
      ['ops', '#btnStep', 'Чекор по чекор', 'Ако сакате побавно, <b>кликнете тука</b>: секој клик е +15 минути. Тастатура: ' + K('→') + '.'],
      ['ops', '#speed', 'Брзина', '<b>Изберете</b> 1×, 4× или 16×. 16× е најбрзо.'],
      ['ops', '#tlTrack', 'Скокни на време', '<b>Кликнете</b> каде било на линијата, на пример на <b>16</b>, за да скокнете во 16:00. Знаците се настани, точките се известувања на агентот.'],
      ['ops', '#scene', '3Д салата', '<b>Влечете</b> со глувчето за да ја ротирате, <b>тркалце</b> за зум, <b>двоен клик</b> за враќање. <b>Кликнете на зона</b> (A, B или C) за да ја изберете.'],
      ['ops', '#status', 'Што се случува', 'Овој банер кажува што се случило во последниот чекор: известување од агентот, предупредување или „сè е во рамки“.'],
      ['ops', '#kpis', 'Главни бројки', 'Чекање, патници над 10 минути и ризик за качување. „roster only“ е истиот ден без агентот, за споредба.'],
      ['ops', '#ptabs', 'Параметри', '<b>Кликнете</b> на Scenario, Agents или Fixed rules за да ги видите поставките.'],
      ['ops', '#params input[data-k=seed]', 'Внесете вредност', '<b>Внесете број</b> од 1 до 9999 (на пример <b>5</b>) за друг ден со патници, па притиснете Enter. Полето ќе стане жолто.'],
      ['ops', '#applyBar', 'Примени', '<b>Кликнете Apply and rerun</b> за денот да се пресмета одново со новата вредност. <b>Discard</b> ја отфрла измената.'],
      ['ops', '#alerts', 'Известувања', 'Тука се појавуваат префрлањата на тимови што ги прави агентот, со правилата што ги поминале. Готово: сега пуштете го денот и следете.']
    ] },
    en: { name: 'Run a simulation', steps: [
      ['ops', '.toptabs button[data-tab=ops]', 'Overview tab', 'This is where the security day runs. <b>Click Overview</b> to come back here.'],
      ['ops', '#btnPlay', 'Run the day', '<b>Click Play</b>. The clock starts at 04:00 and moves in 15-minute steps. Click again to pause. Keyboard: ' + K('Space') + '.'],
      ['ops', '#btnStep', 'Step by step', 'For a slower pace <b>click here</b>: each click is +15 minutes. Keyboard: ' + K('→') + '.'],
      ['ops', '#speed', 'Speed', '<b>Choose</b> 1×, 4× or 16×.'],
      ['ops', '#tlTrack', 'Jump in time', '<b>Click</b> anywhere on the line, for example on <b>16</b>, to jump to 16:00.'],
      ['ops', '#scene', 'The 3D hall', '<b>Drag</b> to rotate, <b>scroll</b> to zoom, <b>double-click</b> to reset. <b>Click a zone</b> to select it.'],
      ['ops', '#status', 'What is happening', 'This banner says what happened in the last step.'],
      ['ops', '#kpis', 'Key numbers', 'Wait, passengers over 10 minutes and boarding at risk. "roster only" is the same day without the agent.'],
      ['ops', '#ptabs', 'Parameters', '<b>Click</b> Scenario, Agents or Fixed rules to see the settings.'],
      ['ops', '#params input[data-k=seed]', 'Enter a value', '<b>Type a number</b> from 1 to 9999 (for example <b>5</b>) for another passenger day, then press Enter. The field turns amber.'],
      ['ops', '#applyBar', 'Apply', '<b>Click Apply and rerun</b> to recompute the day. <b>Discard</b> drops the change.'],
      ['ops', '#alerts', 'Notifications', 'The agent\'s team moves appear here with the rules they passed. Now run the day and watch.']
    ] }
  },
  data: {
    mk: { name: 'Анализирај свој распоред', steps: [
      ['data', '.toptabs button[data-tab=data]', 'Табот Your data', 'Тука внесувате свој распоред на летови. <b>Кликнете</b> на <b>Your data</b>.'],
      ['data', '#btnTemplate', 'Немате датотека?', '<b>Кликнете Download template</b>. Отворете го во Excel и по еден ред за секој лет пополнете: <b>Time</b> (на пр. 07:15), <b>Flight</b> (F101), <b>To</b> (Vienna), <b>Zone</b> (A, B или C), <b>Pax</b> (на пр. 150), <b>Type</b> (short, lowcost или long). Зачувајте.'],
      ['data', '#dropzone', 'Вчитајте датотека', '<b>Кликнете тука</b> и изберете Excel (.xlsx) или CSV, или <b>превлечете</b> ја датотеката. Може и <b>повеќе датотеки одеднаш</b> (држете Ctrl при избор).'],
      ['data', '#btnExample', 'Или пример', 'За проба <b>кликнете Load an example day</b>: се вчитуваат 55 летови.'],
      ['data', '#sheetBox', 'Изберете лист', 'Ако Excel има повеќе листови, <b>изберете</b> го листот со летови во <b>Sheet</b>. Ако листот има патници по час, изберете <b>Hourly departures</b> и зона.'],
      ['data', '#sev', 'Проверка', 'Зелено: во ред. Жолто: предупредување. Црвено: грешка, редот се прескокнува. Причината е напишана под бројките.'],
      ['data', '#dataTable', 'Уредување', '<b>Кликнете во ќелија</b> и поправете: време како <b>ЧЧ:ММ</b> меѓу 04:00 и 23:00, зона <b>A</b>, <b>B</b> или <b>C</b>, патници како број. × го брише редот.'],
      ['data', '#btnAddRow', 'Додај лет', '<b>Кликнете + Row</b> за нов ред, па внесете ги податоците за летот.'],
      ['data', '#feedSw', 'Инциденти (по избор)', '<b>Кликнете</b> за да вклучите демо-настани (доцнење, промена на излез, отсутен тим). Обично оставете исклучено.'],
      ['data', '#aRuns', 'Брзина на анализата', '<b>Изберете 30</b> за побрза анализа, <b>100</b> за попрецизна.'],
      ['data', '#btnAnalyse', 'Анализирај', '<b>Кликнете Analyse the day</b> и почекајте лентата да заврши (обично 10–30 секунди).'],
      ['data', '#report', 'Резултат', 'Тука се појавуваат бројките, наодите, врвниот час и потребните линии по зона, графиците и потезите на агентот. Под нив, во <b>Ask</b>, <b>напишете прашање</b> како „Кој е преоптоварен?“. <b>Use in Overview</b> го пушта денот во 3Д.']
    ] },
    en: { name: 'Analyse your schedule', steps: [
      ['data', '.toptabs button[data-tab=data]', 'Your data tab', 'This is where you load your own flight schedule. <b>Click Your data</b>.'],
      ['data', '#btnTemplate', 'No file yet?', '<b>Click Download template</b>. Open it in Excel and fill one row per flight: <b>Time</b> (e.g. 07:15), <b>Flight</b>, <b>To</b>, <b>Zone</b> (A, B or C), <b>Pax</b> (e.g. 150), <b>Type</b> (short, lowcost or long). Save.'],
      ['data', '#dropzone', 'Load a file', '<b>Click here</b> and choose an Excel (.xlsx) or CSV file, or <b>drag</b> it in. <b>Several files at once</b> work too (hold Ctrl when choosing).'],
      ['data', '#btnExample', 'Or an example', 'To try it, <b>click Load an example day</b>: 55 flights are loaded.'],
      ['data', '#sheetBox', 'Choose a sheet', 'For a workbook with several sheets, <b>choose</b> the flight sheet in <b>Sheet</b>. For passengers per hour choose <b>Hourly departures</b> and a zone.'],
      ['data', '#sev', 'Check', 'Green: fine. Amber: warning. Red: error, the row is skipped. The reason is listed below.'],
      ['data', '#dataTable', 'Edit', '<b>Click a cell</b> and fix it: time as <b>HH:MM</b> between 04:00 and 23:00, zone <b>A</b>, <b>B</b> or <b>C</b>, pax as a number. × deletes the row.'],
      ['data', '#btnAddRow', 'Add a flight', '<b>Click + Row</b> for a new row, then type the flight.'],
      ['data', '#feedSw', 'Disruptions (optional)', '<b>Click</b> to add demo events. Usually leave it off.'],
      ['data', '#aRuns', 'Analysis speed', '<b>Choose 30</b> for a faster analysis, <b>100</b> for a steadier one.'],
      ['data', '#btnAnalyse', 'Analyse', '<b>Click Analyse the day</b> and wait for the bar (usually 10–30 seconds).'],
      ['data', '#report', 'Result', 'Numbers, findings, peak hour and lanes needed, charts and the agent\'s moves appear here. Below them, in <b>Ask</b>, <b>type a question</b>. <b>Use in Overview</b> plays the day in 3D.']
    ] }
  }
}
let tour = null // { key, steps, i }
function tourVisible (sel) { const el = document.querySelector(sel); if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width || r.height ? el : null }
function startTour (key) {
  closeTour()
  document.querySelector('.welcome')?.remove(); store.set('welcomed', '1')
  tour = { key, steps: TOURS[key][guideLang].steps, i: -1 }
  const spot = document.createElement('div'); spot.className = 'tour-spot'; spot.id = 'tourSpot'
  const card = document.createElement('div'); card.className = 'tour-card'; card.id = 'tourCard'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite')
  document.body.append(spot, card)
  tourGo(1)
}
function tourGo (dir) {
  if (!tour) return
  let i = tour.i
  for (;;) {
    i += dir
    if (i < 0 || i >= tour.steps.length) { if (i >= tour.steps.length) closeTour(); return }
    const [v, sel] = tour.steps[i]
    if (view !== v) { view = v; store.set('view', view); renderControls() }
    if (tourVisible(sel)) break
  }
  tour.i = i
  const el = tourVisible(tour.steps[i][1])
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(tourPlace, 380)
}
function tourPlace () {
  if (!tour) return
  const [, sel, title, text] = tour.steps[tour.i]
  const el = tourVisible(sel); if (!el) return
  const r = el.getBoundingClientRect(), pad = 6
  const spot = $('#tourSpot'), card = $('#tourCard')
  Object.assign(spot.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: Math.min(r.height, innerHeight - 20) + pad * 2 + 'px' })
  const en = guideLang === 'en', n = tour.steps.length
  card.innerHTML = `<div class="tc-h"><span class="tc-n">${tour.i + 1} / ${n}</span><span class="tc-name">${TOURS[tour.key][guideLang].name}</span><button class="tc-x" data-t="close" aria-label="${en ? 'Close' : 'Затвори'}">×</button></div>
    <h4>${title}</h4><p>${text}</p>
    <div class="tc-a"><button class="btn" data-t="back"${tour.i === 0 ? ' disabled' : ''}>${en ? 'Back' : 'Назад'}</button><button class="btn primary" data-t="next">${tour.i === n - 1 ? (en ? 'Finish' : 'Крај') : (en ? 'Next' : 'Следно')}</button></div>`
  const cw = Math.min(380, innerWidth - 24), ch = card.offsetHeight
  let top = r.bottom + 14
  if (top + ch > innerHeight - 12) top = r.top - ch - 14
  if (top < 12) top = Math.max(12, Math.min(innerHeight - ch - 12, r.top + 20))
  card.style.width = cw + 'px'
  card.style.left = Math.max(12, Math.min(innerWidth - cw - 12, r.left + r.width / 2 - cw / 2)) + 'px'
  card.style.top = top + 'px'
}
function closeTour () { tour = null; $('#tourSpot')?.remove(); $('#tourCard')?.remove() }
document.addEventListener('click', e => {
  const b = targetEl(e).closest('#tourCard [data-t]'); if (!b) return
  if (b.dataset.t === 'next') tourGo(1); else if (b.dataset.t === 'back') tourGo(-1); else closeTour()
})
document.addEventListener('keydown', e => {
  if (!tour) return
  if (e.key === 'Escape') closeTour()
  else if (e.key === 'ArrowRight' && !targetEl(e).closest('input, select, textarea')) tourGo(1)
  else if (e.key === 'ArrowLeft' && !targetEl(e).closest('input, select, textarea')) tourGo(-1)
  else return
  e.preventDefault(); e.stopImmediatePropagation()
}, true)
addEventListener('resize', () => tour && tourPlace())
addEventListener('scroll', () => tour && tourPlace(), { passive: true })

function renderGuide () {
  const g = GUIDE[guideLang]
  const en = guideLang === 'en'
  $('#guide').innerHTML = `
    <aside class="guide-toc"><div class="seg sm" id="guideLang" role="radiogroup" aria-label="Language">${[['mk', 'МК'], ['en', 'EN']].map(([k, l]) => `<button role="radio" aria-checked="${k === guideLang}" data-gl="${k}">${l}</button>`).join('')}</div>
      <nav>${g.sections.map(([id, h], i) => `<a href="#g-${id}" data-g="${id}">${i + 1}. ${h}</a>`).join('')}</nav></aside>
    <div class="guide-body">
      <section class="panel"><h2 class="big">${g.title}</h2><p class="lead">${g.lead}</p></section>
      <section class="panel tour-start"><h3>${en ? 'Step-by-step tour: what to click and what to type' : 'Прошетка чекор по чекор: што да кликнете и што да внесете'}</h3>
        <p>${en ? 'The screen dims and each button or field is lit up with an explanation. Use Next and Back, or the arrow keys; Esc closes.' : 'Екранот се затемнува и секое копче или поле се осветлува со објаснување. Користете Следно и Назад, или стрелките; Esc затвора.'}</p>
        <div class="tour-btns"><button class="btn primary" data-tour="sim">▶ ${TOURS.sim[guideLang].name}</button><button class="btn primary" data-tour="data">▶ ${TOURS.data[guideLang].name}</button></div></section>
      ${g.sections.map(([id, h, html], i) => `<section class="panel guide-sec" id="g-${id}"><h3><span class="gnum">${i + 1}</span>${h}</h3>${html}</section>`).join('')}
    </div>`
}
$('#guide').addEventListener('click', e => {
  const t = targetEl(e)
  const tb = t.closest('[data-tour]'); if (tb) { startTour(tb.dataset.tour); return }
  const b = t.closest('[data-gl]'); if (b) { guideLang = b.dataset.gl; store.set('guideLang', guideLang); renderGuide(); return }
  const a = t.closest('[data-g]'); if (a) { e.preventDefault(); document.getElementById('g-' + a.dataset.g)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
})

function renderHow () {
  $('#how').innerHTML = `
<section class="panel"><h2 class="big">Methodology</h2>
  <p class="lead">Protok is a small operating system for a passenger terminal. The clock moves in 15-minute steps. Each step the live feed arrives, then two agents talk and code decides what reaches the staff. There is no language model: notifications are templates and every decision is made in code.</p>
  ${FLOW}
</section>
<div class="how-grid">
  <section class="panel"><span class="tag sim">Simulation agent</span><h3>Monte Carlo forecast of each queue</h3>
    <p>Each step it draws ${opts.runs} possible futures for the next ${opts.horizon} minutes: how many passengers each flight brings, when they reach security and how fast screening runs that day. Every future runs through each zone's multi-lane queue.</p>
    <ul class="formulas">
      <li>Lane capacity <code>μ = ${LANE_RATE} pax/h</code>, mean service <code>${Math.round(SVC_MEAN * 60)} s</code>, variation <code>CV ${SVC_CV}</code></li>
      <li>Per slot <code>P10 · P50 · P90</code> of the mean wait across the futures</li>
      <li>Utilisation <code>ρ = arrivals next hour ÷ (open lanes × ${LANE_RATE})</code></li>
    </ul></section>
  <section class="panel"><span class="tag log">Logistics agent</span><h3>Find the hotspot, ask what-if</h3>
    <p>It finds the first slot whose P90 breaks the target, links it to the flights and feed events that fill it, and asks for what-ifs: move a team from another zone, or call a reserve team. Every what-if is simulated on the same futures (common random numbers), so the difference is the plan, not the noise.</p>
    <ul class="formulas">
      <li>Cost of a plan <code>Σ wait + ${W_OVER}·max(0, wait − ${SLA}) + ${W_MISS}·missed boarding</code></li>
      <li>Move kept if <code>gain ≥ ${MIN_GAIN}</code> wait-min and donor <code>P90 ≤ ${f1(SLA * DONOR_P90)} min</code></li>
      <li>Reserve team costs <code>${RESERVE_COST}</code> wait-min, at most <code>${opts.reserveLimit}</code> per day</li>
    </ul></section>
  <section class="panel"><span class="tag gate">Gate</span><h3>Code decides, not the agent</h3>
    <p>The logistics agent only proposes. The gate checks every rule before a notification goes out:</p>
    <ul class="rules">${Object.values(RULE_TXT).map(r => `<li>${r}</li>`).join('')}</ul></section>
  <section class="panel"><span class="tag warn">Honesty</span><h3>What is real and what is not</h3>
    <ul class="notes">
      <li>Flights, passengers, events and the roster are invented. There is no real airport behind this.</li>
      <li>The "real" day is a hidden draw the agents never see, with a hidden screening speed per zone (± ${Math.round(RATE_SD * 100)} %).</li>
      <li>"Roster only" is the same day on last week's roster, so the only difference is the agent.</li>
      <li>The forecast is a little overconfident: about three in four real waits fall inside P10–P90 against a target of 80 %. Compare days measures it.</li>
    </ul></section>
  <section class="panel wide"><h3>Keyboard</h3>
    <div class="keys"><span><kbd>Space</kbd> play / pause</span><span><kbd>→</kbd> next 15 min</span><span><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> select zone</span><span><kbd>R</kbd> restart the day</span><span>Timeline: <kbd>←</kbd> <kbd>→</kbd> <kbd>PgUp</kbd> <kbd>PgDn</kbd> <kbd>Home</kbd> <kbd>End</kbd></span><span>3D: drag, scroll, double-click</span></div></section>
</div>`
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderControls)
renderControls()
renderParams()
renderScenario()
renderData()
renderReport()
renderHow()
renderGuide()
$('#btnHelp').onclick = () => { view = 'guide'; store.set('view', view); renderControls(); window.scrollTo({ top: 0 }) }
// first visit: a small, non-blocking offer of the tours
if (!store.get('welcomed', '')) {
  const en = guideLang === 'en'
  const w = document.createElement('div'); w.className = 'welcome'; w.setAttribute('role', 'dialog')
  w.innerHTML = `<b>${en ? 'New to Protok?' : 'Прв пат во Protok?'}</b><p>${en ? 'A short tour shows what to click and what to type.' : 'Кратка прошетка ви покажува што да кликнете и што да внесете.'}</p>
    <div class="tour-btns"><button class="btn primary" data-w="sim">▶ ${TOURS.sim[guideLang].name}</button><button class="btn primary" data-w="data">▶ ${TOURS.data[guideLang].name}</button><button class="btn" data-w="no">${en ? 'Not now' : 'Не сега'}</button></div>`
  document.body.append(w)
  w.onclick = e => { const b = e.target.closest('[data-w]'); if (!b) return; store.set('welcomed', '1'); w.remove(); if (b.dataset.w !== 'no') startTour(b.dataset.w) }
}
renderBench()
reset()
})()
