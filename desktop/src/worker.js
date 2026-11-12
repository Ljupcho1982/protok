// Worker body. The build puts the engine source in front of this file, so Ops, ZONES, NSLOT and RULES are in scope.
let ops = null
let logSent = 0

function snapshot () {
  const fc = ops.fc && Object.fromEntries(ZONES.map(z => [z, { slots: ops.fc[z].slots, cost: ops.fc[z].cost }]))
  const pick = r => Object.fromEntries([...ZONES.map(z => [z, r[z]]), ['total', r.total]])
  const log = ops.log.slice(logSent)
  logSent = ops.log.length
  return {
    now: ops.now, done: ops.done,
    flights: ops.flightsKnown, events: ops.known,
    plan: Object.fromEntries(ZONES.map(z => [z, Array.from(ops.plan[z])])),
    base: Object.fromEntries(ZONES.map(z => [z, Array.from(ops.basePlan[z])])),
    truth: pick(ops.truth), shadow: pick(ops.shadow),
    fc, alerts: ops.alerts, log,
    reserves: { used: ops.ctx.reservesUsed, limit: ops.ctx.reserveLimit },
    calib: ops.calibration(),
    sim: { evals: ops.sim.evals, pax: ops.sim.paxSimulated, runs: ops.sim.runs },
    nslot: NSLOT, rules: RULES
  }
}

self.onmessage = (e) => {
  const m = e.data
  if (m.type === 'reset') {
    ops = new Ops(m.opts || {})
    logSent = 0
    self.postMessage({ type: 'state', state: snapshot(), reset: true })
  } else if (m.type === 'tick') {
    const n = m.n || 1
    for (let i = 0; i < n && !ops.done; i++) ops.tick()
    self.postMessage({ type: 'state', state: snapshot() })
  } else if (m.type === 'jump') {
    let reset = false
    if (!ops || m.fresh || m.to < ops.now) { ops = new Ops(m.opts || {}); logSent = 0; reset = true }
    let k = 0
    while (!ops.done && ops.now < m.to) {
      ops.tick()
      if (++k % 4 === 0 && ops.now < m.to) { self.postMessage({ type: 'state', state: snapshot(), reset, partial: true, target: m.to }); reset = false }
    }
    self.postMessage({ type: 'state', state: snapshot(), reset, jumped: true })
  } else if (m.type === 'analyze') {
    // A whole day on the user's schedule: with the agent and on the roster alone, plus the agent's moves.
    try {
      const o = new Ops(m.opts || {})
      let k = 0
      while (!o.done) { o.tick(); if (++k % 6 === 0) self.postMessage({ type: 'aprog', now: o.now }) }
      const pz = r => Object.fromEntries([...ZONES.map(z => [z, { slotMean: r[z].slotMean, slotPax: r[z].slotPax, slotOver: r[z].slotOver, meanWait: r[z].meanWait, over: r[z].over, missed: r[z].missed, maxWait: r[z].maxWait, p95: r[z].p95, served: r[z].served }]), ['total', r.total]])
      self.postMessage({
        type: 'analysis', flights: o.flights, events: o.events, alerts: o.alerts,
        plan: Object.fromEntries(ZONES.map(z => [z, Array.from(o.plan[z])])),
        base: Object.fromEntries(ZONES.map(z => [z, Array.from(o.basePlan[z])])),
        truth: pz(o.truth), shadow: pz(o.shadow), calib: o.calibration(), opts: o.opts,
        sim: { evals: o.sim.evals, pax: o.sim.paxSimulated }
      })
    } catch (err) {
      self.postMessage({ type: 'aerror', message: String(err && err.message || err) })
    }
  } else if (m.type === 'bench') {
    const rows = []
    for (let i = 0; i < m.days; i++) {
      const seed = 100 + i
      const o = new Ops({ ...(m.opts || {}), seed, runs: m.runs || 60 }).runToEnd()
      const pickT = r => ({ meanWait: r.total.meanWait, over: r.total.over, missed: r.total.missed, maxWait: r.total.maxWait, served: r.total.served })
      rows.push({ seed, agent: pickT(o.truth), roster: pickT(o.shadow), alerts: o.alerts.length, reserves: o.ctx.reservesUsed, calib: o.calibration() })
      self.postMessage({ type: 'bench', rows: rows.slice(), done: i + 1, days: m.days })
    }
  }
}
