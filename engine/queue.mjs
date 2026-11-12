// One security checkpoint as a multi-lane queue. Lanes open and close at
// 15-minute slot boundaries; a passenger takes the lane that can start them
// first. Pure function: same passengers and same plan give the same waits.
import { slotOf, slotStart, NSLOT } from './day.mjs'

const MAXL = 8

function openFrom (lanes, i, s) {
  let k = slotOf(s)
  if (lanes[k] > i) return s
  for (k = k + 1; k < NSLOT; k++) if (lanes[k] > i) return slotStart(k)
  return Infinity
}

// pax must be sorted by t. init is a list of service times for passengers
// already waiting at t0. Returns the start time of each passenger.
export function runQueue (pax, lanes, t0 = 0, init = []) {
  const free = new Float64Array(MAXL).fill(t0)
  const serve = (t, svc) => {
    let best = -1, bestS = Infinity
    for (let i = 0; i < MAXL; i++) {
      const s = openFrom(lanes, i, Math.max(t, free[i]))
      if (s < bestS) { bestS = s; best = i }
    }
    if (best < 0) { bestS = t + 600; best = 0 } // no lane all day: count it as lost
    free[best] = bestS + svc
    return bestS
  }
  for (const svc of init) serve(t0, svc)
  const start = new Float64Array(pax.length)
  for (let j = 0; j < pax.length; j++) start[j] = serve(pax[j].t, pax[j].svc)
  return start
}
