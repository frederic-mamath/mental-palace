import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, addOutlined } from '../toon.js'

// The hobby island's west zone, a shonen ninja-village training ground (homage, no copied designs):
// a torii gate where the path arrives, three rope-wrapped training posts, target boards with kunai,
// a small dojo, a ramen stand with swaying noren curtains and a glowing lantern, stone lanterns.
// Built in the zone's own space: x toward the island's north (along), z toward its east (across),
// where the path from the plaza comes in.
export default class TrainingGround {
  constructor({ frame, zone, colliders }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time

    this.frame = frame
    this.colliders = colliders
    this.gradientMap = createGradientMap()

    this.group = new THREE.Group()
    frame.toWorld(zone.along, zone.across, 0, this.group.position)
    this.group.rotation.y = frame.yaw
    this.scene.add(this.group)
    this.group.updateMatrixWorld()

    this.setTorii(new THREE.Vector3(-0.2, 0, 5.6))
    for (const x of [-1.4, 0, 1.4]) this.setTrainingPost(new THREE.Vector3(x, 0, 1.5 + Math.abs(x) * 0.4))
    this.setTarget(new THREE.Vector3(3.3, 0, 2.4))
    this.setTarget(new THREE.Vector3(-3.3, 0, 2.6))
    this.setDojo(new THREE.Vector3(2.5, 0, -3.2))
    this.setRamenStand(new THREE.Vector3(-3.0, 0, -2.4))
    this.setStoneLantern(new THREE.Vector3(0.5, 0, -1.0))
    this.setStoneLantern(new THREE.Vector3(4.5, 0, -1.0))
  }

  toon(color, options = {}) {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.gradientMap, ...options })
  }

  // Colliders are in world space: circles at a local point, rectangles aligned with the zone's axes
  addCircle(local, radius) {
    this.colliders.push({ position: this.group.localToWorld(local.clone()).setY(0), radius })
  }

  addRectangle(local, halfLength, halfWidth) {
    this.colliders.push({ position: this.group.localToWorld(local.clone()).setY(0), axis: this.frame.u, halfLength, halfWidth })
  }

  // Red gate with black-capped pillars, a black top beam (kasagi) and a red tie beam (nuki), spanning the path
  setTorii(base) {
    const red = this.toon('#d6202f')
    const black = this.toon('#2a2833')
    const pillar = new THREE.CylinderGeometry(0.17, 0.2, 3.2, 12).translate(0, 1.6, 0)
    for (const x of [-1.6, 1.6]) {
      addOutlined(this.group, pillar, red, { position: [base.x + x, 0, base.z], outline: [1.25, 1.01, 1.25] })
      addOutlined(this.group, new THREE.CylinderGeometry(0.23, 0.23, 0.3, 12).translate(0, 0.15, 0), black, { position: [base.x + x, 0, base.z], outline: 1.15 })
      this.addCircle(new THREE.Vector3(base.x + x, 0, base.z), 0.35)
    }
    addOutlined(this.group, new THREE.BoxGeometry(4.6, 0.26, 0.38), black, { position: [base.x, 3.3, base.z], outline: [1.02, 1.3, 1.3] })
    addOutlined(this.group, new THREE.BoxGeometry(4.0, 0.2, 0.26), red, { position: [base.x, 3.1, base.z], outline: [1.02, 1.3, 1.3] })
    addOutlined(this.group, new THREE.BoxGeometry(3.6, 0.18, 0.2), red, { position: [base.x, 2.45, base.z], outline: [1.02, 1.3, 1.3] })
  }

  // Wooden log with two rope bands
  setTrainingPost(base) {
    addOutlined(this.group, new THREE.CylinderGeometry(0.28, 0.3, 1.7, 12).translate(0, 0.85, 0), this.toon('#9b6b43'), { position: base.toArray(), outline: [1.15, 1.02, 1.15] })
    const rope = this.toon('#eadbb0')
    for (const y of [0.75, 1.25]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.05, 6, 16), rope)
      band.rotation.x = Math.PI / 2
      band.position.set(base.x, y, base.z)
      this.group.add(band)
    }
    this.addCircle(base, 0.4)
  }

  // Round target on a post, painted rings, two kunai stuck in it; faces the entrance (+z)
  setTarget(base) {
    addOutlined(this.group, new THREE.CylinderGeometry(0.08, 0.1, 1.5, 8).translate(0, 0.75, 0), this.toon('#7a5236'), { position: base.toArray(), outline: [1.4, 1.01, 1.4] })
    addOutlined(this.group, new THREE.CylinderGeometry(0.55, 0.55, 0.12, 24), [this.toon('#b07a4f'), this.toon('#ffffff', { map: this.createTargetTexture() }), this.toon('#b07a4f')], {
      position: [base.x, 1.55, base.z + 0.08],
      rotation: [Math.PI / 2, 0, 0],
      outline: [1.06, 1.4, 1.06],
    })
    // Cylinder caps face +y; turned a quarter around x, the top cap (material 1) faces +z with the painted rings
    const blade = new THREE.ConeGeometry(0.035, 0.32, 4).rotateX(-Math.PI / 2)
    for (const [x, y] of [[0.12, 0.08], [-0.2, -0.14]]) {
      const kunai = new THREE.Mesh(blade, this.toon('#3b4252'))
      kunai.position.set(base.x + x, 1.55 + y, base.z + 0.3)
      kunai.rotation.set(0.15, x * 0.8, 0)
      this.group.add(kunai)
    }
    this.addCircle(base, 0.5)
  }

  createTargetTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    for (const [radius, color] of [[64, '#f4f1e8'], [52, '#d6202f'], [38, '#f4f1e8'], [24, '#d6202f'], [11, '#f4f1e8']]) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(64, 64, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  // Raised wooden floor, paper-paneled walls, a dark hip roof with a ridge; entrance facing the zone's center
  setDojo(base) {
    const dark = this.toon('#5a3a26')
    addOutlined(this.group, new THREE.BoxGeometry(4.8, 0.4, 3.8).translate(0, 0.2, 0), dark, { position: base.toArray(), outline: [1.02, 1.08, 1.03] })
    const walls = this.toon('#ffffff', { map: this.createShojiTexture() })
    addOutlined(this.group, new THREE.BoxGeometry(4.4, 2, 3.4).translate(0, 1.4, 0), walls, { position: base.toArray(), outline: [1.02, 1.02, 1.03] })

    // Hip roof: a square frustum (4-sided cylinder turned 45 degrees) stretched over the walls, faceted
    const roof = new THREE.CylinderGeometry(0.28, Math.SQRT1_2, 1, 4, 1).toNonIndexed()
    roof.rotateY(Math.PI / 4)
    roof.computeVertexNormals()
    const roofMesh = addOutlined(this.group, roof, this.toon('#34394a'), { position: [base.x, 2.9, base.z], outline: [1.04, 1.08, 1.04] })
    roofMesh.scale.set(5.8, 1.3, 4.8)
    roofMesh.parent.children.at(-1).scale.set(5.8 * 1.03, 1.3 * 1.08, 4.8 * 1.03)
    addOutlined(this.group, new THREE.BoxGeometry(2.1, 0.22, 0.3), this.toon('#2a2833'), { position: [base.x, 3.62, base.z], outline: 1.15 })

    // Steps up to the entrance
    addOutlined(this.group, new THREE.BoxGeometry(1.2, 0.2, 0.5).translate(0, 0.1, 0), dark, { position: [base.x, 0, base.z + 2.1], outline: 1.06 })
    this.addRectangle(base, 2.5, 2.1)
  }

  // White paper panels in a dark wooden grid, a darker sliding door in the middle
  createShojiTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#f6f0e1'
    ctx.fillRect(0, 0, 256, 128)
    ctx.fillStyle = '#e6dcc6'
    ctx.fillRect(104, 18, 48, 110)
    ctx.fillStyle = '#5a3a26'
    for (let x = 0; x <= 256; x += 26) ctx.fillRect(x - 2, 0, 4, 128)
    for (let y = 0; y <= 128; y += 32) ctx.fillRect(0, y - 2, 256, 4)
    ctx.fillRect(0, 0, 256, 8)
    ctx.fillRect(0, 120, 256, 8)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  // Counter, posts, a slanted roof, noren curtains with "ramen" written across them, a red paper lantern, stools
  setRamenStand(base) {
    const wood = this.toon('#b07a4f')
    addOutlined(this.group, new THREE.BoxGeometry(2.6, 1.0, 0.9).translate(0, 0.5, 0), wood, { position: [base.x, 0, base.z + 0.35], outline: [1.03, 1.05, 1.08] })
    addOutlined(this.group, new THREE.BoxGeometry(2.8, 0.1, 1.1), this.toon('#d9a066'), { position: [base.x, 1.05, base.z + 0.4], outline: [1.02, 1.6, 1.05] })
    const post = new THREE.BoxGeometry(0.12, 2.3, 0.12).translate(0, 1.15, 0)
    for (const [x, z] of [[-1.25, -0.6], [1.25, -0.6], [-1.25, 0.85], [1.25, 0.85]]) {
      addOutlined(this.group, post, this.toon('#7a5236'), { position: [base.x + x, 0, base.z + z], outline: [1.4, 1.01, 1.4] })
    }
    const roof = addOutlined(this.group, new THREE.BoxGeometry(3.1, 0.14, 2.0), this.toon('#8b2f2a'), { position: [base.x, 2.35, base.z + 0.15], outline: [1.02, 1.5, 1.04] })
    roof.rotation.x = -0.18
    roof.parent.children.at(-1).rotation.x = -0.18

    // Noren: strips hanging from the roof's front edge, one slice of the same text each
    const texture = this.createNorenTexture()
    const strips = 4
    const stripWidth = 2.4 / strips
    this.noren = Array.from({ length: strips }, (_, i) => {
      const geometry = new THREE.PlaneGeometry(stripWidth * 0.94, 0.7).translate(0, -0.35, 0)
      const uv = geometry.attributes.uv
      for (let j = 0; j < uv.count; j++) uv.setX(j, (i + uv.getX(j)) / strips)
      const strip = new THREE.Mesh(geometry, this.toon('#ffffff', { map: texture, side: THREE.DoubleSide }))
      strip.position.set(base.x - 1.2 + stripWidth * (i + 0.5), 2.2, base.z + 1.05)
      strip.userData.phase = i * 0.9
      this.group.add(strip)
      return strip
    })

    // Paper lantern at the front corner, glowing (unlit material) and flickering a little
    this.lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.42, 16), new THREE.MeshBasicMaterial({ color: '#ff5a3c' }))
    this.lantern.position.set(base.x + 1.45, 1.75, base.z + 1.0)
    this.group.add(this.lantern)
    for (const y of [0.24, -0.24]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), this.toon('#2a2833'))
      cap.position.set(0, y, 0)
      this.lantern.add(cap)
    }

    const stool = new THREE.CylinderGeometry(0.2, 0.17, 0.55, 12).translate(0, 0.27, 0)
    for (const x of [-0.8, 0, 0.8]) addOutlined(this.group, stool, this.toon('#d9a066'), { position: [base.x + x, 0, base.z + 1.35], outline: [1.12, 1.04, 1.12] })
    this.addRectangle(new THREE.Vector3(base.x, 0, base.z + 0.15), 1.45, 1.1)
  }

  createNorenTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#2b3a67'
    ctx.fillRect(0, 0, 512, 128)
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 84px "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // "ramen" in katakana, one character per strip
    const characters = ['ラ', 'ー', 'メ', 'ン']
    characters.forEach((character, i) => ctx.fillText(character, 64 + i * 128, 66))
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  // Stone lantern (toro): base, pillar, light box, roof, knob
  setStoneLantern(base) {
    const stone = this.toon('#9aa0a8')
    const parts = [
      [new THREE.CylinderGeometry(0.32, 0.38, 0.25, 6), 0.12],
      [new THREE.CylinderGeometry(0.12, 0.15, 0.8, 6), 0.65],
      [new THREE.BoxGeometry(0.5, 0.4, 0.5), 1.25],
      [new THREE.ConeGeometry(0.48, 0.32, 4).rotateY(Math.PI / 4), 1.6],
      [new THREE.SphereGeometry(0.09, 8, 6), 1.82],
    ]
    for (const [geometry, y] of parts) addOutlined(this.group, geometry, stone, { position: [base.x, y, base.z], outline: 1.1 })
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.52), new THREE.MeshBasicMaterial({ color: '#ffd38a' }))
    light.position.set(base.x, 1.25, base.z)
    this.group.add(light)
    this.addCircle(base, 0.45)
  }

  update() {
    const elapsed = this.time.elapsed
    for (const strip of this.noren) strip.rotation.x = Math.sin(elapsed * 1.6 + strip.userData.phase) * 0.12 - 0.05
    this.lantern.material.color.setRGB(1, 0.33 + Math.sin(elapsed * 9) * 0.03 + Math.sin(elapsed * 23) * 0.02, 0.22)
  }
}
