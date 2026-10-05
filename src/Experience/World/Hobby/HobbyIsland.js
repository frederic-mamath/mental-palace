import * as THREE from 'three'
import Experience from '../../Experience.js'
import Island from '../Island.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'
import { createCityFrame } from '../City/cityFrame.js'
import { createRandom } from '../Decor/scatter.js'
import Grass from '../Decor/Grass.js'
import Flowers from '../Decor/Flowers.js'
import Rocks from '../Decor/Rocks.js'
import PalmTrees from '../Decor/PalmTrees.js'
import TrainingGround from './TrainingGround.js'
import PirateCove from './PirateCove.js'

// Zones, in the island's frame: `along` points away from the entrepreneur island (north), `across` east.
// Each zone gets a ground patch now; their landmarks and story beats come later.
const zones = {
  plaza: { along: 0, across: 0, radius: 3.6, color: '#d8cdb6', label: null },
  training: { along: 2, across: -14, radius: 7, color: '#c9a46c', label: 'Training Ground' }, // shonen: Naruto, Bleach, One Piece
  arena: { along: 2, across: 14, radius: 7, color: '#a39a90', label: 'Arena' }, // online games: WoW, LoL, StarCraft
  meadow: { along: 15, across: 0, radius: 6, color: '#a8dc84', label: 'Story Meadow' }, // FF7
  cove: { along: null, across: 0, radius: 5, color: '#f2dca2', label: 'Pirate Cove' }, // ship dock, in the bay (placed from the coastline)
}
const pathWidth = 1.7

// The hobby island: the playful one, homages to early-2000s shonen manga and games (never copied logos or
// characters). Laid out as four zones around a central plaza with a signpost, linked by dirt paths, with its
// own grass, flowers, rocks and palms.
export default class HobbyIsland {
  // keepClear(x, z, margin): extra places to keep decor off (the ship's jetty and its water lane)
  constructor({ shape, origin, keepClear = () => false }) {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.shape = shape
    this.keepClear = keepClear
    this.frame = createCityFrame(origin.center, shape.center)
    this.zones = structuredClone(zones)
    // The cove's sand reaches the inner shore of the bay, which faces the entrepreneur island
    const bayDepth = shape.radiusAt(shape.angleOf(origin.center.x, origin.center.z))
    this.zones.cove.along = -(bayDepth - this.zones.cove.radius * 1.15)
    this.gradientMap = createGradientMap()
    this.outlineMaterial = createOutlineMaterial()
    // Obstacles for the character once it sails here (added to the world's colliders by World)
    this.colliders = []

    this.island = new Island({ shape })
    this.setPaths()
    this.setZonePatches()
    this.setSignpost()
    this.setDecor()
    // Zone landmarks after the decor, so their colliders don't change where decor was placed
    this.trainingGround = new TrainingGround({ frame: this.frame, zone: this.zones.training, colliders: this.colliders })
    this.pirateCove = new PirateCove({ frame: this.frame, zone: this.zones.cove, colliders: this.colliders })
  }

  // Dirt paths from the plaza out to each zone, gently curved
  setPaths() {
    this.paths = []
    const material = new THREE.MeshToonMaterial({ color: '#c8a874', gradientMap: this.gradientMap })
    for (const [name, zone] of Object.entries(this.zones)) {
      if (name === 'plaza') continue
      // Control point pushed sideways for a slight bend
      const bend = { along: zone.along / 2 - zone.across * 0.15, across: zone.across / 2 + zone.along * 0.15 }
      const curve = new THREE.QuadraticBezierCurve(new THREE.Vector2(0, 0), new THREE.Vector2(bend.along, bend.across), new THREE.Vector2(zone.along, zone.across))
      const points = curve.getPoints(24)
      this.paths.push(points)

      const mesh = new THREE.Mesh(this.createRibbon(points, pathWidth), material)
      mesh.position.y = 0.02
      mesh.receiveShadow = true
      this.scene.add(mesh)
    }
  }

  // Flat strip of constant width along points given in the island's frame
  createRibbon(points, width) {
    const positions = []
    const left = new THREE.Vector3()
    const right = new THREE.Vector3()
    for (let i = 0; i < points.length; i++) {
      const previous = points[Math.max(i - 1, 0)]
      const next = points[Math.min(i + 1, points.length - 1)]
      const tangent = new THREE.Vector2().subVectors(next, previous).normalize()
      const point = points[i]
      // Perpendicular in the frame: (along, across) turned a quarter
      this.frame.toWorld(point.x - tangent.y * (width / 2), point.y + tangent.x * (width / 2), 0, left)
      this.frame.toWorld(point.x + tangent.y * (width / 2), point.y - tangent.x * (width / 2), 0, right)
      positions.push(left.x, 0, left.z, right.x, 0, right.z)
    }
    const indices = []
    for (let i = 0; i < points.length - 1; i++) {
      const a = i * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    // Winding may face down depending on the frame's handedness; make sure the normals point up
    if (geometry.attributes.normal.getY(0) < 0) {
      geometry.index.array.reverse()
      geometry.computeVertexNormals()
    }
    return geometry
  }

  // Each zone's ground: a wobbly disc (packed earth, stone, meadow, sand), the plaza paved on top
  setZonePatches() {
    for (const [name, zone] of Object.entries(this.zones)) {
      const shape = new THREE.Shape()
      const steps = 40
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2
        const radius = zone.radius * (1 + 0.08 * Math.sin(angle * 3 + zone.along) + 0.05 * Math.sin(angle * 5 + zone.across))
        if (i === 0) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
        else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
      }
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2),
        new THREE.MeshToonMaterial({ color: zone.color, gradientMap: this.gradientMap })
      )
      this.frame.toWorld(zone.along, zone.across, name === 'plaza' ? 0.04 : 0.03, mesh.position)
      mesh.receiveShadow = true
      this.scene.add(mesh)
    }
  }

  // Wooden signpost on the plaza, one plank pointing to each zone
  setSignpost() {
    const plaza = this.frame.toWorld(this.zones.plaza.along, this.zones.plaza.across)
    const wood = new THREE.MeshToonMaterial({ color: '#9b6b43', gradientMap: this.gradientMap })
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.2, 8).translate(0, 1.6, 0), wood)
    const postOutline = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 3.25, 8).translate(0, 1.6, 0), this.outlineMaterial)
    post.position.copy(plaza)
    postOutline.position.copy(plaza)
    post.castShadow = true
    this.scene.add(post, postOutline)
    this.colliders.push({ position: plaza.clone(), radius: 0.4 })

    const planks = Object.entries(this.zones).filter(([, zone]) => zone.label)
    planks.forEach(([, zone], i) => {
      const target = this.frame.toWorld(zone.along, zone.across)
      const direction = target.sub(plaza)
      const label = this.createPlankTexture(zone.label)
      // Box faces' UVs read correctly from outside, so the label reads from both sides
      const geometry = new THREE.BoxGeometry(2.3, 0.42, 0.08).translate(1.25, 0, 0)
      const plank = new THREE.Mesh(geometry, [wood, wood, wood, wood, label, label])
      const outline = new THREE.Mesh(geometry, this.outlineMaterial)
      outline.scale.set(1.03, 1.18, 1.8)
      for (const mesh of [plank, outline]) {
        mesh.position.set(plaza.x, 2.75 - i * 0.48, plaza.z)
        mesh.rotation.y = Math.atan2(-direction.z, direction.x)
        this.scene.add(mesh)
      }
      plank.castShadow = true
    })
  }

  createPlankTexture(text) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 48
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#b8845a'
    ctx.fillRect(0, 0, 256, 48)
    ctx.fillStyle = '#9b6b43'
    for (let y = 8; y < 48; y += 13) ctx.fillRect(0, y, 256, 2)
    ctx.fillStyle = '#2a1c12'
    ctx.font = '400 30px "Bebas Neue", Impact, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text.toUpperCase(), 128, 26)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return new THREE.MeshToonMaterial({ map: texture, gradientMap: this.gradientMap })
  }

  // Is (x, z) on a zone patch or a path, grown by `margin`? Keeps decor off them.
  onLayout(x, z, margin) {
    if (this.keepClear(x, z, margin)) return true
    const { along, across } = this.frame.toFrame(x, z)
    for (const zone of Object.values(this.zones)) {
      if (Math.hypot(along - zone.along, across - zone.across) < zone.radius * 1.1 + margin) return true
    }
    for (const points of this.paths) {
      for (const point of points) {
        if (Math.hypot(along - point.x, across - point.y) < pathWidth / 2 + margin + 0.4) return true
      }
    }
    return false
  }

  // Same decor kinds as the entrepreneur island, with their own seeds, off the zones and paths;
  // the FF7 meadow gets a dense field of yellow and white flowers
  setDecor() {
    const island = this.shape
    const cleared = []
    const avoid = (margin) => [...this.colliders, ...cleared].map(({ position, radius }) => ({ position, radius: radius + margin }))
    const off = (margin) => (x, z) => this.onLayout(x, z, margin)

    this.palmTrees = new PalmTrees({ island, random: createRandom(31), avoid: avoid(2), colliders: this.colliders, exclude: off(2.5), cleared })
    this.rocks = new Rocks({ island, random: createRandom(32), avoid: avoid(1.5), colliders: this.colliders, exclude: off(1.5), cleared })
    this.grass = new Grass({ island, random: createRandom(33), avoid: avoid(0.2), exclude: off(0.2), count: 700 })
    this.flowers = new Flowers({ island, random: createRandom(34), avoid: avoid(0.5), exclude: off(0.6), patches: 10 })

    const { meadow } = this.zones
    const centers = Array.from({ length: 7 }, (_, i) => {
      const angle = (i / 7) * Math.PI * 2
      const distance = i === 0 ? 0 : meadow.radius * 0.55
      return this.frame.toWorld(meadow.along + Math.cos(angle) * distance, meadow.across + Math.sin(angle) * distance)
    })
    this.meadowFlowers = new Flowers({ island, random: createRandom(35), avoid: [], centers, colors: ['#ffd23f', '#ffffff', '#fff3a6'] })
  }

  update() {
    this.palmTrees.update()
    this.trainingGround.update()
  }
}
