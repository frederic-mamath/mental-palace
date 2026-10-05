import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'

// Simplified cel-shaded Eiffel Tower: four splayed legs joined by arches, two platforms,
// a tapering top shaft and a spire. Reads as a silhouette from the other island.
export default class EiffelTower {
  constructor({ position, yaw = 0 }) {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.group = new THREE.Group()
    this.group.position.copy(position)
    this.group.rotation.y = yaw
    this.scene.add(this.group)

    this.material = new THREE.MeshToonMaterial({ color: '#8b6f52', gradientMap: createGradientMap() })
    this.outlineMaterial = createOutlineMaterial()
    this.outlineThickness = 0.07

    // Lower legs, from the ground to the first platform
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      this.beam(new THREE.Vector3(sx * 3.4, 0, sz * 3.4), new THREE.Vector3(sx * 2.1, 4.2, sz * 2.1), 0.55, 0.4)
      this.beam(new THREE.Vector3(sx * 2.0, 4.5, sz * 2.0), new THREE.Vector3(sx * 1.05, 9.4, sz * 1.05), 0.35, 0.25)
    }

    // Arches between neighbouring legs, under the first platform
    const archGeometry = new THREE.TorusGeometry(2.9, 0.16, 6, 16, Math.PI)
    for (let side = 0; side < 4; side++) {
      const arch = new THREE.Mesh(archGeometry, this.material)
      const angle = (side * Math.PI) / 2
      arch.position.set(Math.cos(angle) * 3.0, 1.0, Math.sin(angle) * 3.0)
      arch.rotation.y = -angle + Math.PI / 2
      this.group.add(arch)
    }

    this.slab(5.2, 0.45, 4.3)
    this.slab(2.6, 0.35, 9.55)
    this.beam(new THREE.Vector3(0, 9.7, 0), new THREE.Vector3(0, 16.5, 0), 1.25, 0.35)
    this.slab(1.0, 0.4, 16.6)
    this.beam(new THREE.Vector3(0, 16.8, 0), new THREE.Vector3(0, 18.6, 0), 0.12, 0.05)

    this.group.updateWorldMatrix(true, false)
    this.legColliders = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => ({
      position: this.group.localToWorld(new THREE.Vector3(sx * 3.2, 0, sz * 3.2)),
      radius: 0.8,
    }))

    this.group.traverse((child) => {
      if (child.isMesh && child.material === this.material) child.castShadow = true
    })
  }

  // Four-sided tapered beam between two points, faceted, with an ink outline
  beam(start, end, radiusStart, radiusEnd) {
    const length = start.distanceTo(end)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(start).normalize()
    )
    const center = start.clone().lerp(end, 0.5)
    const t = this.outlineThickness

    for (const [material, grow] of [[this.material, 0], [this.outlineMaterial, t]]) {
      const geometry = new THREE.CylinderGeometry(radiusEnd + grow, radiusStart + grow, length + grow, 4).toNonIndexed()
      geometry.rotateY(Math.PI / 4)
      geometry.computeVertexNormals()
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(center)
      mesh.quaternion.copy(quaternion)
      this.group.add(mesh)
    }
  }

  // Square platform of side `size` at height `y`
  slab(size, height, y) {
    const t = this.outlineThickness
    for (const [material, grow] of [[this.material, 0], [this.outlineMaterial, t]]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size + grow * 2, height + grow * 2, size + grow * 2), material)
      mesh.position.y = y
      this.group.add(mesh)
    }
  }
}
