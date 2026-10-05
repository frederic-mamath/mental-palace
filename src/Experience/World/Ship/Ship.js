import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'

// A small cel-shaded pirate ship, a homage to One Piece without copying its ships or Jolly Roger:
// wooden hull with a raised bow and stern, stern cabin, mast with a crow's nest, a bulging striped sail
// with a straw hat on it, a pennant and a bowsprit.
// Bow along +x, up +y; the origin sits on the waterline, the deck at `deckHeight` above it.
export default class Ship {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.length = 7
    this.deckHeight = 0.9
    this.gradientMap = createGradientMap()
    this.outlineMaterial = createOutlineMaterial()

    this.group = new THREE.Group()
    this.scene.add(this.group)

    this.setHull()
    this.setCabin()
    this.setMast()
    this.setBowsprit()

    this.group.traverse((child) => {
      if (child.isMesh && child.material !== this.outlineMaterial && !child.userData.noShadow) child.castShadow = true
    })
  }

  toon(color, options = {}) {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.gradientMap, ...options })
  }

  // Half width, keel depth and top of the hull sides (the sheer) at x along the hull
  hullSection(x) {
    const half = this.length / 2
    const t = (x + half) / this.length // 0 at the stern, 1 at the bow
    const width = 1.4 * Math.sin(Math.PI * Math.min(0.12 + t * 0.95, 1)) ** 0.7 * (t > 0.85 ? 1 - (t - 0.85) * 4 : 1)
    const keel = 0.65 * Math.sin(Math.PI * Math.min(0.08 + t * 0.95, 1)) ** 0.5
    const sheer = 1.25 + 0.5 * (2 * t - 1) ** 4 + (t > 0.8 ? (t - 0.8) * 1.2 : 0)
    return { width: Math.max(width, 0.05), keel, sheer }
  }

  // Hull lofted through cross-sections from stern to bow; a transom closes the stern
  setHull() {
    const sections = 28
    const profile = [[-1, 1], [-0.97, 0.45], [-0.82, -0.1], [-0.45, -0.75], [0, -1]]
    const ring = [...profile, ...profile.slice(0, -1).reverse().map(([u, v]) => [-u, v])]
    const positions = []
    const uvs = []

    for (let i = 0; i <= sections; i++) {
      const x = -this.length / 2 + (i / sections) * this.length
      const { width, keel, sheer } = this.hullSection(x)
      ring.forEach(([u, v], j) => {
        // v = 1 at the sheer, -1 at the keel
        const y = v >= 0 ? v * sheer : v * keel
        positions.push(x, y, u * width)
        uvs.push(i / sections, j / (ring.length - 1))
      })
    }

    const indices = []
    const perRing = ring.length
    for (let i = 0; i < sections; i++) {
      for (let j = 0; j < perRing - 1; j++) {
        const a = i * perRing + j
        const b = a + perRing
        // Wound so the faces point outward (the ink outline only draws back faces)
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
    // Transom: fan over the stern ring
    for (let j = 1; j < perRing - 1; j++) indices.push(0, j, j + 1)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    const hull = new THREE.Mesh(geometry, this.toon('#ffffff', { map: this.createHullTexture() }))
    // Inner lining: the inside of the bulwarks, seen from the deck (otherwise you'd see through to the outline)
    const lining = new THREE.Mesh(geometry, this.toon('#a8693a', { side: THREE.BackSide }))
    const outline = new THREE.Mesh(geometry, this.outlineMaterial)
    outline.scale.set(1.025, 1.05, 1.06)
    this.group.add(hull, lining, outline)

    // Deck: the hull's top outline, a little below the sheer so the sides form a bulwark
    const deckShape = new THREE.Shape()
    for (let i = 0; i <= sections; i++) {
      const x = -this.length / 2 + (i / sections) * this.length
      const z = this.hullSection(x).width * 0.94
      if (i === 0) deckShape.moveTo(x, z)
      else deckShape.lineTo(x, z)
    }
    for (let i = sections; i >= 0; i--) {
      const x = -this.length / 2 + (i / sections) * this.length
      deckShape.lineTo(x, -this.hullSection(x).width * 0.94)
    }
    const deck = new THREE.Mesh(new THREE.ShapeGeometry(deckShape).rotateX(-Math.PI / 2), this.toon('#c8955f'))
    deck.position.y = this.deckHeight
    deck.receiveShadow = true
    this.group.add(deck)
  }

  // Bands across the hull's height (v runs sheer, side, keel, side, sheer): cream gunwale, planked sides,
  // dark below the waterline
  createHullTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    const band = (from, to, color) => {
      ctx.fillStyle = color
      ctx.fillRect(0, (1 - to) * 256, 64, (to - from) * 256)
    }
    band(0, 1, '#b8743a')
    band(0.4, 0.6, '#5b2f1d')
    band(0, 0.08, '#f0d6a0')
    band(0.92, 1, '#f0d6a0')
    ctx.fillStyle = '#9a5f2e'
    for (const v of [0.14, 0.22, 0.3, 0.7, 0.78, 0.86]) ctx.fillRect(0, (1 - v) * 256, 64, 2)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  outlined(geometry, material, position, outlineScale = new THREE.Vector3(1.06, 1.06, 1.06), parent = this.group) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    const hull = new THREE.Mesh(geometry, this.outlineMaterial)
    hull.position.copy(position)
    hull.scale.copy(outlineScale)
    parent.add(mesh, hull)
    return mesh
  }

  setCabin() {
    const y = this.deckHeight
    this.outlined(new THREE.BoxGeometry(1.3, 0.9, 1.9), this.toon('#d9a066'), new THREE.Vector3(-2.3, y + 0.45, 0))
    this.outlined(new THREE.BoxGeometry(1.5, 0.15, 2.1), this.toon('#f0d6a0'), new THREE.Vector3(-2.3, y + 0.97, 0))
    // Round windows on both sides
    const porthole = new THREE.CircleGeometry(0.14, 16)
    for (const side of [-1, 1]) {
      for (const x of [-2.6, -2.0]) {
        const window = new THREE.Mesh(porthole, new THREE.MeshBasicMaterial({ color: '#2a2833' }))
        window.position.set(x, y + 0.5, side * 0.96)
        window.rotation.y = side > 0 ? 0 : Math.PI
        window.userData.noShadow = true
        this.group.add(window)
      }
    }
  }

  setMast() {
    const y = this.deckHeight
    const wood = this.toon('#7a4a2a')
    const mastHeight = 5
    this.outlined(new THREE.CylinderGeometry(0.08, 0.11, mastHeight, 10), wood, new THREE.Vector3(0.3, y + mastHeight / 2, 0), new THREE.Vector3(1.5, 1.01, 1.5))

    // Yard (horizontal spar) and the sail hanging from it, bulging forward like it's full of wind
    const yardY = y + 4
    const yard = this.outlined(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8), wood, new THREE.Vector3(0.38, yardY, 0), new THREE.Vector3(1.6, 1.01, 1.6))
    yard.rotation.x = Math.PI / 2
    yard.parent.children.at(-1).rotation.x = Math.PI / 2

    const sailWidth = 3
    const sailHeight = 2.6
    const sailGeometry = new THREE.PlaneGeometry(sailWidth, sailHeight, 12, 8)
    const position = sailGeometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      const across = position.getX(i) / (sailWidth / 2)
      const down = position.getY(i) / (sailHeight / 2)
      position.setZ(i, 0.45 * (1 - across * across) * (1 - down * down * 0.6))
    }
    sailGeometry.computeVertexNormals()
    // Plane faces +z; turn it so the bulge points toward the bow (+x) and its width spans the deck (z)
    sailGeometry.rotateY(Math.PI / 2)
    this.sail = new THREE.Mesh(sailGeometry, this.toon('#ffffff', { map: this.createSailTexture(), side: THREE.DoubleSide }))
    this.sail.position.set(0.45, yardY - sailHeight / 2 - 0.05, 0)
    this.group.add(this.sail)

    // Crow's nest above the yard, and a pennant at the top
    this.outlined(new THREE.CylinderGeometry(0.38, 0.32, 0.35, 14, 1, true), this.toon('#9a6238', { side: THREE.DoubleSide }), new THREE.Vector3(0.3, y + 4.55, 0), new THREE.Vector3(1.08, 1.1, 1.08))
    const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.35).translate(-0.45, 0, 0), this.toon('#d6202f', { side: THREE.DoubleSide }))
    pennant.position.set(0.3, y + mastHeight - 0.1, 0)
    this.pennant = pennant
    this.group.add(pennant)
  }

  // Cream sail with red bands top and bottom and a straw hat in the middle (no skull: a hat, not a flag)
  createSailTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 224
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fbf3df'
    ctx.fillRect(0, 0, 256, 224)
    ctx.fillStyle = '#d6202f'
    ctx.fillRect(0, 10, 256, 14)
    ctx.fillRect(0, 200, 256, 14)

    // Straw hat: wide brim, rounded crown, red band
    const cx = 128
    const cy = 120
    ctx.fillStyle = '#f2c14e'
    ctx.beginPath()
    ctx.ellipse(cx, cy + 14, 78, 20, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx, cy, 44, 38, 0, Math.PI, 0)
    ctx.lineTo(cx + 44, cy + 10)
    ctx.lineTo(cx - 44, cy + 10)
    ctx.fill()
    ctx.fillStyle = '#d6202f'
    ctx.fillRect(cx - 44, cy - 6, 88, 13)
    ctx.strokeStyle = '#1a1626'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.ellipse(cx, cy + 14, 78, 20, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(cx, cy, 44, 38, 0, Math.PI, 0)
    ctx.stroke()

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  setBowsprit() {
    const tip = this.length / 2
    const bowsprit = this.outlined(
      new THREE.CylinderGeometry(0.05, 0.08, 1.8, 8),
      this.toon('#7a4a2a'),
      new THREE.Vector3(tip + 0.4, this.hullSection(tip - 0.2).sheer + 0.15, 0),
      new THREE.Vector3(1.6, 1.02, 1.6)
    )
    bowsprit.rotation.z = -Math.PI / 2 + 0.35
    bowsprit.parent.children.at(-1).rotation.z = bowsprit.rotation.z
  }

  // Pennant flutter
  update(elapsed) {
    this.pennant.rotation.y = Math.sin(elapsed * 3) * 0.3
  }
}
