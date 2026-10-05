import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'

// Haussmann-style buildings: cream stone facades (painted on a canvas texture: shopfronts,
// window rows, wrought-iron balconies), blue-grey zinc mansard roofs and terracotta chimney pots.
// All instanced: walls, roofs, chimneys and their outlines are a handful of draw calls.
//
// units: [{ along, across, width, depth, height, roofHeight }] in city coordinates
export default class Buildings {
  constructor({ frame, units, random }) {
    this.experience = new Experience()
    this.scene = this.experience.scene

    const gradientMap = createGradientMap()
    const outlineThickness = 0.06
    const quaternion = new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, frame.yaw)
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()

    // Walls: a unit box standing on y = 0
    const wallGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const wallMaterial = new THREE.MeshToonMaterial({ map: this.createFacadeTexture(), gradientMap })
    this.walls = new THREE.InstancedMesh(wallGeometry, wallMaterial, units.length)
    this.wallOutlines = new THREE.InstancedMesh(wallGeometry, createOutlineMaterial(), units.length)

    // Mansard roof: a square frustum (4-sided cylinder turned 45°) sitting on the walls, faceted
    const roofGeometry = new THREE.CylinderGeometry(0.42, Math.SQRT1_2, 1, 4, 1).toNonIndexed()
    roofGeometry.rotateY(Math.PI / 4).translate(0, 0.5, 0)
    roofGeometry.computeVertexNormals()
    this.roofs = new THREE.InstancedMesh(roofGeometry, new THREE.MeshToonMaterial({ color: '#7d8ea3', gradientMap }), units.length)
    this.roofOutlines = new THREE.InstancedMesh(roofGeometry, createOutlineMaterial(), units.length)

    // Two chimney stacks per building, on the roof's flat top
    const chimneyGeometry = new THREE.BoxGeometry(0.35, 0.7, 0.35).translate(0, 0.35, 0)
    this.chimneys = new THREE.InstancedMesh(chimneyGeometry, new THREE.MeshToonMaterial({ color: '#b5643c', gradientMap }), units.length * 2)

    // Slight stone tint variations between buildings
    const tints = ['#ffffff', '#f6eddc', '#fff3e2', '#efe6d6'].map((color) => new THREE.Color(color))

    units.forEach((unit, i) => {
      frame.toWorld(unit.along, unit.across, 0, position)
      this.walls.setMatrixAt(i, matrix.compose(position, quaternion, scale.set(unit.width, unit.height, unit.depth)))
      this.walls.setColorAt(i, tints[Math.floor(random() * tints.length)])
      this.wallOutlines.setMatrixAt(
        i,
        matrix.compose(position, quaternion, scale.set(unit.width + outlineThickness * 2, unit.height + outlineThickness, unit.depth + outlineThickness * 2))
      )

      frame.toWorld(unit.along, unit.across, unit.height, position)
      this.roofs.setMatrixAt(i, matrix.compose(position, quaternion, scale.set(unit.width, unit.roofHeight, unit.depth)))
      this.roofOutlines.setMatrixAt(
        i,
        matrix.compose(position, quaternion, scale.set(unit.width + outlineThickness * 2, unit.roofHeight + outlineThickness, unit.depth + outlineThickness * 2))
      )

      for (let c = 0; c < 2; c++) {
        const side = c === 0 ? -1 : 1
        frame.toWorld(unit.along + side * unit.width * 0.18, unit.across + (random() - 0.5) * unit.depth * 0.3, unit.height + unit.roofHeight - 0.05, position)
        this.chimneys.setMatrixAt(i * 2 + c, matrix.compose(position, quaternion, scale.set(1, 0.8 + random() * 0.5, 1)))
      }
    })

    for (const mesh of [this.walls, this.roofs, this.chimneys]) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
    this.scene.add(this.walls, this.wallOutlines, this.roofs, this.roofOutlines, this.chimneys)
  }

  // One facade, used on every side: arched shopfronts, five floors of windows,
  // continuous iron balconies on the 2nd and 5th floors, cornices between them
  createFacadeTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    const columns = 3
    const columnWidth = canvas.width / columns
    const groundHeight = 56
    const floors = 5
    const floorHeight = (canvas.height - groundHeight - 14) / floors

    ctx.fillStyle = '#efe3c8'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Ground floor: darker stone band with arched shopfronts
    const groundTop = canvas.height - groundHeight
    ctx.fillStyle = '#ddcca9'
    ctx.fillRect(0, groundTop, canvas.width, groundHeight)
    for (let c = 0; c < columns; c++) {
      const x = c * columnWidth + columnWidth * 0.2
      const width = columnWidth * 0.6
      ctx.fillStyle = '#3b4252'
      ctx.beginPath()
      ctx.moveTo(x, canvas.height)
      ctx.lineTo(x, groundTop + 18)
      ctx.arc(x + width / 2, groundTop + 18, width / 2, Math.PI, 0)
      ctx.lineTo(x + width, canvas.height)
      ctx.fill()
    }

    // Cornices: top of the building and above the ground floor
    ctx.fillStyle = '#cbb894'
    ctx.fillRect(0, 0, canvas.width, 10)
    ctx.fillRect(0, groundTop - 5, canvas.width, 5)

    // Windows, floor by floor from the top
    for (let f = 0; f < floors; f++) {
      const floorTop = 14 + f * floorHeight
      for (let c = 0; c < columns; c++) {
        const x = c * columnWidth + columnWidth * 0.28
        const width = columnWidth * 0.44
        const y = floorTop + floorHeight * 0.14
        const height = floorHeight * 0.66
        ctx.fillStyle = '#e9dfc9'
        ctx.fillRect(x - 3, y - 3, width + 6, height + 6)
        ctx.fillStyle = '#4d5d74'
        ctx.fillRect(x, y, width, height)
        ctx.fillStyle = '#e9dfc9'
        ctx.fillRect(x + width / 2 - 1, y, 2, height)
      }

      // Wrought-iron balconies on the 2nd floor (fourth from the top) and the 5th (top floor)
      if (f === 0 || f === 3) {
        const railY = floorTop + floorHeight * 0.62
        ctx.fillStyle = '#2a2833'
        ctx.fillRect(0, railY, canvas.width, 3)
        ctx.fillRect(0, railY + floorHeight * 0.2, canvas.width, 2)
        for (let x = 0; x < canvas.width; x += 6) ctx.fillRect(x, railY, 1.5, floorHeight * 0.2)
      }
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }
}
