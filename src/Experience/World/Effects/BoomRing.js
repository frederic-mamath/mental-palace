import * as THREE from 'three'
import Experience from '../../Experience.js'

// Flat "sonic boom" ring bursting out horizontally from a take-off point, then fading.
// Horizontal so it reads as an expanding ellipse from the elevated camera, whatever the dash direction.
// Pooled so rapid dashes don't cut each other short.
export default class BoomRing {
  constructor({ count = 3, lifetime = 0.4, startRadius = 1.8, endRadius = 6, color = '#ffffff' } = {}) {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.lifetime = lifetime
    this.startRadius = startRadius
    this.endRadius = endRadius
    this.next = 0

    const geometry = new THREE.RingGeometry(0.86, 1, 64)
    this.rings = Array.from({ length: count }, () => {
      const ring = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide })
      )
      ring.rotation.x = -Math.PI / 2
      ring.visible = false
      ring.userData.age = 0
      this.scene.add(ring)
      return ring
    })
  }

  spawn(position) {
    const ring = this.rings[this.next]
    this.next = (this.next + 1) % this.rings.length

    ring.position.copy(position)
    ring.userData.age = 0
    ring.visible = true
  }

  update(delta) {
    for (const ring of this.rings) {
      if (!ring.visible) continue

      ring.userData.age += delta
      const life = ring.userData.age / this.lifetime
      if (life >= 1) {
        ring.visible = false
        continue
      }

      const eased = 1 - Math.pow(1 - life, 3)
      ring.scale.setScalar(this.startRadius + (this.endRadius - this.startRadius) * eased)
      ring.material.opacity = 0.9 * (1 - life)
    }
  }
}
