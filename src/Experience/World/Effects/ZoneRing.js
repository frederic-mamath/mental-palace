import * as THREE from 'three'

// Flat ring on the ground marking an interaction zone. Faint at rest; brightens and sends
// pulses inward when the character is inside (setActive).
export default class ZoneRing {
  constructor({ parent, radius, color = '#ffffff', y = 0.04 }) {
    this.radius = radius
    this.activity = 0
    this.target = 0

    const geometry = new THREE.RingGeometry(0.94, 1, 96)
    const createRing = () => {
      const ring = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false })
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = y
      parent.add(ring)
      return ring
    }

    this.ring = createRing()
    this.pulse = createRing()
  }

  setActive(active) {
    this.target = active ? 1 : 0
  }

  update(delta, elapsed) {
    this.activity += (this.target - this.activity) * (1 - Math.exp(-8 * delta))

    this.ring.scale.setScalar(this.radius * (1 + Math.sin(elapsed * 3) * 0.015 * this.activity))
    this.ring.material.opacity = 0.3 + 0.6 * this.activity

    const progress = (elapsed * 0.8) % 1
    this.pulse.scale.setScalar(this.radius * (1 - progress * 0.35))
    this.pulse.material.opacity = this.activity * (1 - progress) * 0.6
  }
}
