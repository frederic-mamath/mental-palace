import * as THREE from 'three'

// City coordinates: u runs along the flight path (from the entrepreneur island toward the city),
// v across it, both centered on the city island. Streets and the runway follow these axes.
export function createCityFrame(from, to) {
  const u = new THREE.Vector2(to.x - from.x, to.z - from.z).normalize()
  const v = new THREE.Vector2(-u.y, u.x)

  return {
    u,
    v,
    // rotation.y turning an object's local +x toward +u (its local +z then points along +v)
    yaw: Math.atan2(-u.y, u.x),
    toWorld(along, across, y = 0, target = new THREE.Vector3()) {
      return target.set(to.x + u.x * along + v.x * across, y, to.z + u.y * along + v.y * across)
    },
  }
}
