import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'

// Where a straight line across a frame (constant `across`) meets an island's plateau edge, searching from
// `inland` (on the plateau) toward `seaward` (in the sea), both distances along the frame
export function shoreAlong(island, frame, across, inland, seaward) {
  let land = inland
  let sea = seaward
  for (let i = 0; i < 40; i++) {
    const middle = (land + sea) / 2
    const point = frame.toWorld(middle, across)
    if (island.edgeDistance(point.x, point.z) < 0) land = middle
    else sea = middle
  }
  return (land + sea) / 2
}

// Wooden pier on posts, level with the plateau, running along a frame from `landEnd` (just inland of the
// cliff, so it joins the land seamlessly) out to `seaEnd`. The ship moors off its tip.
export default class Pier {
  constructor({ frame, across = 0, landEnd, seaEnd, width = 2.2 }) {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.frame = frame
    this.across = across
    this.landEnd = landEnd
    this.seaEnd = seaEnd
    this.width = width
    this.direction = Math.sign(seaEnd - landEnd)

    const length = Math.abs(seaEnd - landEnd)
    // The deck as a walkway for the character: its center kept a little inside the deck's sides and short of
    // the tip, so the cloud doesn't bump into the moored ship
    this.walkway = {
      position: frame.toWorld((landEnd + seaEnd) / 2 - this.direction * 0.5, across),
      axis: frame.u,
      halfLength: length / 2 - 0.5,
      halfWidth: width / 2 - 0.35,
    }
    this.middle = (landEnd + seaEnd) / 2
    const gradientMap = createGradientMap()
    const outlineMaterial = createOutlineMaterial()

    // Laid out along local +x, from the land end
    this.group = new THREE.Group()
    frame.toWorld(landEnd, across, 0, this.group.position)
    this.group.rotation.y = frame.yaw + (this.direction < 0 ? Math.PI : 0)
    this.scene.add(this.group)

    // Deck top a few centimeters above the plateau: where the pier overlaps the land, a deck exactly at the
    // grass's height z-fights with it (both surfaces at the same depth flicker through each other)
    const deckTop = 0.05
    const deckGeometry = new THREE.BoxGeometry(length, 0.18, width).translate(length / 2, deckTop - 0.09, 0)
    const deck = new THREE.Mesh(deckGeometry, new THREE.MeshToonMaterial({ map: this.createPlankTexture(length), gradientMap }))
    deck.receiveShadow = true
    deck.castShadow = true
    const deckOutline = new THREE.Mesh(deckGeometry, outlineMaterial)
    deckOutline.scale.set(1.01, 1.3, 1.05)
    this.group.add(deck, deckOutline)

    // Posts down into the water every couple of units, and two bollards at the tip
    const wood = new THREE.MeshToonMaterial({ color: '#6e4a2c', gradientMap })
    const post = new THREE.CylinderGeometry(0.13, 0.15, 2.2, 8).translate(0, -1.2, 0)
    for (let x = 1.5; x <= length + 0.01; x += 2) {
      for (const side of [-1, 1]) {
        const mesh = new THREE.Mesh(post, wood)
        mesh.position.set(Math.min(x, length - 0.2), 0, side * (width / 2 - 0.1))
        this.group.add(mesh)
      }
    }
    const bollard = new THREE.CylinderGeometry(0.16, 0.2, 0.45, 10).translate(0, deckTop + 0.22, 0)
    for (const side of [-1, 1]) {
      const mesh = new THREE.Mesh(bollard, new THREE.MeshToonMaterial({ color: '#2a2833', gradientMap }))
      mesh.position.set(length - 0.4, 0, side * (width / 2 - 0.3))
      mesh.castShadow = true
      this.group.add(mesh)
    }
  }

  createPlankTexture(length) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#b07a4f'
    ctx.fillRect(0, 0, 256, 32)
    ctx.fillStyle = '#8b5d39'
    for (let x = 0; x < 256; x += 16) ctx.fillRect(x, 0, 2, 32)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.repeat.set(length / 8, 1)
    return texture
  }

  // Is (x, z) on the pier or in the water lane off its tip where the ship moors and leaves, grown by
  // `margin`? Keeps decor (rocks in the shallows, palms on the shore) out of the way.
  contains(x, z, margin = 0) {
    const { along, across } = this.frame.toFrame(x, z)
    const from = Math.min(this.landEnd, this.seaEnd + this.direction * 12)
    const to = Math.max(this.landEnd, this.seaEnd + this.direction * 12)
    return along > from - margin && along < to + margin && Math.abs(across - this.across) < this.width / 2 + 2.5 + margin
  }
}
