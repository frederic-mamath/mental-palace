import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { interactionKinds } from '../interactionKinds.js'

// Flat ring on the ground marking an interaction zone, styled by its kind (see interactionKinds.js).
// Faint at rest; brightens when the character is inside (setActive). Solid rings then send pulses inward;
// dashed rings turn, faster when active; double rings (an outer and an inner ring) send pulses outward.
export default class ZoneRing {
  constructor({ parent, radius, kind = 'experience', y = 0.04 }) {
    const { color, ringStyle } = interactionKinds[kind]
    this.radius = radius
    this.dashed = ringStyle === 'dashed'
    this.double = ringStyle === 'double'
    this.activity = 0
    this.target = 0

    const createRing = (geometry) => {
      const ring = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }))
      ring.rotation.x = -Math.PI / 2
      ring.position.y = y
      parent.add(ring)
      return ring
    }

    if (this.dashed) {
      // Dashes: short arcs filling 60% of the circumference
      const dashes = 16
      const slot = (Math.PI * 2) / dashes
      const arcs = Array.from({ length: dashes }, (_, i) => new THREE.RingGeometry(0.92, 1, 6, 1, i * slot, slot * 0.6))
      this.ring = createRing(mergeGeometries(arcs))
    } else {
      const geometry = new THREE.RingGeometry(0.94, 1, 96)
      this.ring = createRing(geometry)
      this.pulse = createRing(geometry)
      if (this.double) this.inner = createRing(new THREE.RingGeometry(0.72, 0.78, 96))
    }
  }

  setActive(active) {
    this.target = active ? 1 : 0
  }

  update(delta, elapsed) {
    this.activity += (this.target - this.activity) * (1 - Math.exp(-8 * delta))

    this.ring.scale.setScalar(this.radius * (1 + Math.sin(elapsed * 3) * 0.015 * this.activity))
    this.ring.material.opacity = 0.3 + 0.6 * this.activity

    if (this.dashed) {
      // The ring lies flat (rotated onto the ground), so turning around its local z spins it on the ground
      this.ring.rotation.z += delta * (0.25 + 0.9 * this.activity)
      return
    }

    const progress = (elapsed * 0.8) % 1
    if (this.double) {
      this.inner.scale.copy(this.ring.scale)
      this.inner.material.opacity = this.ring.material.opacity
      // From the inner ring out past the outer one
      this.pulse.scale.setScalar(this.radius * (0.75 + progress * 0.4))
    } else {
      this.pulse.scale.setScalar(this.radius * (1 - progress * 0.35))
    }
    this.pulse.material.opacity = this.activity * (1 - progress) * 0.6
  }
}
