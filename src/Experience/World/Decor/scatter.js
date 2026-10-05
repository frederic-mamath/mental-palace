// Deterministic random (mulberry32): the same seed always gives the same island layout.
export function createRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const range = (random, min, max) => min + random() * (max - min)

// Random point in a band that follows an island's coastline (an IslandShape). Offsets are relative to
// the plateau edge: negative is inland, positive is beach and sea. `from: null` starts at the island center.
// `angle` is around the island's center, e.g. to face things outward.
export function sampleBand(random, island, { from = null, to }) {
  const angle = random() * Math.PI * 2
  const edge = island.radiusAt(angle)
  const inner = from === null ? 0 : edge + from
  const outer = edge + to
  // sqrt keeps the density even across the band instead of crowding the inner edge
  const radius = Math.sqrt(inner * inner + random() * (outer * outer - inner * inner))
  return { x: island.center.x + Math.cos(angle) * radius, z: island.center.z + Math.sin(angle) * radius, angle }
}

// Rejection sampling: keeps points outside `avoid` circles ({ position, radius }) and at least `spacing` apart.
export function scatter({ random, count, sample, avoid = [], spacing = 0, attempts = count * 30 }) {
  const points = []

  for (let i = 0; i < attempts && points.length < count; i++) {
    const point = sample(random)
    const blocked = avoid.some(({ position, radius }) => Math.hypot(point.x - position.x, point.z - position.z) < radius)
    if (blocked) continue
    if (spacing > 0 && points.some((other) => Math.hypot(point.x - other.x, point.z - other.z) < spacing)) continue
    points.push(point)
  }

  return points
}
