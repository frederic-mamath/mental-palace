import * as THREE from 'three'
import Experience from '../../Experience.js'

// Fading translucent copies of a set of meshes, left behind along a path (dash trail).
// Ghosts are pooled: spawning reuses the oldest one.
export default class Afterimages {
  constructor({ meshes, count = 10, lifetime = 0.4, color = '#3fb8ff', opacity = 0.8 }) {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.lifetime = lifetime
    this.opacity = opacity
    this.next = 0
    this.matrix = new THREE.Matrix4()
    // Slightly smaller than the source so a fresh ghost hides inside it instead of z-fighting
    this.shrink = new THREE.Matrix4().makeScale(0.95, 0.95, 0.95)

    this.ghosts = Array.from({ length: count }, () => {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false })
      const ghost = new THREE.Group()
      ghost.matrixAutoUpdate = false
      ghost.visible = false
      ghost.userData = { age: 0, material }

      for (const mesh of meshes) {
        const copy = new THREE.Mesh(mesh.geometry, material)
        copy.position.copy(mesh.position)
        copy.scale.copy(mesh.scale)
        ghost.add(copy)
      }

      this.scene.add(ghost)
      return ghost
    })
  }

  // Leaves a ghost at the current world transform of `source` (the parent of the copied meshes)
  spawn(source) {
    const ghost = this.ghosts[this.next]
    this.next = (this.next + 1) % this.ghosts.length

    source.updateWorldMatrix(true, false)
    ghost.matrix.multiplyMatrices(source.matrixWorld, this.shrink)
    ghost.matrixWorldNeedsUpdate = true
    ghost.userData.age = 0
    ghost.visible = true
  }

  update(delta) {
    for (const ghost of this.ghosts) {
      if (!ghost.visible) continue

      ghost.userData.age += delta
      const life = ghost.userData.age / this.lifetime
      if (life >= 1) {
        ghost.visible = false
        continue
      }

      ghost.userData.material.opacity = this.opacity * (1 - life) * (1 - life)
    }
  }
}
