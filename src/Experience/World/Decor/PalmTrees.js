import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import Experience from '../../Experience.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'
import { sea } from '../islands.js'
import { range, sampleBand, scatter } from './scatter.js'

// Palm trees along the coast: curved ringed trunks leaning out to sea, drooping leaves swaying gently.
export default class PalmTrees {
  constructor({ island, random, avoid, colliders }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time

    this.random = random
    this.outlineThickness = 0.04

    const gradientMap = createGradientMap()
    this.materials = {
      trunk: new THREE.MeshToonMaterial({ color: '#a8743f', gradientMap }),
      trunkLight: new THREE.MeshToonMaterial({ color: '#c8975a', gradientMap }),
      leaf: new THREE.MeshToonMaterial({ color: '#3faa4a', gradientMap, side: THREE.DoubleSide }),
      coconut: new THREE.MeshToonMaterial({ color: '#6b4a2b', gradientMap }),
      outline: createOutlineMaterial(),
    }
    this.leafGeometry = this.createLeafGeometry()
    this.coconutGeometry = new THREE.IcosahedronGeometry(0.14, 1)

    // Most on the plateau rim, a few down on the beach
    const rim = scatter({ random, count: 6, sample: (r) => sampleBand(r, island, { from: -2.6, to: -1.2 }), avoid, spacing: 6 })
    const rimZones = rim.map((point) => ({ position: point, radius: 5 }))
    const beach = scatter({ random, count: 4, sample: (r) => sampleBand(r, island, { from: 0.6, to: 1.5 }), avoid: [...avoid, ...rimZones], spacing: 6 })

    this.palms = [
      ...rim.map((point) => ({ point, y: 0 })),
      ...beach.map((point) => ({ point, y: sea.waterLevel + 0.3 })),
    ].map(({ point, y }) => {
      const palm = this.createPalm()
      palm.position.set(point.x, y, point.z)
      // The trunk bends toward local +x; turn that outward, away from the island center
      palm.rotation.y = -point.angle + range(random, -0.4, 0.4)
      palm.scale.setScalar(range(random, 0.85, 1.15))
      this.scene.add(palm)

      colliders.push({ position: new THREE.Vector3(point.x, 0, point.z), radius: 0.5 * palm.scale.x })
      return palm
    })
  }

  createPalm() {
    const random = this.random
    const palm = new THREE.Group()
    const height = range(random, 4.5, 6)
    const bend = range(random, 0.8, 1.8)
    const segments = 7
    const pointAt = (t) => new THREE.Vector3(bend * t * t, height * t, 0)

    // Trunk: stacked tapered segments along a curve; alternating tones and outlines read as rings.
    // Segments are baked into one geometry per material, so a trunk costs 3 draw calls instead of 14.
    const up = new THREE.Vector3(0, 1, 0)
    const parts = { trunk: [], trunkLight: [], outline: [] }
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const unitScale = new THREE.Vector3(1, 1, 1)
    for (let i = 0; i < segments; i++) {
      const start = pointAt(i / segments)
      const end = pointAt((i + 1) / segments)
      const length = start.distanceTo(end)
      const radiusBottom = THREE.MathUtils.lerp(0.3, 0.17, i / segments)
      const radiusTop = THREE.MathUtils.lerp(0.3, 0.17, (i + 1) / segments) * 0.88

      quaternion.setFromUnitVectors(up, end.clone().sub(start).normalize())
      matrix.compose(start.clone().lerp(end, 0.5), quaternion, unitScale)

      const t = this.outlineThickness
      parts[i % 2 ? 'trunkLight' : 'trunk'].push(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 7).applyMatrix4(matrix))
      parts.outline.push(new THREE.CylinderGeometry(radiusTop + t, radiusBottom + t, length, 7).applyMatrix4(matrix))
    }

    for (const [name, geometries] of Object.entries(parts)) {
      const mesh = new THREE.Mesh(mergeGeometries(geometries), this.materials[name])
      mesh.castShadow = name !== 'outline'
      palm.add(mesh)
    }

    // Crown of leaves fanning around the top
    const crown = new THREE.Group()
    crown.position.copy(pointAt(1))
    const leafCount = 7
    const leaves = []
    for (let i = 0; i < leafCount; i++) {
      const pivot = new THREE.Group()
      pivot.rotation.y = (i / leafCount) * Math.PI * 2 + range(random, -0.2, 0.2)
      const leaf = new THREE.Mesh(this.leafGeometry, this.materials.leaf)
      leaf.rotation.z = range(random, 0.05, 0.4)
      leaf.userData.baseTilt = leaf.rotation.z
      leaf.castShadow = true
      pivot.add(leaf)
      crown.add(pivot)
      leaves.push(leaf)
    }

    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2
      const coconut = new THREE.Mesh(this.coconutGeometry, this.materials.coconut)
      coconut.position.set(Math.cos(angle) * 0.16, -0.15, Math.sin(angle) * 0.16)
      crown.add(coconut)
    }

    palm.add(crown)
    palm.userData = { crown, leaves, phase: random() * Math.PI * 2 }
    return palm
  }

  // A long leaf along +x: pointed at both ends, drooping toward the tip, folded along its midrib
  createLeafGeometry() {
    const length = 2.6
    const width = 0.75
    const droop = 1.3
    const geometry = new THREE.PlaneGeometry(1, 1, 2, 10)
    const position = geometry.attributes.position

    for (let i = 0; i < position.count; i++) {
      const across = position.getX(i) // -0.5 .. 0.5
      const along = position.getY(i) + 0.5 // 0 .. 1
      const profile = Math.sin(Math.PI * (0.12 + 0.88 * along))
      const fold = (0.5 - Math.abs(across)) * 0.2 * profile
      position.setXYZ(i, along * length, fold - droop * along * along, across * width * profile)
    }

    geometry.computeVertexNormals()
    return geometry
  }

  update() {
    const elapsed = this.time.elapsed

    for (const palm of this.palms) {
      const { crown, leaves, phase } = palm.userData
      crown.rotation.z = Math.sin(elapsed * 1.1 + phase) * 0.04
      crown.rotation.x = Math.sin(elapsed * 0.8 + phase) * 0.03
      leaves.forEach((leaf, i) => {
        leaf.rotation.z = leaf.userData.baseTilt + Math.sin(elapsed * 2 + phase + i) * 0.05
      })
    }
  }
}
