import * as THREE from 'three'
import Unit from './Unit.js'

const colors = {
  robe: '#24479a',
  robeLight: '#3f86d6',
  tabard: '#62a8f0',
  stone: '#c3c7cd',
  stoneDark: '#7b818c',
  wood: '#8a5a33',
  woodLight: '#d9a066',
  rune: '#5b3a22',
  glove: '#5a5aa8',
  crystal: '#6fc7ff',
  ink: '#1a1626',
}

// A square spiral, the runes carved on the necklace and the medallion (unit size, centered)
const runePoints = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.3], [0.1, 0.3], [0.1, 0.1], [0.3, 0.1], [0.3, -0.3], [-0.3, -0.3], [-0.3, 0.5], [-0.5, 0.5]]

// Overlord's ranged unit, from the user's reference (the caster minions of MOBAs), a little shorter than the
// melee one: a navy robe with a light blue tabard split at the bottom, a stone mask with angry eyes under a
// floppy stitched hood, a necklace of carved wooden beads with a stone medallion, purple gloves, and a
// wooden staff crowned with stone prongs holding a big blue crystal in its right hand; the left hand is
// raised, open, casting. No pauldrons, no shield.
//
// Joints as in Unit.js; the staff is a group under hand_R (to swap weapons) and its crystal a node of its
// own. The parts are modeled arms down; `setStance` poses the arms, so the .glb's rest pose is the casting
// one. `update(elapsed)` plays a slow idle: breathing, the head looking around, the casting hand pulsing, the
// crystal turning.
export default class RangedMinion extends Unit {
  constructor() {
    super('RangedMinion', colors)

    this.waist = this.joint('waist', this.group, [0, 0.88, 0])
    this.neck = this.joint('neck', this.waist, [0, 1.46, 0.03])

    this.setRobe()
    this.setTorso()
    this.setHead()
    this.setNecklace()
    this.setArms()
    this.setStaff()
    this.setStance()

    // In its own space: covers the body and the staff
    this.colliders = [{ position: new THREE.Vector3(0, 0, 0.1), radius: 1.0 }]
  }

  // A rune (square spiral) of `size`, flat on the xy plane
  rune(size) {
    const shape = new THREE.Shape(runePoints.map(([x, y]) => new THREE.Vector2(x * size, y * size)))
    return new THREE.ShapeGeometry(shape)
  }

  // Octagonal robe flaring toward the ground, the tabard down the front (split at the bottom), boot tips
  setRobe() {
    const height = 0.92
    const bottom = 0.55
    const top = 0.38
    const robe = new THREE.CylinderGeometry(top, bottom, height, 8).rotateY(Math.PI / 8).translate(0, height / 2, 0)
    this.add(this.facet(robe), this.materials.robe, this.group, { outline: [1.05, 1.01, 1.05] })

    // Tabard: leaning back with the robe's front face, a notch up from the bottom splits it in two flaps
    const apothem = Math.cos(Math.PI / 8)
    const lean = Math.atan(((bottom - top) * apothem) / height)
    const w = 0.19
    const h = height * 0.92
    const tabard = new THREE.Shape()
    tabard.moveTo(-w, 0)
    tabard.lineTo(-0.025, 0)
    tabard.lineTo(0, 0.24)
    tabard.lineTo(0.025, 0)
    tabard.lineTo(w, 0)
    tabard.lineTo(w * 0.9, h)
    tabard.lineTo(-w * 0.9, h)
    tabard.closePath()
    const tabardGeometry = new THREE.ExtrudeGeometry(tabard, { depth: 0.03, bevelEnabled: false }).translate(0, -h / 2, -0.015)
    this.add(this.facet(tabardGeometry), this.materials.tabard, this.group, {
      position: [0, height * 0.5, ((bottom + top) / 2) * apothem + 0.012],
      rotation: [-lean, 0, 0],
      outline: false,
    })

    // Boot tips peeking out under the hem
    for (const side of [-1, 1]) {
      this.add(this.chamferBox(0.2, 0.14, 0.24, 0.03), this.materials.wood, this.group, { position: [0.2 * side, 0.07, bottom * apothem - 0.02], outline: 1.1 })
    }
  }

  // A narrow chest under the necklace, a stone collar ring for the neck
  setTorso() {
    this.add(this.chamferBox(0.72, 0.46, 0.54, 0.06), this.materials.robe, this.waist, { position: this.local(this.waist, [0, 1.12, 0]), outline: [1.04, 1.06, 1.06] })
  }

  // A stone mask with slanted eye holes, under a light blue hood flopping back, stitched along its top, with a
  // stone band at its brim
  setHead() {
    // The head's center, 0.24 above the neck
    const at = (x, y, z) => [x, y + 0.24, z]
    this.add(this.chamferBox(0.64, 0.42, 0.7, 0.12), this.materials.robeLight, this.neck, { position: at(0, 0.12, -0.1), rotation: [-0.15, 0, 0], outline: 1.06 })
    this.add(this.chamferBox(0.68, 0.08, 0.74, 0.02), this.materials.stone, this.neck, { position: at(0, -0.08, -0.07), rotation: [-0.15, 0, 0], outline: [1.04, 1.25, 1.04] })

    // The floppy tip, falling back and to the side
    const tip = new THREE.Group()
    tip.position.fromArray(at(0.12, 0.22, -0.44))
    tip.rotation.set(-0.9, 0, -0.5)
    this.neck.add(tip)
    this.add(this.chamferBox(0.42, 0.26, 0.44, 0.08), this.materials.robeLight, tip, { outline: 1.08 })

    // Stitches across the seam on the hood's top (half in, half out of its top face)
    const hood = new THREE.Group()
    hood.position.fromArray(at(0, 0.12, -0.1))
    hood.rotation.set(-0.15, 0, 0)
    this.neck.add(hood)
    for (const [x, z] of [[-0.16, 0.08], [0.0, 0.0], [0.16, -0.08]]) {
      this.add(new THREE.BoxGeometry(0.035, 0.03, 0.2), this.materials.rune, hood, { position: [x, 0.21, z], rotation: [0, 0.6, 0], outline: false })
    }

    // The mask, in front of the hood
    const maskDepth = 0.16
    const maskZ = 0.28
    this.add(this.chamferBox(0.46, 0.46, maskDepth, 0.07), this.materials.stone, this.neck, { position: at(0, -0.04, maskZ), outline: 1.07 })
    const front = maskZ + maskDepth / 2 + 0.006
    for (const side of [-1, 1]) {
      const eye = new THREE.Shape()
      eye.moveTo(0.04 * side, 0.0)
      eye.lineTo(0.17 * side, 0.07)
      eye.lineTo(0.16 * side, -0.03)
      eye.lineTo(0.06 * side, -0.07)
      eye.closePath()
      this.add(new THREE.ShapeGeometry(eye), this.materials.ink, this.neck, { position: at(0, -0.02, front), outline: false })
    }
  }

  // Carved wooden beads in a ring on the shoulders, each with a rune on its outer face, and a stone medallion
  // hanging from the front one
  setNecklace() {
    const count = 9
    const radius = 0.4
    const y = 1.36
    const bead = this.chamferBox(0.24, 0.17, 0.16, 0.03)
    const rune = this.rune(0.09)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 // 0: the front
      const holder = new THREE.Group()
      holder.position.fromArray(this.local(this.waist, [Math.sin(angle) * radius, y - Math.cos(angle) * 0.04, Math.cos(angle) * radius]))
      holder.rotation.set(-0.25, angle, 0, 'YXZ') // leaning out, like it rests on the shoulders
      this.waist.add(holder)
      this.add(bead, this.materials.woodLight, holder, { outline: 1.08 })
      this.add(rune, this.materials.rune, holder, { position: [0, 0, 0.08 + 0.006], outline: false })
    }

    const medallionZ = 0.28 * 1.06 + 0.03 + 0.05 // in front of the chest's outline hull
    this.add(this.chamferBox(0.28, 0.3, 0.1, 0.04), this.materials.stone, this.waist, { position: this.local(this.waist, [0, 1.12, medallionZ]), outline: 1.08 })
    this.add(this.rune(0.16), this.materials.stoneDark, this.waist, { position: this.local(this.waist, [0, 1.12, medallionZ + 0.05 + 0.006]), outline: false })
  }

  // Sleeved arms and purple gloves; the left glove is open, palm forward
  setArms() {
    this.hands = {}
    this.elbows = {}
    this.shoulders = {}
    for (const side of [-1, 1]) {
      const suffix = side < 0 ? 'R' : 'L'
      const shoulder = (this.shoulders[suffix] = this.joint(`shoulder_${suffix}`, this.waist, [0.46 * side, 1.3, 0.02]))
      const elbow = (this.elbows[suffix] = this.joint(`elbow_${suffix}`, shoulder, [0.58 * side, 0.98, 0.04]))
      const hand = (this.hands[suffix] = this.joint(`hand_${suffix}`, elbow, [0.64 * side, 0.7, 0.16]))

      this.add(this.chamferBox(0.22, 0.4, 0.22, 0.04), this.materials.robe, shoulder, { position: this.local(shoulder, [0.53 * side, 1.15, 0.03]), rotation: [0, 0, 0.25 * side], outline: 1.08 })
      // The sleeve widens toward the wrist
      const sleeve = new THREE.CylinderGeometry(0.15, 0.12, 0.36, 6).rotateY(Math.PI / 6)
      this.add(this.facet(sleeve), this.materials.robe, elbow, { position: this.local(elbow, [0.62 * side, 0.85, 0.11]), rotation: [0.4, 0, 0.12 * side], outline: 1.08 })

      if (suffix === 'R') {
        // A fist around the staff
        this.add(this.chamferBox(0.17, 0.17, 0.17, 0.03), this.materials.glove, hand, { outline: 1.1 })
      } else {
        // Open palm (facing +z once the arm is raised) and a thumb
        this.add(this.chamferBox(0.22, 0.25, 0.09, 0.025), this.materials.glove, hand, { position: [0, -0.07, 0], outline: 1.1 })
        this.add(this.chamferBox(0.07, 0.13, 0.07, 0.015), this.materials.glove, hand, { position: [-0.14, -0.03, 0], rotation: [0, 0, 0.5], outline: 1.15 })
      }
    }
  }

  // Upright in the right fist: a wooden shaft, a light wooden collar, four stone prongs holding the crystal
  setStaff() {
    this.staff = new THREE.Group()
    this.staff.name = 'staff'
    this.hands.R.add(this.staff)

    const bottom = -0.5
    const top = 1.15
    this.add(this.facet(new THREE.CylinderGeometry(0.045, 0.055, top - bottom, 6)), this.materials.wood, this.staff, { position: [0, (top + bottom) / 2, 0], outline: [1.3, 1.01, 1.3] })
    this.add(this.facet(new THREE.CylinderGeometry(0.15, 0.13, 0.14, 8).rotateY(Math.PI / 8)), this.materials.woodLight, this.staff, { position: [0, top, 0], outline: [1.08, 1.2, 1.08] })
    this.add(this.facet(new THREE.CylinderGeometry(0.11, 0.15, 0.08, 8).rotateY(Math.PI / 8)), this.materials.stoneDark, this.staff, { position: [0, top + 0.11, 0], outline: [1.08, 1.25, 1.08] })
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4
      const prong = new THREE.Group()
      prong.position.set(Math.sin(angle) * 0.12, top + 0.2, Math.cos(angle) * 0.12)
      prong.rotation.set(0.35, angle, 0, 'YXZ') // leaning out
      this.staff.add(prong)
      this.add(this.chamferBox(0.09, 0.2, 0.07, 0.02), this.materials.stone, prong, { outline: 1.12 })
    }

    // The crystal: a hexagonal prism with pointed ends, longer at the top
    this.crystal = new THREE.Group()
    this.crystal.name = 'crystal'
    this.crystal.position.set(0, top + 0.42, 0)
    this.staff.add(this.crystal)
    const profile = [[0, -0.26], [0.16, -0.1], [0.19, 0.12], [0.12, 0.36], [0, 0.46]].map(([x, y]) => new THREE.Vector2(x, y))
    this.add(this.facet(new THREE.LatheGeometry(profile, 6)), this.materials.crystal, this.crystal, { outline: 1.06 })
  }

  // Casting: the staff held upright in front of the right side, the left hand raised, open, toward the front
  setStance() {
    this.elbows.R.rotation.set(-0.9, 0, 0)
    this.hands.R.rotation.set(0.9, 0, 0) // the staff stays upright
    this.shoulders.L.rotation.set(-0.45, 0, 0.75)
    this.elbows.L.rotation.set(-0.3, 0, 1.45)
    this.hands.L.rotation.set(0.1, -0.5, -0.2)
    this.rest = { handL: this.hands.L.rotation.x }
  }

  update(elapsed) {
    // Breathing: a slow rise of everything above the robe
    this.waist.position.y = 0.88 + Math.sin(elapsed * 1.6) * 0.02
    // Looking around now and then
    this.neck.rotation.y = Math.sin(elapsed * 0.4 + 1) * 0.25 * Math.max(Math.sin(elapsed * 0.15 + 2), 0)
    // The casting hand pulses, the crystal turns
    this.hands.L.rotation.x = this.rest.handL + Math.sin(elapsed * 2.2) * 0.08
    this.crystal.rotation.y = elapsed * 0.6
  }
}
