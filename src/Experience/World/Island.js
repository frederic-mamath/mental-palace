import * as THREE from 'three'
import Experience from '../Experience.js'
import { createGradientMap } from './toon.js'
import { sea } from './islands.js'

// Wild island colors: grass plateau, earthy cliffs, sand beach
const wildPalette = { top: '#7fcf6b', cliff: '#b07a4f', shore: '#f2dca2' }

// Land in two stacked slabs following an island's outline (an IslandShape from islands.js):
// a plateau with steep cliffs, and a lower shore ring (beach, quay ledge...) that sinks into the water.
export default class Island {
  constructor({ shape, palette = wildPalette }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.debug = this.experience.debug
    this.shape = shape

    const gradientMap = createGradientMap()
    this.materials = {
      top: new THREE.MeshToonMaterial({ color: palette.top, gradientMap }),
      cliff: new THREE.MeshToonMaterial({ color: palette.cliff, gradientMap }),
      shore: new THREE.MeshToonMaterial({ color: palette.shore, gradientMap }),
    }

    // Plateau top sits at y = 0, where the character and landmarks stand
    // Small plateau bevel keeps the cliff steep; the beach bevel reaches full width right at the waterline
    this.plateau = this.createSlab({ offset: 0, top: 0, bevel: 0.15 }, [this.materials.top, this.materials.cliff])
    this.beach = this.createSlab({ offset: shape.beachWidth, top: sea.waterLevel + 0.3, bevel: 0.3 }, this.materials.shore)

    this.setDebug()
  }

  createSlab({ offset, top, bevel, depth = 3 }, material) {
    const segments = 160
    const shape = new THREE.Shape()
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      // The bevel grows the outline by its size, so start that much inside
      const radius = this.shape.radiusAt(angle) + offset - bevel
      // Shape y becomes world -z after the rotation below, hence the minus sign
      const x = Math.cos(angle) * radius
      const y = -Math.sin(angle) * radius
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    shape.closePath()

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      steps: 1,
      curveSegments: 1,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
    })

    // Material groups: 0 = top/bottom caps, 1 = sides and bevel
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(this.shape.center.x, top - depth - bevel, this.shape.center.z)
    mesh.receiveShadow = true
    this.scene.add(mesh)
    return mesh
  }

  setDebug() {
    if (!this.debug.active) return

    const folder = this.debug.ui.addFolder(`Island: ${this.shape.name}`)
    folder.addColor(this.materials.top, 'color').name('top')
    folder.addColor(this.materials.cliff, 'color').name('cliff')
    folder.addColor(this.materials.shore, 'color').name('shore')
  }
}
