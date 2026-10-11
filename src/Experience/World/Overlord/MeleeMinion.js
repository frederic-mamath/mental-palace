import * as THREE from 'three'
import Unit from './Unit.js'

const colors = {
  robe: '#2f5fc4',
  robeLight: '#5a8cf0',
  chest: '#264ea6',
  steel: '#a3a7ad',
  steelDark: '#4a4f5c',
  wood: '#a8622f',
  crystal: '#6fc7ff',
  ink: '#1a1626',
}

// Overlord's melee unit, from the user's model (a nod to the melee minions of MOBAs): a blue robe with a
// lighter front panel and a brown belt, a grey shield-shaped helmet with angry eye slits, a blue chin gem
// and a crest knob, big sloped pauldrons, a stone hammer with a blue crystal held head down in its right
// hand and a tall steel-and-wood shield in its left. Blocky chamfered pieces, like a figurine.
//
// Joints as in Unit.js; the pauldrons ride the shoulders, the hammer and the shield are groups under the
// hands (to swap weapons). `update(elapsed)` plays a slow idle: breathing, the head looking around, the
// hammer swaying.
export default class MeleeMinion extends Unit {
  constructor() {
    super('MeleeMinion', colors)

    // Everything above the belt breathes; the robe stays put
    this.waist = this.joint('waist', this.group, [0, 0.42, 0])
    this.neck = this.joint('neck', this.waist, [0, 1.69, 0.04])

    this.setRobe()
    this.setTorso()
    this.setHead()
    this.setArms()
    this.setHammer()
    this.setShield()

    // In its own space: covers the body, the hammer and the shield
    this.colliders = [{ position: new THREE.Vector3(0, 0, 0.1), radius: 1.5 }]
  }

  // Octagonal robe flaring toward the ground, a lighter panel down the front, a belt with a buckle
  setRobe() {
    const height = 1.0
    const bottom = 0.62
    const top = 0.46
    const robe = new THREE.CylinderGeometry(top, bottom, height, 8).rotateY(Math.PI / 8).translate(0, height / 2, 0)
    this.add(this.facet(robe), this.materials.robe, this.group, { outline: [1.05, 1.01, 1.05] })

    // Front panel, leaning back with the robe's front face
    const apothem = Math.cos(Math.PI / 8)
    const lean = Math.atan(((bottom - top) * apothem) / height)
    this.add(new THREE.BoxGeometry(0.3, height * 0.94, 0.03), this.materials.robeLight, this.group, {
      position: [0, height * 0.49, ((bottom + top) / 2) * apothem + 0.012],
      rotation: [-lean, 0, 0],
      outline: false,
    })

    const beltY = 0.42
    const beltRadius = bottom - (bottom - top) * (beltY / height) + 0.025
    this.add(this.facet(new THREE.CylinderGeometry(beltRadius, beltRadius, 0.11, 8).rotateY(Math.PI / 8)), this.materials.wood, this.group, {
      position: [0, beltY, 0],
      outline: [1.04, 1.25, 1.04],
    })
    this.add(this.chamferBox(0.16, 0.14, 0.06, 0.015), this.materials.steelDark, this.group, { position: [0, beltY, beltRadius * apothem + 0.03], outline: 1.15 })
  }

  // Chest and a steel collar
  setTorso() {
    this.add(this.chamferBox(0.92, 0.5, 0.62, 0.06), this.materials.chest, this.waist, { position: this.local(this.waist, [0, 1.22, 0]), outline: [1.04, 1.06, 1.06] })
    this.add(this.chamferBox(0.5, 0.26, 0.42, 0.03), this.materials.steelDark, this.waist, { position: this.local(this.waist, [0, 1.56, 0]), outline: 1.06 })
  }

  // Shield-shaped helmet: flat brow, cheeks tapering to a chin; slanted eye slits, a chin gem, a crest
  setHead() {
    // The helmet's center, 0.21 above the neck
    const at = (x, y, z) => [x, y + 0.21, z]

    const depth = 0.44
    const outline = new THREE.Shape()
    outline.moveTo(-0.29, 0.24)
    outline.lineTo(0.29, 0.24)
    outline.lineTo(0.32, 0.02)
    outline.lineTo(0.17, -0.25)
    outline.lineTo(-0.17, -0.25)
    outline.lineTo(-0.32, 0.02)
    outline.closePath()
    const helmet = new THREE.ExtrudeGeometry(outline, { depth: depth - 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 })
    this.add(this.facet(helmet.translate(0, 0, -(depth - 0.06) / 2)), this.materials.steel, this.neck, { position: at(0, 0, 0), outline: 1.07 })

    // Eye slits: inner corners low, for the frown
    const front = depth / 2 + 0.006
    for (const side of [-1, 1]) {
      const eye = new THREE.Shape()
      eye.moveTo(0.05 * side, -0.01)
      eye.lineTo(0.23 * side, 0.07)
      eye.lineTo(0.22 * side, 0.0)
      eye.lineTo(0.07 * side, -0.07)
      eye.closePath()
      // ShapeGeometry fixes the winding of the mirrored slit itself
      this.add(new THREE.ShapeGeometry(eye), this.materials.ink, this.neck, { position: at(0, 0.02, front), outline: false })
    }
    this.add(this.facet(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 6).rotateX(Math.PI / 2)), this.materials.crystal, this.neck, { position: at(0, -0.17, front), outline: 1.2 })
    this.add(this.chamferBox(0.13, 0.26, 0.15, 0.02), this.materials.steel, this.neck, { position: at(0, 0.36, -0.04), outline: 1.1 })
  }

  // Sloped pauldrons with a dark trim, and blocky arms reaching down to the hammer (right) and the shield (left)
  setArms() {
    this.hands = {}
    for (const side of [-1, 1]) {
      const suffix = side < 0 ? 'R' : 'L'
      const shoulder = this.joint(`shoulder_${suffix}`, this.waist, [0.8 * side, 1.38, 0.02])
      const elbow = this.joint(`elbow_${suffix}`, shoulder, [0.93 * side, 0.95, 0.05])
      this.hands[suffix] = this.joint(`hand_${suffix}`, elbow, [1.02 * side, 0.72, 0.26])

      const pauldron = new THREE.Group()
      pauldron.name = `pauldron_${suffix}`
      pauldron.position.fromArray(this.local(shoulder, [0.7 * side, 1.52, 0]))
      pauldron.rotation.z = -0.42 * side
      shoulder.add(pauldron)
      this.add(this.chamferBox(0.62, 0.36, 0.74, 0.06), this.materials.steel, pauldron, { outline: [1.05, 1.08, 1.05] })
      // Trim: clearly wider than the pauldron's outline hull (sides 0.005 apart z-fought)
      this.add(this.chamferBox(0.72, 0.09, 0.84, 0.02), this.materials.steelDark, pauldron, { position: [0, -0.2, 0], outline: [1.04, 1.2, 1.04] })

      // Upper arm down and out from under the pauldron, the elbow, the forearm forward to the hand
      this.add(this.chamferBox(0.24, 0.42, 0.24, 0.03), this.materials.steel, shoulder, { position: this.local(shoulder, [0.86 * side, 1.18, 0.02]), rotation: [0, 0, 0.25 * side], outline: 1.08 })
      this.add(this.chamferBox(0.13, 0.13, 0.13, 0.02), this.materials.steelDark, elbow, { outline: 1.15 })
      this.add(this.chamferBox(0.26, 0.4, 0.26, 0.03), this.materials.steel, elbow, { position: this.local(elbow, [0.98 * side, 0.78, 0.16]), rotation: [0.5, 0, 0.12 * side], outline: 1.08 })
    }
  }

  // Held head down at the right side: a stone block with a brown rivet on its outer face, a blue crystal on
  // top where the short handle meets the fist
  setHammer() {
    // In the fist; the head's bottom stays above the feet (y = 0)
    this.hammer = new THREE.Group()
    this.hammer.name = 'hammer'
    this.hands.R.add(this.hammer)

    this.add(this.facet(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 6)), this.materials.steelDark, this.hammer, { position: [-0.1, -0.06, 0], rotation: [0, 0, -0.35], outline: 1.25 })
    this.add(this.facet(new THREE.CylinderGeometry(0.12, 0.14, 0.12, 6)), this.materials.crystal, this.hammer, { position: [-0.2, -0.17, 0], outline: 1.15 })
    this.add(this.chamferBox(0.66, 0.5, 0.6, 0.08), this.materials.steel, this.hammer, { position: [-0.3, -0.47, 0], outline: 1.05 })
    this.add(this.facet(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10).rotateZ(Math.PI / 2)), this.materials.wood, this.hammer, { position: [-0.645, -0.47, 0], outline: 1.2 })
  }

  // Tall shield on the left: a steel top plate with cut corners and a square window, over a wooden board
  // with a dark strip down the middle
  setShield() {
    this.shield = new THREE.Group()
    this.shield.name = 'shield'
    this.shield.position.fromArray(this.local(this.hands.L, [1.3, 0.98, 0.66]))
    this.shield.rotation.y = -0.28
    this.hands.L.add(this.shield)

    const thickness = 0.14
    this.add(this.chamferBox(0.74, 1.0, thickness, 0.03), this.materials.wood, this.shield, { position: [0, -0.4, 0], outline: [1.04, 1.03, 1.3] })
    this.add(new THREE.BoxGeometry(0.12, 0.96, 0.02), this.materials.steelDark, this.shield, { position: [0, -0.42, thickness / 2 + 0.01], outline: false })

    const plate = new THREE.Shape()
    const w = 0.43
    const cut = 0.14
    plate.moveTo(-w, -0.22)
    plate.lineTo(w, -0.22)
    plate.lineTo(w, 0.5 - cut)
    plate.lineTo(w - cut, 0.5)
    plate.lineTo(-w + cut, 0.5)
    plate.lineTo(-w, 0.5 - cut)
    plate.closePath()
    const plateDepth = 0.24 // thicker than the board, so their back faces are 0.03 apart
    const plateGeometry = new THREE.ExtrudeGeometry(plate, { depth: plateDepth - 0.04, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 })
    this.add(this.facet(plateGeometry.translate(0, 0, -(plateDepth - 0.04) / 2)), this.materials.steel, this.shield, { position: [0, 0.22, 0.02], outline: [1.04, 1.04, 1.25] })

    // The window: a dark square frame on the plate's face
    const frame = new THREE.Shape()
    frame.moveTo(-0.15, -0.15)
    frame.lineTo(0.15, -0.15)
    frame.lineTo(0.15, 0.15)
    frame.lineTo(-0.15, 0.15)
    frame.closePath()
    const hole = new THREE.Path()
    hole.moveTo(-0.09, -0.09)
    hole.lineTo(-0.09, 0.09)
    hole.lineTo(0.09, 0.09)
    hole.lineTo(0.09, -0.09)
    hole.closePath()
    frame.holes.push(hole)
    this.add(new THREE.ShapeGeometry(frame), this.materials.ink, this.shield, { position: [0, 0.48, 0.02 + plateDepth / 2 + 0.006], outline: false })
  }

  update(elapsed) {
    // Breathing: a slow rise of everything above the belt
    this.waist.position.y = 0.42 + Math.sin(elapsed * 1.6) * 0.025
    // Looking around now and then
    this.neck.rotation.y = Math.sin(elapsed * 0.45) * 0.25 * Math.max(Math.sin(elapsed * 0.17), 0)
    // The hammer's weight swings the hand a little
    this.hands.R.rotation.z = Math.sin(elapsed * 1.1) * 0.05
  }
}
