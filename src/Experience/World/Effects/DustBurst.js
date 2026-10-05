import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap } from '../toon.js'

// Cel-shaded dust puffs kicked out on the ground, mostly opposite to a direction.
export default class DustBurst {
  constructor({ count = 12, lifetime = 0.55, color = '#f1ece0' } = {}) {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.lifetime = lifetime
    this.next = 0

    const geometry = new THREE.IcosahedronGeometry(1, 2)
    const gradientMap = createGradientMap()

    this.puffs = Array.from({ length: count }, () => {
      const puff = new THREE.Mesh(
        geometry,
        new THREE.MeshToonMaterial({ color, gradientMap, transparent: true, depthWrite: false })
      )
      puff.visible = false
      puff.userData = { age: 0, velocity: new THREE.Vector3(), size: 1 }
      this.scene.add(puff)
      return puff
    })
  }

  spawn(position, direction, amount = 6) {
    const back = direction.clone().negate()

    for (let i = 0; i < amount; i++) {
      const puff = this.puffs[this.next]
      this.next = (this.next + 1) % this.puffs.length

      // Fan out behind, with some sideways spread
      const angle = (Math.random() - 0.5) * Math.PI * 1.2
      const velocity = puff.userData.velocity.copy(back).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle)
      velocity.multiplyScalar(2 + Math.random() * 2.5)
      velocity.y = 0.6 + Math.random() * 0.8

      puff.position.set(position.x, 0.25, position.z)
      puff.userData.age = 0
      puff.userData.size = 0.25 + Math.random() * 0.25
      puff.visible = true
    }
  }

  update(delta) {
    for (const puff of this.puffs) {
      if (!puff.visible) continue

      const data = puff.userData
      data.age += delta
      const life = data.age / this.lifetime
      if (life >= 1) {
        puff.visible = false
        continue
      }

      // Burst out fast, then drift and slow down
      data.velocity.multiplyScalar(Math.exp(-5 * delta))
      puff.position.addScaledVector(data.velocity, delta)
      puff.scale.setScalar(data.size * (0.6 + Math.sin(life * Math.PI) * 0.9))
      puff.material.opacity = 1 - life * life
    }
  }
}
