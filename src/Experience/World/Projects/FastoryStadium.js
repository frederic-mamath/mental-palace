import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'
import { createRandom } from '../Decor/scatter.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import ZoneRing from '../Effects/ZoneRing.js'
import { focusPose } from './focusPose.js'

// Fastory's brand: dark blue letters, yellow borders, white for the rest
const colors = { blue: '#1d2b64', yellow: '#f7c21b', white: '#f7f7f4', ink: '#1a1626', pad: '#d8cdb6', grass: '#5fbf4f', steel: '#9aa1ab' }

// Stands: three tiers around an elliptical pitch, open toward the city
const bowl = { innerX: 4.6, innerZ: 7.6, tier: 0.9, tiers: 3, tierHeight: 0.6, openHalfAngle: 0.75 }
const outerX = bowl.innerX + bowl.tier * bowl.tiers
const outerZ = bowl.innerZ + bowl.tier * bowl.tiers

// Project landmark: a football stadium on the city's cape, for Fastory (mobile ads turned into games).
// A horseshoe of stands in the brand colors around the pitch, open toward the city, four floodlights,
// and a giant vertical phone as the scoreboard, showing a story-style ad. Fans fill the stands; a tap
// sends a wave around them and confetti over the pitch.
//
// Implements the landmark interface documented in DoubleTap.js. Local axes: x along the flight path
// (away from the city), z across it (the pitch's length), y up; the open side faces -x.
export default class FastoryStadium {
  constructor({ project, frame, along, across }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time

    this.project = project
    this.gradientMap = createGradientMap()
    this.outlineMaterial = createOutlineMaterial()
    this.random = createRandom(31)

    this.group = new THREE.Group()
    frame.toWorld(along, across, 0, this.group.position)
    this.group.rotation.y = frame.yaw
    this.scene.add(this.group)

    this.active = false
    this.isOpen = false
    this.waveStart = -1e5

    this.setGround()
    this.setPitch()
    this.setStands()
    this.setFloodlights()
    this.setScreen()
    this.setFans()
    this.setConfetti()

    // Stand at the open side, facing the pitch and the screen, to interact
    this.front = new THREE.Group()
    this.front.position.set(-bowl.innerX - 1, 0, 0)
    this.group.add(this.front)
    this.group.updateMatrixWorld(true)
    this.zone = { position: this.front.getWorldPosition(new THREE.Vector3()), radius: 3.4 }
    this.ring = new ZoneRing({ parent: this.front, radius: 3.1, kind: 'experience' })
    this.setColliders(frame)

    this.group.traverse((child) => {
      if (child.isMesh && child.material !== this.outlineMaterial && !child.userData.noShadow) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }

  toon(color, options = {}) {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.gradientMap, ...options })
  }

  // Adds `mesh` with an ink hull scaled by `outline` (a number or [x, y, z])
  outlined(mesh, outline = 1.06, parent = this.group) {
    const hull = new THREE.Mesh(mesh.geometry, this.outlineMaterial)
    hull.position.copy(mesh.position)
    hull.rotation.copy(mesh.rotation)
    if (Array.isArray(outline)) hull.scale.set(...outline)
    else hull.scale.setScalar(outline)
    parent.add(mesh, hull)
    return mesh
  }

  // A point on the ellipse of half-axes (x, z) at parametric angle t (0 = far side, +x)
  ellipsePoint(x, z, t, y = 0) {
    return new THREE.Vector3(Math.cos(t) * x, y, Math.sin(t) * z)
  }

  // Stone pad under the whole stadium, and the screen's apron
  setGround() {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 64).translate(0, 0.04, 0), this.toon(colors.pad))
    pad.scale.set(outerX + 0.8, 1, outerZ + 0.8)
    this.group.add(pad)
  }

  setPitch() {
    const width = 6.2
    const length = 10.6
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(width, length), this.toon('#ffffff', { map: this.createPitchTexture() }))
    pitch.rotation.x = -Math.PI / 2
    pitch.position.y = 0.09
    this.group.add(pitch)

    // Goals at both ends: white posts and crossbar, a dark net at the back
    const white = this.toon(colors.white)
    const net = new THREE.MeshBasicMaterial({ color: '#c9ced6', transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    for (const side of [-1, 1]) {
      const goal = new THREE.Group()
      goal.position.set(0, 0.09, side * (length / 2 - 0.05))
      this.group.add(goal)
      for (const x of [-0.8, 0.8]) this.outlined(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1).translate(x, 0.4, 0), white), 1.25, goal)
      this.outlined(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.1).translate(0, 0.8, 0), white), 1.25, goal)
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.75), net)
      back.position.set(0, 0.4, side * 0.45)
      back.userData.noShadow = true
      goal.add(back)
    }

    // A ball on the penalty spot
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), this.toon(colors.white))
    ball.position.set(0, 0.25, -length / 2 + 1.3)
    this.outlined(ball, 1.15)
  }

  // Mown stripes and white lines (canvas v runs along the pitch's length, z)
  createPitchTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 248
    canvas.height = 424
    const ctx = canvas.getContext('2d')
    const { width: w, height: h } = canvas
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? '#5fbf4f' : '#54ad45'
      ctx.fillRect(0, (i * h) / 10, w, h / 10 + 1)
    }
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4
    const m = 10
    ctx.strokeRect(m, m, w - 2 * m, h - 2 * m)
    ctx.beginPath()
    ctx.moveTo(m, h / 2)
    ctx.lineTo(w - m, h / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 34, 0, Math.PI * 2)
    ctx.stroke()
    for (const top of [true, false]) {
      const y = top ? m : h - m - 70
      ctx.strokeRect(w / 2 - 70, y, 140, 70)
      ctx.strokeRect(w / 2 - 34, top ? m : h - m - 28, 68, 28)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  // Ring sector between two ellipses, open around -x, extruded up by `height` (caps = material 0, sides = 1)
  createSector(innerX, innerZ, outX, outZ, height) {
    const start = -(Math.PI - bowl.openHalfAngle)
    const end = Math.PI - bowl.openHalfAngle
    const shape = new THREE.Shape()
    shape.absellipse(0, 0, outX, outZ, start, end, false)
    shape.absellipse(0, 0, innerX, innerZ, end, start, true)
    // Shape y becomes -z: the sector is symmetric, so only the winding matters
    return new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 48 }).rotateX(-Math.PI / 2)
  }

  // Three tiers of dark blue seats on white risers, and a white back wall topped with a yellow border
  setStands() {
    const seats = this.toon(colors.blue)
    const risers = this.toon(colors.white)
    for (let i = 0; i < bowl.tiers; i++) {
      const geometry = this.createSector(bowl.innerX + i * bowl.tier, bowl.innerZ + i * bowl.tier, outerX, outerZ, bowl.tierHeight * (i + 1))
      this.group.add(new THREE.Mesh(geometry, [seats, risers]))
    }
    this.wallHeight = bowl.tierHeight * bowl.tiers + 0.7
    const wall = new THREE.Mesh(this.createSector(outerX, outerZ, outerX + 0.25, outerZ + 0.25, this.wallHeight), [risers, risers])
    this.outlined(wall, [1.012, 1.02, 1.012])
    const border = new THREE.Mesh(this.createSector(outerX - 0.05, outerZ - 0.05, outerX + 0.3, outerZ + 0.3, 0.22), this.toon(colors.yellow))
    border.position.y = this.wallHeight
    this.outlined(border, [1.012, 1.25, 1.012])
  }

  // Tall steel masts outside the stands, their lamp panels tilted toward the pitch
  setFloodlights() {
    const steel = this.toon(colors.steel)
    const lamp = new THREE.MeshBasicMaterial({ color: '#fff4c2' })
    this.lamps = []
    for (const t of [0.6, -0.6, 2.05, -2.05]) {
      const base = this.ellipsePoint(outerX + 0.9, outerZ + 0.9, t)
      const mast = new THREE.Group()
      mast.position.copy(base)
      mast.rotation.y = Math.atan2(base.x, base.z) + Math.PI // local +z toward the pitch's center
      this.group.add(mast)
      this.outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 8, 8).translate(0, 4, 0), steel), [1.35, 1.01, 1.35], mast)

      const head = new THREE.Group()
      head.position.set(0, 8.2, 0)
      head.rotation.x = 0.55
      mast.add(head)
      this.outlined(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.2), steel), [1.06, 1.1, 1.4], head)
      for (let row = 0; row < 2; row++) {
        for (let column = 0; column < 3; column++) {
          const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.34), lamp)
          bulb.position.set(-0.5 + column * 0.5, 0.22 - row * 0.44, 0.11)
          bulb.userData.noShadow = true
          head.add(bulb)
        }
      }
      this.lamps.push(head)
    }
  }

  // The scoreboard: a giant vertical phone behind the far stands, facing the open side, showing a
  // story-style mobile ad (mobile-first, like Fastory's)
  setScreen() {
    const width = 3.4
    const height = 6
    this.screenSize = { width, height }
    const screen = new THREE.Group()
    screen.position.set(outerX + 1.1, 3.1, 0)
    screen.rotation.y = -Math.PI / 2 // local +z (the display) toward -x
    this.group.add(screen)
    this.screen = screen

    // Two legs down to the ground
    const steel = this.toon(colors.steel)
    for (const x of [-0.9, 0.9]) this.outlined(new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 0.3).translate(x, -1.6, -0.1), steel), [1.2, 1.01, 1.2], screen)

    // Body: a rounded rectangle, then the display
    const body = new THREE.Shape()
    const r = 0.45
    body.moveTo(-width / 2 + r, 0)
    body.lineTo(width / 2 - r, 0)
    body.quadraticCurveTo(width / 2, 0, width / 2, r)
    body.lineTo(width / 2, height - r)
    body.quadraticCurveTo(width / 2, height, width / 2 - r, height)
    body.lineTo(-width / 2 + r, height)
    body.quadraticCurveTo(-width / 2, height, -width / 2, height - r)
    body.lineTo(-width / 2, r)
    body.quadraticCurveTo(-width / 2, 0, -width / 2 + r, 0)
    const bodyGeometry = new THREE.ExtrudeGeometry(body, { depth: 0.3, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -0.3)
    this.outlined(new THREE.Mesh(bodyGeometry, this.toon('#22202b')), [1.03, 1.02, 1.3], screen)

    this.screenCanvas = document.createElement('canvas')
    this.screenCanvas.width = 288
    this.screenCanvas.height = 512
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas)
    this.screenTexture.colorSpace = THREE.SRGBColorSpace
    this.screenTexture.anisotropy = 4
    this.drawScreen()
    const display = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.3, height - 0.3), new THREE.MeshBasicMaterial({ map: this.screenTexture }))
    display.position.set(0, height / 2, 0.01)
    display.userData.noShadow = true
    screen.add(display)
  }

  // A story ad: progress bars at the top, the brand, the years, a "tap to play" button, a swipe-up hint
  drawScreen() {
    const ctx = this.screenCanvas.getContext('2d')
    const { width: w, height: h } = this.screenCanvas
    const font = '-apple-system, "Helvetica Neue", Arial, sans-serif'
    ctx.fillStyle = colors.white
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = colors.yellow
    ctx.lineWidth = 14
    ctx.strokeRect(7, 7, w - 14, h - 14)

    // Story progress bars
    const bars = 4
    const gap = 6
    const barWidth = (w - 48 - gap * (bars - 1)) / bars
    for (let i = 0; i < bars; i++) {
      const x = 24 + i * (barWidth + gap)
      ctx.fillStyle = '#d5d8e2'
      ctx.fillRect(x, 26, barWidth, 6)
      ctx.fillStyle = colors.blue
      ctx.fillRect(x, 26, barWidth * (i < 2 ? 1 : i === 2 ? 0.5 : 0), 6)
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = colors.blue
    ctx.font = `900 52px ${font}`
    ctx.fillText('FASTORY', w / 2, 120)
    ctx.font = `600 22px ${font}`
    ctx.fillText('2018 – 2020', w / 2, 166)

    // A ball in the middle, like a game about to start
    ctx.beginPath()
    ctx.arc(w / 2, 272, 54, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = colors.blue
    ctx.stroke()
    ctx.fillStyle = colors.blue
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5
      ctx.lineTo(w / 2 + Math.cos(angle) * 20, 272 + Math.sin(angle) * 20)
    }
    ctx.fill()

    // Button
    ctx.fillStyle = colors.yellow
    ctx.beginPath()
    ctx.roundRect(44, 368, w - 88, 58, 29)
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = colors.blue
    ctx.stroke()
    ctx.fillStyle = colors.blue
    ctx.font = `800 24px ${font}`
    ctx.fillText('TAP TO PLAY', w / 2, 398)

    // Swipe-up chevron
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(w / 2 - 16, 474)
    ctx.lineTo(w / 2, 460)
    ctx.lineTo(w / 2 + 16, 474)
    ctx.stroke()

    this.screenTexture.needsUpdate = true
  }

  // Fans on the tiers, in the brand's colors: a body and a head each (instanced), seeded
  setFans() {
    const spots = []
    const start = -(Math.PI - bowl.openHalfAngle) + 0.08
    const end = Math.PI - bowl.openHalfAngle - 0.08
    for (let i = 0; i < bowl.tiers; i++) {
      const x = bowl.innerX + (i + 0.5) * bowl.tier
      const z = bowl.innerZ + (i + 0.5) * bowl.tier
      const y = bowl.tierHeight * (i + 1)
      const steps = Math.floor(((end - start) * (x + z)) / 2 / 0.55)
      for (let s = 0; s <= steps; s++) {
        const t = start + ((end - start) * s) / steps
        if (this.random() < 0.35) continue
        spots.push({ position: this.ellipsePoint(x, z, t, y), t })
      }
    }
    this.fanSpots = spots

    const geometry = new THREE.CapsuleGeometry(0.14, 0.18, 3, 8).translate(0, 0.23, 0)
    const head = new THREE.SphereGeometry(0.12, 10, 8).translate(0, 0.55, 0)
    const merged = mergeGeometries([geometry, head])
    this.fans = new THREE.InstancedMesh(merged, this.toon('#ffffff'), spots.length)
    this.fanOutlines = new THREE.InstancedMesh(merged, this.outlineMaterial, spots.length)
    const palette = [colors.blue, colors.yellow, colors.white, colors.blue].map((color) => new THREE.Color(color))
    spots.forEach((spot, i) => {
      this.fans.setColorAt(i, palette[Math.floor(this.random() * palette.length)])
      spot.phase = this.random() * Math.PI * 2
    })
    this.fans.castShadow = true
    this.group.add(this.fans, this.fanOutlines)
    this.updateFans(0)
  }

  updateFans(elapsed) {
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const waveAge = elapsed - this.waveStart
    this.fanSpots.forEach((spot, i) => {
      // Cheering hop when someone is around; the wave runs around the horseshoe after a tap
      let lift = this.active || this.isOpen ? Math.max(Math.sin(elapsed * 7 + spot.phase), 0) * 0.08 : 0
      const progress = (spot.t + Math.PI) / (Math.PI * 2) // 0..1 around the stands
      const wave = waveAge * 0.7 - progress
      if (wave > 0 && wave < 0.12) lift = Math.max(lift, Math.sin((wave / 0.12) * Math.PI) * 0.35)
      position.copy(spot.position).setY(spot.position.y + lift)
      // Face the pitch's center
      quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(-spot.position.x, -spot.position.z))
      this.fans.setMatrixAt(i, matrix.compose(position, quaternion, scale.set(1, 1 + lift * 0.6, 1)))
      this.fanOutlines.setMatrixAt(i, matrix.compose(position, quaternion, scale.set(1.15, 1.08 + lift * 0.6, 1.15)))
    })
    this.fans.instanceMatrix.needsUpdate = true
    this.fanOutlines.instanceMatrix.needsUpdate = true
  }

  // Confetti in the brand's colors, thrown over the pitch on a tap
  setConfetti() {
    const count = 90
    this.confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), count)
    this.confetti.userData.noShadow = true
    this.confetti.frustumCulled = false
    const palette = [colors.blue, colors.yellow, '#ffffff'].map((color) => new THREE.Color(color))
    this.confettiPieces = Array.from({ length: count }, (_, i) => {
      this.confetti.setColorAt(i, palette[i % palette.length])
      return { position: new THREE.Vector3(), velocity: new THREE.Vector3(), spin: new THREE.Vector3(), age: Infinity }
    })
    this.group.add(this.confetti)
    this.updateConfetti(0)
  }

  throwConfetti() {
    for (const piece of this.confettiPieces) {
      piece.position.set((Math.random() - 0.5) * 4, 0.5, (Math.random() - 0.5) * 7)
      piece.velocity.set((Math.random() - 0.5) * 3, 7 + Math.random() * 4, (Math.random() - 0.5) * 3)
      piece.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8)
      piece.age = 0
    }
  }

  updateConfetti(delta) {
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const euler = new THREE.Euler()
    const visible = new THREE.Vector3(1, 1, 1)
    const hidden = new THREE.Vector3(0, 0, 0)
    this.confettiPieces.forEach((piece, i) => {
      piece.age += delta
      const alive = piece.age < 3.5 && piece.position.y > 0.1
      if (alive) {
        // Up fast, then a slow fluttering fall (heavy drag)
        piece.velocity.y -= 9 * delta
        piece.velocity.multiplyScalar(Math.exp(-1.6 * delta))
        piece.position.addScaledVector(piece.velocity, delta)
        piece.position.x += Math.sin(piece.age * 5 + i) * delta * 0.6
      }
      euler.set(piece.spin.x * piece.age, piece.spin.y * piece.age, piece.spin.z * piece.age)
      this.confetti.setMatrixAt(i, matrix.compose(piece.position, quaternion.setFromEuler(euler), alive ? visible : hidden))
    })
    this.confetti.instanceMatrix.needsUpdate = true
  }

  // Circles along the stands (the pitch stays open to walk on), plus the masts and the screen's legs
  setColliders(frame) {
    this.colliders = []
    const world = (local) => this.group.localToWorld(local)
    const x = (bowl.innerX + outerX + 0.25) / 2
    const z = (bowl.innerZ + outerZ + 0.25) / 2
    const half = (outerX + 0.25 - bowl.innerX) / 2
    const end = Math.PI - bowl.openHalfAngle
    const steps = Math.ceil((2 * end * (x + z)) / 2 / 1.1)
    for (let s = 0; s <= steps; s++) {
      const t = -end + (2 * end * s) / steps
      this.colliders.push({ position: world(this.ellipsePoint(x, z, t)), radius: half + 0.2 })
    }
    for (const lamp of this.lamps) this.colliders.push({ position: world(lamp.parent.position.clone()), radius: 0.4 })
    this.colliders.push({ position: world(new THREE.Vector3(outerX + 1.2, 0, 0)), axis: frame.u, halfLength: 0.4, halfWidth: 1.3 })
  }

  // --- Landmark interface ---

  get pickTargets() {
    return [this.group]
  }

  getPromptAnchor(target = new THREE.Vector3()) {
    return this.group.localToWorld(target.set(-bowl.innerX - 1, 3, 0))
  }

  // From above the open side, looking down over the pitch to the screen, the stadium beside the card
  getFocusPose(viewport, fov) {
    const quaternion = this.group.getWorldQuaternion(new THREE.Quaternion())
    return focusPose(
      {
        center: this.group.localToWorld(new THREE.Vector3(1.5, 3.6, 0)),
        normal: new THREE.Vector3(-1, 0, 0).applyQuaternion(quaternion),
        right: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion),
        up: new THREE.Vector3(0, 1, 0),
        height: 10,
        // Phones: mostly the screen and the far stands
        narrowHeight: 8.5,
        // High enough to look over the city blocks behind the camera
        elevation: 0.55,
      },
      viewport,
      fov
    )
  }

  setActive(active) {
    this.active = active
    this.ring.setActive(active)
  }

  setOpen(open) {
    this.isOpen = open
  }

  // A tap: the crowd does a wave and confetti flies over the pitch
  react() {
    this.waveStart = this.time.elapsed
    this.throwConfetti()
  }

  update() {
    const delta = this.time.delta
    const elapsed = this.time.elapsed
    this.ring.update(delta, elapsed)
    this.updateFans(elapsed)
    this.updateConfetti(Math.min(delta, 0.05))
  }
}
