// node --test test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ZONES, ZONE_MAX, ZONE_MIN, NSLOT, NOTICE, slotOf, slotStart, makeSchedule, makeEvents, makeRoster, paxOf, paxOfDay, clonePlan } from './engine/day.mjs'
import { runQueue } from './engine/queue.mjs'
import { SimAgent } from './engine/montecarlo.mjs'
import { check, apply, RULES } from './engine/gate.mjs'
import { Ops } from './engine/os.mjs'
import { rng } from './engine/rng.mjs'

const flights = makeSchedule(7)
const events = makeEvents(flights)

test('the day is the same for the same seed', () => {
  assert.deepEqual(makeSchedule(7), flights)
  assert.deepEqual(makeEvents(makeSchedule(7)), events)
  const a = paxOfDay(flights, events, 42), b = paxOfDay(flights, events, 42)
  assert.equal(a.length, b.length)
  assert.deepEqual(a.slice(0, 50), b.slice(0, 50))
  assert.ok(flights.length >= 50 && events.length >= 7)
})

test('queue: one lane, known service times', () => {
  const lanes = new Int8Array(NSLOT).fill(1)
  const pax = [{ t: 300, svc: 2 }, { t: 300, svc: 2 }, { t: 301, svc: 2 }]
  const s = runQueue(pax, lanes, 0)
  assert.deepEqual(Array.from(s), [300, 302, 304])
})

test('queue: a closed checkpoint waits for the next opening', () => {
  const lanes = new Int8Array(NSLOT)
  lanes[slotOf(330)] = 1
  const s = runQueue([{ t: 300, svc: 1 }], lanes, 0)
  assert.equal(s[0], slotStart(slotOf(330)))
})

test('queue: more lanes never make the wait longer on the same passengers', () => {
  const pax = paxOfDay(flights, [], 9).filter(p => p.zone === 'B').sort((a, b) => a.t - b.t)
  const p = makeRoster(flights).B
  const more = Int8Array.from(p, v => v + 1)
  const sum = l => runQueue(pax, l, 0).reduce((a, s, j) => a + s - pax[j].t, 0)
  assert.ok(sum(more) <= sum(p))
})

test('feed: a late delay does not move people who already left home', () => {
  const f = flights.find(x => x.type === 'short')
  const early = [{ t: f.std - 400, type: 'delay', flight: f.id, std: f.std + 60 }]
  const late = [{ t: f.std - 30, type: 'delay', flight: f.id, std: f.std + 60 }]
  const none = [], a = [], b = [], c = []
  paxOf(f, none, 5, a); paxOf(f, early, 5, b); paxOf(f, late, 5, c)
  assert.equal(a.length, b.length)
  for (let i = 0; i < a.length; i++) { assert.equal(b[i].t, a[i].t + 60); assert.equal(c[i].t, a[i].t) }
})

test('feed: a cancellation stops passengers who had not reached security', () => {
  const f = flights[10]
  const out = []
  paxOf(f, [{ t: f.std - 300, type: 'cancel', flight: f.id }], 5, out)
  assert.equal(out.length, 0)
})

test('simulation agent: common random numbers give the same answer twice', () => {
  const sim = new SimAgent({ runs: 40, seed: 'x' }).prepare({ flights, events: [], now: 360, horizon: 180 })
  const plan = makeRoster(flights)
  assert.equal(sim.evalZone('A', plan.A).cost, sim.evalZone('A', plan.A).cost)
  const more = Int8Array.from(plan.A, v => v + 1)
  assert.ok(sim.evalZone('A', more).cost <= sim.evalZone('A', plan.A).cost)
})

const ROSTER = makeRoster(flights)
const ctx0 = () => {
  const plan = clonePlan(ROSTER)
  const pool = new Int16Array(NSLOT)
  for (let s = 0; s < NSLOT; s++) pool[s] = ZONES.reduce((a, z) => a + plan[z][s], 0)
  return { plan, pool, now: 600, moves: [], reservesUsed: 0, reserveLimit: 2 }
}
const failed = r => r.checks.filter(c => !c.ok).map(c => c.id)

test('gate: every rule stops what it should', () => {
  const c = ctx0()
  const s0 = slotOf(c.now + 30)
  const donor = ZONES.find(z => c.plan[z][s0] > ZONE_MIN[z] + 1)
  const target = ZONES.find(z => z !== donor && c.plan[z][s0] < ZONE_MAX[z])
  assert.ok(check({ kind: 'move', from: donor, to: target, s0, s1: s0 + 4 }, c).ok)
  assert.ok(failed(check({ kind: 'move', from: donor, to: donor, s0, s1: s0 + 4 }, c)).includes('zones'))
  assert.ok(failed(check({ kind: 'move', from: donor, to: target, s0: slotOf(c.now), s1: slotOf(c.now) + 4 }, c)).includes('notice'))
  assert.ok(failed(check({ kind: 'move', from: donor, to: target, s0, s1: s0 + 2 }, c)).includes('stay'))
  assert.ok(failed(check({ kind: 'move', from: donor, to: target, s0, s1: s0 + 13 }, c)).includes('stay'))
  const low = clonePlan(c.plan); for (let s = 0; s < NSLOT; s++) low[donor][s] = ZONE_MIN[donor]
  assert.ok(failed(check({ kind: 'move', from: donor, to: target, s0, s1: s0 + 4 }, { ...c, plan: low })).includes('donorMin'))
  const full = clonePlan(c.plan); for (let s = 0; s < NSLOT; s++) full[target][s] = ZONE_MAX[target]
  assert.ok(failed(check({ kind: 'move', from: donor, to: target, s0, s1: s0 + 4 }, { ...c, plan: full })).includes('targetMax'))
  const moves = [{ kind: 'move', from: target, to: donor, s0, s1: s0 + 4 }]
  assert.ok(failed(check({ kind: 'move', from: donor, to: target, s0: s0 + 5, s1: s0 + 9 }, { ...c, moves })).includes('pingpong'))
  assert.ok(failed(check({ kind: 'reserve', to: target, s0, s1: s0 + 4 }, { ...c, reservesUsed: 2 })).includes('reserve'))
  const tight = { ...c, pool: Int16Array.from(c.pool, v => v - 1) }
  assert.ok(failed(check({ kind: 'move', from: donor, to: target, s0, s1: s0 + 4 }, tight)).includes('pool'))
  assert.equal(RULES.length, 8)
})

test('gate: 20,000 random proposals, nothing accepted breaks the invariants', () => {
  const r = rng(77)
  let accepted = 0
  for (let i = 0; i < 20000; i++) {
    const c = ctx0()
    c.now = 240 + Math.floor(r() * 1100)
    const z = () => ['A', 'B', 'C', 'D', '', null][Math.floor(r() * 6)]
    const s0 = Math.floor(r() * (NSLOT + 4)) - 2
    const a = { kind: r() < 0.7 ? 'move' : r() < 0.9 ? 'reserve' : 'drop', from: r() < 0.9 ? z() : undefined, to: z(), s0, s1: s0 + Math.floor(r() * 16) - 2 }
    if (r() < 0.1) a.s0 = 1.5
    const g = check(a, c)
    if (!g.ok) continue
    accepted++
    apply(c.plan, a)
    assert.ok(slotStart(a.s0) >= c.now + NOTICE)
    for (let s = 0; s < NSLOT; s++) {
      let tot = 0
      for (const q of ZONES) { assert.ok(c.plan[q][s] >= ZONE_MIN[q] && c.plan[q][s] <= ZONE_MAX[q]); tot += c.plan[q][s] }
      assert.ok(tot <= c.pool[s] + (a.kind === 'reserve' && s >= a.s0 && s < a.s1 ? 1 : 0))
    }
  }
  assert.ok(accepted > 100, 'some legal proposals were accepted: ' + accepted)
})

test('a full day: the plan stays legal and the agent beats the roster', () => {
  const o = new Ops({ seed: 1, runs: 60 }).runToEnd()
  for (let s = 0; s < NSLOT; s++) {
    let tot = 0
    for (const z of ZONES) { assert.ok(o.plan[z][s] <= ZONE_MAX[z]); tot += o.plan[z][s] }
    const res = o.ctx.moves.filter(m => m.kind === 'reserve' && s >= m.s0 && s < m.s1).length
    assert.ok(tot <= o.pool[s] + res)
  }
  for (const a of o.alerts) { assert.ok(a.effective >= a.t + NOTICE); assert.ok(a.gate.every(c => c.ok)) }
  assert.ok(o.ctx.reservesUsed <= 2)
  assert.ok(o.truth.total.over < o.shadow.total.over)
  assert.equal(o.truth.total.served, o.shadow.total.served)
})

test('benchmark: 10 days with and without the agent', () => {
  const rows = []
  for (let i = 0; i < 10; i++) {
    const o = new Ops({ seed: 100 + i, runs: 60 }).runToEnd()
    rows.push({ a: o.truth.total, b: o.shadow.total, n: o.alerts.length, cal: o.calibration() })
  }
  const sum = k => rows.reduce((x, r) => x + k(r), 0)
  const line = `wait ${(sum(r => r.a.meanWait) / 10).toFixed(2)} vs ${(sum(r => r.b.meanWait) / 10).toFixed(2)} min; over 10 min ${sum(r => r.a.over)} vs ${sum(r => r.b.over)}; boarding at risk ${sum(r => r.a.missed)} vs ${sum(r => r.b.missed)}; max ${Math.max(...rows.map(r => r.a.maxWait)).toFixed(1)} vs ${Math.max(...rows.map(r => r.b.maxWait)).toFixed(1)}; alerts ${sum(r => r.n)}; coverage P10-P90 ${(sum(r => r.cal.inside * r.cal.n) / sum(r => r.cal.n) * 100).toFixed(0)}%, under P90 ${(sum(r => r.cal.below90 * r.cal.n) / sum(r => r.cal.n) * 100).toFixed(0)}%`
  console.log('BENCH ' + line)
  for (const r of rows) console.log(`  day: over ${r.a.over} vs ${r.b.over}, missed ${r.a.missed} vs ${r.b.missed}, alerts ${r.n}`)
  assert.ok(sum(r => r.a.over) < sum(r => r.b.over))
  assert.ok(sum(r => r.a.missed) <= sum(r => r.b.missed))
})
