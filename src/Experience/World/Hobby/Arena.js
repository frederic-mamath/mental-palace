import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, addOutlined } from '../toon.js'

// The hobby island's east zone, for online games (homages, no copied designs):
// - a raid platform (WoW): round stone floor with a slowly turning glowing rune circle, ringed by rune
//   obelisks crowned with floating crystals, open toward the path; walkable, it hosts the raid boss mini-game
// - a battle lane (LoL): a short stone lane between a blue and a red tower, ending at a floating crystal
// - a mineral field (StarCraft): a cluster of glowing blue crystals
// Built in the zone's own space: x toward the island's north (along), z toward its east (across);
// the path from the plaza comes in from -z.
export default class Arena {
  constructor({ frame, zone, colliders }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time

    this.frame = frame
    this.colliders = colliders
    this.gradientMap = createGradientMap()
    this.floaters = []

    this.group = new THREE.Group()
    frame.toWorld(zone.along, zone.across, 0, this.group.position)
    this.group.rotation.y = frame.yaw
    this.scene.add(this.group)
    this.group.updateMatrixWorld()

    this.setRaidPlatform(new THREE.Vector3(3, 0, 1.5), 3.6)
    this.setLane(-4.5, -2.5, 6.2)
    this.setMinerals(new THREE.Vector3(0.6, 0, 6.6))
  }

  toon(color, options = {}) {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.gradientMap, ...options })
  }

  glow(color) {
    return new THREE.MeshBasicMaterial({ color })
  }

  addCircle(local, radius) {
    this.colliders.push({ position: this.group.localToWorld(local.clone()).setY(0), radius })
  }

  // A crystal that floats and turns (updated each frame)
  addFloater(mesh, baseY, { bob = 0.12, speed = 1, spin = 0.8 } = {}) {
    mesh.userData.floater = { baseY, bob, speed, spin, phase: this.floaters.length * 1.3 }
    this.floaters.push(mesh)
  }

  setRaidPlatform(center, radius) {
    // Center and radius in world space, for the mini-game
    this.raid = { center: this.group.localToWorld(center.clone()).setY(0), radius }

    addOutlined(this.group, new THREE.CylinderGeometry(radius, radius + 0.15, 0.16, 48).translate(0, 0.08, 0), this.toon('#8f8a99'), {
      position: center.toArray(),
      outline: [1.02, 1.3, 1.02],
    })
    // Rune circle drawn on top, unlit so it glows, turning slowly
    this.runes = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.92, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: this.createRuneTexture(), transparent: true, depthWrite: false })
    )
    this.runes.position.set(center.x, 0.18, center.z)
    this.group.add(this.runes)

    // Rune obelisks around the platform, leaving an opening toward the path (-z)
    const stone = this.toon('#6f6a7c')
    const obelisk = new THREE.CylinderGeometry(0.22, 0.42, 2.6, 4, 1).toNonIndexed().rotateY(Math.PI / 4).translate(0, 1.3, 0)
    obelisk.computeVertexNormals()
    const crystal = new THREE.OctahedronGeometry(0.28, 0).scale(1, 1.6, 1)
    const count = 7
    for (let i = 0; i < count; i++) {
      // Spread over the circle minus a 90-degree opening centered on -z
      const angle = Math.PI / 2 + Math.PI / 4 + (i / (count - 1)) * (Math.PI * 2 - Math.PI / 2)
      const x = center.x + Math.cos(angle) * (radius + 0.6)
      const z = center.z - Math.sin(angle) * (radius + 0.6)
      addOutlined(this.group, obelisk, stone, { position: [x, 0, z], outline: [1.15, 1.02, 1.15] })
      // A glowing rune strip on the side facing the platform
      const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.4), this.glow('#7ee8ff'))
      rune.position.set(x - Math.cos(angle) * 0.3, 1.3, z + Math.sin(angle) * 0.3)
      this.group.add(rune)
      // lookAt takes a world point and accounts for the parent group's transform
      rune.lookAt(this.group.localToWorld(new THREE.Vector3(center.x, 1.3, center.z)))
      const gem = new THREE.Mesh(crystal, this.glow('#b48cff'))
      gem.position.set(x, 3.2, z)
      this.group.add(gem)
      this.addFloater(gem, 3.2, { bob: 0.1, speed: 1.4 })
      this.addCircle(new THREE.Vector3(x, 0, z), 0.5)
    }
  }

  // Concentric circles with runic glyphs between them, transparent elsewhere
  createRuneTexture() {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const c = size / 2
    ctx.strokeStyle = '#7ee8ff'
    ctx.fillStyle = '#7ee8ff'
    ctx.lineWidth = 6
    for (const r of [0.97, 0.78, 0.4]) {
      ctx.beginPath()
      ctx.arc(c, c, c * r, 0, Math.PI * 2)
      ctx.stroke()
    }
    // Glyphs: small angular marks around the ring
    ctx.lineWidth = 5
    const glyphs = 24
    for (let i = 0; i < glyphs; i++) {
      const angle = (i / glyphs) * Math.PI * 2
      ctx.save()
      ctx.translate(c + Math.cos(angle) * c * 0.875, c + Math.sin(angle) * c * 0.875)
      ctx.rotate(angle + Math.PI / 2)
      ctx.beginPath()
      const shape = i % 3
      if (shape === 0) { ctx.moveTo(-10, 12); ctx.lineTo(0, -12); ctx.lineTo(10, 12) }
      if (shape === 1) { ctx.moveTo(-10, -12); ctx.lineTo(10, -12); ctx.moveTo(0, -12); ctx.lineTo(0, 12) }
      if (shape === 2) { ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(-6, -12); ctx.lineTo(6, 12) }
      ctx.stroke()
      ctx.restore()
    }
    // Eight-pointed star in the middle: two squares, the second turned 45 degrees
    for (const offset of [0, Math.PI / 4]) {
      ctx.beginPath()
      for (let i = 0; i <= 4; i++) {
        const angle = offset + (i / 4) * Math.PI * 2
        const x = c + Math.cos(angle) * c * 0.36
        const y = c + Math.sin(angle) * c * 0.36
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  // Stone lane along z at x = laneX, from zStart to zEnd: a blue tower near the start, a red one near the end,
  // and the crystal on its pedestal at the far end
  setLane(laneX, zStart, zEnd) {
    const length = zEnd - zStart
    const lane = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, length).translate(0, 0.04, 0), this.toon('#7d756c'))
    lane.position.set(laneX, 0.02, (zStart + zEnd) / 2)
    lane.receiveShadow = true
    this.group.add(lane)

    this.setTower(new THREE.Vector3(laneX + 1.5, 0, zStart + 1.2), '#4cc3ff')
    this.setTower(new THREE.Vector3(laneX - 1.5, 0, zEnd - 2.6), '#ff5a5a')

    // The crystal at the end of the lane: a pedestal ring and a big floating gem
    const pedestal = this.toon('#6f6a7c')
    const end = new THREE.Vector3(laneX, 0, zEnd + 1.0)
    addOutlined(this.group, new THREE.CylinderGeometry(1.0, 1.2, 0.4, 8).translate(0, 0.2, 0), pedestal, { position: end.toArray(), outline: [1.05, 1.1, 1.05] })
    addOutlined(this.group, new THREE.TorusGeometry(0.8, 0.12, 6, 16).rotateX(Math.PI / 2), pedestal, { position: [end.x, 0.5, end.z], outline: 1.1 })
    this.nexus = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0).scale(1, 1.7, 1), this.glow('#7e9cff'))
    this.nexus.position.set(end.x, 1.9, end.z)
    this.group.add(this.nexus)
    this.addFloater(this.nexus, 1.9, { bob: 0.18, speed: 1, spin: 0.6 })
    this.addCircle(end, 1.3)
  }

  // Tower: stone base and shaft, a small roofed cage holding a glowing orb in its team color
  setTower(base, color) {
    const stone = this.toon('#a59f95')
    addOutlined(this.group, new THREE.CylinderGeometry(0.6, 0.75, 0.5, 8).translate(0, 0.25, 0), stone, { position: base.toArray(), outline: 1.06 })
    addOutlined(this.group, new THREE.CylinderGeometry(0.32, 0.48, 2.2, 8).translate(0, 1.6, 0), stone, { position: base.toArray(), outline: [1.1, 1.02, 1.1] })
    const metal = this.toon('#3b4252')
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.8, 0.07), metal)
      bar.position.set(base.x + x, 3.1, base.z + z)
      this.group.add(bar)
    }
    addOutlined(this.group, new THREE.ConeGeometry(0.55, 0.5, 4).rotateY(Math.PI / 4), metal, { position: [base.x, 3.75, base.z], outline: 1.1 })
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), this.glow(color))
    orb.position.set(base.x, 3.1, base.z)
    this.group.add(orb)
    this.addFloater(orb, 3.1, { bob: 0.05, speed: 2.4, spin: 0 })
    this.addCircle(base, 0.8)
  }

  // Cluster of six-sided blue crystals of different heights, leaning outward
  setMinerals(center) {
    const material = this.toon('#5ad2ff', { emissive: '#1a7fd6', emissiveIntensity: 0.6 })
    this.mineralMaterial = material
    const shards = [
      [0, 0, 1.6, 0], [0.55, 0.2, 1.1, 0.35], [-0.5, 0.3, 1.25, -0.3], [0.2, -0.55, 0.9, 0.25],
      [-0.35, -0.5, 1.0, -0.25], [0.85, -0.35, 0.7, 0.5], [-0.85, -0.1, 0.75, -0.5],
    ]
    for (const [x, z, height, lean] of shards) {
      const geometry = new THREE.CylinderGeometry(0.16, 0.22, height, 6).translate(0, height / 2, 0)
      const tip = new THREE.ConeGeometry(0.16, 0.35, 6).translate(0, height + 0.17, 0)
      for (const part of [geometry, tip]) {
        addOutlined(this.group, part, material, { position: [center.x + x, -0.05, center.z + z], rotation: [lean * 0.6, 0, -lean], outline: [1.12, 1.02, 1.12] })
      }
    }
    this.addCircle(center, 1.3)
  }

  update() {
    const elapsed = this.time.elapsed
    this.runes.rotation.y = elapsed * 0.15
    for (const mesh of this.floaters) {
      const { baseY, bob, speed, spin, phase } = mesh.userData.floater
      mesh.position.y = baseY + Math.sin(elapsed * speed + phase) * bob
      mesh.rotation.y = elapsed * spin + phase
    }
    this.mineralMaterial.emissiveIntensity = 0.5 + Math.sin(elapsed * 1.7) * 0.15
  }
}
