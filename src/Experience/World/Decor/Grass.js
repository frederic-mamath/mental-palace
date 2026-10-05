import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import Experience from '../../Experience.js'
import { createGradientMap, applyWind } from '../toon.js'
import { range, sampleBand, scatter } from './scatter.js'

// Hundreds of small grass tufts on the plateau, in a single instanced draw call, swaying in the wind.
export default class Grass {
  constructor({ island, random, avoid, count = 900 }) {
    this.experience = new Experience()
    this.scene = this.experience.scene

    const geometry = this.createTuftGeometry()
    // White base color: each instance gets its own tint through instanceColor
    const material = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: createGradientMap() })
    applyWind(material, { height: 0.6, amplitude: 0.12 })

    const points = scatter({ random, count, sample: (r) => sampleBand(r, island, { to: -0.6 }), avoid })
    const palette = ['#5aab4c', '#4c9c43', '#8fd873'].map((color) => new THREE.Color(color))

    this.mesh = new THREE.InstancedMesh(geometry, material, points.length)
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const position = new THREE.Vector3()

    points.forEach((point, i) => {
      const size = range(random, 1, 1.7)
      position.set(point.x, 0, point.z)
      quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, random() * Math.PI * 2)
      scale.set(size, size * range(random, 0.8, 1.3), size)
      this.mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale))
      this.mesh.setColorAt(i, palette[Math.floor(random() * palette.length)])
    })

    this.mesh.receiveShadow = true
    this.scene.add(this.mesh)
  }

  // A few thin cones fanning out from the same base
  createTuftGeometry() {
    const blades = []
    const count = 5

    for (let i = 0; i < count; i++) {
      const height = 0.35 + (i % 3) * 0.12
      const blade = new THREE.ConeGeometry(0.05, height, 3)
      blade.translate(0, height / 2, 0)
      blade.rotateZ(0.2 + (i % 2) * 0.15)
      blade.rotateY((i / count) * Math.PI * 2)
      blades.push(blade)
    }

    const geometry = mergeGeometries(blades)

    // Normals pointing straight up: tufts shade exactly like the ground they grow from, reading as flat anime shapes
    const normals = geometry.attributes.normal
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0)

    return geometry
  }
}
