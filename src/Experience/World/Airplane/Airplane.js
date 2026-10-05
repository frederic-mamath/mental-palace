import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'

// Livery inspired by Air France's colors (not its logo): white body, navy fin with a red and white
// stripe along the leading edge, and "AF" on the tail.
const colors = { white: '#f7f7f4', belly: '#d5dae1', navy: '#0b2a5b', red: '#d6202f', window: '#1e2a44', engine: '#c9ced6' }

// Cel-shaded airliner built from code. Nose along +x, up +y; the origin is the fuselage center,
// `groundClearance` above the ground when the wheels touch it.
export default class Airplane {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.length = 5
    this.groundClearance = 0.77
    this.gradientMap = createGradientMap()
    this.outlineMaterial = createOutlineMaterial()

    this.group = new THREE.Group()
    this.scene.add(this.group)

    this.setFuselage()
    this.setWings()
    this.setEngines()
    this.setTail()
    this.setLandingGear()

    this.group.traverse((child) => {
      if (child.isMesh && child.material !== this.outlineMaterial) child.castShadow = true
    })
  }

  toon(color, options = {}) {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.gradientMap, ...options })
  }

  // Mesh plus a scaled inverted-hull copy for the ink outline. Geometry should be centered on its own
  // origin and placed with `position`, so the hull grows evenly around the part instead of drifting.
  addOutlined(geometry, material, outlineScale, { parent = this.group, position } = {}) {
    const mesh = new THREE.Mesh(geometry, material)
    const hull = new THREE.Mesh(geometry, this.outlineMaterial)
    hull.scale.copy(outlineScale)
    if (position) {
      mesh.position.copy(position)
      hull.position.copy(position)
    }
    parent.add(mesh, hull)
    return mesh
  }

  // Lathe along an evenly sampled profile (so the livery texture isn't distorted), turned to point along +x,
  // with the tail cone swept up like an airliner's
  setFuselage() {
    const half = this.length / 2
    const radius = 0.48
    const radiusAt = (y) => {
      if (y > 1.4) return radius * Math.sqrt(Math.max(1 - ((y - 1.4) / (half - 1.4)) ** 2, 0)) // rounded nose
      if (y < -1) {
        const t = (y + half) / (half - 1) // 0 at the tail tip, 1 where the cabin starts
        return 0.12 + (radius - 0.12) * (1 - (1 - t) ** 2)
      }
      return radius
    }

    const samples = 48
    const profile = [new THREE.Vector2(0, -half)]
    for (let i = 0; i <= samples; i++) {
      const y = -half + (i / samples) * this.length
      profile.push(new THREE.Vector2(radiusAt(y), y))
    }

    const geometry = new THREE.LatheGeometry(profile, 32)
    geometry.rotateZ(-Math.PI / 2)
    const position = geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      if (x < -1) position.setY(i, position.getY(i) + (x + 1) ** 2 * 0.09)
    }
    geometry.computeVertexNormals()

    const material = this.toon('#ffffff', { map: this.createFuselageTexture() })
    this.addOutlined(geometry, material, new THREE.Vector3(1.015, 1.08, 1.08))
  }

  // Lathe UVs: u goes around (0 = +z side, 0.25 = belly, 0.5 = -z side, 0.75 = top), v from tail (0) to nose (1)
  createFuselageTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    const { width: w, height: h } = canvas
    const y = (v) => (1 - v) * h // canvas rows run top to bottom, v bottom to top

    ctx.fillStyle = colors.white
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = colors.belly
    ctx.fillRect(w * 0.14, 0, w * 0.22, h)

    // A row of cabin windows on each side (u = 0 wraps around the texture's edges)
    ctx.fillStyle = colors.window
    for (const u of [0, 0.5, 1]) {
      for (let v = 0.3; v < 0.76; v += 0.022) {
        ctx.beginPath()
        ctx.roundRect(u * w - 3, y(v) - 5, 6, 8, 2)
        ctx.fill()
      }
    }

    // Cockpit windscreen wrapping over the top of the nose
    ctx.beginPath()
    ctx.roundRect(w * 0.56, y(0.905), w * 0.38, h * 0.02, 3)
    ctx.fill()

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  // Flat swept planform (x along the fuselage, second coordinate the span) extruded thin and laid horizontal
  createPlanform(points, thickness) {
    const shape = new THREE.Shape(points.map(([x, span]) => new THREE.Vector2(x, span)))
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: thickness * 0.3,
      bevelSize: 0.03,
      bevelSegments: 1,
    })
    // Shape y becomes -z, the thickness becomes +y; then center it vertically
    geometry.rotateX(-Math.PI / 2).translate(0, -thickness / 2, 0)
    return geometry
  }

  setWings() {
    const geometry = this.createPlanform(
      [[0.5, 0], [-0.95, 3.3], [-1.45, 3.3], [-1.25, 0.45], [-1.25, -0.45], [-1.45, -3.3], [-0.95, -3.3]],
      0.1
    )
    this.addOutlined(geometry, this.toon(colors.white), new THREE.Vector3(1.02, 1.6, 1.02), { position: new THREE.Vector3(0, -0.25, 0) })
  }

  setEngines() {
    const nacelle = new THREE.CylinderGeometry(0.2, 0.17, 0.9, 16).rotateZ(Math.PI / 2)
    const intake = new THREE.CircleGeometry(0.15, 16).rotateY(Math.PI / 2)
    for (const side of [-1, 1]) {
      const engine = new THREE.Group()
      engine.position.set(0.2, -0.45, side * 1.35)
      this.group.add(engine)
      this.addOutlined(nacelle, this.toon(colors.engine), new THREE.Vector3(1.04, 1.18, 1.18), { parent: engine })
      const fan = new THREE.Mesh(intake, new THREE.MeshBasicMaterial({ color: colors.window }))
      fan.position.x = 0.452
      engine.add(fan)
    }
  }

  setTail() {
    const stabilizers = this.createPlanform(
      [[-1.75, 0], [-2.4, 1.25], [-2.7, 1.25], [-2.55, 0.3], [-2.55, -0.3], [-2.7, -1.25], [-2.4, -1.25]],
      0.06
    )
    this.addOutlined(stabilizers, this.toon(colors.white), new THREE.Vector3(1.02, 1.8, 1.02), { position: new THREE.Vector3(0, 0.2, 0) })

    // Fin: navy core plus a painted decal on each side
    const finPoints = [[-1.45, 0.3], [-2.35, 1.75], [-2.8, 1.75], [-2.65, 0.3]]
    const finShape = new THREE.Shape(finPoints.map(([x, y]) => new THREE.Vector2(x, y)))
    const finThickness = 0.1
    const fin = new THREE.ExtrudeGeometry(finShape, { depth: finThickness, bevelEnabled: false }).translate(0, 0, -finThickness / 2)
    this.addOutlined(fin, this.toon(colors.navy), new THREE.Vector3(1.01, 1.03, 1.8))

    for (const side of [1, -1]) {
      const decal = new THREE.Mesh(this.createFinDecalGeometry(finShape, side), this.toon('#ffffff', { map: this.createFinTexture(finPoints, side) }))
      decal.position.z = side * (finThickness / 2 + 0.003)
      this.group.add(decal)
    }
  }

  // Flat copy of the fin shape facing +z or -z, with UVs spanning its bounding box. On the -z side u is
  // reversed and the faces flipped, so the texture reads the right way round from that side too.
  createFinDecalGeometry(shape, side) {
    const geometry = new THREE.ShapeGeometry(shape)
    geometry.computeBoundingBox()
    const { min, max } = geometry.boundingBox
    const position = geometry.attributes.position
    const uv = geometry.attributes.uv
    for (let i = 0; i < position.count; i++) {
      const u = (position.getX(i) - min.x) / (max.x - min.x)
      uv.setXY(i, side > 0 ? u : 1 - u, (position.getY(i) - min.y) / (max.y - min.y))
    }
    if (side < 0) {
      const index = geometry.index.array
      for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]]
      geometry.computeVertexNormals()
    }
    return geometry
  }

  // Navy fin, a red and a white stripe parallel to the leading edge, "AF" in white.
  // Drawn in fin coordinates, mirrored on the -z side so the stripes stay at the front.
  createFinTexture(points, side) {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    const xs = points.map(([x]) => x)
    const ys = points.map(([, y]) => y)
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const toCanvas = (x, y) => {
      const u = (x - minX) / (maxX - minX)
      return [(side > 0 ? u : 1 - u) * size, (1 - (y - minY) / (maxY - minY)) * size]
    }
    const band = (offsetFront, offsetBack, color) => {
      // Quad parallel to the leading edge (from points[0] at the bottom to points[1] at the top), offset backward
      const [[x0, y0], [x1, y1]] = points
      ctx.fillStyle = color
      ctx.beginPath()
      for (const [x, y] of [[x0 - offsetFront, y0 - 0.2], [x1 - offsetFront, y1 + 0.2], [x1 - offsetBack, y1 + 0.2], [x0 - offsetBack, y0 - 0.2]]) {
        ctx.lineTo(...toCanvas(x, y))
      }
      ctx.fill()
    }

    ctx.fillStyle = colors.navy
    ctx.fillRect(0, 0, size, size)
    band(0.06, 0.2, colors.red)
    band(0.2, 0.3, colors.white)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'italic 900 74px -apple-system, "Helvetica Neue", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('AF', ...toCanvas(-2.42, 0.95))

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  // Nose and main gear; folded away (scaled down) once airborne
  setLandingGear() {
    this.gear = new THREE.Group()
    this.group.add(this.gear)

    const strut = new THREE.CylinderGeometry(0.035, 0.035, 0.42, 6)
    const wheel = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12).rotateX(Math.PI / 2)
    const strutMaterial = this.toon('#9aa1ab')
    const wheelMaterial = this.toon('#22252c')

    for (const [x, z] of [[1.6, 0], [-0.4, 0.45], [-0.4, -0.45]]) {
      const leg = new THREE.Mesh(strut, strutMaterial)
      leg.position.set(x, -0.42, z)
      const tyre = new THREE.Mesh(wheel, wheelMaterial)
      tyre.position.set(x, -this.groundClearance + 0.14, z)
      this.gear.add(leg, tyre)
    }
  }

  // 1 = gear down, 0 = retracted
  setGear(extension) {
    this.gear.scale.setScalar(Math.max(extension, 0.001))
    this.gear.visible = extension > 0.01
  }
}
