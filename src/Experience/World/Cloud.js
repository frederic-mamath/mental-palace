import * as THREE from 'three'
import Experience from '../Experience.js'
import { createGradientMap, createOutlineMaterial } from './toon.js'

// The main character: a puffy cel-shaded cloud built from overlapping spheres.
// Each puff gets an inverted-hull twin, so ink lines show on the silhouette and in the creases between puffs.
export default class Cloud {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.debug = this.experience.debug

    this.params = {
      color: '#ffffff',
      outlineColor: '#1a1626',
      outlineThickness: 0.05,
      hoverHeight: 1.6,
      floatAmplitude: 0.15,
      floatSpeed: 1.5,
    }

    this.group = new THREE.Group()
    this.group.position.y = this.params.hoverHeight
    this.scene.add(this.group)

    this.setMaterials()
    this.setBody()
    this.setFace()
    this.setDebug()
  }

  setMaterials() {
    this.materials = {
      body: new THREE.MeshToonMaterial({ color: this.params.color, gradientMap: createGradientMap() }),
      outline: createOutlineMaterial(this.params.outlineColor),
      eye: new THREE.MeshBasicMaterial({ color: '#1a1626' }),
    }
  }

  setBody() {
    // [x, y, z, radius]
    const puffs = [
      [0, 0, 0, 1],
      [0.9, -0.15, 0, 0.75],
      [-0.9, -0.15, 0, 0.75],
      [0.45, 0.45, 0.1, 0.7],
      [-0.4, 0.5, -0.1, 0.65],
      [0, -0.1, 0.55, 0.7],
      [0, -0.1, -0.55, 0.7],
      [1.5, -0.3, 0.1, 0.45],
      [-1.5, -0.3, -0.1, 0.45],
    ]

    this.geometry = new THREE.IcosahedronGeometry(1, 5)
    this.body = new THREE.Group()
    this.outlines = []

    for (const [x, y, z, radius] of puffs) {
      const puff = new THREE.Mesh(this.geometry, this.materials.body)
      puff.position.set(x, y, z)
      puff.scale.setScalar(radius)
      puff.castShadow = true
      this.body.add(puff)

      const outline = new THREE.Mesh(this.geometry, this.materials.outline)
      outline.position.set(x, y, z)
      outline.userData.radius = radius
      this.outlines.push(outline)
      this.body.add(outline)
    }

    this.updateOutlineThickness()
    this.group.add(this.body)
  }

  setFace() {
    this.face = new THREE.Group()

    const eyeGeometry = new THREE.SphereGeometry(1, 16, 16)
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, this.materials.eye)
      eye.position.set(0.22 * side, 0.05, 1.17)
      eye.scale.set(0.07, 0.12, 0.05)
      this.face.add(eye)
    }

    this.body.add(this.face)
  }

  updateOutlineThickness() {
    for (const outline of this.outlines) {
      outline.scale.setScalar(outline.userData.radius + this.params.outlineThickness)
    }
  }

  setDebug() {
    if (!this.debug.active) return

    const folder = this.debug.ui.addFolder('Cloud')
    folder.addColor(this.params, 'color').onChange((value) => this.materials.body.color.set(value))
    folder.addColor(this.params, 'outlineColor').onChange((value) => this.materials.outline.color.set(value))
    folder.add(this.params, 'outlineThickness', 0, 0.2, 0.001).onChange(() => this.updateOutlineThickness())
    folder.add(this.params, 'hoverHeight', 0.5, 5, 0.01)
    folder.add(this.params, 'floatAmplitude', 0, 1, 0.01)
    folder.add(this.params, 'floatSpeed', 0, 5, 0.01)
  }

  update() {
    const t = this.time.elapsed * this.params.floatSpeed

    // Idle: gentle bob, sway and breathing squash
    this.group.position.y = this.params.hoverHeight + Math.sin(t) * this.params.floatAmplitude
    this.group.rotation.z = Math.sin(t * 0.55) * 0.05
    this.group.rotation.x = Math.sin(t * 0.4) * 0.03
    this.body.scale.set(1 + Math.sin(t * 2) * 0.015, 1 - Math.sin(t * 2) * 0.02, 1)
  }
}
