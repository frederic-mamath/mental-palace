import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import Experience from '../../Experience.js'
import { createGradientMap, addOutlined } from '../toon.js'
import ZoneRing from '../Effects/ZoneRing.js'
import { focusPose } from '../Projects/focusPose.js'

// Story beat landmark of the hobby island: a carved standing stone on a base, its emblem glowing in the
// story's accent color. Opens the story's card (an 'experience' ring); a tap makes it hop and flare.
// Implements the landmark interface documented in Projects/DoubleTap.js.
//   story: an entry of `stories` in projects.js; position: world point on the ground; yaw: world rotation
//   so the carved face (local +z) looks toward where visitors come from
export default class StoryStone {
  constructor({ story, position, yaw }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time

    this.project = story
    this.gradientMap = createGradientMap()

    this.group = new THREE.Group()
    this.group.position.copy(position)
    this.group.rotation.y = yaw
    this.scene.add(this.group)
    this.group.updateMatrixWorld()

    this.collider = { position: position.clone().setY(0), radius: 0.9 }
    this.zone = { position: this.group.localToWorld(new THREE.Vector3(0, 0, 1.6)), radius: 2.6 }

    this.active = false
    this.isOpen = false
    this.glow = 0
    this.flare = 0
    this.bounce = { value: 0, velocity: 0 }

    const stone = new THREE.MeshToonMaterial({ color: '#8d8f9c', gradientMap: this.gradientMap })
    addOutlined(this.group, new THREE.CylinderGeometry(0.9, 1.05, 0.3, 8).translate(0, 0.15, 0), stone, { outline: [1.04, 1.12, 1.04] })

    this.slab = new THREE.Group()
    this.slab.position.y = 0.3
    this.group.add(this.slab)
    addOutlined(this.slab, new RoundedBoxGeometry(1.3, 2.1, 0.38, 3, 0.12).translate(0, 1.05, 0), stone, { outline: [1.05, 1.03, 1.15] })

    // The emblem: unlit, so it glows; brightens when the cloud is near and flares on a tap
    this.emblemMaterial = new THREE.MeshBasicMaterial({ map: this.createEmblemTexture(story), transparent: true, depthWrite: false })
    this.emblem = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), this.emblemMaterial)
    this.emblem.position.set(0, 1.25, 0.2)
    this.slab.add(this.emblem)

    // Ring in front of the carved face, where visitors stand
    this.front = new THREE.Group()
    this.front.position.set(0, 0, 1.6)
    this.group.add(this.front)
    this.ring = new ZoneRing({ parent: this.front, radius: 2.2, kind: 'experience' })
  }

  // Carved emblem in the accent color on a transparent background, inside a circle
  createEmblemTexture(story) {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const c = size / 2
    ctx.strokeStyle = story.accent
    ctx.fillStyle = story.accent
    ctx.lineWidth = 10
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.arc(c, c, c - 10, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    if (story.emblem === 'shuriken') {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2
        const radius = i % 2 === 0 ? c * 0.72 : c * 0.2
        ctx.lineTo(c + Math.cos(angle) * radius, c + Math.sin(angle) * radius)
      }
      ctx.closePath()
      ctx.fill()
    } else if (story.emblem === 'crystal') {
      ctx.moveTo(c, c * 0.25)
      ctx.lineTo(c * 1.42, c * 0.85)
      ctx.lineTo(c, c * 1.78)
      ctx.lineTo(c * 0.58, c * 0.85)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(c * 0.58, c * 0.85)
      ctx.lineTo(c * 1.42, c * 0.85)
      ctx.moveTo(c, c * 0.25)
      ctx.lineTo(c, c * 1.78)
      ctx.stroke()
    } else if (story.emblem === 'sword') {
      ctx.fillRect(c - 22, c * 0.32, 44, c * 1.0)
      ctx.beginPath()
      ctx.moveTo(c - 22, c * 1.32)
      ctx.lineTo(c, c * 1.62)
      ctx.lineTo(c + 22, c * 1.32)
      ctx.fill()
      ctx.fillRect(c - 52, c * 0.32, 104, 16)
      ctx.fillRect(c - 9, c * 0.08, 18, c * 0.26)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  // --- Landmark interface ---

  get pickTargets() {
    return [this.slab]
  }

  getPromptAnchor(target = new THREE.Vector3()) {
    return this.group.localToWorld(target.set(0, 3.3, 0))
  }

  getFocusPose(viewport, fov) {
    const quaternion = this.group.getWorldQuaternion(new THREE.Quaternion())
    return focusPose(
      {
        center: this.group.localToWorld(new THREE.Vector3(0, 1.4, 0)),
        normal: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion),
        right: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion),
        up: new THREE.Vector3(0, 1, 0),
        height: 3.4,
        elevation: 0.08,
      },
      viewport,
      fov
    )
  }

  setActive(active) {
    if (active && !this.active) this.bounce.velocity += 3
    this.active = active
    this.ring.setActive(active)
  }

  setOpen(open) {
    this.isOpen = open
  }

  react() {
    this.bounce.velocity += 6
    this.flare = 1
  }

  update() {
    const delta = this.time.delta
    this.ring.update(delta, this.time.elapsed)

    const steps = Math.ceil(delta / (1 / 120))
    for (let i = 0; i < steps; i++) {
      const step = delta / steps
      this.bounce.velocity += (-150 * this.bounce.value - 10 * this.bounce.velocity) * step
      this.bounce.value += this.bounce.velocity * step
    }
    this.slab.position.y = 0.3 + this.bounce.value * 0.15

    // Glow: dim at rest, bright when someone is near or reading, flaring on a tap
    const awake = this.active || this.isOpen ? 1 : 0
    this.glow += (awake - this.glow) * (1 - Math.exp(-5 * delta))
    this.flare = Math.max(this.flare - delta * 1.5, 0)
    this.emblemMaterial.opacity = 0.45 + 0.45 * this.glow + 0.1 * this.flare
    this.emblem.scale.setScalar(1 + this.flare * 0.25)
  }
}
