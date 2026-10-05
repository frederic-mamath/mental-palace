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
// zodiacs, a pun on shipping, and the GOAT). A round woolly sheep built from overlapping toon puffs, with big
// glossy eyes, golden goat horns and four stubby legs trotting on golden hooves. Each puff gets an inverted-hull
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
      hoverHeight: 1.27, // body center above the ground, so the hooves touch it
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
    }
  }

  setBody() {
    // A round woolly body, a little longer front (+z) to back than wide: [x, y, z, radius]
    const puffs = [
      [0, 0, 0, 1], // core
      [0, 0.08, 0.55, 0.85], // face
      [0, 0, -0.6, 0.85], // rump
      [0.6, -0.05, 0.25, 0.7],
      [-0.6, -0.05, 0.25, 0.7],
      [0.6, -0.05, -0.35, 0.7],
      [-0.6, -0.05, -0.35, 0.7],
      [0, 0.55, 0.15, 0.6], // back of the head
      [0.35, 0.45, -0.35, 0.55],
      [-0.35, 0.45, -0.3, 0.55],
      [0, -0.35, 0, 0.72], // belly
      [0, 0.2, -1.25, 0.32], // tail
      [0, 0.95, 0.5, 0.28], // forehead tuft
      [0.2, 0.88, 0.38, 0.22],
      [-0.2, 0.88, 0.4, 0.22],
    ]

    this.geometry = new THREE.IcosahedronGeometry(1, 5)
    this.body = new THREE.Group()
    this.puffs = []
    this.outlines = []

    for (const [x, y, z, radius] of puffs) {
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

    this.updateOutlineThickness()
    this.group.add(this.body)
  }

  // Big glossy eyes on the face puff (each with a white highlight) and a small pink nose
  setFace() {
    this.face = new THREE.Group()
    this.eyes = []

    const sphere = new THREE.SphereGeometry(1, 20, 16)
    for (const side of [-1, 1]) {
      const eye = new THREE.Group()
      eye.position.set(0.33 * side, 0.28, 1.3)
      const ball = new THREE.Mesh(sphere, this.materials.eye)
      ball.scale.set(0.17, 0.19, 0.1)
      const highlight = new THREE.Mesh(sphere, this.materials.highlight)
      highlight.scale.setScalar(0.05)
      // Same corner on both eyes (upper left as seen from the front), like one light catching them
      highlight.position.set(-0.05, 0.07, 0.08)
      eye.add(ball, highlight)
      this.face.add(eye)
      this.eyes.push(eye)
    }

    const nose = new THREE.Mesh(sphere, this.materials.nose)
    nose.scale.set(0.09, 0.06, 0.05)
    nose.position.set(0, 0.03, 1.39)
    this.face.add(nose)

    this.body.add(this.face)
    this.nextBlink = 2
  }

  // Golden goat horns curling back and down from the top of the head, tapering, with darker ridges
  setHorns() {
    const tubular = 32
    const radial = 10
    const radiusAt = (t) => THREE.MathUtils.lerp(0.17, 0.035, Math.pow(t, 0.8))
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
        [[0, 0, 0], [0.25, 0.3, -0.05], [0.55, 0.38, -0.3], [0.8, 0.2, -0.5], [0.92, -0.1, -0.42], [0.85, -0.32, -0.2]].map(
          ([x, y, z]) => new THREE.Vector3(x * side, y, z)
        )
      )
      const horn = new THREE.Group()
      horn.position.set(0.55 * side, 0.6, 0.62)
      horn.add(new THREE.Mesh(createHorn(curve, 0), this.materials.horn))
      horn.add(new THREE.Mesh(createHorn(curve, 0.035), this.materials.outline))
      // Ridges: thin dark rings around the horn
      for (const t of [0.22, 0.45, 0.66]) {
        const ridge = new THREE.Mesh(new THREE.TorusGeometry(radiusAt(t), 0.022, 6, 18), this.materials.ridge)
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

  // Four stubby woolly legs on golden hooves, pivoting at the hip for the trot
  setLegs() {
    const wool = new THREE.CylinderGeometry(0.2, 0.18, 0.55, 12).translate(0, -0.27, 0)
    const hoof = new THREE.CylinderGeometry(0.19, 0.22, 0.2, 12).translate(0, -0.6, 0)
    this.legs = [
      [0.48, 0.5], // front left
      [-0.48, 0.5], // front right
      [0.48, -0.5], // back left
      [-0.48, -0.5], // back right
    ].map(([x, z], i) => {
      const hip = new THREE.Group()
      hip.position.set(x, -0.55, z)
      for (const [geometry, material] of [[wool, this.materials.body], [hoof, this.materials.horn]]) {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow = true
        const outline = new THREE.Mesh(geometry, this.materials.outline)
        outline.scale.set(1.2, 1.04, 1.2)
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
