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
// and a giant vertical phone as the scoreboard, playing a story-style ad (the brand, a sweepstakes, a
// leaderboard). A sweepstakes wheel on the pitch spins when someone walks up. Fans fill the stands; a tap
// sends a wave around them and confetti over the pitch, and scores points for "YOU" on the leaderboard.
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
    this.setStory()
    this.setScreen()
    this.setWheel()
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

  // The screen plays a story ad, three slides on a loop, like the mobile stories Fastory built: the brand,
  // a sweepstakes, then a leaderboard where the visitor ("YOU") climbs with every tap
  setStory() {
    this.story = { slides: ['brand', 'sweepstakes', 'leaderboard'], slide: 0, time: 0, duration: 4.5, redraw: 0 }
    this.players = this.project.leaderboard.map((player) => ({ ...player }))
    this.you = this.players.find((player) => player.you)
    this.youFlash = 0
  }

  drawScreen() {
    const ctx = this.screenCanvas.getContext('2d')
    const { width: w, height: h } = this.screenCanvas
    const font = '-apple-system, "Helvetica Neue", Arial, sans-serif'
    const { slides, slide, time, duration } = this.story
    ctx.fillStyle = colors.white
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = colors.yellow
    ctx.lineWidth = 14
    ctx.strokeRect(7, 7, w - 14, h - 14)

    // Story progress bars: past slides full, the current one filling up
    const gap = 6
    const barWidth = (w - 48 - gap * (slides.length - 1)) / slides.length
    for (let i = 0; i < slides.length; i++) {
      const x = 24 + i * (barWidth + gap)
      ctx.fillStyle = '#d5d8e2'
      ctx.fillRect(x, 26, barWidth, 6)
      ctx.fillStyle = colors.blue
      ctx.fillRect(x, 26, barWidth * (i < slide ? 1 : i === slide ? Math.min(time / duration, 1) : 0), 6)
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const title = (text, size = 52) => {
      ctx.fillStyle = colors.blue
      ctx.font = `900 ${size}px ${font}`
      ctx.fillText(text, w / 2, 120)
    }
    const subtitle = (text) => {
      ctx.fillStyle = colors.blue
      ctx.font = `600 22px ${font}`
      ctx.fillText(text, w / 2, 166)
    }
    const button = (text) => {
      ctx.fillStyle = colors.yellow
      ctx.beginPath()
      ctx.roundRect(44, 368, w - 88, 58, 29)
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = colors.blue
      ctx.stroke()
      ctx.fillStyle = colors.blue
      ctx.font = `800 24px ${font}`
      ctx.fillText(text, w / 2, 398)
      // Swipe-up chevron
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(w / 2 - 16, 474)
      ctx.lineTo(w / 2, 460)
      ctx.lineTo(w / 2 + 16, 474)
      ctx.stroke()
    }

    if (slides[slide] === 'brand') {
      title('FASTORY')
      subtitle('2018 – 2020')
      // A ball, like a game about to start
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
      button('TAP TO PLAY')
    } else if (slides[slide] === 'sweepstakes') {
      title('SWEEPSTAKES', 33)
      subtitle('Play to win a prize')
      // A gift box that hops
      const hop = Math.abs(Math.sin(time * 4)) * 12
      const y = 290 - hop
      ctx.lineWidth = 5
      ctx.strokeStyle = colors.blue
      ctx.fillStyle = colors.blue
      ctx.fillRect(w / 2 - 56, y - 30, 112, 82)
      ctx.fillStyle = '#2c3d86'
      ctx.fillRect(w / 2 - 64, y - 56, 128, 28)
      ctx.strokeRect(w / 2 - 64, y - 56, 128, 28)
      ctx.fillStyle = colors.yellow
      ctx.fillRect(w / 2 - 10, y - 56, 20, 108)
      ctx.beginPath()
      ctx.ellipse(w / 2 - 22, y - 66, 22, 12, -0.4, 0, Math.PI * 2)
      ctx.ellipse(w / 2 + 22, y - 66, 22, 12, 0.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      button('SPIN TO WIN')
    } else {
      title('LEADERBOARD', 32)
      subtitle('This week')
      const ranked = [...this.players].sort((a, b) => b.score - a.score).slice(0, 5)
      ranked.forEach((player, i) => {
        const y = 214 + i * 50
        const flash = player.you && this.youFlash > 0 && Math.sin(this.youFlash * 30) > 0
        if (player.you) {
          ctx.fillStyle = flash ? colors.blue : colors.yellow
          ctx.beginPath()
          ctx.roundRect(28, y - 21, w - 56, 42, 12)
          ctx.fill()
        }
        const ink = flash ? colors.yellow : colors.blue
        ctx.fillStyle = ink
        ctx.font = `900 24px ${font}`
        ctx.textAlign = 'left'
        ctx.fillText(`${i + 1}`, 42, y + 1)
        ctx.font = `${player.you ? 900 : 700} 22px ${font}`
        ctx.fillText(player.name, 76, y + 1)
        ctx.textAlign = 'right'
        ctx.font = `800 22px ${font}`
        ctx.fillText(player.score.toLocaleString('en-US'), w - 42, y + 1)
        ctx.textAlign = 'center'
      })
      ctx.fillStyle = colors.blue
      ctx.font = `700 18px ${font}`
      ctx.fillText('Tap to score!', w / 2, 474)
    }

    this.screenTexture.needsUpdate = true
  }

  updateStory(delta) {
    const story = this.story
    story.time += delta
    this.youFlash = Math.max(this.youFlash - delta, 0)
    if (story.time >= story.duration) {
      story.slide = (story.slide + 1) % story.slides.length
      story.time = 0
    }
    // Redraw about 15 times a second: enough for the bars and the hopping gift
    story.redraw -= delta
    if (story.redraw <= 0) {
      story.redraw = 1 / 15
      this.drawScreen()
    }
  }

  // A tap scores points for the visitor, shown at once on the leaderboard
  score() {
    this.you.score += 350
    this.youFlash = 0.6
    this.story.slide = this.story.slides.indexOf('leaderboard')
    this.story.time = 0
    this.story.redraw = 0
  }

  // Sweepstakes wheel on the pitch's center spot, facing the open side: spun when someone walks up
  setWheel() {
    const radius = 1.25
    this.wheelSegments = this.project.wheel
    const stand = new THREE.Group()
    stand.position.set(0.4, 0.09, 0)
    stand.rotation.y = -Math.PI / 2 // local +z (the wheel's face) toward -x
    this.group.add(stand)
    this.wheelStand = stand

    const steel = this.toon(colors.steel)
    this.outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.18, 16).translate(0, 0.09, 0), steel), [1.08, 1.2, 1.08], stand)
    this.outlined(new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.6, 0.22).translate(0, 0.9, -0.15), steel), [1.25, 1.02, 1.25], stand)

    this.wheel = new THREE.Group()
    this.wheel.position.set(0, 1.75, 0)
    stand.add(this.wheel)
    const face = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), this.toon('#ffffff', { map: this.createWheelTexture() }))
    face.position.z = 0.06
    this.wheel.add(face)
    this.outlined(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.1, 48).rotateX(Math.PI / 2), this.toon(colors.blue)), [1.04, 1.04, 1.5], this.wheel)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.07, 8, 48), this.toon(colors.yellow))
    rim.position.z = 0.07
    this.wheel.add(rim)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16).rotateX(Math.PI / 2), this.toon(colors.yellow))
    hub.position.z = 0.1
    this.outlined(hub, 1.2, this.wheel)

    // Pointer at the top, pointing down into the wheel
    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 3).rotateZ(Math.PI), this.toon(colors.yellow))
    pointer.position.set(0, 1.75 + radius + 0.12, 0.12)
    this.outlined(pointer, 1.2, stand)
    this.pointer = pointer

    this.spin = { angle: 0, speed: 0, bump: 0 }
  }

  // Segments in brand colors with their prizes (a "WIN" segment throws confetti when it comes up)
  createWheelTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    const font = '-apple-system, "Helvetica Neue", Arial, sans-serif'
    const count = this.wheelSegments.length
    const step = (Math.PI * 2) / count
    const fills = [colors.blue, colors.yellow, colors.white]
    for (let i = 0; i < count; i++) {
      // Segment i centered straight up (canvas angle -PI/2) when the wheel's angle is i * step
      const middle = -Math.PI / 2 - i * step
      const fill = fills[i % fills.length]
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.moveTo(128, 128)
      ctx.arc(128, 128, 128, middle - step / 2, middle + step / 2)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = colors.ink
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.save()
      ctx.translate(128, 128)
      ctx.rotate(middle)
      ctx.fillStyle = fill === colors.blue ? colors.white : colors.blue
      ctx.font = `900 22px ${font}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(this.wheelSegments[i], 116, 1)
      ctx.restore()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  spinWheel() {
    this.spin.speed += 9 + Math.random() * 5
  }

  updateWheel(delta) {
    const spin = this.spin
    if (spin.speed > 0) {
      spin.angle += spin.speed * delta
      spin.speed *= Math.exp(-1.1 * delta)
      spin.speed = Math.max(spin.speed - 0.8 * delta, 0)
      if (spin.speed === 0) {
        // Stopped: the pointer hops, and a winning draw throws confetti
        spin.bump = 1
        const step = (Math.PI * 2) / this.wheelSegments.length
        const index = ((Math.round(spin.angle / step) % this.wheelSegments.length) + this.wheelSegments.length) % this.wheelSegments.length
        if (this.wheelSegments[index] === 'WIN') this.throwConfetti()
      }
    }
    // The face's canvas angles run clockwise: turning the wheel by +angle brings segment angle / step up
    this.wheel.rotation.z = -spin.angle
    spin.bump = Math.max(spin.bump - delta * 2.5, 0)
    this.pointer.scale.setScalar(1 + Math.sin(spin.bump * Math.PI) * 0.35)
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

  // Circles along the stands (the pitch stays open to walk on), plus the masts, the wheel and the screen's legs
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
    this.colliders.push({ position: world(this.wheelStand.position.clone().setY(0)), radius: 0.65 })
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
    // Walking up to the stadium spins the sweepstakes wheel
    if (active && !this.active) this.spinWheel()
    this.active = active
    this.ring.setActive(active)
  }

  setOpen(open) {
    this.isOpen = open
  }

  // A tap: the crowd does a wave, confetti flies over the pitch, and the visitor scores on the leaderboard
  react() {
    this.waveStart = this.time.elapsed
    this.throwConfetti()
    this.score()
  }

  update() {
    const delta = this.time.delta
    const elapsed = this.time.elapsed
    this.ring.update(delta, elapsed)
    this.updateFans(elapsed)
    this.updateStory(delta)
    this.updateWheel(Math.min(delta, 0.05))
    this.updateConfetti(Math.min(delta, 0.05))
  }
}
