import * as THREE from 'three'
import { createGradientMap } from '../toon.js'

// Cel-shaded hearts that pop out, float up with a wobble and fade, like a "like" on a double tap.
// Spawned in `parent`'s local space; pooled.
export default class HeartPop {
  constructor({ parent, color = '#ff3d6e', count = 4, lifetime = 1.1 }) {
    this.lifetime = lifetime
    this.next = 0

    const geometry = this.createHeartGeometry()
    const gradientMap = createGradientMap()

    this.hearts = Array.from({ length: count }, () => {
      const material = new THREE.MeshToonMaterial({ color, gradientMap, transparent: true })
      const outlineMaterial = new THREE.MeshBasicMaterial({ color: '#1a1626', side: THREE.BackSide, transparent: true })
      const heart = new THREE.Group()
      const body = new THREE.Mesh(geometry, material)
      const outline = new THREE.Mesh(geometry, outlineMaterial)
      outline.scale.setScalar(1.12)
      heart.add(body, outline)
      heart.visible = false
      heart.userData = { age: 0, origin: new THREE.Vector3(), materials: [material, outlineMaterial], drift: 0 }
      parent.add(heart)
      return heart
    })
  }

  // Classic parametric heart curve, extruded with a soft bevel and centered
  createHeartGeometry() {
    const shape = new THREE.Shape()
    const steps = 64
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2
      const x = 16 * Math.pow(Math.sin(t), 3)
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
      if (i === 0) shape.moveTo(x / 32, y / 32)
      else shape.lineTo(x / 32, y / 32)
    }

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 3,
    })
    geometry.center()
    return geometry
  }

  spawn(position) {
    const heart = this.hearts[this.next]
    this.next = (this.next + 1) % this.hearts.length

    heart.userData.age = 0
    heart.userData.origin.copy(position)
    heart.userData.drift = (Math.random() - 0.5) * 0.8
    heart.position.copy(position)
    heart.visible = true
  }

  update(delta) {
    for (const heart of this.hearts) {
      if (!heart.visible) continue

      const data = heart.userData
      data.age += delta
      const life = data.age / this.lifetime
      if (life >= 1) {
        heart.visible = false
        continue
      }

      // Pop in with an overshoot, float up and sideways, fade over the last 40%
      const pop = Math.min(life / 0.25, 1)
      const overshoot = 1 + 3.5 * Math.pow(pop - 1, 3) + 2.5 * Math.pow(pop - 1, 2) // easeOutBack
      heart.scale.setScalar(Math.max(overshoot, 0.001))
      heart.position.set(
        data.origin.x + data.drift * life,
        data.origin.y + life * 1.6,
        data.origin.z + 0.4 + life * 0.3
      )
      heart.rotation.y = Math.sin(life * Math.PI * 3) * 0.4

      const opacity = life < 0.6 ? 1 : 1 - (life - 0.6) / 0.4
      for (const material of data.materials) material.opacity = opacity
    }
  }
}
