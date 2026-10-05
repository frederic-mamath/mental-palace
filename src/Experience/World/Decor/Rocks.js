import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'
import { island } from '../islandShape.js'
import { range, sampleBand, scatter } from './scatter.js'

// Faceted, outlined rocks on the plateau, on the beach and poking out of the shallows.
// Large rocks on land become colliders.
export default class Rocks {
  constructor({ random, avoid, colliders }) {
    this.experience = new Experience()
    this.scene = this.experience.scene

    const outlineThickness = 0.05
    const beachTop = island.waterLevel + 0.3
    const zones = [
      { count: 14, band: { to: -1.5 }, y: 0, size: [0.3, 1.1], height: [0.7, 1], spacing: 2.5, solid: true },
      { count: 10, band: { from: 0.4, to: island.beachWidth - 0.3 }, y: beachTop, size: [0.25, 0.6], height: [0.6, 0.9], spacing: 2, solid: true },
      { count: 14, band: { from: island.beachWidth + 1, to: island.beachWidth + 6 }, y: island.waterLevel, size: [0.5, 1.6], height: [0.5, 0.85], spacing: 3 },
    ]

    const rocks = []
    for (const zone of zones) {
      const points = scatter({ random, count: zone.count, sample: (r) => sampleBand(r, zone.band), avoid, spacing: zone.spacing })
      for (const point of points) {
        const size = range(random, ...zone.size)
        const scale = new THREE.Vector3(size * range(random, 0.8, 1.2), size * range(random, ...zone.height), size * range(random, 0.8, 1.2))
        // Sunk into the ground so they look settled rather than placed
        const position = new THREE.Vector3(point.x, zone.y - scale.y * 0.2, point.z)
        const rotation = new THREE.Euler(range(random, -0.3, 0.3), random() * Math.PI * 2, range(random, -0.3, 0.3))
        rocks.push({ position, rotation, scale })

        if (zone.solid && size > 0.6) {
          colliders.push({ position: position.clone().setY(0), radius: Math.max(scale.x, scale.z) * 0.9 })
        }
      }
    }

    // Unshared vertices give each face its own normal: the faceted look MeshToonMaterial can't do with flatShading
    const geometry = new THREE.DodecahedronGeometry(1, 0).toNonIndexed()
    geometry.computeVertexNormals()

    this.mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshToonMaterial({ color: '#a3acc2', gradientMap: createGradientMap() }),
      rocks.length
    )
    this.outline = new THREE.InstancedMesh(geometry, createOutlineMaterial(), rocks.length)

    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const outlineScale = new THREE.Vector3()
    rocks.forEach(({ position, rotation, scale }, i) => {
      quaternion.setFromEuler(rotation)
      this.mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale))
      outlineScale.copy(scale).addScalar(outlineThickness)
      this.outline.setMatrixAt(i, matrix.compose(position, quaternion, outlineScale))
    })

    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.scene.add(this.mesh, this.outline)
  }
}
