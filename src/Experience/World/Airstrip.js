import * as THREE from 'three'
import Experience from '../Experience.js'
import { createGradientMap, createOutlineMaterial } from './toon.js'
import { createRandom, range } from './Decor/scatter.js'
import { createCityFrame } from './City/cityFrame.js'

// Bush airstrip on the entrepreneur island, on the flight line toward the city: a worn dirt strip
// with ragged edges and tyre tracks, white-painted edge stones and a windsock.
// Planes take off toward the destination (+along) and land coming back from it.
export default class Airstrip {
  constructor({ island, destination, length = 14.25, width = 3.6 }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time

    this.frame = createCityFrame(island.center, destination.center, island.center)
    this.width = width
    // Ends 2.5 units before the plateau edge facing the destination
    this.end = island.radiusAt(island.angleOf(destination.center.x, destination.center.z)) - 2.5
    this.start = this.end - length
    this.random = createRandom(21)
    this.gradientMap = createGradientMap()
    this.outlineMaterial = createOutlineMaterial()

    // Laid out along +x (the flight line), centered on the strip's middle
    this.group = new THREE.Group()
    this.frame.toWorld((this.start + this.end) / 2, 0, 0, this.group.position)
    this.group.rotation.y = this.frame.yaw
    this.scene.add(this.group)

    this.setStrip(length)
    this.setEdgeStones(length)
    this.setWindsock(length)
  }

  // Is (x, z) on the strip, grown by `margin`? Used to keep decor off it.
  contains(x, z, margin = 0) {
    const { along, across } = this.frame.toFrame(x, z)
    return along > this.start - margin && along < this.end + margin && Math.abs(across) < this.width / 2 + margin
  }

  // Flat band along x with wavy edges, lying on the ground
  createBand(length, halfWidth, { offset = 0, roughness = 0.12, seed = 0 } = {}) {
    const steps = 48
    const wobble = (x, side) => roughness * (Math.sin(x * 1.7 + seed + side * 2.1) + 0.5 * Math.sin(x * 4.3 + seed * 2 + side))
    const shape = new THREE.Shape()
    for (let i = 0; i <= steps; i++) {
      const x = -length / 2 + (i / steps) * length
      const y = offset + halfWidth + wobble(x, 1)
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    for (let i = steps; i >= 0; i--) {
      const x = -length / 2 + (i / steps) * length
      shape.lineTo(x, offset - halfWidth - wobble(x, -1))
    }
    return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2)
  }

  setStrip(length) {
    const dirt = new THREE.Mesh(
      this.createBand(length, this.width / 2, { roughness: 0.14 }),
      new THREE.MeshToonMaterial({ color: '#cfa86f', gradientMap: this.gradientMap })
    )
    dirt.position.y = 0.02
    dirt.receiveShadow = true

    const trackMaterial = new THREE.MeshToonMaterial({ color: '#a7834f', gradientMap: this.gradientMap })
    for (const [offset, seed] of [[-0.65, 1], [0.65, 4]]) {
      const track = new THREE.Mesh(this.createBand(length - 1.5, 0.17, { offset, roughness: 0.05, seed }), trackMaterial)
      track.position.y = 0.03
      track.receiveShadow = true
      this.group.add(track)
    }

    this.group.add(dirt)
  }

  // White-painted stones every couple of units along both edges, and a row across each end
  setEdgeStones(length) {
    const spots = []
    const edge = this.width / 2 + 0.35
    for (let x = -length / 2; x <= length / 2 + 0.01; x += 2.4) spots.push([x, edge], [x, -edge])
    for (const end of [-1, 1]) {
      for (let i = 0; i < 5; i++) spots.push([end * (length / 2 + 0.4), -this.width / 2 + (i / 4) * this.width])
    }

    const geometry = new THREE.DodecahedronGeometry(0.17, 0)
    const stones = new THREE.InstancedMesh(geometry, new THREE.MeshToonMaterial({ color: '#f4f1e8', gradientMap: this.gradientMap }), spots.length)
    const outlines = new THREE.InstancedMesh(geometry, this.outlineMaterial, spots.length)
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const euler = new THREE.Euler()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()

    spots.forEach(([x, z], i) => {
      const size = range(this.random, 0.8, 1.2)
      position.set(x, 0.08, z)
      quaternion.setFromEuler(euler.set(this.random() * 3, this.random() * 3, this.random() * 3))
      stones.setMatrixAt(i, matrix.compose(position, quaternion, scale.set(size, size * 0.7, size)))
      outlines.setMatrixAt(i, matrix.compose(position, quaternion, scale.set(size * 1.3, size * 0.95, size * 1.3)))
    })

    stones.castShadow = true
    this.group.add(stones, outlines)
  }

  // Orange-and-white striped sock on a pole beside the take-off end, fluttering in the wind
  setWindsock(length) {
    const windsock = new THREE.Group()
    windsock.position.set(length / 2 - 2, 0, -(this.width / 2 + 1.6))
    this.group.add(windsock)

    const poleHeight = 2.6
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, poleHeight, 8).translate(0, poleHeight / 2, 0),
      new THREE.MeshToonMaterial({ color: '#e9e6dd', gradientMap: this.gradientMap })
    )
    pole.castShadow = true
    const poleOutline = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, poleHeight + 0.05, 8).translate(0, poleHeight / 2, 0), this.outlineMaterial)
    windsock.add(pole, poleOutline)

    // Cone open at both ends; after the rotation its narrow end points along +x and the wide end sits at the pivot
    const sockLength = 1.3
    const sockGeometry = new THREE.CylinderGeometry(0.12, 0.26, sockLength, 16, 1, true)
    sockGeometry.rotateZ(-Math.PI / 2).translate(sockLength / 2, 0, 0)
    const sock = new THREE.Mesh(
      sockGeometry,
      new THREE.MeshToonMaterial({ map: this.createStripeTexture(), gradientMap: this.gradientMap, side: THREE.DoubleSide })
    )
    sock.castShadow = true

    this.sockPivot = new THREE.Group()
    this.sockPivot.position.y = poleHeight - 0.15
    this.sockPivot.add(sock)
    windsock.add(this.sockPivot)

    this.windsockPosition = windsock.getWorldPosition(new THREE.Vector3())
    // Pole collider, added to the world's colliders once the decor is placed
    this.collider = { position: this.windsockPosition, radius: 0.35 }
  }

  createStripeTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 80
    const ctx = canvas.getContext('2d')
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#f4f1e8' : '#f26b1d'
      ctx.fillRect(0, i * 16, 8, 16)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  update() {
    const elapsed = this.time.elapsed
    // Swings slowly around the breeze direction, flutters, droops a little when the gusts drop
    this.sockPivot.rotation.y = 0.6 + Math.sin(elapsed * 0.45) * 0.35
    this.sockPivot.rotation.z = -0.12 + Math.sin(elapsed * 0.9) * 0.08 + Math.sin(elapsed * 7.3) * 0.02
  }
}
