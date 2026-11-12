// Агент за симулации. It draws many possible futures of the next hours from
// what is known now (schedule, feed, people already in the queue) and runs
// each checkpoint queue under a staffing plan. The futures are drawn once per
// tick and reused for every what-if, so two plans are compared on the same
// passengers and the difference is the plan, not the noise.
import { rng, seedOf, lognormal, quantile, normal } from './rng.mjs'
import { ZONES, SLA, SVC_MEAN, SVC_CV, BOARD_CLOSE, RATE_SD, slotOf, paxOfDay } from './day.mjs'
import { runQueue } from './queue.mjs'

export const W_OVER = 4 // extra weight per minute above the SLA
export const W_MISS = 60 // a passenger who misses boarding, in wait-minute equivalents

export class SimAgent {
  constructor ({ runs = 120, seed = 'mc' } = {}) {
    this.runs = runs
    this.seed = seed
    this.evals = 0
    this.paxSimulated = 0
  }

  // flights: the base schedule; events: only those known now.
  prepare ({ flights, events, now, horizon = 180, observed = {} }) {
    const t1 = now + horizon
    this.now = now
    this.t1 = t1
    this.s0 = slotOf(now)
    this.s1 = slotOf(t1 - 1) + 1
    const near = flights.filter(f => f.std > now - 30 && f.std < t1 + 260)
    const nearIds = new Set(near.map(f => f.id))
    const evs = events.filter(e => e.type === 'add' ? e.flight.std < t1 + 260 : nearIds.has(e.flight))
    this.samples = Object.fromEntries(ZONES.map(z => [z, []]))
    this.init = Object.fromEntries(ZONES.map(z => [z, []]))
    const ns = this.s1 - this.s0
    this.flightLoad = Object.fromEntries(ZONES.map(z => [z, Array.from({ length: ns }, () => new Map())]))
    for (let k = 0; k < this.runs; k++) {
      const all = paxOfDay(near, evs, seedOf(this.seed, k))
      const byZ = Object.fromEntries(ZONES.map(z => [z, []]))
      for (const p of all) {
        if (p.t < now || p.t >= t1) continue
        byZ[p.zone].push(p)
        const m = this.flightLoad[p.zone][slotOf(p.t) - this.s0]
        m.set(p.f, (m.get(p.f) || 0) + 1 / this.runs)
      }
      for (const z of ZONES) {
        const speed = Math.exp(RATE_SD * normal(rng(seedOf(this.seed, k, 'speed', z))))
        for (const p of byZ[z]) p.svc *= speed
        byZ[z].sort((a, b) => a.t - b.t)
        this.samples[z].push(byZ[z])
        const r = rng(seedOf(this.seed, k, 'init', z))
        const q = []
        for (let i = 0; i < (observed[z] || 0); i++) q.push(lognormal(r, SVC_MEAN, SVC_CV) * speed)
        this.init[z].push(q)
      }
    }
    return this
  }

  // Forecast one checkpoint under a lane plan (Int8Array over the day).
  evalZone (z, lanes) {
    this.evals++
    const ns = this.s1 - this.s0
    const runs = this.runs
    const means = Array.from({ length: ns }, () => new Float64Array(runs))
    const counts = new Float64Array(ns)
    let cost = 0, missed = 0, waitSum = 0, paxN = 0
    for (let k = 0; k < runs; k++) {
      const pax = this.samples[z][k]
      const init = this.init[z][k]
      const start = runQueue(pax, lanes, this.now, init)
      this.paxSimulated += pax.length + init.length
      const sum = new Float64Array(ns), n = new Float64Array(ns)
      for (let j = 0; j < pax.length; j++) {
        const p = pax[j]
        const w = start[j] - p.t
        const s = slotOf(p.t) - this.s0
        sum[s] += w; n[s]++
        waitSum += w; paxN++
        cost += w + W_OVER * Math.max(0, w - SLA)
        if (start[j] + p.svc > p.std - BOARD_CLOSE) { missed++; cost += W_MISS }
      }
      // people already queued at "now" also wait; they count toward the first slot
      for (let i = 0; i < init.length; i++) {
        const w = (i + 1) * SVC_MEAN / Math.max(1, lanes[this.s0])
        cost += w + W_OVER * Math.max(0, w - SLA)
      }
      for (let s = 0; s < ns; s++) { means[s][k] = n[s] ? sum[s] / n[s] : 0; counts[s] += n[s] / runs }
    }
    const slots = []
    for (let s = 0; s < ns; s++) {
      const a = Array.from(means[s]).sort((x, y) => x - y)
      slots.push({
        s: this.s0 + s,
        p10: quantile(a, 0.1),
        p50: quantile(a, 0.5),
        p90: quantile(a, 0.9),
        pOver: a.filter(x => x > SLA).length / runs,
        pax: counts[s]
      })
    }
    return { zone: z, cost: cost / runs, missed: missed / runs, meanWait: paxN ? waitSum / paxN : 0, slots }
  }

  forecast (plan) {
    return Object.fromEntries(ZONES.map(z => [z, this.evalZone(z, plan[z])]))
  }

  // Which flights fill a checkpoint over a range of slots, largest first.
  contributors (z, sFrom, sTo) {
    const tot = new Map()
    for (let s = Math.max(sFrom, this.s0); s < Math.min(sTo, this.s1); s++) {
      for (const [f, c] of this.flightLoad[z][s - this.s0]) tot.set(f, (tot.get(f) || 0) + c)
    }
    const all = [...tot.values()].reduce((a, b) => a + b, 0) || 1
    return [...tot.entries()].map(([f, c]) => ({ f, pax: c, share: c / all })).sort((a, b) => b.pax - a.pax)
  }
}
