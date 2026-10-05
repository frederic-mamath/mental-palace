import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'

// City airport at the island's edge facing the entrepreneur island: a marked runway along the flight
// path (planes arrive moving toward +u and touch down at its start), an apron, a round terminal
// (a nod to Paris-CDG's Terminal 1) and a control tower.
export default class Airport {
  constructor({ frame, runway }) {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.frame = frame
    this.runway = runway
    this.gradientMap = createGradientMap()
    this.outlineMaterial = createOutlineMaterial()
    this.colliders = []

    this.setRunway()
    this.setApron()
    this.setTerminal()
    this.setControlTower()
  }

  // Flat group aligned with the city frame, at (along, across)
  place(along, across, y = 0) {
    const group = new THREE.Group()
    this.frame.toWorld(along, across, y, group.position)
    group.rotation.y = this.frame.yaw
    this.scene.add(group)
    return group
  }

  setRunway() {
    const { start, length, width } = this.runway
    const group = this.place(start + length / 2, 0, 0.03)
    const geometry = new THREE.PlaneGeometry(length, width).rotateX(-Math.PI / 2)
    const material = new THREE.MeshToonMaterial({ map: this.createRunwayTexture(), gradientMap: this.gradientMap })
    const runway = new THREE.Mesh(geometry, material)
    runway.receiveShadow = true
    group.add(runway)
  }

  // Asphalt with edge lines, a dashed centerline, threshold "piano keys" and touchdown bars at both ends
  createRunwayTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    const { width: w, height: h } = canvas

    ctx.fillStyle = '#3c3f47'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#f4f1e8'
    ctx.fillRect(0, 6, w, 4)
    ctx.fillRect(0, h - 10, w, 4)

    for (let x = 140; x < w - 140; x += 70) ctx.fillRect(x, h / 2 - 2, 40, 4)

    for (const end of [0, 1]) {
      const flip = (x, width) => (end === 0 ? x : w - x - width)
      for (let i = 0; i < 6; i++) ctx.fillRect(flip(18, 70), 18 + i * 16, 70, 9)
      for (const y of [h / 2 - 34, h / 2 + 22]) ctx.fillRect(flip(170, 60), y, 60, 12)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }

  setApron() {
    const { start, length } = this.runway
    const group = this.place(start + length / 2, 8.5, 0.02)
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(length * 0.8, 9).rotateX(-Math.PI / 2),
      new THREE.MeshToonMaterial({ color: '#8a8e98', gradientMap: this.gradientMap })
    )
    apron.receiveShadow = true
    group.add(apron)
  }

  // Cylinder with an ink outline (radius grown by t), standing on y = bottom
  addCylinder(group, { radius, height, bottom = 0, color, radialSegments = 32, outline = true }) {
    const material = new THREE.MeshToonMaterial({ color, gradientMap: this.gradientMap })
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, radialSegments), material)
    mesh.position.y = bottom + height / 2
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)

    if (outline) {
      const t = 0.06
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(radius + t, radius + t, height + t * 2, radialSegments), this.outlineMaterial)
      hull.position.copy(mesh.position)
      group.add(hull)
    }
    return mesh
  }

  setTerminal() {
    const { start, length } = this.runway
    const group = this.place(start + length / 2, 10)
    this.colliders.push({ position: group.position.clone(), radius: 4.3 })
    this.addCylinder(group, { radius: 4, height: 2.6, color: '#ddd7ca' })
    // Glass band around the middle, slightly proud of the concrete
    this.addCylinder(group, { radius: 4.06, height: 0.9, bottom: 0.9, color: '#7fb6d9', outline: false })
    this.addCylinder(group, { radius: 4.3, height: 0.3, bottom: 2.6, color: '#bdb6a8' })
  }

  setControlTower() {
    const { start, length } = this.runway
    const group = this.place(start + length * 0.72, -6.5)
    this.colliders.push({ position: group.position.clone(), radius: 1.4 })
    this.addCylinder(group, { radius: 0.55, height: 7, color: '#ddd7ca', radialSegments: 16 })
    this.addCylinder(group, { radius: 1.25, height: 1.2, bottom: 7, color: '#7fb6d9', radialSegments: 16 })
    this.addCylinder(group, { radius: 1.4, height: 0.25, bottom: 8.2, color: '#bdb6a8', radialSegments: 16 })
    this.addCylinder(group, { radius: 0.05, height: 1.2, bottom: 8.45, color: '#2a2833', radialSegments: 6, outline: false })
  }
}
