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
    this.inputs = this.experience.inputs
    this.camera = this.experience.camera.instance
    this.colliders = this.experience.world.colliders

    this.params = {
      color: '#ffffff',
      outlineColor: '#1a1626',
      outlineThickness: 0.05,
      hoverHeight: 1.6,
      floatAmplitude: 0.15,
      floatSpeed: 1.5,
      speed: 4,
      sprintMultiplier: 1.8,
      acceleration: 6,
      turnSpeed: 10,
      lean: 0.12,
      bank: 0.06,
      boundsRadius: 27,
      collisionRadius: 1.4,
    }

    this.group = new THREE.Group()
    this.group.position.y = this.params.hoverHeight
    this.scene.add(this.group)

    this.setMaterials()
    this.setBody()
    this.setFace()
    this.setMovement()
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
    const { actions } = this.inputs
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

    // Frame-rate independent easing toward the wanted velocity
    this.velocity.lerp(this.targetVelocity, 1 - Math.exp(-this.params.acceleration * delta))
    this.group.position.addScaledVector(this.velocity, delta)

    // Stay on the island
    const position = this.group.position
    const distance = Math.hypot(position.x, position.z)
    if (distance > this.params.boundsRadius) {
      position.x *= this.params.boundsRadius / distance
      position.z *= this.params.boundsRadius / distance
    }

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
  resolveCollisions() {
    const position = this.group.position

    for (const collider of this.colliders) {
      this.pushDirection.set(position.x - collider.position.x, 0, position.z - collider.position.z)
      const distance = this.pushDirection.length()
      const minDistance = collider.radius + this.params.collisionRadius
      if (distance >= minDistance || distance === 0) continue

      this.pushDirection.divideScalar(distance)
      position.addScaledVector(this.pushDirection, minDistance - distance)

      const into = this.velocity.dot(this.pushDirection)
      if (into < 0) this.velocity.addScaledVector(this.pushDirection, -into)
    }
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
    folder.add(this.params, 'speed', 0.5, 15, 0.1)
    folder.add(this.params, 'sprintMultiplier', 1, 4, 0.1)
    folder.add(this.params, 'acceleration', 0.5, 20, 0.1)
    folder.add(this.params, 'turnSpeed', 0.5, 30, 0.1)
    folder.add(this.params, 'lean', 0, 0.5, 0.01)
    folder.add(this.params, 'bank', 0, 0.3, 0.01)
  }

  update() {
    this.updateMovement(this.time.delta)

    const t = this.time.elapsed * this.params.floatSpeed
    const bank = THREE.MathUtils.clamp(-this.yawSpeed * this.params.bank, -0.35, 0.35)

    // Idle bob, sway and breathing squash, plus leaning forward with speed and into turns
    this.group.position.y = this.params.hoverHeight + Math.sin(t) * this.params.floatAmplitude
    this.group.rotation.y = this.yaw
    this.group.rotation.x = Math.sin(t * 0.4) * 0.03 + Math.min(this.speedRatio, 1.5) * this.params.lean
    this.group.rotation.z = Math.sin(t * 0.55) * 0.05 + bank
    this.body.scale.set(1 + Math.sin(t * 2) * 0.015, 1 - Math.sin(t * 2) * 0.02, 1)
  }
}
