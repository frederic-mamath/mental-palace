import * as THREE from 'three'
import Experience from '../Experience.js'
import EventEmitter from '../Utils/EventEmitter.js'
import { createGradientMap, createOutlineMaterial } from './toon.js'
import Afterimages from './Effects/Afterimages.js'
import DustBurst from './Effects/DustBurst.js'
import SpeedLines from './Effects/SpeedLines.js'
import BoomRing from './Effects/BoomRing.js'
import { islands } from './islands.js'

// The main character, the Sheeping Goat (the user's brand: sheep and goat, their Vietnamese and Cambodian
// zodiacs, a pun on shipping, and the GOAT). A chibi sheep built from overlapping toon puffs: a big round
// head (wool cap, cream face, floppy ears, golden goat horns) above a smaller woolly body on four short legs. Each puff gets an inverted-hull
// twin, so ink lines show on the silhouette and in the creases between puffs.
// (The code still calls it the cloud: it started as one.)
// Used instead of the keyboard state while movement is locked (a project is open)
const idleActions = { forward: false, backward: false, left: false, right: false, sprint: false }

// Four bursts fanning out in every direction for the smoke poof
const poofDirections = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)]

// Events: 'dashStart' (position, direction), 'teleport' (position)
export default class Cloud extends EventEmitter {
  constructor() {
    super()

    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.debug = this.experience.debug
    this.inputs = this.experience.inputs
    this.camera = this.experience.camera.instance
    this.colliders = this.experience.world.colliders
    // Rectangles over the water the cloud may walk on (piers), same shape as rectangle colliders
    this.walkways = this.experience.world.walkways
    this.lastPosition = new THREE.Vector3()
    // The island the cloud is on: it can roam its plateau and beach, but not the sea
    this.island = islands.entrepreneur

    this.params = {
      color: '#ffffff',
      outlineColor: '#1a1626',
      outlineThickness: 0.05,
      hoverHeight: 1.15, // body center above the ground, so the hooves touch it
      floatAmplitude: 0.03, // breathing
      floatSpeed: 1.5,
      legSwing: 0.6, // leg swing (radians) at full trot
      stride: 0.9, // gait cycles per unit of distance walked
      speed: 4,
      sprintMultiplier: 1.8,
      acceleration: 6,
      turnSpeed: 10,
      lean: 0.04,
      bank: 0.04,
      shoreMargin: 0.8, // how far from the waterline the cloud's center must stay
      collisionRadius: 1.4,
      dashSpeed: 24,
      dashDuration: 0.28,
      dashCooldown: 0.5,
      dashStretch: 0.35,
    }

    // Height of the ground the cloud floats over (0 on the islands; raised in the raid instance)
    this.groundHeight = 0

    this.group = new THREE.Group()
    this.group.position.y = this.groundHeight + this.params.hoverHeight
    this.scene.add(this.group)

    this.setMaterials()
    this.setBody()
    this.setFace()
    this.setHorns()
    this.setLegs()
    this.setMovement()
    this.setDash()
    this.setDebug()
  }

  setMaterials() {
    this.materials = {
      body: new THREE.MeshToonMaterial({ color: this.params.color, gradientMap: createGradientMap() }),
      outline: createOutlineMaterial(this.params.outlineColor),
      eye: new THREE.MeshBasicMaterial({ color: '#1a1626' }),
      highlight: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      nose: new THREE.MeshToonMaterial({ color: '#e58fa0', gradientMap: createGradientMap() }),
      horn: new THREE.MeshToonMaterial({ color: '#d4a72c', gradientMap: createGradientMap() }),
      ridge: new THREE.MeshToonMaterial({ color: '#8a6a1a', gradientMap: createGradientMap() }),
      skin: new THREE.MeshToonMaterial({ color: '#f6e2cf', gradientMap: createGradientMap() }),
      ear: new THREE.MeshToonMaterial({ color: '#f1c2ad', gradientMap: createGradientMap() }),
      hoof: new THREE.MeshToonMaterial({ color: '#4a3a33', gradientMap: createGradientMap() }),
      cheek: new THREE.MeshBasicMaterial({ color: '#f4a3a3', transparent: true, opacity: 0.75, depthWrite: false }),
    }
  }

  // Chibi proportions: a big round head above and in front of a smaller woolly body. Wool puffs are all
  // children of `body` (head puffs offset by headCenter), so the dash afterimages copy them as they are.
  setBody() {
    this.geometry = new THREE.IcosahedronGeometry(1, 5)
    this.body = new THREE.Group()
    this.puffs = []
    this.outlines = []
    // Chibi head: about as wide as the body (everything on the head scales with headScale)
    this.headScale = 1.18
    this.headCenter = new THREE.Vector3(0, 1.05, 0.32)

    // [x, y, z, radius]
    const bodyPuffs = [
      [0, 0, 0, 0.8], // core
      [0, -0.05, 0.4, 0.6], // chest
      [0, 0, -0.45, 0.65], // rump
      [0.45, -0.05, 0.1, 0.55],
      [-0.45, -0.05, 0.1, 0.55],
      [0.42, -0.05, -0.3, 0.55],
      [-0.42, -0.05, -0.3, 0.55],
      [0, -0.35, 0, 0.55], // belly
      [0, 0.35, -0.25, 0.5], // back
      [0, 0.15, -1.0, 0.28], // tail
    ]
    // Wool cap on top of the head and a fringe framing the face
    const headPuffs = [
      [0, 0.25, -0.05, 0.62], // crown
      [0.38, 0.12, -0.05, 0.45],
      [-0.38, 0.12, -0.05, 0.45],
      [0, 0.1, -0.35, 0.5], // back of the head
      [0, 0.45, 0.35, 0.28], // fringe
      [0.22, 0.4, 0.33, 0.25],
      [-0.22, 0.4, 0.33, 0.25],
      [0.42, 0.3, 0.25, 0.25],
      [-0.42, 0.3, 0.25, 0.25],
    ]

    for (const [x, y, z, radius] of bodyPuffs) this.addPuff(x, y, z, radius)
    const k = this.headScale
    for (const [x, y, z, radius] of headPuffs) this.addPuff(x * k + this.headCenter.x, y * k + this.headCenter.y, z * k + this.headCenter.z, radius * k)

    this.updateOutlineThickness()
    this.group.add(this.body)
  }

  addPuff(x, y, z, radius) {
    const puff = new THREE.Mesh(this.geometry, this.materials.body)
    puff.position.set(x, y, z)
    puff.scale.setScalar(radius)
    puff.castShadow = true
    this.puffs.push(puff)
    this.body.add(puff)

    const outline = new THREE.Mesh(this.geometry, this.materials.outline)
    outline.position.set(x, y, z)
    outline.userData.radius = radius
    this.outlines.push(outline)
    this.body.add(outline)
  }

  // Cream face under the wool fringe: small glossy eyes with highlights, pink cheeks, a tiny nose and an
  // "ω" mouth; floppy ears on the sides of the head
  setFace() {
    this.face = new THREE.Group()
    this.face.position.copy(this.headCenter)
    this.face.scale.setScalar(this.headScale)
    this.eyes = []

    const sphere = new THREE.SphereGeometry(1, 24, 18)
    const skin = new THREE.Mesh(sphere, this.materials.skin)
    skin.scale.set(0.55, 0.5, 0.45)
    skin.position.set(0, -0.08, 0.22)
    skin.castShadow = true
    const skinOutline = new THREE.Mesh(sphere, this.materials.outline)
    skinOutline.scale.set(0.585, 0.535, 0.48)
    skinOutline.position.copy(skin.position)
    this.face.add(skin, skinOutline)

    for (const side of [-1, 1]) {
      const eye = new THREE.Group()
      eye.position.set(0.2 * side, -0.02, 0.61)
      const ball = new THREE.Mesh(sphere, this.materials.eye)
      ball.scale.set(0.065, 0.08, 0.04)
      const highlight = new THREE.Mesh(sphere, this.materials.highlight)
      highlight.scale.setScalar(0.022)
      // Same corner on both eyes (upper left as seen from the front), like one light catching them
      highlight.position.set(-0.022, 0.03, 0.03)
      eye.add(ball, highlight)
      this.face.add(eye)
      this.eyes.push(eye)

      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.085, 20), this.materials.cheek)
      cheek.position.set(0.31 * side, -0.15, 0.555)
      cheek.rotation.y = side * 0.45
      this.face.add(cheek)

      // Ear: a flattened oval drooping sideways, pink-beige with an outline
      const ear = new THREE.Group()
      ear.position.set(0.6 * side, 0.02, 0.05)
      ear.rotation.set(0, side * -0.3, side * -0.45)
      const earShape = new THREE.Mesh(sphere, this.materials.ear)
      earShape.scale.set(0.34, 0.12, 0.2)
      earShape.position.x = 0.22 * side
      earShape.castShadow = true
      const earOutline = new THREE.Mesh(sphere, this.materials.outline)
      earOutline.scale.set(0.37, 0.145, 0.225)
      earOutline.position.copy(earShape.position)
      ear.add(earShape, earOutline)
      this.face.add(ear)
    }

    const nose = new THREE.Mesh(sphere, this.materials.nose)
    nose.scale.set(0.035, 0.022, 0.02)
    nose.position.set(0, -0.09, 0.665)
    this.face.add(nose)

    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshBasicMaterial({ map: this.createMouthTexture(), transparent: true, depthWrite: false }))
    mouth.position.set(0, -0.15, 0.655)
    this.face.add(mouth)

    this.body.add(this.face)
    this.nextBlink = 2
  }

  // A small "ω" smile drawn on a transparent canvas
  createMouthTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#3a2a2a'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(22, 10, 10, Math.PI * 0.15, Math.PI * 0.95)
    ctx.moveTo(52, 12)
    ctx.arc(42, 10, 10, Math.PI * 0.05, Math.PI * 0.85)
    ctx.stroke()
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  // Golden goat horns on top of the head, shaped like an L: a short rise, a turn toward the back, then a
  // wavy end lifting slightly toward the sky; thick at the base, tapering, with darker ridges
  setHorns() {
    const tubular = 32
    const radial = 10
    const size = 0.75 * this.headScale // relative to the first design, to suit the head
    const radiusAt = (t) => THREE.MathUtils.lerp(0.22, 0.06, Math.pow(t, 1.1)) * size
    // A tube along `curve` whose radius follows radiusAt (+ grow, for the outline)
    const createHorn = (curve, grow) => {
      const geometry = new THREE.TubeGeometry(curve, tubular, 1, radial, false)
      const position = geometry.attributes.position
      const center = new THREE.Vector3()
      const point = new THREE.Vector3()
      for (let i = 0; i < position.count; i++) {
        const ring = Math.floor(i / (radial + 1))
        const t = ring / tubular
        curve.getPointAt(t, center)
        point.fromBufferAttribute(position, i).sub(center).multiplyScalar(radiusAt(t) + grow).add(center)
        position.setXYZ(i, point.x, point.y, point.z)
      }
      geometry.computeVertexNormals()
      return geometry
    }

    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3(
        // x outward, y up, z forward (the back is -z): rise, turn back, run back nearly level, then a small
        // wave lifting the tip slightly upward
        [[0, 0, 0], [0.08, 0.22, -0.05], [0.18, 0.32, -0.3], [0.26, 0.3, -0.6], [0.32, 0.36, -0.86], [0.36, 0.52, -1.05], [0.42, 0.62, -1.18]].map(
          ([x, y, z]) => new THREE.Vector3(x * side * size, y * size, z * size)
        )
      )
      const horn = new THREE.Group()
      horn.position.copy(this.headCenter).add(new THREE.Vector3(0.32 * side, 0.55, 0.08).multiplyScalar(this.headScale))
      horn.add(new THREE.Mesh(createHorn(curve, 0), this.materials.horn))
      horn.add(new THREE.Mesh(createHorn(curve, 0.03), this.materials.outline))
      for (const t of [0.2, 0.42, 0.62]) {
        const ridge = new THREE.Mesh(new THREE.TorusGeometry(radiusAt(t), 0.018, 6, 18), this.materials.ridge)
        curve.getPointAt(t, ridge.position)
        ridge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangentAt(t))
        horn.add(ridge)
      }
      horn.traverse((child) => {
        if (child.isMesh && child.material !== this.materials.outline) child.castShadow = true
      })
      this.body.add(horn)
    }
  }

  // Four short legs on dark hooves, pivoting at the hip for the trot
  setLegs() {
    const leg = new THREE.CylinderGeometry(0.15, 0.14, 0.45, 12).translate(0, -0.22, 0)
    const hoof = new THREE.CylinderGeometry(0.16, 0.17, 0.16, 12).translate(0, -0.52, 0)
    this.legs = [
      [0.38, 0.35], // front left
      [-0.38, 0.35], // front right
      [0.38, -0.35], // back left
      [-0.38, -0.35], // back right
    ].map(([x, z], i) => {
      const hip = new THREE.Group()
      hip.position.set(x, -0.55, z)
      for (const [geometry, material] of [[leg, this.materials.skin], [hoof, this.materials.hoof]]) {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow = true
        const outline = new THREE.Mesh(geometry, this.materials.outline)
        outline.scale.set(1.22, 1.04, 1.22)
        hip.add(mesh, outline)
      }
      // Diagonal pairs swing together: front left with back right, front right with back left
      hip.userData.side = i === 0 || i === 3 ? 1 : -1
      this.group.add(hip)
      return hip
    })
    this.gait = 0
  }

  setMovement() {
    this.velocity = new THREE.Vector3()
    this.targetVelocity = new THREE.Vector3()
    this.forward = new THREE.Vector3()
    this.right = new THREE.Vector3()
    this.pushDirection = new THREE.Vector3()
    this.yaw = 0
    this.yawSpeed = 0
    this.speedRatio = 0

    // Yaw first, so idle sway, lean and bank happen around the cloud's own axes
    this.group.rotation.order = 'YXZ'
  }

  updateMovement(delta) {
    const actions = this.inputs.movementLocked ? idleActions : this.inputs.actions
    const inputX = Number(actions.right) - Number(actions.left)
    const inputZ = Number(actions.forward) - Number(actions.backward)

    // Directions relative to where the camera looks, flattened on the ground
    this.camera.getWorldDirection(this.forward)
    this.forward.y = 0
    this.forward.normalize()
    this.right.crossVectors(this.forward, THREE.Object3D.DEFAULT_UP)

    this.targetVelocity.set(0, 0, 0).addScaledVector(this.forward, inputZ).addScaledVector(this.right, inputX)
    if (this.targetVelocity.lengthSq() > 0) {
      const speed = this.params.speed * (actions.sprint ? this.params.sprintMultiplier : 1)
      this.targetVelocity.normalize().multiplyScalar(speed)
    }

    if (this.dash.timer > 0) {
      // Locked at full dash speed; once it ends, the easing below brakes back to walking speed
      this.velocity.copy(this.dash.direction).multiplyScalar(this.params.dashSpeed)
    } else {
      // Frame-rate independent easing toward the wanted velocity
      this.velocity.lerp(this.targetVelocity, 1 - Math.exp(-this.params.acceleration * delta))
    }
    this.lastPosition.copy(this.group.position)
    this.group.position.addScaledVector(this.velocity, delta)
    this.stayOnGround(delta)

    this.resolveCollisions()

    // Turn toward the movement direction (the face looks down +z) via the shortest angle
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    const previousYaw = this.yaw
    if (speed > 0.1) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.z)
      const angle = Math.atan2(Math.sin(targetYaw - this.yaw), Math.cos(targetYaw - this.yaw))
      this.yaw += angle * (1 - Math.exp(-this.params.turnSpeed * delta))
    }

    const yawSpeed = delta > 0 ? (this.yaw - previousYaw) / delta : 0
    this.yawSpeed += (yawSpeed - this.yawSpeed) * (1 - Math.exp(-8 * delta))
    this.speedRatio = speed / this.params.speed
  }

  // Push out of overlapping colliders and drop the velocity going into them, so the cloud slides around
  // Stay on land (the beach is fine, the water isn't) or on a walkway. On land, slide along the coast as
  // always; on a walkway, keep whichever part of the move stays on it so the cloud slides along its edges.
  stayOnGround(delta) {
    const position = this.group.position
    const shoreOffset = this.island.beachWidth - this.params.shoreMargin
    const allowed = (point) => this.island.edgeDistance(point.x, point.z) <= shoreOffset || this.onWalkway(point)
    if (allowed(position)) return

    if (!this.onWalkway(this.lastPosition)) {
      this.island.clamp(position, shoreOffset)
      return
    }

    for (const [x, z] of [[this.velocity.x, 0], [0, this.velocity.z]]) {
      position.copy(this.lastPosition)
      position.x += x * delta
      position.z += z * delta
      if (allowed(position)) return
    }
    position.copy(this.lastPosition)
  }

  onWalkway(point) {
    return this.walkways.some(({ position, axis, halfLength, halfWidth }) => {
      const dx = point.x - position.x
      const dz = point.z - position.z
      return Math.abs(dx * axis.x + dz * axis.y) <= halfLength && Math.abs(-dx * axis.y + dz * axis.x) <= halfWidth
    })
  }

  // Colliders are circles { position, radius } or rectangles { position, axis (unit Vector2 along their
  // length), halfLength, halfWidth } on the ground plane. Each one only computes how deep the cloud is in it
  // and which way out; pushing out and removing the velocity going into it is shared.
  resolveCollisions() {
    const position = this.group.position
    const radius = this.params.collisionRadius

    for (const collider of this.colliders) {
      // Moving colliders (the airplane once airborne) can switch themselves off
      if (collider.disabled) continue

      const depth = collider.axis ? this.rectanglePush(collider, radius) : this.circlePush(collider, radius)
      if (depth <= 0) continue

      position.addScaledVector(this.pushDirection, depth)
      const into = this.velocity.dot(this.pushDirection)
      if (into < 0) this.velocity.addScaledVector(this.pushDirection, -into)
    }
  }

  // Sets pushDirection and returns the overlap depth (0 when clear)
  circlePush(collider, radius) {
    const position = this.group.position
    this.pushDirection.set(position.x - collider.position.x, 0, position.z - collider.position.z)
    const distance = this.pushDirection.length()
    const minDistance = collider.radius + radius
    if (distance >= minDistance || distance === 0) return 0

    this.pushDirection.divideScalar(distance)
    return minDistance - distance
  }

  rectanglePush(collider, radius) {
    const { position: center, axis, halfLength, halfWidth } = collider
    const dx = this.group.position.x - center.x
    const dz = this.group.position.z - center.z
    // In the rectangle's frame: along its axis, and across it (axis turned a quarter)
    const along = dx * axis.x + dz * axis.y
    const across = -dx * axis.y + dz * axis.x
    const toWorld = (a, c) => this.pushDirection.set(a * axis.x - c * axis.y, 0, a * axis.y + c * axis.x)

    const outsideAlong = along - THREE.MathUtils.clamp(along, -halfLength, halfLength)
    const outsideAcross = across - THREE.MathUtils.clamp(across, -halfWidth, halfWidth)
    const distance = Math.hypot(outsideAlong, outsideAcross)

    if (distance > 0) {
      if (distance >= radius) return 0
      toWorld(outsideAlong / distance, outsideAcross / distance)
      return radius - distance
    }

    // Center inside the rectangle (fast dash): leave through the nearest side
    const depthAlong = halfLength - Math.abs(along)
    const depthAcross = halfWidth - Math.abs(across)
    if (depthAlong < depthAcross) {
      toWorld(Math.sign(along) || 1, 0)
      return depthAlong + radius
    }
    toWorld(0, Math.sign(across) || 1)
    return depthAcross + radius
  }

  setDash() {
    this.dash = { timer: 0, cooldown: 0, ghostTimer: 0, direction: new THREE.Vector3() }
    // Spring driving the stretch: pulled to 1 while dashing, released to 0 after, overshooting into a squash
    this.stretch = { value: 0, velocity: 0 }

    this.afterimages = new Afterimages({ meshes: this.puffs })
    this.dust = new DustBurst()
    this.speedLines = new SpeedLines()
    this.boomRing = new BoomRing()

    this.inputs.on('actionStart', (action) => {
      if (action === 'dash') this.startDash()
    })
  }

  // Jump straight to another spot (and island, and ground height), at rest, facing `yaw`. Events: 'teleport'
  teleport(position, { island = this.island, yaw = this.yaw, groundHeight = this.groundHeight } = {}) {
    this.group.position.copy(position)
    this.island = island
    this.groundHeight = groundHeight
    this.velocity.set(0, 0, 0)
    this.yaw = yaw
    this.yawSpeed = 0
    this.trigger('teleport', this.group.position)
  }

  // Ninja smoke poof: vanish while a project is open (it would block the camera's view), reappear after
  setHidden(hidden) {
    if (this.group.visible === !hidden) return

    const position = this.group.position
    for (const direction of poofDirections) this.dust.spawn(position, direction, 5, { y: position.y - 0.3, size: 2.2 })
    this.group.visible = !hidden
  }

  startDash() {
    if (this.dash.cooldown > 0 || this.inputs.movementLocked) return

    // Dash toward the held direction, or straight ahead when no direction is held
    if (this.targetVelocity.lengthSq() > 0) this.dash.direction.copy(this.targetVelocity).normalize()
    else this.dash.direction.set(Math.sin(this.yaw), 0, Math.cos(this.yaw))

    // Snap to face the dash direction (shortest way round) so the stretch points the right way
    const targetYaw = Math.atan2(this.dash.direction.x, this.dash.direction.z)
    this.yaw += Math.atan2(Math.sin(targetYaw - this.yaw), Math.cos(targetYaw - this.yaw))

    this.dash.timer = this.params.dashDuration
    this.dash.cooldown = this.params.dashDuration + this.params.dashCooldown
    // First ghost once the cloud has moved a bit, so it doesn't overlap the body
    this.dash.ghostTimer = 0.045

    this.dust.spawn(this.group.position, this.dash.direction, 6, { y: this.groundHeight + 0.25 })
    // Around the lower body, so it reads as bursting from the cloud
    this.boomRing.spawn(this.group.position.clone().setY(this.group.position.y - 0.5))
    this.trigger('dashStart', this.group.position, this.dash.direction)
    this.speedLines.burst(this.params.dashDuration)
    this.experience.camera.kick(3)
  }

  updateDash(delta) {
    this.dash.cooldown = Math.max(this.dash.cooldown - delta, 0)

    if (this.dash.timer > 0) {
      this.dash.timer -= delta
      this.dash.ghostTimer -= delta
      if (this.dash.ghostTimer <= 0) {
        this.afterimages.spawn(this.body)
        this.dash.ghostTimer = 0.045
      }
    }

    // Substeps keep the stiff spring stable on slow frames
    const target = this.dash.timer > 0 ? 1 : 0
    const steps = Math.ceil(delta / (1 / 120))
    const step = delta / steps
    for (let i = 0; i < steps; i++) {
      const acceleration = (target - this.stretch.value) * 260 - this.stretch.velocity * 13
      this.stretch.velocity += acceleration * step
      this.stretch.value += this.stretch.velocity * step
    }

    this.afterimages.update(delta)
    this.dust.update(delta)
    this.speedLines.update(delta)
    this.boomRing.update(delta)
  }

  updateOutlineThickness() {
    for (const outline of this.outlines) {
      outline.scale.setScalar(outline.userData.radius + this.params.outlineThickness)
    }
  }

  setDebug() {
    if (!this.debug.active) return

    const folder = this.debug.ui.addFolder('Sheeping Goat')
    folder.addColor(this.params, 'color').onChange((value) => this.materials.body.color.set(value))
    folder.addColor(this.params, 'outlineColor').onChange((value) => this.materials.outline.color.set(value))
    folder.add(this.params, 'outlineThickness', 0, 0.2, 0.001).onChange(() => this.updateOutlineThickness())
    folder.add(this.params, 'hoverHeight', 0.5, 5, 0.01)
    folder.add(this.params, 'floatAmplitude', 0, 1, 0.01)
    folder.add(this.params, 'floatSpeed', 0, 5, 0.01)
    folder.add(this.params, 'speed', 0.5, 15, 0.1)
    folder.add(this.params, 'sprintMultiplier', 1, 4, 0.1)
    folder.add(this.params, 'acceleration', 0.5, 20, 0.1)
    folder.add(this.params, 'turnSpeed', 0.5, 30, 0.1)
    folder.add(this.params, 'lean', 0, 0.5, 0.01)
    folder.add(this.params, 'bank', 0, 0.3, 0.01)
    folder.add(this.params, 'dashSpeed', 4, 40, 0.1)
    folder.add(this.params, 'dashDuration', 0.05, 0.6, 0.01)
    folder.add(this.params, 'dashCooldown', 0, 2, 0.01)
    folder.add(this.params, 'dashStretch', 0, 1, 0.01)
  }

  update() {
    this.updateMovement(this.time.delta)
    this.updateDash(this.time.delta)

    const delta = this.time.delta
    const t = this.time.elapsed * this.params.floatSpeed
    const bank = THREE.MathUtils.clamp(-this.yawSpeed * this.params.bank, -0.35, 0.35)

    // Trot: the gait advances with the distance walked; legs swing in diagonal pairs, more the faster it
    // goes, and the body bounces once per step
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    const effort = Math.min(speed / this.params.speed, 1)
    this.gait += speed * delta * this.params.stride * Math.PI
    const swing = Math.sin(this.gait) * this.params.legSwing * effort
    for (const leg of this.legs) leg.rotation.x = swing * leg.userData.side
    const bounce = Math.abs(Math.sin(this.gait)) * 0.08 * effort

    // Breathing, a little sway at rest, leaning forward with speed and into turns
    this.group.position.y = this.groundHeight + this.params.hoverHeight + Math.sin(t) * this.params.floatAmplitude + bounce
    this.group.rotation.y = this.yaw
    this.group.rotation.x = Math.sin(t * 0.4) * 0.015 + Math.min(this.speedRatio, 1.5) * this.params.lean
    this.group.rotation.z = Math.sin(t * 0.55) * 0.02 + bank

    // Blink every few seconds
    this.nextBlink -= delta
    const blinking = this.nextBlink < 0.12
    for (const eye of this.eyes) eye.scale.y = blinking ? 0.12 : 1
    if (this.nextBlink <= 0) this.nextBlink = 2.5 + Math.random() * 3
    // Stretch along the heading (local z) while dashing, squash when the spring overshoots below 0
    const stretch = this.stretch.value * this.params.dashStretch
    this.body.scale.set(
      (1 + Math.sin(t * 2) * 0.015) * (1 - stretch * 0.5),
      (1 - Math.sin(t * 2) * 0.02) * (1 - stretch * 0.5),
      1 + stretch
    )
  }
}
