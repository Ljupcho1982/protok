// The operating loop. A clock advances in 15-minute ticks; the feed delivers
// what changed; the logistics agent asks the simulation agent and sends alerts
// through the gate; the "real" day (one hidden draw of passengers that no
// agent sees) is played under the plan actually in force. A shadow copy of the
// same day is played under the original roster, so the difference is the agent.
import { ZONES, RATE_SD, DAY_START, DAY_END, SLOT, NSLOT, SLA, BOARD_CLOSE, slotOf, slotStart, makeSchedule, makeEvents, makeRoster, knownFlights, paxOfDay, clonePlan, normalizeFlights } from './day.mjs'
import { seedOf, rng, normal } from './rng.mjs'
import { runQueue } from './queue.mjs'
import { SimAgent } from './montecarlo.mjs'
import { decide } from './logistics.mjs'

export function realize (paxByZone, plan, now = Infinity) {
  const out = {}
  for (const z of ZONES) {
    const pax = paxByZone[z]
    const start = runQueue(pax, plan[z], DAY_START - 120)
    const sum = new Float64Array(NSLOT), n = new Float64Array(NSLOT), over = new Float64Array(NSLOT)
    let waitSum = 0, cnt = 0, overN = 0, missed = 0, maxW = 0, queueNow = 0, waitingNow = 0
    const waits = []
    for (let j = 0; j < pax.length; j++) {
      const p = pax[j]
      if (p.t > now) break
      const done = start[j] <= now
      if (!done) { queueNow++; waitingNow = Math.max(waitingNow, now - p.t) }
      const w = Math.min(start[j], now) - p.t // what can be seen at "now"
      const s = slotOf(p.t)
      sum[s] += w; n[s]++
      if (w > SLA) { over[s]++ }
      if (!done) continue
      waits.push(w)
      waitSum += w; cnt++
      if (w > SLA) overN++
      if (w > maxW) maxW = w
      if (start[j] + p.svc > p.std - BOARD_CLOSE) missed++
    }
    waits.sort((a, b) => a - b)
    out[z] = {
      slotMean: Array.from(sum, (x, i) => n[i] ? x / n[i] : null),
      slotPax: Array.from(n), slotOver: Array.from(over),
      served: cnt, meanWait: cnt ? waitSum / cnt : 0, totalWait: waitSum, over: overN,
      p95: waits.length ? waits[Math.floor(waits.length * 0.95)] : 0,
      maxWait: maxW, missed, queueNow, waitingNow
    }
  }
  const tot = { served: 0, totalWait: 0, over: 0, missed: 0, maxWait: 0 }
  for (const z of ZONES) { tot.served += out[z].served; tot.totalWait += out[z].totalWait; tot.over += out[z].over; tot.missed += out[z].missed; tot.maxWait = Math.max(tot.maxWait, out[z].maxWait) }
  tot.meanWait = tot.served ? tot.totalWait / tot.served : 0
  out.total = tot
  return out
}

export class Ops {
  // flights: an optional schedule of your own (see normalizeFlights); feed: false drops the scripted live feed.
  constructor ({ seed = 1, schedSeed = 7, agent = true, runs = 100, horizon = 180, reserveLimit = 2, flights = null, feed = true } = {}) {
    this.opts = { seed, schedSeed, agent, runs, horizon, reserveLimit, custom: !!flights, feed }
    this.flights = flights ? normalizeFlights(flights) : makeSchedule(schedSeed)
    this.events = feed ? makeEvents(this.flights) : []
    this.roster = makeRoster(this.flights)
    this.plan = clonePlan(this.roster)
    this.basePlan = clonePlan(this.roster)
    this.pool = new Int16Array(NSLOT)
    for (let s = 0; s < NSLOT; s++) this.pool[s] = ZONES.reduce((a, z) => a + this.roster[z][s], 0)
    const truth = paxOfDay(this.flights, this.events, seedOf('truth', seed))
    this.truthPax = Object.fromEntries(ZONES.map(z => [z, truth.filter(p => p.zone === z).sort((a, b) => a.t - b.t)]))
    // the real screening speed of each checkpoint today, hidden from the agents
    this.speed = Object.fromEntries(ZONES.map(z => [z, Math.exp(RATE_SD * normal(rng(seedOf('truthspeed', seed, z))))]))
    for (const z of ZONES) for (const p of this.truthPax[z]) p.svc *= this.speed[z]
    this.ctx = { pool: this.pool, moves: [], reservesUsed: 0, reserveLimit }
    this.sim = new SimAgent({ runs, seed: 'mc' + seed })
    this.now = DAY_START
    this.alerts = []
    this.log = []
    this.fc = null
    this.fcAt = null
    this.history = [] // forecast p50/p90 as issued 60 min ahead, to check calibration
    this.done = false
    this.refresh()
  }

  get known () { return this.events.filter(e => e.t <= this.now) }
  get flightsKnown () { return knownFlights(this.flights, this.events, this.now) }

  refresh () {
    this.truth = realize(this.truthPax, this.plan, this.now)
    this.shadow = realize(this.truthPax, this.basePlan, this.now)
  }

  tick () {
    if (this.done) return
    const prev = this.now
    this.now = Math.min(DAY_END, this.now + SLOT)
    const fresh = this.events.filter(e => e.t > prev && e.t <= this.now)
    for (const e of fresh) {
      if (e.type !== 'staff') continue
      for (let s = e.from; s < e.to; s++) {
        for (const p of [this.plan, this.basePlan]) p[e.zone][s] = Math.max(0, p[e.zone][s] + e.delta)
        this.pool[s] += e.delta
      }
    }
    for (const a of this.alerts) if (a.status === 'sent' && a.t < this.now) a.status = 'ack'
    this.refresh()
    if (this.now >= DAY_END) { this.done = true; return }
    const observed = Object.fromEntries(ZONES.map(z => [z, this.truth[z].queueNow]))
    this.sim.prepare({ flights: this.flights, events: this.known, now: this.now, horizon: this.opts.horizon, observed })
    const flightsKnown = this.flightsKnown
    if (this.opts.agent) {
      const r = decide({ sim: this.sim, plan: this.plan, ctx: this.ctx, flightsKnown, events: this.events, now: this.now, newEvents: fresh, log: this.log })
      this.fc = r.fc
      this.alerts.push(...r.alerts)
      if (r.alerts.length) this.refresh()
    } else {
      this.fc = this.sim.forecast(this.plan)
    }
    this.fcAt = this.now
    for (const z of ZONES) {
      const x = this.fc[z].slots.find(y => slotStart(y.s) >= this.now + 60)
      if (x) this.history.push({ zone: z, s: x.s, p10: x.p10, p50: x.p50, p90: x.p90 })
    }
  }

  // How often the real wait fell inside the forecast band issued an hour before.
  calibration () {
    let inside = 0, below90 = 0, n = 0
    for (const h of this.history) {
      if (slotStart(h.s + 1) > this.now) continue
      const real = this.truth[h.zone].slotMean[h.s]
      if (real == null || this.truth[h.zone].slotPax[h.s] < 10) continue
      n++
      if (real >= h.p10 && real <= h.p90) inside++
      if (real <= h.p90) below90++
    }
    return { n, inside: n ? inside / n : 0, below90: n ? below90 / n : 0 }
  }

  runToEnd () { while (!this.done) this.tick(); return this }
}
