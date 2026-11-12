// Seeded random numbers. Every draw in Проток comes from here, so a seed fixes
// a whole day, and the same seed gives the same passengers to every what-if.
export function rng (seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedOf (...xs) {
  let h = 2166136261
  for (const x of xs) {
    const s = String(x)
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
    h ^= 0x9e37; h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function normal (r) {
  let u = 0
  while (u === 0) u = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}

// Lognormal with a given mean and coefficient of variation.
export function lognormal (r, mean, cv) {
  const s2 = Math.log(1 + cv * cv)
  return mean * Math.exp(Math.sqrt(s2) * normal(r) - s2 / 2)
}

export function quantile (sorted, q) {
  if (!sorted.length) return 0
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}
