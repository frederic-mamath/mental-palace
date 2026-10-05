// Single source of truth for the island's outline, shared by the land meshes, the water's
// shoreline foam (as GLSL) and the character's movement limit, so they always line up.

export const island = {
  radius: 22, // average radius of the grass plateau
  beachWidth: 2.5, // sand ring beyond the plateau, before the water
  waterLevel: -0.9,
}

// Sum of sines around the circle: [frequency, amplitude, phase]. Integer frequencies keep it seamless.
const harmonics = [
  [2, 0.12, 0.5],
  [3, 0.07, 1.7],
  [5, 0.05, 2.3],
]

// Radius of the grass plateau at `angle` (radians, measured as Math.atan2(z, x))
export function islandRadius(angle) {
  let factor = 1
  for (const [frequency, amplitude, phase] of harmonics) factor += amplitude * Math.sin(frequency * angle + phase)
  return island.radius * factor
}

const float = (value) => value.toFixed(4)

export const islandRadiusGLSL = /* glsl */ `
float islandRadius(float angle) {
  return ${float(island.radius)} * (1.0${harmonics
    .map(([f, a, p]) => ` + ${float(a)} * sin(${float(f)} * angle + ${float(p)})`)
    .join('')});
}
`
