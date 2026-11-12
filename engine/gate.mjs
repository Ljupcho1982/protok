// The rule gate. Every staff move the logistics agent proposes passes through
// these checks in code before an alert can be sent. The agent cannot skip it.
import { ZONES, ZONE_MAX, ZONE_MIN, NOTICE, SLOT, slotStart, NSLOT } from './day.mjs'

export const MIN_STAY = 45 // minutes a moved team stays
export const MAX_STAY = 180
export const PINGPONG = 45 // no opposite move this close to an earlier one
export const RULES = ['zones', 'notice', 'stay', 'donorMin', 'targetMax', 'pool', 'pingpong', 'reserve']

// action: { kind: 'move'|'reserve', from?, to, s0, s1 }
// ctx: { plan, pool (Int16Array per slot), now, moves: [past actions], reservesUsed, reserveLimit }
export function check (a, ctx) {
  const res = []
  const add = (id, ok, note = '') => res.push({ id, ok: !!ok, note })
  const range = []
  const validRange = Number.isInteger(a.s0) && Number.isInteger(a.s1) && a.s0 >= 0 && a.s1 <= NSLOT && a.s1 > a.s0
  if (validRange) for (let s = a.s0; s < a.s1; s++) range.push(s)
  add('zones', validRange && ZONES.includes(a.to) && (a.kind === 'reserve' ? !a.from : (ZONES.includes(a.from) && a.from !== a.to)) && (a.kind === 'move' || a.kind === 'reserve'))
  add('notice', validRange && slotStart(a.s0) >= ctx.now + NOTICE, validRange ? `${slotStart(a.s0) - ctx.now} min` : '')
  const len = validRange ? (a.s1 - a.s0) * SLOT : 0
  add('stay', len >= MIN_STAY && len <= MAX_STAY, `${len} min`)
  add('donorMin', a.kind !== 'move' || (validRange && ZONES.includes(a.from) && range.every(s => ctx.plan[a.from][s] - 1 >= ZONE_MIN[a.from])))
  add('targetMax', validRange && ZONES.includes(a.to) && range.every(s => ctx.plan[a.to][s] + 1 <= ZONE_MAX[a.to]))
  const after = s => ZONES.reduce((x, z) => x + ctx.plan[z][s], 0) + (a.kind === 'reserve' ? 1 : 0)
  add('pool', validRange && range.every(s => after(s) <= ctx.pool[s] + reserveLanes(ctx.moves, s) + (a.kind === 'reserve' ? 1 : 0)))
  const close = PINGPONG / SLOT
  add('pingpong', a.kind !== 'move' || !ctx.moves.some(m => m.kind === 'move' && m.from === a.to && m.to === a.from && m.s1 + close > a.s0 && a.s1 + close > m.s0))
  add('reserve', a.kind !== 'reserve' || ctx.reservesUsed < ctx.reserveLimit, `${ctx.reservesUsed}/${ctx.reserveLimit}`)
  return { ok: res.every(r => r.ok), checks: res }
}

function reserveLanes (moves, s) {
  return moves.filter(m => m.kind === 'reserve' && s >= m.s0 && s < m.s1).length
}

export function apply (plan, a) {
  for (let s = a.s0; s < a.s1; s++) {
    plan[a.to][s] += 1
    if (a.kind === 'move') plan[a.from][s] -= 1
  }
}
