// The simulated day: departures, the live feed of changes, and how each
// passenger decides when to reach security. All of it is invented.
import { rng, seedOf, normal, lognormal } from './rng.mjs'

export const ZONES = ['A', 'B', 'C']
export const ZONE_MAX = { A: 7, B: 6, C: 5 }
export const ZONE_MIN = { A: 1, B: 1, C: 1 }
export const DAY_START = 240 // 04:00
export const DAY_END = 1380 // 23:00
export const SLOT = 15
export const NSLOT = (DAY_END - DAY_START) / SLOT
export const SLA = 10 // minutes in the security queue
export const NOTICE = 15 // an alert must reach the team this long before it takes effect
export const LANE_RATE = 138 // passengers per hour per lane, from the mean service time below
export const SVC_MEAN = 60 / LANE_RATE
export const SVC_CV = 0.55
export const RATE_SD = 0.08 // the day's real screening speed per checkpoint is not known in advance
export const BOARD_CLOSE = 20 // a passenger must clear security this long before departure

export const slotOf = t => Math.min(NSLOT - 1, Math.max(0, Math.floor((t - DAY_START) / SLOT)))
export const slotStart = i => DAY_START + i * SLOT
export const hhmm = t => { const m = ((Math.round(t) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') }

const CITIES = {
  short: ['Виена', 'Цирих', 'Минхен', 'Рим', 'Љубљана', 'Атина', 'Белград', 'Загреб', 'Будимпешта', 'Варшава', 'Прага', 'Франкфурт'],
  lowcost: ['Малме', 'Дортмунд', 'Базел', 'Ајндховен', 'Мемминген', 'Гетеборг', 'Билунд', 'Бергамо', 'Карлсруе', 'Хан'],
  long: ['Дубаи', 'Доха', 'Истанбул', 'Њујорк', 'Торонто', 'Чикаго']
}
const CITIES_EN = {
  Виена: 'Vienna', Цирих: 'Zurich', Минхен: 'Munich', Рим: 'Rome', Љубљана: 'Ljubljana', Атина: 'Athens', Белград: 'Belgrade', Загреб: 'Zagreb', Будимпешта: 'Budapest', Варшава: 'Warsaw', Прага: 'Prague', Франкфурт: 'Frankfurt',
  Малме: 'Malmo', Дортмунд: 'Dortmund', Базел: 'Basel', Ајндховен: 'Eindhoven', Мемминген: 'Memmingen', Гетеборг: 'Gothenburg', Билунд: 'Billund', Бергамо: 'Bergamo', Карлсруе: 'Karlsruhe', Хан: 'Hahn',
  Дубаи: 'Dubai', Доха: 'Doha', Истанбул: 'Istanbul', Њујорк: 'New York', Торонто: 'Toronto', Чикаго: 'Chicago'
}
export const cityEn = c => CITIES_EN[c] || c

// When passengers show up at security, in minutes before departure: [mean, sd].
export const SHOWUP = { short: [95, 26], lowcost: [86, 22], long: [138, 30] }

export function makeSchedule (seed = 7) {
  const r = rng(seed)
  const banks = [[330, 455, 15], [535, 650, 7], [690, 800, 9], [890, 990, 7], [1010, 1100, 10], [1160, 1280, 7]]
  const out = []
  for (const [from, to, n] of banks) {
    for (let k = 0; k < n; k++) {
      const std = Math.round((from + r() * (to - from)) / 5) * 5
      const x = r()
      const type = x < 0.16 ? 'long' : x < 0.48 ? 'lowcost' : 'short'
      const zone = type === 'long' ? 'C' : (r() < 0.55 ? 'A' : 'B')
      const seats = type === 'long' ? 250 + Math.round(r() * 50) : type === 'lowcost' ? 186 + Math.round(r() * 3) : 150 + Math.round(r() * 40)
      const pax = Math.round(seats * (0.76 + 0.19 * r()))
      const list = CITIES[type]
      out.push({ std, type, zone, seats, pax, dest: list[Math.floor(r() * list.length)] })
    }
  }
  out.sort((a, b) => a.std - b.std)
  const gates = { A: 0, B: 0, C: 0 }
  return out.map((f, i) => ({ ...f, id: 'F' + (101 + i), gate: f.zone + (1 + (gates[f.zone]++ % (f.zone === 'C' ? 4 : 8))) }))
}

// A schedule entered by a user: { std (minutes), zone, pax, id?, dest?, type?, seats? }.
// Fills the gaps the engine needs and sorts by departure. Validation with
// messages for people lives in the app; this only makes the data safe to run.
export function normalizeFlights (list) {
  const gates = { A: 0, B: 0, C: 0 }
  const used = new Set()
  return list
    .filter(f => ZONES.includes(f.zone) && Number.isFinite(f.std) && f.pax > 0)
    .map(f => ({ ...f, std: Math.round(f.std), pax: Math.round(f.pax) }))
    .sort((a, b) => a.std - b.std)
    .map((f, i) => {
      const type = SHOWUP[f.type] ? f.type : f.pax >= 240 ? 'long' : 'short'
      let id = String(f.id || '').trim() || 'U' + (101 + i)
      while (used.has(id)) id += '′'
      used.add(id)
      const seats = Math.max(f.pax, Math.round(f.seats || f.pax / 0.88))
      const gate = f.gate || f.zone + (1 + (gates[f.zone]++ % (f.zone === 'C' ? 4 : 8)))
      return { id, std: f.std, type, zone: f.zone, seats, pax: f.pax, dest: String(f.dest || '—'), gate }
    })
}

// The live feed. Each change is chosen from the schedule by a rule, so it
// stays sensible if the schedule seed changes.
export function makeEvents (flights) {
  const pick = (fn) => flights.find(fn)
  const ev = []
  const g1 = pick(f => f.zone === 'B' && f.std >= 465 && f.std <= 540 && f.type !== 'long') || pick(f => f.zone === 'B')
  if (g1) ev.push({ t: 375, type: 'gate', flight: g1.id, zone: 'A' })
  const sw = pick(f => f.zone === 'A' && f.std >= 700 && f.std <= 780)
  if (sw) ev.push({ t: 500, type: 'swap', flight: sw.id, pax: Math.min(232, sw.pax + 70), seats: 232 })
  ev.push({ t: 580, type: 'add', flight: { id: 'F901', std: 790, type: 'long', zone: 'C', seats: 290, pax: 268, dest: 'Доха', gate: 'C4', added: true } })
  const dl = pick(f => f.zone === 'B' && f.std >= 880 && f.std <= 960)
  if (dl) ev.push({ t: 690, type: 'delay', flight: dl.id, std: dl.std + 100 })
  ev.push({ t: 750, type: 'staff', zone: 'B', from: slotOf(780), to: slotOf(1020), delta: -1 })
  const cx = pick(f => f.zone === 'A' && f.std >= 1050 && f.std <= 1110)
  if (cx) ev.push({ t: 930, type: 'cancel', flight: cx.id })
  const g2 = pick(f => f.zone === 'C' && f.std >= 1180)
  if (g2) ev.push({ t: 1060, type: 'gate', flight: g2.id, zone: 'A' })
  const late = pick(f => f.zone === 'A' && f.std >= 1200 && f.std <= 1260)
  if (late) ev.push({ t: 1150, type: 'delay', flight: late.id, std: late.std + 45 })
  ev.sort((a, b) => a.t - b.t)
  return ev.map((e, i) => ({ ...e, id: 'E' + (i + 1) }))
}

// The flight as anyone would know it at time t.
export function flightAt (base, evs, t) {
  const f = { ...base, base, cancelled: false, delayed: false, gateChanged: false, swapped: false }
  for (const e of evs) {
    if (e.t > t) break
    if (e.type === 'delay') { f.std = e.std; f.delayed = true } else if (e.type === 'gate') { f.zone = e.zone; f.gate = e.zone + '9'; f.gateChanged = true } else if (e.type === 'swap') { f.pax = e.pax; f.seats = e.seats; f.swapped = true } else if (e.type === 'cancel') f.cancelled = true
  }
  return f
}

// All flights known at time t, from the base schedule plus the events seen so far.
export function knownFlights (flights, events, t) {
  const seen = events.filter(e => e.t <= t)
  const list = flights.slice()
  for (const e of seen) if (e.type === 'add') list.push(e.flight)
  return list.map(f => flightAt(f, seen.filter(e => e.flight === f.id), t)).sort((a, b) => a.std - b.std)
}

// Passengers of every flight in a run, given the events the caller knows about.
export function paxOfDay (flights, events, runSeed) {
  const out = []
  const byFlight = new Map()
  for (const e of events) if (e.flight && typeof e.flight === 'string') { if (!byFlight.has(e.flight)) byFlight.set(e.flight, []); byFlight.get(e.flight).push(e) }
  const list = flights.slice()
  for (const e of events) if (e.type === 'add') list.push(e.flight)
  for (const f of list) paxOf(f, byFlight.get(f.id) || [], runSeed, out)
  return out
}

// Passengers of one flight for one run. The random draws depend only on the
// run seed and the flight id, so every plan and every what-if sees the same
// people (common random numbers). evs are the events of this flight that the
// caller knows about; a change only moves a passenger if it was announced
// before the passenger left home (delay) or reached security (gate, cancel).
export function paxOf (base, evs, runSeed, out) {
  const r = rng(seedOf(runSeed, base.id))
  const final = flightAt(base, evs, Infinity)
  const drift = 1 + 0.05 * normal(r)
  const lean = normal(r) * 6 // the whole flight comes a little early or late
  const count = Math.min(final.seats, Math.round(final.pax * drift))
  const n = Math.max(count, Math.round(Math.max(base.pax, final.pax) * 1.2))
  const [mu, sd] = SHOWUP[base.type]
  const cancel = evs.find(e => e.type === 'cancel')
  for (let i = 0; i < n; i++) {
    const showup = Math.max(28, Math.min(240, mu + lean + sd * normal(r)))
    const svc = lognormal(r, SVC_MEAN, SVC_CV)
    if (i >= count) continue
    const leave = base.std - showup - 50
    let std = base.std
    for (const e of evs) if (e.type === 'delay' && e.t <= leave) std = e.std
    const t = std - showup
    if (cancel && cancel.t <= t) continue
    let zone = base.zone
    for (const e of evs) if (e.type === 'gate' && e.t <= t) zone = e.zone
    out.push({ t, svc, zone, f: base.id, std: final.std })
  }
}

// The roster a planner would write the week before: two-hour blocks, sized
// from the average day of the original schedule, a little lean.
export function makeRoster (flights, lean = 0.92) {
  const rate = {}
  for (const z of ZONES) rate[z] = new Float64Array(NSLOT)
  const RUNS = 30
  for (let k = 0; k < RUNS; k++) {
    for (const p of paxOfDay(flights, [], seedOf('roster', k))) rate[p.zone][slotOf(p.t)] += 1 / RUNS
  }
  const plan = {}
  for (const z of ZONES) {
    plan[z] = new Int8Array(NSLOT)
    for (let b = 0; b < NSLOT; b += 8) {
      let peak = 0
      for (let s = b; s < Math.min(NSLOT, b + 8); s++) peak = Math.max(peak, rate[z][s] * 4)
      const lanes = Math.max(ZONE_MIN[z], Math.min(ZONE_MAX[z], Math.ceil(peak / LANE_RATE * lean)))
      for (let s = b; s < Math.min(NSLOT, b + 8); s++) plan[z][s] = lanes
    }
  }
  return plan
}

export const clonePlan = p => Object.fromEntries(ZONES.map(z => [z, Int8Array.from(p[z])]))
