import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'
import ZoneRing from '../Effects/ZoneRing.js'
import { focusPose } from './focusPose.js'

const colors = { shell: '#c9ced6', wall: '#aeb4bd', floor: '#b9bcc4', ink: '#1a1626', navy: '#0b2a5b', red: '#d6202f', paper: '#f4f1e8', wood: '#b07a4f', ecu: '#3b4252' }

// Project landmark: an arched Air France Industries maintenance hangar beside the city runway, open to the
// runway, with the PROGNOS story inside as a diorama: paper repair records and USB keys, a workbench
// with a giant ECU, and a screen predicting the next failure. Paper sheets keep lifting off the stack and
// turn into data points as they fly into the screen.
//
// Implements the landmark interface documented in DoubleTap.js. Local axes: x along the runway (the
// hangar's width), z toward the runway (its open front), y up.
export default class AirFranceHangar {
  constructor({ project, frame, along, across }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time

    this.project = project
    this.size = { width: 9, depth: 7, shell: 0.25 }
    this.radius = this.size.width / 2
    this.gradientMap = createGradientMap()
    this.outlineMaterial = createOutlineMaterial()

    this.group = new THREE.Group()
    frame.toWorld(along, across, 0, this.group.position)
    this.group.rotation.y = frame.yaw
    this.scene.add(this.group)
    this.group.updateMatrixWorld()

    const { width, depth } = this.size
    // The diorama can't be entered: the whole footprint blocks the character
    this.collider = { position: this.group.position.clone(), axis: frame.u, halfLength: width / 2 + 0.1, halfWidth: depth / 2 + 0.1 }
    // Stand in front of the opening to interact
    this.front = new THREE.Group()
    this.front.position.set(0, 0, depth / 2 + 2.4)
    this.group.add(this.front)
    this.group.updateMatrixWorld()
    this.zone = { position: this.front.getWorldPosition(new THREE.Vector3()), radius: 3.4 }

    this.active = false
    this.isOpen = false
    this.burstUntil = 0
    this.bounce = { value: 0, velocity: 0 }

    this.setBuilding()
    // Warm work light over the bench, so the diorama reads inside the shaded shell
    const workLight = new THREE.PointLight('#ffe2b8', 12, 9, 1.5)
    workLight.position.set(0, 3.4, -0.6)
    this.group.add(workLight)
    this.setWorkbench()
    this.setRecords()
    this.setScreen()
    this.setSheets()
    this.ring = new ZoneRing({ parent: this.front, radius: 3.1, color: project.accent })

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

  box(width, height, depth, material, position, parent = this.group) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
    mesh.position.copy(position)
    parent.add(mesh)
    return mesh
  }

  // Concrete slab, barrel-vault shell open at the front, and a back wall carrying the sign
  setBuilding() {
    const { width, depth, shell } = this.size
    const radius = this.radius

    this.box(width + 0.6, 0.12, depth + 0.6, this.toon(colors.floor), new THREE.Vector3(0, 0.06, 0))

    // Arch ring extruded along z; its end faces (material group 0) are inked, outlining the arch openings
    const arch = new THREE.Shape()
    arch.absarc(0, 0, radius, 0, Math.PI, false)
    arch.absarc(0, 0, radius - shell, Math.PI, 0, true)
    const shellGeometry = new THREE.ExtrudeGeometry(arch, { depth, bevelEnabled: false, curveSegments: 32 }).translate(0, 0, -depth / 2)
    this.group.add(new THREE.Mesh(shellGeometry, [new THREE.MeshBasicMaterial({ color: colors.ink }), this.toon(colors.shell)]))

    // Back wall: a half disc with the painted sign, UVs spanning its bounding box
    const wallShape = new THREE.Shape()
    wallShape.absarc(0, 0, radius - shell, 0, Math.PI, false)
    wallShape.closePath()
    const wallGeometry = new THREE.ShapeGeometry(wallShape, 32)
    const position = wallGeometry.attributes.position
    const uv = wallGeometry.attributes.uv
    const wallRadius = radius - shell
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, (position.getX(i) + wallRadius) / (2 * wallRadius), position.getY(i) / wallRadius)
    }
    const wall = new THREE.Mesh(wallGeometry, this.toon('#ffffff', { map: this.createWallTexture() }))
    wall.position.z = -depth / 2 + 0.05
    this.group.add(wall)
  }

  createWallTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    const { width: w, height: h } = canvas
    const font = '-apple-system, "Helvetica Neue", Arial, sans-serif'

    ctx.fillStyle = colors.wall
    ctx.fillRect(0, 0, w, h)
    // Vertical panel seams
    ctx.fillStyle = '#9ea4ad'
    for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 2, h)

    // Sign band high on the wall, above the monitor (v ~ 0.62-0.78), narrow enough to fit the half disc
    // there, with the livery's stripes at its left end; the workshop's name just below it
    const bandTop = h * 0.22
    const bandHeight = h * 0.16
    const bandLeft = w * 0.2
    const bandWidth = w * 0.6
    ctx.fillStyle = colors.navy
    ctx.fillRect(bandLeft, bandTop, bandWidth, bandHeight)
    ctx.fillStyle = colors.red
    ctx.fillRect(bandLeft, bandTop, 9, bandHeight)
    ctx.fillStyle = colors.paper
    ctx.fillRect(bandLeft + 12, bandTop, 5, bandHeight)
    ctx.fillStyle = '#ffffff'
    ctx.font = `800 23px ${font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('AIR FRANCE INDUSTRIES', w / 2 + 8, bandTop + bandHeight / 2)
    ctx.fillStyle = colors.ink
    ctx.font = `700 15px ${font}`
    ctx.fillText('ECU REPAIR WORKSHOP', w / 2, bandTop + bandHeight + 16)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  // Workbench with the giant ECU: dark casing, connector pins, blinking status lights
  setWorkbench() {
    const benchZ = -1.4
    const steel = this.toon('#8d939c')
    this.box(4.6, 0.14, 1.6, this.toon(colors.wood), new THREE.Vector3(0, 1.0, benchZ))
    for (const [x, z] of [[-2.1, -0.6], [2.1, -0.6], [-2.1, 0.6], [2.1, 0.6]]) {
      this.box(0.12, 0.95, 0.12, steel, new THREE.Vector3(x, 0.5, benchZ + z))
    }

    this.ecu = new THREE.Group()
    this.ecu.position.set(0, 1.07, benchZ)
    this.group.add(this.ecu)
    this.ecuBaseY = this.ecu.position.y

    const casing = this.box(1.4, 0.95, 1.0, this.toon(colors.ecu), new THREE.Vector3(0, 0.475, 0), this.ecu)
    const hull = new THREE.Mesh(casing.geometry, this.outlineMaterial)
    hull.position.copy(casing.position)
    hull.scale.set(1.06, 1.08, 1.08)
    this.ecu.add(hull)
    this.box(1.1, 0.6, 0.04, this.toon('#5a6272'), new THREE.Vector3(0, 0.5, 0.52), this.ecu)
    const gold = this.toon('#e8b830')
    for (let i = 0; i < 6; i++) this.box(0.08, 0.08, 0.12, gold, new THREE.Vector3(-0.4 + i * 0.16, 0.25, 0.56), this.ecu)

    this.leds = ['#4ade80', '#4ade80', '#fbbf24', '#f87171'].map((color, i) => {
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color }))
      led.position.set(-0.36 + i * 0.24, 0.68, 0.56)
      led.userData = { color: new THREE.Color(color), noShadow: true }
      this.ecu.add(led)
      return led
    })
  }

  // The "before": paper repair records stacked on the bench and the floor, and a few USB keys
  setRecords() {
    // Sheet edges painted on the sides so the boxes read as stacks of paper
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = colors.paper
    ctx.fillRect(0, 0, 16, 64)
    ctx.fillStyle = '#c9c3b4'
    for (let y = 2; y < 64; y += 5) ctx.fillRect(0, y, 16, 1)
    const edges = new THREE.CanvasTexture(canvas)
    edges.colorSpace = THREE.SRGBColorSpace
    edges.wrapT = THREE.RepeatWrapping
    edges.repeat.set(1, 3)
    const paper = [this.toon('#ffffff', { map: edges }), this.toon('#ffffff', { map: edges }), this.toon(colors.paper), this.toon(colors.paper), this.toon('#ffffff', { map: edges }), this.toon('#ffffff', { map: edges })]
    const stacks = [
      [-1.7, 1.07, -1.5, 0.45, 0.1],
      [-1.35, 1.07, -1.05, 0.3, -0.2],
      [-3.3, 0.12, -0.9, 0.9, 0.25],
      [-3.0, 0.12, 0.2, 0.6, -0.1],
      [-3.6, 0.12, -2.2, 1.2, 0.05],
    ]
    for (const [x, y, z, height, angle] of stacks) {
      const stack = this.box(0.6, height, 0.8, paper, new THREE.Vector3(x, y + height / 2, z))
      stack.rotation.y = angle
      const hull = new THREE.Mesh(stack.geometry, this.outlineMaterial)
      hull.position.copy(stack.position)
      hull.rotation.copy(stack.rotation)
      hull.scale.set(1.08, 1 + 0.05 / height, 1.06)
      this.group.add(hull)
    }
    // Where flying sheets take off: the top of the bench stack
    this.sheetsFrom = new THREE.Vector3(-1.7, 1.6, -1.5)

    for (const [x, z, color, angle] of [[-0.95, -0.85, '#2563eb', 0.4], [-0.75, -0.95, '#d6202f', -0.3], [-1.05, -1.25, '#1a1626', 1.1]]) {
      const key = this.box(0.12, 0.05, 0.3, this.toon(color), new THREE.Vector3(x, 1.1, z))
      key.rotation.y = angle
    }
  }

  // The "after": a monitor on the bench predicting the next failure
  setScreen() {
    const monitor = new THREE.Group()
    monitor.position.set(1.75, 1.07, -1.55)
    monitor.rotation.y = -0.35
    this.group.add(monitor)

    const dark = this.toon('#2a2833')
    this.box(0.12, 0.45, 0.12, dark, new THREE.Vector3(0, 0.22, 0), monitor)
    const frame = this.box(1.7, 1.1, 0.08, dark, new THREE.Vector3(0, 0.95, 0), monitor)
    const hull = new THREE.Mesh(frame.geometry, this.outlineMaterial)
    hull.position.copy(frame.position)
    hull.scale.set(1.04, 1.06, 1.6)
    monitor.add(hull)

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.96), new THREE.MeshBasicMaterial({ map: this.createChartTexture() }))
    screen.position.set(0, 0.95, 0.045)
    screen.userData.noShadow = true
    monitor.add(screen)
    this.monitor = monitor
    // Where flying sheets land, as data points (in the hangar's local space)
    monitor.updateWorldMatrix(true, false)
    this.sheetsTo = monitor.localToWorld(new THREE.Vector3(0, 0.95, 0.1))
    this.group.worldToLocal(this.sheetsTo)
  }

  // Failure rate over component age: a long flat stretch, then the wear-out rise that makes the next
  // failure predictable; repair records as dots, the predicted failure marked
  createChartTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 320
    const ctx = canvas.getContext('2d')
    const { width: w, height: h } = canvas
    const font = '-apple-system, "Helvetica Neue", Arial, sans-serif'
    const left = 50
    const right = w - 24
    const top = 70
    const bottom = h - 46
    const curve = (x) => 0.12 + 0.88 * Math.pow(x, 6) // normalized age 0..1 -> failure rate 0..1
    const toCanvas = (x, y) => [left + x * (right - left), bottom - y * (bottom - top)]

    ctx.fillStyle = '#101826'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#ffffff'
    ctx.font = `800 30px ${font}`
    ctx.fillText('PROGNOS', 24, 44)
    ctx.fillStyle = '#8aa0bf'
    ctx.font = `500 16px ${font}`
    ctx.fillText('Predicted next failure', 190, 42)

    ctx.strokeStyle = '#3a4a63'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(left, top - 10)
    ctx.lineTo(left, bottom)
    ctx.lineTo(right, bottom)
    ctx.stroke()
    ctx.fillStyle = '#8aa0bf'
    ctx.font = `500 14px ${font}`
    ctx.fillText('flight hours', right - 80, bottom + 26)
    ctx.save()
    ctx.translate(20, bottom - 10)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('failure rate', 0, 0)
    ctx.restore()

    // Records: dots scattered around the curve
    ctx.fillStyle = '#60a5fa'
    for (let i = 0; i < 26; i++) {
      const x = (i + 0.5) / 30
      const [cx, cy] = toCanvas(x, curve(x) + Math.sin(i * 12.9898) * 0.05)
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.strokeStyle = '#f8fafc'
    ctx.lineWidth = 4
    ctx.beginPath()
    for (let i = 0; i <= 60; i++) {
      const x = i / 60
      const [cx, cy] = toCanvas(x, curve(x))
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    }
    ctx.stroke()

    const predicted = 0.9
    const [px] = toCanvas(predicted, 0)
    ctx.strokeStyle = colors.red
    ctx.setLineDash([10, 8])
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(px, top - 6)
    ctx.lineTo(px, bottom)
    ctx.stroke()
    ctx.setLineDash([])
    const [mx, my] = toCanvas(predicted, curve(predicted))
    ctx.fillStyle = colors.red
    ctx.beginPath()
    ctx.arc(mx, my, 9, 0, Math.PI * 2)
    ctx.fill()

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  // Sheets lifting off the paper stack, tumbling along an arc and shrinking into data points at the screen
  setSheets() {
    const geometry = new THREE.PlaneGeometry(0.3, 0.4)
    this.sheetColors = { paper: new THREE.Color(colors.paper), data: new THREE.Color('#60a5fa') }
    this.sheetControl = new THREE.Vector3(0, 3.4, -0.6)
    this.sheets = Array.from({ length: 10 }, (_, i) => {
      const sheet = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: colors.paper, side: THREE.DoubleSide }))
      sheet.userData = { phase: i / 10, noShadow: true }
      this.group.add(sheet)
      return sheet
    })
    this.sheetClock = 0
  }

  // --- Landmark interface ---

  get pickTargets() {
    return [this.group]
  }

  getPromptAnchor(target = new THREE.Vector3()) {
    return this.group.localToWorld(target.set(0, this.radius + 1.2, this.size.depth / 2))
  }

  // Looking into the opening from a little above the bench, far enough back for the arch to frame the scene,
  // with the hangar beside the project card
  getFocusPose(viewport, fov) {
    const quaternion = this.group.getWorldQuaternion(new THREE.Quaternion())
    return focusPose(
      {
        center: this.group.localToWorld(new THREE.Vector3(0, 1.8, -0.8)),
        normal: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion),
        right: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion),
        up: new THREE.Vector3(0, 1, 0),
        height: this.radius + 1,
        // Phones: just the workbench scene, or the camera would end up inside the terminal across the runway
        narrowHeight: 3.2,
        elevation: 0.1,
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

  // A tap: the ECU hops and flashes, and a burst of records flies into the screen
  react() {
    this.bounce.velocity += 6
    this.burstUntil = this.time.elapsed + 1.6
  }

  update() {
    const delta = this.time.delta
    const elapsed = this.time.elapsed
    const bursting = elapsed < this.burstUntil

    this.ring.update(delta, elapsed)

    // ECU hop, substepped spring
    const steps = Math.ceil(delta / (1 / 120))
    for (let i = 0; i < steps; i++) {
      const step = delta / steps
      this.bounce.velocity += (-160 * this.bounce.value - 11 * this.bounce.velocity) * step
      this.bounce.value += this.bounce.velocity * step
    }
    this.ecu.position.y = this.ecuBaseY + this.bounce.value * 0.15

    // Status lights blink out of step; all flash white during a burst
    this.leds.forEach((led, i) => {
      if (bursting) led.material.color.set(Math.sin(elapsed * 30) > 0 ? '#ffffff' : led.userData.color)
      else led.material.color.copy(led.userData.color).multiplyScalar(Math.sin(elapsed * (2 + i) + i * 1.7) > -0.3 ? 1 : 0.25)
    })

    // Sheets: faster when someone is around, much faster during a burst
    this.sheetClock += delta * (bursting ? 1.4 : this.active || this.isOpen ? 0.45 : 0.25)
    const point = new THREE.Vector3()
    for (const sheet of this.sheets) {
      const t = (this.sheetClock + sheet.userData.phase) % 1
      // Quadratic Bezier from the stack, over the bench, into the screen
      point.copy(this.sheetsFrom).multiplyScalar((1 - t) ** 2)
      point.addScaledVector(this.sheetControl, 2 * (1 - t) * t)
      point.addScaledVector(this.sheetsTo, t * t)
      sheet.position.copy(point)
      sheet.rotation.set(t * 6, t * 9 + sheet.userData.phase * 4, t * 3)
      sheet.scale.setScalar(t < 0.75 ? 1 : 1 - ((t - 0.75) / 0.25) * 0.8)
      sheet.material.color.lerpColors(this.sheetColors.paper, this.sheetColors.data, THREE.MathUtils.smoothstep(t, 0.55, 0.9))
    }
  }
}
