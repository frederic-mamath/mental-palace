import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, addOutlined } from '../toon.js'

// The hobby island's south zone, a One Piece-inspired pirate cove (homage, no copied designs): an open
// treasure chest spilling gold, a stack of barrels and one wearing a straw hat, crates, and a big anchor
// planted in the sand. The middle stays clear, from the jetty (-x) to the path toward the plaza (+x).
// Built in the zone's own space: x toward the island's north (along), z toward its east (across).
export default class PirateCove {
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

    this.setTreasure(new THREE.Vector3(0.4, 0, 3.2))
    this.setCrates(new THREE.Vector3(-1.7, 0, 3.4))
    this.setAnchor(new THREE.Vector3(2.5, 0, 3.0))
    this.setBarrelStack(new THREE.Vector3(-0.8, 0, -3.3))
    this.setStrawHatBarrel(new THREE.Vector3(1.5, 0, -2.7))
  }

  toon(color, options = {}) {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.gradientMap, ...options })
  }

  addCircle(local, radius) {
    this.colliders.push({ position: this.group.localToWorld(local.clone()).setY(0), radius })
  }

  // Chest with gold bands, its lid swung open, a heap of gold inside and coins spilled on the sand
  setTreasure(base) {
    const wood = this.toon('#8b5a32')
    const gold = this.toon('#f2c14e')
    addOutlined(this.group, new THREE.BoxGeometry(1.2, 0.65, 0.8).translate(0, 0.33, 0), wood, { position: base.toArray(), outline: [1.05, 1.08, 1.08] })
    for (const x of [-0.42, 0.42]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.67, 0.82).translate(0, 0.33, 0), gold)
      band.position.set(base.x + x, 0, base.z)
      this.group.add(band)
    }

    // Lid: half a cylinder lying along x, hinged at the back edge and tipped open
    const lidPivot = new THREE.Group()
    lidPivot.position.set(base.x, 0.65, base.z - 0.4)
    lidPivot.rotation.x = -1.9
    this.group.add(lidPivot)
    const lid = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(0, 0, 0.4)
    addOutlined(lidPivot, lid, wood, { outline: [1.04, 1.06, 1.06] })

    // Gold heap: a few flattened nuggets rising out of the chest
    for (const [x, z, size] of [[0, 0, 0.42], [-0.3, 0.1, 0.3], [0.3, -0.05, 0.32]]) {
      const heap = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), gold)
      heap.scale.y = 0.55
      heap.position.set(base.x + x, 0.68, base.z + z)
      this.group.add(heap)
    }
    const coin = new THREE.CylinderGeometry(0.09, 0.09, 0.025, 12)
    for (const [x, z, tilt] of [[0.8, 0.3, 0.3], [0.95, -0.15, -0.2], [0.7, 0.65, 0.1], [-0.75, 0.55, -0.35], [0.2, 0.7, 0.25]]) {
      const piece = new THREE.Mesh(coin, gold)
      piece.position.set(base.x + x, 0.045, base.z + z)
      piece.rotation.set(tilt, 0, -tilt * 0.7)
      this.group.add(piece)
    }
    this.addCircle(base, 0.75)
  }

  setCrates(base) {
    const wood = this.toon('#b98a52')
    addOutlined(this.group, new THREE.BoxGeometry(0.85, 0.85, 0.85).translate(0, 0.42, 0), wood, { position: base.toArray(), rotation: [0, 0.3, 0], outline: 1.06 })
    addOutlined(this.group, new THREE.BoxGeometry(0.6, 0.6, 0.6).translate(0, 0.3, 0), wood, { position: [base.x + 0.05, 0.85, base.z - 0.05], rotation: [0, -0.4, 0], outline: 1.07 })
    this.addCircle(base, 0.6)
  }

  // Shank tilted and planted in the sand, ring on top, crossbar (stock), curved arms ending in flukes
  setAnchor(base) {
    const iron = this.toon('#3b4252')
    const anchor = new THREE.Group()
    anchor.position.copy(base)
    anchor.rotation.set(0.12, 0.6, -0.18)
    this.group.add(anchor)
    addOutlined(anchor, new THREE.CylinderGeometry(0.09, 0.11, 2.4, 10).translate(0, 1.1, 0), iron, { outline: [1.3, 1.02, 1.3] })
    addOutlined(anchor, new THREE.TorusGeometry(0.22, 0.06, 8, 20), iron, { position: [0, 2.45, 0], outline: 1.15 })
    addOutlined(anchor, new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8).rotateZ(Math.PI / 2), iron, { position: [0, 2.0, 0], outline: [1.02, 1.4, 1.4] })
    // Arms: half a torus below the shank, half sunk in the sand
    addOutlined(anchor, new THREE.TorusGeometry(0.6, 0.09, 8, 20, Math.PI).rotateZ(Math.PI), iron, { position: [0, 0.35, 0], outline: 1.1 })
    for (const side of [-1, 1]) {
      addOutlined(anchor, new THREE.ConeGeometry(0.16, 0.36, 4), iron, { position: [side * 0.6, 0.48, 0], rotation: [0, 0, side * -0.5], outline: 1.15 })
    }
    this.addCircle(base, 0.7)
  }

  // Wooden barrel: a bulging lathe with dark hoops
  createBarrel() {
    const barrel = new THREE.Group()
    const points = []
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      points.push(new THREE.Vector2(0.36 + Math.sin(t * Math.PI) * 0.07, t * 0.95))
    }
    addOutlined(barrel, new THREE.LatheGeometry(points, 16), this.toon('#a46a3a'), { outline: [1.06, 1.02, 1.06] })
    const lid = new THREE.Mesh(new THREE.CircleGeometry(0.36, 16).rotateX(-Math.PI / 2), this.toon('#8b5a32'))
    lid.position.y = 0.95
    barrel.add(lid)
    const hoop = this.toon('#3b4252')
    for (const y of [0.15, 0.8]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 6, 20), hoop)
      ring.rotation.x = Math.PI / 2
      ring.position.y = y
      barrel.add(ring)
    }
    return barrel
  }

  setBarrelStack(base) {
    for (const [x, y, z] of [[-0.42, 0, 0], [0.42, 0, 0], [0, 0.95, 0]]) {
      const barrel = this.createBarrel()
      barrel.position.set(base.x + x, y, base.z + z)
      this.group.add(barrel)
    }
    this.addCircle(base, 1.0)
  }

  // A single barrel with the straw hat resting on it: wide yellow brim, rounded crown, red band
  setStrawHatBarrel(base) {
    const barrel = this.createBarrel()
    barrel.position.copy(base)
    this.group.add(barrel)

    const straw = this.toon('#f2c14e')
    const hat = new THREE.Group()
    hat.position.set(base.x, 0.97, base.z)
    hat.rotation.set(0.08, 0.5, -0.06)
    this.group.add(hat)
    addOutlined(hat, new THREE.CylinderGeometry(0.62, 0.64, 0.05, 28), straw, { outline: [1.04, 1.6, 1.04] })
    addOutlined(hat, new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1), straw, { outline: 1.07 })
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.1, 20, 1, true), this.toon('#d6202f', { side: THREE.DoubleSide }))
    band.position.y = 0.07
    hat.add(band)
    this.addCircle(base, 0.55)
  }
}
