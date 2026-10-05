import * as THREE from 'three'
import Experience from '../Experience.js'
import { createGradientMap } from './toon.js'

export default class Floor {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.geometry = new THREE.CircleGeometry(30, 64)
    this.material = new THREE.MeshToonMaterial({
      color: '#7fcf6b',
      gradientMap: createGradientMap(),
    })

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.receiveShadow = true
    this.scene.add(this.mesh)
  }
}
