import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'

const colors = { stone: '#b4b0a6', blue: '#6f88b8', red: '#b8746f', plinth: '#8d8a96', wood: '#9a6a43', board: '#efe4c8', ink: '#1a1626' }

// Tiles and props standing on the ground start this far below it (see "Known pitfalls" in CLAUDE.md)
const sink = 0.04
const hex = { size: 0.85, gap: 0.08, rings: 2, top: 0.1 }

// The entrepreneur island's zone for Overlord, the user's slow, tactics-based mobile game (in the making):
// a hexagonal game board in the grass, the player's rows (blue) facing the spawn point and the enemy's
// (red) at the back, a raised tile in the middle where the game's units are shown, and a wooden sign.
// Units are added with `showUnit`. Local axes: +z toward the spawn point (the board's front), y up.
export default class OverlordZone {
  constructor({ project, center }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time

    this.project = project
    this.gradientMap = createGradientMap()
    this.outlineMaterial = createOutlineMaterial()
    this.units = []

    this.group = new THREE.Group()
    this.group.position.set(center.x, 0, center.z)
    // Face the spawn point (the island's center)
    this.group.rotation.y = Math.atan2(-center.x, -center.z)
    this.scene.add(this.group)

    this.setBoard()
    this.setSign()
    this.radius = hex.size * (1.5 * hex.rings + 1) + 0.4

    this.group.updateMatrixWorld(true)
    this.colliders = [{ position: this.group.localToWorld(this.signPosition.clone()), radius: 0.35 }]
  }

  toon(color) {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.gradientMap })
  }

  outlined(mesh, outline, parent = this.group) {
    const hull = new THREE.Mesh(mesh.geometry, this.outlineMaterial)
    hull.position.copy(mesh.position)
    hull.rotation.copy(mesh.rotation)
    if (Array.isArray(outline)) hull.scale.set(...outline)
    else hull.scale.setScalar(outline)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh, hull)
    return mesh
  }

  // Hex tiles in rings around the middle one (axial coordinates), colored by side
  setBoard() {
    const { size, gap, rings, top } = hex
    const tile = new THREE.CylinderGeometry(size - gap, size - gap, top + sink, 6).translate(0, (top - sink) / 2, 0)
    const materials = { stone: this.toon(colors.stone), blue: this.toon(colors.blue), red: this.toon(colors.red) }
    for (let q = -rings; q <= rings; q++) {
      for (let r = -rings; r <= rings; r++) {
        if (Math.abs(q + r) > rings || (q === 0 && r === 0)) continue
        const x = Math.sqrt(3) * size * (q + r / 2)
        const z = 1.5 * size * r
        const side = z > 0.5 ? 'blue' : z < -0.5 ? 'red' : 'stone'
        const mesh = new THREE.Mesh(tile, materials[side])
        mesh.position.set(x, 0, z)
        this.outlined(mesh, [1.04, 1.15, 1.04])
      }
    }

    // The middle tile, raised: a plinth for the units on show
    this.plinthTop = 0.45
    // Unshared vertices: flat faces, so the sides don't get smooth-normal shadow stripes
    const plinthGeometry = new THREE.CylinderGeometry(size - gap, size + 0.05, this.plinthTop + sink, 6).translate(0, (this.plinthTop - sink) / 2, 0).toNonIndexed()
    plinthGeometry.computeVertexNormals()
    const plinth = new THREE.Mesh(plinthGeometry, this.toon(colors.plinth))
    this.outlined(plinth, [1.04, 1.06, 1.04])
    // Its sides face away from the sun: received shadows only add a ragged penumbra there
    plinth.receiveShadow = false
  }

  // A wooden sign at the board's front right corner, facing the spawn point
  setSign() {
    this.signPosition = new THREE.Vector3(3.6, 0, 2.6)
    const sign = new THREE.Group()
    sign.position.copy(this.signPosition)
    sign.rotation.y = -0.35
    this.group.add(sign)

    const wood = this.toon(colors.wood)
    this.outlined(new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.6, 0.14).translate(0, 0.8 - sink, 0), wood), [1.3, 1.02, 1.3], sign)
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 0.08), wood)
    panel.position.set(0, 1.45, 0.11) // in front of the post
    this.outlined(panel, [1.04, 1.08, 1.6], sign)
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.72), new THREE.MeshToonMaterial({ map: this.createSignTexture(), gradientMap: this.gradientMap }))
    face.position.set(0, 1.45, 0.155)
    sign.add(face)
  }

  // Drawn again once the title font has loaded (the page loads Bebas Neue from Google Fonts)
  createSignTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 390
    canvas.height = 180
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    this.drawSign(canvas, texture)
    document.fonts?.load('64px "Bebas Neue"').then(() => this.drawSign(canvas, texture))
    return texture
  }

  drawSign(canvas, texture) {
    const ctx = canvas.getContext('2d')
    const { width: w, height: h } = canvas
    ctx.fillStyle = colors.board
    ctx.fillRect(0, 0, w, h)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = colors.ink
    ctx.font = `64px "Bebas Neue", Impact, sans-serif`
    ctx.fillText(this.project.title.toUpperCase(), w / 2, h * 0.4)
    ctx.font = `600 15px -apple-system, "Helvetica Neue", Arial, sans-serif`
    ctx.fillText(this.project.tagline, w / 2, h * 0.76)
    texture.needsUpdate = true
  }

  // Puts a unit (an object with a `group`, and optionally `update(elapsed)` and `colliders` in its local
  // space) on the plinth, facing the front
  showUnit(unit) {
    unit.group.position.set(0, this.plinthTop - sink, 0)
    this.group.add(unit.group)
    this.group.updateMatrixWorld(true)
    for (const { position, radius } of unit.colliders ?? []) {
      this.colliders.push({ position: unit.group.localToWorld(position.clone()).setY(0), radius })
    }
    this.units.push(unit)
  }

  // Is (x, z) on the board, grown by `margin`? Keeps decor off it.
  contains(x, z, margin = 0) {
    return Math.hypot(x - this.group.position.x, z - this.group.position.z) < this.radius + margin
  }

  update() {
    for (const unit of this.units) unit.update?.(this.time.elapsed)
  }
}
