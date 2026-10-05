import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import Experience from '../../Experience.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'
import ZoneRing from '../Effects/ZoneRing.js'
import HeartPop from '../Effects/HeartPop.js'

// Project landmark: a giant cel-shaded iPhone standing on a stone pedestal, showing the Double Tap app.
//
// Landmark interface used by Interactions:
//   project, zone { position, radius }, pickTargets, getPromptAnchor(), getFocusPose(viewport, fov),
//   setActive(bool) when the character is in the zone, setOpen(bool), react() on a tap
export default class DoubleTap {
  constructor({ project, position = new THREE.Vector3(), rotationY = 0 }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.debug = this.experience.debug

    this.project = project
    this.icon = this.experience.resources.items.doubleTapIcon?.image

    this.params = {
      bodyColor: '#2d2b38',
      accent: project.accent,
      outlineThickness: 0.05,
    }

    // Phone dimensions (iPhone-like 1:2 ratio, scaled up to landmark size)
    this.size = { width: 2.2, height: 4.4, depth: 0.3, radius: 0.3, bezel: 0.08 }
    this.pedestal = { radiusTop: 1.4, radiusBottom: 1.6, height: 0.5 }

    this.group = new THREE.Group()
    this.group.position.copy(position)
    this.group.rotation.y = rotationY
    this.scene.add(this.group)

    // Cheap circular collider used by the character
    this.collider = { position: this.group.position, radius: this.pedestal.radiusBottom }
    // Entering this circle offers to open the project
    this.zone = { position: this.group.position, radius: 5 }

    this.active = false
    this.isOpen = false
    this.screenBrightness = 0
    // Spring for the phone's hop when woken up or tapped
    this.bounce = { value: 0, velocity: 0 }
    this.rippleStart = 0

    this.setMaterials()
    this.setPedestal()
    this.setPhone()
    this.setScreen()
    this.setTapRipples()
    this.setEffects()
    this.setDebug()
  }

  setMaterials() {
    const gradientMap = createGradientMap()

    this.materials = {
      body: new THREE.MeshToonMaterial({ color: this.params.bodyColor, gradientMap }),
      stone: new THREE.MeshToonMaterial({ color: '#a3acc2', gradientMap }),
      dark: new THREE.MeshToonMaterial({ color: '#1e1d33', gradientMap }),
      lens: new THREE.MeshBasicMaterial({ color: '#0b0a14' }),
      outline: createOutlineMaterial(),
    }
  }

  setPedestal() {
    const { radiusTop, radiusBottom, height } = this.pedestal
    const t = this.params.outlineThickness

    // MeshToonMaterial has no flatShading: unshared vertices give each face its own normal for the faceted look
    const stoneGeometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 8).toNonIndexed()
    stoneGeometry.computeVertexNormals()
    const stone = new THREE.Mesh(stoneGeometry, this.materials.stone)
    stone.position.y = height / 2
    stone.castShadow = true
    stone.receiveShadow = true

    const outline = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop + t, radiusBottom + t, height + t * 2, 8),
      this.materials.outline
    )
    outline.position.copy(stone.position)

    this.group.add(stone, outline)
  }

  setPhone() {
    const { width, height, depth, radius } = this.size
    const t = this.params.outlineThickness

    this.phone = new THREE.Group()
    // Sunk slightly into the pedestal and leaning back, like a monument
    this.phoneBaseY = this.pedestal.height - 0.15
    this.phone.position.y = this.phoneBaseY
    this.phone.rotation.x = -0.12
    this.group.add(this.phone)

    // Everything below is positioned from the phone's bottom edge
    const body = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 6, radius), this.materials.body)
    body.position.y = height / 2
    body.castShadow = true
    body.receiveShadow = true

    // Offsetting every dimension (and the corner radius) by t gives an outline of even thickness
    const outline = new THREE.Mesh(
      new RoundedBoxGeometry(width + t * 2, height + t * 2, depth + t * 2, 6, radius + t),
      this.materials.outline
    )
    outline.position.copy(body.position)

    this.phone.add(body, outline)

    // Side buttons: action + volume on the left, power on the right
    const buttonGeometry = new THREE.BoxGeometry(0.06, 1, 0.12)
    const buttons = [
      [-1, 3.55, 0.18],
      [-1, 3.15, 0.35],
      [-1, 2.7, 0.35],
      [1, 3.0, 0.55],
    ]
    for (const [side, y, length] of buttons) {
      const button = new THREE.Mesh(buttonGeometry, this.materials.body)
      button.position.set(side * (width / 2 + 0.02), y, 0)
      button.scale.y = length
      this.phone.add(button)
    }

    // Camera bump on the back, top-left when looking at the back
    const bump = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.9, 0.1, 4, 0.2), this.materials.dark)
    bump.position.set(width / 2 - 0.6, height - 0.6, -depth / 2 - 0.03)
    this.phone.add(bump)

    const lensGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 24)
    lensGeometry.rotateX(Math.PI / 2)
    for (const [x, y] of [[-0.2, 0.2], [-0.2, -0.2], [0.2, 0]]) {
      const lens = new THREE.Mesh(lensGeometry, this.materials.lens)
      lens.position.set(bump.position.x + x, bump.position.y + y, bump.position.z - 0.06)
      this.phone.add(lens)
    }
  }

  setScreen() {
    const { width, height, depth, bezel } = this.size
    this.screenSize = { width: width - bezel * 2, height: height - bezel * 2 }

    this.canvas = document.createElement('canvas')
    this.canvas.width = 512
    this.canvas.height = Math.round(512 * (this.screenSize.height / this.screenSize.width))

    this.screenTexture = new THREE.CanvasTexture(this.canvas)
    this.screenTexture.colorSpace = THREE.SRGBColorSpace
    this.screenTexture.anisotropy = 4
    this.drawScreen()

    // Basic material: the screen emits its own light, so it stays bright on the shadow side
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(this.screenSize.width, this.screenSize.height),
      new THREE.MeshBasicMaterial({ map: this.screenTexture, transparent: true })
    )
    screen.position.set(0, height / 2, depth / 2 + 0.002)
    this.screen = screen
    this.phone.add(screen)
  }

  // The app's home look: dark screen, accent glow, real app icon, name, tagline and status
  drawScreen() {
    const ctx = this.canvas.getContext('2d')
    const { width: w, height: h } = this.canvas
    const pxPerUnit = w / this.screenSize.width
    const font = '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif'
    const accent = this.params.accent

    ctx.clearRect(0, 0, w, h)

    // Rounded screen shape, clipped so the corners follow the phone's
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, (this.size.radius - this.size.bezel) * pxPerUnit)
    ctx.clip()

    const background = ctx.createLinearGradient(0, 0, 0, h)
    background.addColorStop(0, '#1d1b24')
    background.addColorStop(1, '#0b0a0f')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, w, h)

    const iconSize = 220
    const iconX = w / 2
    const iconY = h * 0.36

    const glow = ctx.createRadialGradient(iconX, iconY, 0, iconX, iconY, 300)
    glow.addColorStop(0, `${accent}88`)
    glow.addColorStop(1, `${accent}00`)
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)

    // Status bar
    ctx.fillStyle = '#ffffff'
    ctx.font = `600 34px ${font}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillText('9:41', 52, 58)
    ctx.beginPath()
    ctx.roundRect(w - 108, 44, 58, 28, 8)
    ctx.fill()

    // Dynamic Island
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.roundRect(w / 2 - 80, 34, 160, 48, 24)
    ctx.fill()

    // App icon, with the iOS corner radius (about 22% of its size)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(iconX - iconSize / 2, iconY - iconSize / 2, iconSize, iconSize, iconSize * 0.2237)
    ctx.clip()
    if (this.icon) {
      ctx.drawImage(this.icon, iconX - iconSize / 2, iconY - iconSize / 2, iconSize, iconSize)
    } else {
      ctx.fillStyle = accent
      ctx.fill()
    }
    ctx.restore()

    // Name, then the tagline one sentence per line, the first in the accent color
    let y = iconY + iconSize / 2 + 90
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = `800 72px ${font}`
    ctx.fillText(this.project.title, w / 2, y)

    y += 80
    ctx.font = `700 40px ${font}`
    this.project.tagline.split(/(?<=\.)\s+/).forEach((line, i) => {
      ctx.fillStyle = i === 0 ? accent : '#ffffff'
      ctx.fillText(line, w / 2, y)
      y += 50
    })

    // Status pill
    y += 40
    ctx.font = `600 26px ${font}`
    const pillWidth = ctx.measureText(this.project.status).width + 48
    ctx.strokeStyle = accent
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(w / 2 - pillWidth / 2, y - 24, pillWidth, 48, 24)
    ctx.stroke()
    ctx.fillStyle = accent
    ctx.fillText(this.project.status, w / 2, y + 1)

    // Home indicator
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(w / 2 - 85, h - 34, 170, 10, 5)
    ctx.fill()

    ctx.restore()

    this.screenTexture.needsUpdate = true

    // Where the icon sits on the screen plane, for the ripples and hearts
    this.iconCenter = new THREE.Vector2(0, (h / 2 - iconY) / pxPerUnit)
    this.iconHalfSize = iconSize / 2 / pxPerUnit
  }

  setTapRipples() {
    const geometry = new THREE.RingGeometry(0.93, 1, 64)
    this.ripples = [0, 0.22].map((delay) => {
      const ripple = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })
      )
      ripple.position.set(this.iconCenter.x, this.screen.position.y + this.iconCenter.y, this.screen.position.z + 0.002)
      ripple.userData.delay = delay
      this.phone.add(ripple)
      return ripple
    })
  }

  setEffects() {
    this.zoneRing = new ZoneRing({ parent: this.group, radius: 4.6, color: this.params.accent })
    this.hearts = new HeartPop({ parent: this.phone })
  }

  setDebug() {
    if (!this.debug.active) return

    const folder = this.debug.ui.addFolder('DoubleTap')
    folder.addColor(this.params, 'bodyColor').onChange((value) => this.materials.body.color.set(value))
    folder.addColor(this.params, 'accent').onChange(() => this.drawScreen())
  }

  // --- Landmark interface ---

  get pickTargets() {
    return [this.phone]
  }

  // World point above the phone where the "press E" prompt floats
  getPromptAnchor(target = new THREE.Vector3()) {
    return this.phone.localToWorld(target.set(0, this.size.height + 0.7, 0))
  }

  // Camera pose facing the screen, aimed off-center so the phone sits beside the project card:
  // left of it on wide screens, above it on narrow ones (760px matches the card's bottom-sheet breakpoint in style.css)
  getFocusPose({ width, height }, fov) {
    const center = this.screen.getWorldPosition(new THREE.Vector3())
    const quaternion = this.screen.getWorldQuaternion(new THREE.Quaternion())
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion)

    const narrow = width < 760
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov / 2))
    // Distance at which the phone fills this share of the view height
    const share = narrow ? 0.38 : 0.7
    const distance = this.size.height / share / (2 * tanHalfFov)
    const visibleHeight = 2 * distance * tanHalfFov
    const visibleWidth = visibleHeight * (width / height)

    const target = center.clone()
    if (narrow) target.addScaledVector(up, -visibleHeight * 0.24)
    else target.addScaledVector(right, visibleWidth * 0.2)

    return { position: target.clone().addScaledVector(normal, distance), target }
  }

  setActive(active) {
    if (active && !this.active) this.bounce.velocity += 6
    this.active = active
    this.zoneRing.setActive(active)
  }

  setOpen(open) {
    this.isOpen = open
  }

  // A tap on the phone: hop, a heart pops out of the icon, and the ripples restart right away
  react() {
    this.bounce.velocity += 9
    this.hearts.spawn(new THREE.Vector3(this.iconCenter.x, this.screen.position.y + this.iconCenter.y, this.screen.position.z))
    this.rippleStart = this.time.elapsed
  }

  update() {
    const delta = this.time.delta
    const elapsed = this.time.elapsed

    // Hop spring, substepped so it stays stable on slow frames
    const steps = Math.ceil(delta / (1 / 120))
    for (let i = 0; i < steps; i++) {
      const step = delta / steps
      const acceleration = -140 * this.bounce.value - 10 * this.bounce.velocity
      this.bounce.velocity += acceleration * step
      this.bounce.value += this.bounce.velocity * step
    }
    this.phone.position.y = this.phoneBaseY + this.bounce.value * 0.3

    // The screen wakes up when the character comes close
    const awake = this.active || this.isOpen ? 1 : 0
    this.screenBrightness += (awake - this.screenBrightness) * (1 - Math.exp(-6 * delta))
    this.screen.material.color.setScalar(0.78 + 0.22 * this.screenBrightness)

    this.zoneRing.update(delta, elapsed)
    this.hearts.update(delta)

    // Two quick taps, then a pause (restarted by react)
    const period = 2.4
    const duration = 0.8
    const cycle = (elapsed - this.rippleStart) % period

    for (const ripple of this.ripples) {
      const progress = (cycle - ripple.userData.delay) / duration
      const visible = progress >= 0 && progress <= 1
      ripple.visible = visible
      if (!visible) continue

      const eased = 1 - Math.pow(1 - progress, 3)
      ripple.scale.setScalar(this.iconHalfSize * (1.15 + eased * 1.1))
      ripple.material.opacity = (1 - progress) * 0.85
    }
  }
}
