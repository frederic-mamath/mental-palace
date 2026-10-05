import * as THREE from 'three'

const colors = { edge: '#ff3b3b', fill: '#ff3b3b' }
// How much of the cloud's body may overlap an attack's edge before it counts as a hit (forgiving)
const tolerance = 0.35

// One boss attack telegraphed on the raid arena's floor: a red shape that fills up over `delay` seconds,
// strikes (flash), then fades. Shapes, in the arena's local space (floor at y = 0):
//   circle { x, z, radius } · cone { x, z, angle, length, halfAngle } (apex at x, z, pointing along angle)
//   line { x, z, angle, length, width } (centered on x, z) · donut { inner, outer } (safe inside `inner`)
// Angles are measured as Math.atan2(dz, dx).
export default class Telegraph {
  constructor({ parent, type, params, delay, layer = 0 }) {
    this.type = type
    this.params = params
    this.delay = delay
    this.elapsed = 0
    this.state = 'telegraph'

    this.group = new THREE.Group()
    this.group.position.set(params.x ?? 0, 0.03 + layer * 0.004, params.z ?? 0)
    parent.add(this.group)

    const material = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })
    this.fillMaterial = material(colors.fill, 0.18)
    this.edgeMaterial = material(colors.edge, 0.9)
    this.build()
  }

  // Flat geometry lying on the floor: shapes are drawn in XY, then laid down (shape y becomes -z,
  // so an angle a in the floor plane is -a in shape space)
  build() {
    const flat = (geometry) => geometry.rotateX(-Math.PI / 2)
    const { type, params } = this

    if (type === 'circle') {
      this.fill = new THREE.Mesh(flat(new THREE.CircleGeometry(params.radius, 40)), this.fillMaterial)
      this.edge = new THREE.Mesh(flat(new THREE.RingGeometry(params.radius - 0.14, params.radius, 40)), this.edgeMaterial)
    } else if (type === 'cone') {
      const start = -params.angle - params.halfAngle
      this.fill = new THREE.Mesh(flat(new THREE.CircleGeometry(params.length, 24, start, params.halfAngle * 2)), this.fillMaterial)
      this.edge = new THREE.Mesh(flat(new THREE.RingGeometry(params.length - 0.18, params.length, 24, 1, start, params.halfAngle * 2)), this.edgeMaterial)
    } else if (type === 'line') {
      this.group.rotation.y = -params.angle
      this.fill = new THREE.Mesh(flat(new THREE.PlaneGeometry(params.length, params.width)), this.fillMaterial)
      const sides = [-1, 1].map((side) => flat(new THREE.PlaneGeometry(params.length, 0.14)).translate(0, 0, side * (params.width / 2 - 0.07)))
      this.edge = new THREE.Group()
      for (const geometry of sides) this.edge.add(new THREE.Mesh(geometry, this.edgeMaterial))
    } else if (type === 'donut') {
      this.fill = new THREE.Mesh(flat(new THREE.RingGeometry(params.inner, params.outer, 64)), this.fillMaterial)
      this.edge = new THREE.Mesh(flat(new THREE.RingGeometry(params.inner - 0.16, params.inner, 64)), this.edgeMaterial)
    }

    this.group.add(this.fill, this.edge)
  }

  // Was (x, z), in the arena's local space, inside the attack?
  contains(x, z) {
    const { type, params } = this
    const dx = x - (params.x ?? 0)
    const dz = z - (params.z ?? 0)
    const distance = Math.hypot(dx, dz)

    if (type === 'circle') return distance <= params.radius + tolerance
    if (type === 'cone') {
      const offset = Math.atan2(Math.sin(Math.atan2(dz, dx) - params.angle), Math.cos(Math.atan2(dz, dx) - params.angle))
      return distance <= params.length + tolerance && (distance < 1 || Math.abs(offset) <= params.halfAngle + 0.08)
    }
    if (type === 'line') {
      const along = dx * Math.cos(params.angle) + dz * Math.sin(params.angle)
      const across = -dx * Math.sin(params.angle) + dz * Math.cos(params.angle)
      return Math.abs(along) <= params.length / 2 && Math.abs(across) <= params.width / 2 + tolerance
    }
    if (type === 'donut') return distance >= params.inner - tolerance
    return false
  }

  // Returns true on the frame the attack strikes
  update(delta) {
    this.elapsed += delta

    if (this.state === 'telegraph') {
      const progress = Math.min(this.elapsed / this.delay, 1)
      // The fill grows toward the edge (circles and cones from their center, lines from their middle);
      // a donut, which has no single center, brightens instead
      if (this.type === 'circle' || this.type === 'cone') this.fill.scale.setScalar(Math.max(progress, 0.02))
      if (this.type === 'line') this.fill.scale.z = Math.max(progress, 0.02)
      this.fillMaterial.opacity = 0.18 + 0.3 * progress
      if (progress >= 1) {
        this.state = 'impact'
        this.elapsed = 0
        this.fill.scale.set(1, 1, 1)
        return true
      }
      return false
    }

    if (this.state === 'impact') {
      // Flash, then fade out
      const fade = this.elapsed / 0.35
      this.fillMaterial.opacity = 0.85 * (1 - fade)
      this.edgeMaterial.opacity = 0.9 * (1 - fade)
      if (fade >= 1) this.state = 'done'
    }
    return false
  }

  dispose() {
    this.group.removeFromParent()
    this.group.traverse((child) => child.geometry?.dispose())
    this.fillMaterial.dispose()
    this.edgeMaterial.dispose()
  }
}
