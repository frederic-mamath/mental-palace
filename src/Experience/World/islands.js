// Single source of truth for the islands' outlines, shared by the land meshes, the water's
// shoreline foam (as generated GLSL), decor placement and the character's movement limits,
// so they always line up.

export const sea = {
  waterLevel: -0.9,
}

const float = (value) => value.toFixed(4)

export class IslandShape {
  // harmonics: sum of sines around the circle, [frequency, amplitude, phase]; integer frequencies keep it seamless
  constructor({ name, center = { x: 0, z: 0 }, radius, beachWidth, harmonics }) {
    this.name = name
    this.center = center
    this.radius = radius // average radius of the plateau
    this.beachWidth = beachWidth // sand ring beyond the plateau, before the water
    this.harmonics = harmonics
  }

  // Radius of the plateau at `angle` (radians around the island's center, measured as Math.atan2(dz, dx))
  radiusAt(angle) {
    let factor = 1
    for (const [frequency, amplitude, phase] of this.harmonics) factor += amplitude * Math.sin(frequency * angle + phase)
    return this.radius * factor
  }

  angleOf(x, z) {
    return Math.atan2(z - this.center.z, x - this.center.x)
  }

  // Signed distance to the plateau edge along the radius: negative inland, positive on the beach and sea
  edgeDistance(x, z) {
    return Math.hypot(x - this.center.x, z - this.center.z) - this.radiusAt(this.angleOf(x, z))
  }

  // Pulls `position` (a Vector3, edited in place) back inside the outline grown by `offset`
  clamp(position, offset) {
    const dx = position.x - this.center.x
    const dz = position.z - this.center.z
    const distance = Math.hypot(dx, dz)
    const limit = this.radiusAt(Math.atan2(dz, dx)) + offset
    if (distance <= limit) return

    position.x = this.center.x + (dx * limit) / distance
    position.z = this.center.z + (dz * limit) / distance
  }

  get glslFunction() {
    return `islandRadius_${this.name}`
  }

  get glsl() {
    const terms = this.harmonics.map(([f, a, p]) => ` + ${float(a)} * sin(${float(f)} * angle + ${float(p)})`).join('')
    return `float ${this.glslFunction}(float angle) { return ${float(this.radius)} * (1.0${terms}); }`
  }
}

export const islands = {
  entrepreneur: new IslandShape({
    name: 'entrepreneur',
    radius: 22,
    beachWidth: 2.5,
    harmonics: [
      [2, 0.12, 0.5],
      [3, 0.07, 1.7],
      [5, 0.05, 2.3],
    ],
  }),
  // Paris-inspired city, 110 units north-west: in view behind the Double Tap phone from the spawn point.
  // Its street grid and airport runway are aligned with the line between the two islands (the flight path).
  city: new IslandShape({
    name: 'city',
    center: { x: -88, z: -66 },
    radius: 33,
    beachWidth: 0.8, // a narrow stone ledge along the quays, not a beach
    harmonics: [
      [2, 0.06, 1.1],
      [3, 0.04, 0.2],
    ],
  }),
}

// GLSL `vec2 shoreline(vec2 p)`: x = distance from p to the nearest island's waterline (negative on land),
// y = the angle of p around that island (for effects that vary along the coast)
export function shorelineGLSL(shapes) {
  const candidates = shapes
    .map(
      (shape) => /* glsl */ `
  {
    vec2 offset = p - vec2(${float(shape.center.x)}, ${float(shape.center.z)});
    float angle = atan(offset.y, offset.x);
    float shoreDistance = length(offset) - ${shape.glslFunction}(angle) - ${float(shape.beachWidth)};
    if (shoreDistance < nearest.x) nearest = vec2(shoreDistance, angle);
  }`
    )
    .join('')

  return /* glsl */ `
${shapes.map((shape) => shape.glsl).join('\n')}

vec2 shoreline(vec2 p) {
  vec2 nearest = vec2(1e6, 0.0);${candidates}
  return nearest;
}
`
}
