// Агент за логистика. Each tick it reads the new feed items, asks the
// simulation agent for a forecast, finds the checkpoints about to break the
// queue target, asks for what-ifs (move a team, call a reserve team), sends
// the best one through the rule gate and, if it passes, alerts the staff.
import { ZONES, SLA, NOTICE, SLOT, slotOf, slotStart, NSLOT, DAY_START } from './day.mjs'
import { check, apply } from './gate.mjs'

export const RESERVE_COST = 260 // a reserve team on overtime, in wait-minute equivalents
export const MIN_GAIN = 40 // a move must save at least this many wait-minutes
export const MAX_ACTIONS = 3 // per tick
export const DONOR_P90 = 0.6 // the donor checkpoint must keep its P90 under 60% of the target

function hotspots (fc, sMin) {
  const out = []
  for (const z of ZONES) {
    const sl = fc[z].slots
    for (let i = 0; i < sl.length; i++) {
      const x = sl[i]
      if (x.s < sMin) continue
      if (x.pOver >= 0.3 || x.p90 > SLA) {
        let j = i
        while (j + 1 < sl.length && (sl[j + 1].pOver >= 0.3 || sl[j + 1].p90 > SLA)) j++
        out.push({ zone: z, s: x.s, sEnd: sl[j].s + 1, p90: Math.max(...sl.slice(i, j + 1).map(y => y.p90)), pOver: Math.max(...sl.slice(i, j + 1).map(y => y.pOver)), pax: sl.slice(i, j + 1).reduce((a, y) => a + y.pax, 0) })
        break
      }
    }
  }
  return out.sort((a, b) => a.s - b.s || b.pOver - a.pOver)
}

// Which feed items explain a checkpoint's load.
export function correlate (sim, flightsKnown, events, now, hs) {
  const top = sim.contributors(hs.zone, hs.s, hs.sEnd).slice(0, 4)
  const byId = new Map(flightsKnown.map(f => [f.id, f]))
  const flights = top.map(c => {
    const f = byId.get(c.f)
    const ev = events.filter(e => e.t <= now && (e.flight === c.f || e.flight?.id === c.f)).map(e => e.type)
    return { id: c.f, pax: Math.round(c.pax), share: c.share, std: f?.std, dest: f?.dest, events: ev }
  })
  const staff = events.find(e => e.type === 'staff' && e.t <= now && e.zone === hs.zone && e.from < hs.sEnd && e.to > hs.s)
  return { flights, staff: staff ? staff.id : null }
}

function stats (z, fc, s0, s1) {
  const sl = fc[z].slots.filter(x => x.s >= s0 && x.s < s1)
  return { p90: Math.max(0, ...sl.map(x => x.p90)), pOver: Math.max(0, ...sl.map(x => x.pOver)) }
}

// One decision step. Mutates plan and ctx.moves when an action is taken.
export function decide ({ sim, plan, ctx, flightsKnown, events, now, newEvents, log }) {
  const say = (from, to, kind, data) => log.push({ t: now, from, to, kind, ...data })
  for (const e of newEvents) say('feed', 'logistics', 'event', { event: e })
  say('logistics', 'sim', 'ask', { runs: sim.runs, horizon: Math.round(sim.t1 - now) })
  const t0 = performance.now()
  let fc = sim.forecast(plan)
  say('sim', 'logistics', 'forecast', { runs: sim.runs, ms: Math.round(performance.now() - t0), pax: Math.round(ZONES.reduce((a, z) => a + fc[z].slots.reduce((b, x) => b + x.pax, 0), 0)), hot: hotspots(fc, slotOf(now)).map(h => ({ zone: h.zone, s: h.s, p90: h.p90, pOver: h.pOver })) })
  const alerts = []
  const sMin = Math.ceil((now + NOTICE - DAY_START) / SLOT)
  const tried = new Set()
  for (let iter = 0; iter < MAX_ACTIONS; iter++) {
    const hs = hotspots(fc, sMin).find(h => !tried.has(h.zone + h.s))
    if (!hs) break
    tried.add(hs.zone + hs.s)
    const corr = correlate(sim, flightsKnown, events, now, hs)
    say('logistics', 'logistics', 'correlate', { zone: hs.zone, s: hs.s, corr })
    const cands = []
    const s0 = Math.max(sMin, hs.s - 1)
    for (const len of [3, 5, 8]) {
      const s1 = Math.min(NSLOT, Math.max(s0 + len, Math.min(hs.sEnd + 1, s0 + 12)))
      for (const from of ZONES) if (from !== hs.zone) cands.push({ kind: 'move', from, to: hs.zone, s0, s1 })
      cands.push({ kind: 'reserve', to: hs.zone, s0, s1: Math.min(NSLOT, s0 + Math.max(4, len)) })
    }
    const seen = new Set()
    let best = null, rejected = 0, evaluated = 0, unsafe = 0
    const tw = performance.now()
    for (const a of cands) {
      const key = JSON.stringify(a)
      if (seen.has(key)) continue
      seen.add(key)
      const g = check(a, { ...ctx, plan, now })
      if (!g.ok) { rejected++; continue }
      const trial = { ...plan, [a.to]: Int8Array.from(plan[a.to]) }
      if (a.kind === 'move') trial[a.from] = Int8Array.from(plan[a.from])
      apply(trial, a)
      const zs = a.kind === 'move' ? [a.from, a.to] : [a.to]
      const after = {}
      let delta = a.kind === 'reserve' ? RESERVE_COST * (a.s1 - a.s0) * SLOT / 60 : 0
      for (const z of zs) { after[z] = sim.evalZone(z, trial[z]); delta += after[z].cost - fc[z].cost }
      evaluated++
      // never fix one checkpoint by breaking another: the donor must stay well inside the target
      if (a.kind === 'move') {
        const d = stats(a.from, { [a.from]: after[a.from] }, a.s0 - 1, a.s1 + 2)
        if (d.p90 > DONOR_P90 * SLA || d.pOver > 0.1) { unsafe++; continue }
      }
      if (!best || delta < best.delta) best = { a, delta, after, gate: g }
    }
    say('logistics', 'sim', 'whatif', { n: evaluated, rejected, unsafe, ms: Math.round(performance.now() - tw) })
    if (!best || best.delta > -MIN_GAIN) { say('logistics', 'logistics', 'hold', { zone: hs.zone, s: hs.s, gain: best ? -best.delta : 0 }); continue }
    const a = best.a
    const before = stats(a.to, fc, a.s0, a.s1)
    const donorBefore = a.kind === 'move' ? stats(a.from, fc, a.s0, a.s1) : null
    apply(plan, a)
    if (a.kind === 'reserve') ctx.reservesUsed++
    const id = 'AL' + String(ctx.moves.length + 1).padStart(2, '0')
    ctx.moves.push({ ...a, id, t: now })
    fc = { ...fc, ...best.after }
    tried.delete(hs.zone + hs.s) // the same peak may need a second team
    const alert = {
      id, t: now, ...a, effective: slotStart(a.s0), until: slotStart(a.s1),
      gain: -best.delta, gate: best.gate.checks,
      target: { before, after: stats(a.to, fc, a.s0, a.s1) },
      donor: donorBefore ? { before: donorBefore, after: stats(a.from, fc, a.s0, a.s1) } : null,
      hotspot: { zone: hs.zone, s: hs.s, sEnd: hs.sEnd },
      corr, status: 'sent'
    }
    alerts.push(alert)
    say('gate', 'logistics', 'pass', { id, checks: best.gate.checks.length })
    say('logistics', 'staff', 'alert', { id })
  }
  return { fc, alerts }
}
