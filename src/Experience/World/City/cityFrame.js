import * as THREE from 'three'

// Flight-path coordinates: u runs along the line from the entrepreneur island toward the city, v across
// it. Centered on `origin` (the city by default; the entrepreneur island for its airstrip). City streets
// and both runways follow these axes, so planes fly in a straight line from one runway to the other.
export function createCityFrame(from, to, origin = to) {
  const u = new THREE.Vector2(to.x - from.x, to.z - from.z).normalize()
  const v = new THREE.Vector2(-u.y, u.x)

  return {
    u,
    v,
    // rotation.y turning an object's local +x toward +u (its local +z then points along +v)
    yaw: Math.atan2(-u.y, u.x),
    toWorld(along, across, y = 0, target = new THREE.Vector3()) {
      return target.set(origin.x + u.x * along + v.x * across, y, origin.z + u.y * along + v.y * across)
    },
    // Inverse of toWorld: { along, across } of a world point
    toFrame(x, z) {
      const dx = x - origin.x
      const dz = z - origin.z
      return { along: dx * u.x + dz * u.y, across: dx * v.x + dz * v.y }
    },
  }
}
