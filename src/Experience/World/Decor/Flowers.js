import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import Experience from '../../Experience.js'
import { createGradientMap, applyWind } from '../toon.js'
import { range, sampleBand, scatter } from './scatter.js'

// Patches of small flowers, one color per patch. Stems, petals and centers are three instanced meshes sharing matrices.
export default class Flowers {
  // exclude(x, z): spots to leave bare (e.g. the airstrip); the random draws stay the same, so nothing else moves
  // `centers` places the patches yourself (a dense meadow) instead of scattering `patches` of them;
  // `colors` overrides the palette
  constructor({ island, random, avoid, exclude = () => false, patches = 16, centers: chosenCenters, colors = ['#ff7eb6', '#ffffff', '#ffd23f', '#b388ff', '#ff5c5c'] }) {
    this.experience = new Experience()
    this.scene = this.experience.scene

    const palette = colors.map((color) => new THREE.Color(color))
    const centers = chosenCenters ?? scatter({ random, count: patches, sample: (r) => sampleBand(r, island, { to: -2.5 }), avoid, spacing: 5 })

    const flowers = []
    for (const center of centers) {
      const color = palette[Math.floor(random() * palette.length)]
      const amount = 6 + Math.floor(random() * 8)

      for (let i = 0; i < amount; i++) {
        const angle = random() * Math.PI * 2
        const distance = Math.sqrt(random()) * 1.8
        const x = center.x + Math.cos(angle) * distance
        const z = center.z + Math.sin(angle) * distance
        const insideIsland = island.edgeDistance(x, z) < -0.6
        const blocked = avoid.some(({ position, radius }) => Math.hypot(x - position.x, z - position.z) < radius)
        if (insideIsland && !blocked) flowers.push({ x, z, color })
      }
    }

    const gradientMap = createGradientMap()
    const parts = [
      { geometry: this.createStemGeometry(), material: new THREE.MeshToonMaterial({ color: '#3f9a3a', gradientMap }) },
      { geometry: this.createPetalsGeometry(), material: new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap }), tinted: true },
      { geometry: this.createCenterGeometry(), material: new THREE.MeshToonMaterial({ color: '#ffb000', gradientMap }) },
    ]

    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const position = new THREE.Vector3()

    this.meshes = parts.map(({ geometry, material }) => {
      // Same wind settings on every part so a flower sways as one piece
      applyWind(material, { height: 0.45, amplitude: 0.08 })
      return new THREE.InstancedMesh(geometry, material, flowers.length)
    })

    let count = 0
    for (const flower of flowers) {
      const size = range(random, 1.3, 2)
      position.set(flower.x, 0, flower.z)
      quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, random() * Math.PI * 2)
      scale.setScalar(size)
      if (exclude(flower.x, flower.z)) continue

      matrix.compose(position, quaternion, scale)
      this.meshes.forEach((mesh, part) => {
        mesh.setMatrixAt(count, matrix)
        if (parts[part].tinted) mesh.setColorAt(count, flower.color)
      })
      count++
    }
    for (const mesh of this.meshes) mesh.count = count

    // No shadows: the shadow pass doesn't run the wind patch, so they'd stay upright while the flowers bend
    for (const mesh of this.meshes) this.scene.add(mesh)
  }

  createStemGeometry() {
    const geometry = new THREE.CylinderGeometry(0.015, 0.02, 0.4, 4)
    geometry.translate(0, 0.2, 0)
    return geometry
  }

  createPetalsGeometry() {
    const petals = []
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2
      const petal = new THREE.IcosahedronGeometry(0.075, 0)
      petal.scale(1, 0.45, 1)
      petal.translate(Math.cos(angle) * 0.085, 0.42, Math.sin(angle) * 0.085)
      petals.push(petal)
    }
    return mergeGeometries(petals)
  }

  createCenterGeometry() {
    const geometry = new THREE.IcosahedronGeometry(0.055, 0)
    geometry.translate(0, 0.44, 0)
    return geometry
  }
}
