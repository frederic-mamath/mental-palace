import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import Experience from '../../Experience.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'

// Project landmark: a giant cel-shaded iPhone standing on a stone pedestal, showing the DoubleTap app.
export default class DoubleTap {
  constructor({ position = new THREE.Vector3(), rotationY = 0 } = {}) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.debug = this.experience.debug

    this.params = {
      bodyColor: '#3d3b8e',
      screenTop: '#ff8a4c',
      screenBottom: '#ff3d7f',
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

    this.setMaterials()
    this.setPedestal()
    this.setPhone()
    this.setScreen()
    this.setTapRipples()
    this.setDebug()
  }

  setMaterials() {
    const gradientMap = createGradientMap()

    this.materials = {
      body: new THREE.MeshToonMaterial({ color: this.params.bodyColor, gradientMap }),
      stone: new THREE.MeshToonMaterial({ color: '#a3acc2', gradientMap, flatShading: true }),
      dark: new THREE.MeshToonMaterial({ color: '#1e1d33', gradientMap }),
      lens: new THREE.MeshBasicMaterial({ color: '#0b0a14' }),
      outline: createOutlineMaterial(),
    }
  }

  setPedestal() {
    const { radiusTop, radiusBottom, height } = this.pedestal
    const t = this.params.outlineThickness

    const stone = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 8), this.materials.stone)
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
    this.phone.position.y = this.pedestal.height - 0.15
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

  drawScreen() {
    const ctx = this.canvas.getContext('2d')
    const { width: w, height: h } = this.canvas
    const pxPerUnit = w / this.screenSize.width
    const font = '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif'

    ctx.clearRect(0, 0, w, h)

    // Rounded screen shape, clipped so the corners follow the phone's
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, (this.size.radius - this.size.bezel) * pxPerUnit)
    ctx.clip()

    const background = ctx.createLinearGradient(0, 0, 0, h)
    background.addColorStop(0, this.params.screenTop)
    background.addColorStop(1, this.params.screenBottom)
    ctx.fillStyle = background
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
    ctx.fillStyle = '#0b0a14'
    ctx.beginPath()
    ctx.roundRect(w / 2 - 80, 34, 160, 48, 24)
    ctx.fill()

    // App icon with a "double tap" glyph: a finger dot and two ripples
    const iconSize = 220
    const iconX = w / 2
    const iconY = h * 0.42
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(iconX - iconSize / 2, iconY - iconSize / 2, iconSize, iconSize, 52)
    ctx.fill()

    ctx.fillStyle = this.params.screenBottom
    ctx.strokeStyle = this.params.screenBottom
    ctx.beginPath()
    ctx.arc(iconX, iconY, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 11
    for (const [radius, alpha] of [[48, 0.8], [74, 0.45]]) {
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(iconX, iconY, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Title
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.font = `800 76px ${font}`
    ctx.fillText('DoubleTap', w / 2, iconY + iconSize / 2 + 80)
    ctx.globalAlpha = 0.8
    ctx.font = `500 32px ${font}`
    ctx.fillText('Current project', w / 2, iconY + iconSize / 2 + 140)
    ctx.globalAlpha = 1

    // Home indicator
    ctx.beginPath()
    ctx.roundRect(w / 2 - 85, h - 34, 170, 10, 5)
    ctx.fill()

    ctx.restore()

    this.screenTexture.needsUpdate = true

    // Where the icon sits on the screen plane, for the ripples
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

  setDebug() {
    if (!this.debug.active) return

    const folder = this.debug.ui.addFolder('DoubleTap')
    folder.addColor(this.params, 'bodyColor').onChange((value) => this.materials.body.color.set(value))
    folder.addColor(this.params, 'screenTop').onChange(() => this.drawScreen())
    folder.addColor(this.params, 'screenBottom').onChange(() => this.drawScreen())
  }

  update() {
    // Two quick taps, then a pause
    const period = 2.4
    const duration = 0.8
    const cycle = this.time.elapsed % period

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
