import * as THREE from 'three'
import Unit from './Unit.js'

const colors = {
  steel: '#a3a7ad',
  steelDark: '#4a4f5c',
  stone: '#b8b4ac',
  plate: '#2f5fc4',
  robe: '#24479a',
  robeLight: '#3f86d6',
  brass: '#d4a640',
  glass: '#9fe3ff',
  crystal: '#6fc7ff',
  wood: '#8a5a33',
  smoke: '#ece9e2',
  ink: '#1a1626',
}

// Overlord's juggernaut: the big melee unit (three times a minion's cost), 1.5 times as tall as the melee
// minion. A headless steel golem built like a gorilla: a chunky chest with a blue team plate and a crystal
// core behind a grille, sloped pauldrons with blue plates, long arms ending in stone fists near the ground,
// short piston legs on flat feet, and an exhaust stack on its back that puffs smoke. On top, where its head
// would be, an open cockpit: an unarmored minion drives it (a blue robe and hood, glowing eyes in the hood's
// shadow, brass goggles pushed up), its hands on two levers.
//
// Joints as in Unit.js, plus legs (hip -> knee -> foot on each side, from the root, so the chest can turn on
// its own). The pilot is a node under the waist with the usual `neck` (its hood); its gloves ride the levers
// (lever_R, lever_L) and the crystal is `core`, to make it glow. `update(elapsed)` plays a slow idle: a heavy
// sway, the core pulsing, the levers jiggling, the pilot looking around, smoke puffs (hidden until the first
// update, so they're left out of the .glb).
export default class Juggernaut extends Unit {
  constructor() {
    super('Juggernaut', colors)
    this.materials.glow = new THREE.MeshBasicMaterial({ name: 'glow', color: '#ffe066' })

    this.waist = this.joint('waist', this.group, [0, 1.35, 0])

    this.setLegs()
    this.setChest()
    this.setArms()
    this.setCockpit()
    this.setPilot()
    this.setExhaust()
    this.setStance()

    // In its own space: covers the body and the fists
    this.colliders = [{ position: new THREE.Vector3(0, 0, 0.1), radius: 1.6 }]
  }

  // A pelvis block, thighs, knee pistons, shins and flat feet
  setLegs() {
    this.add(this.chamferBox(1.0, 0.36, 0.66, 0.06), this.materials.steelDark, this.group, { position: [0, 1.3, 0], outline: 1.05 })
    for (const side of [-1, 1]) {
      const suffix = side < 0 ? 'R' : 'L'
      const x = 0.5 * side
      const hip = this.joint(`hip_${suffix}`, this.group, [0.48 * side, 1.15, 0])
      const knee = this.joint(`knee_${suffix}`, hip, [x, 0.66, 0.04])
      const foot = this.joint(`foot_${suffix}`, knee, [x, 0.24, 0.06])

      this.add(this.chamferBox(0.42, 0.56, 0.44, 0.05), this.materials.steel, hip, { position: this.local(hip, [0.48 * side, 0.93, 0.02]), outline: 1.06 })
      // The piston: 0.04 wider than the shin on each side, so their faces stay apart
      this.add(this.facet(new THREE.CylinderGeometry(0.17, 0.17, 0.58, 8).rotateZ(Math.PI / 2)), this.materials.steelDark, knee, { outline: [1.04, 1.1, 1.1] })
      this.add(this.chamferBox(0.5, 0.44, 0.52, 0.06), this.materials.steel, knee, { position: this.local(knee, [x, 0.42, 0.05]), outline: 1.06 })
      this.add(this.chamferBox(0.6, 0.24, 0.82, 0.06), this.materials.stone, foot, { position: this.local(foot, [x, 0.12, 0.12]), outline: [1.05, 1.12, 1.05] })
    }
  }

  // The chest block with a belly band, the blue team plate, and the crystal core behind a grille
  setChest() {
    const front = 1.15 / 2
    this.add(this.chamferBox(1.6, 1.25, 1.15, 0.16), this.materials.steel, this.waist, { position: this.local(this.waist, [0, 2.05, 0]), outline: [1.04, 1.04, 1.04] })
    this.add(this.chamferBox(1.66, 0.16, 1.21, 0.04), this.materials.steelDark, this.waist, { position: this.local(this.waist, [0, 1.55, 0]), outline: [1.03, 1.2, 1.03] })
    // Half sunk in the chest, so its faces stay 0.04 off the chest's front
    this.add(this.chamferBox(1.0, 0.42, 0.08, 0.03), this.materials.plate, this.waist, { position: this.local(this.waist, [0, 2.33, front + 0.01]), outline: 1.05 })

    const core = [0, 1.88, front]
    this.add(this.facet(new THREE.CylinderGeometry(0.33, 0.33, 0.12, 8).rotateX(Math.PI / 2)), this.materials.steelDark, this.waist, { position: this.local(this.waist, core), outline: 1.08 })
    this.core = new THREE.Group()
    this.core.name = 'core'
    this.core.position.fromArray(this.local(this.waist, [core[0], core[1], front + 0.05]))
    this.waist.add(this.core)
    const profile = [[0, -0.2], [0.22, -0.05], [0.22, 0.1], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x, y))
    this.add(this.facet(new THREE.LatheGeometry(profile, 6).rotateX(Math.PI / 2)), this.materials.crystal, this.core, { outline: 1.06 })
    for (const x of [-0.17, 0, 0.17]) {
      this.add(this.chamferBox(0.045, 0.62, 0.045, 0.01), this.materials.steelDark, this.waist, { position: this.local(this.waist, [x, core[1], front + 0.2]), outline: 1.2 })
    }
  }

  // Sloped pauldrons with blue plates, long arms, cuffed stone fists with a knuckle band, low by the feet
  setArms() {
    this.hands = {}
    for (const side of [-1, 1]) {
      const suffix = side < 0 ? 'R' : 'L'
      const shoulder = this.joint(`shoulder_${suffix}`, this.waist, [0.92 * side, 2.42, 0])
      const elbow = this.joint(`elbow_${suffix}`, shoulder, [1.14 * side, 1.62, 0.05])
      const hand = (this.hands[suffix] = this.joint(`hand_${suffix}`, elbow, [1.2 * side, 0.9, 0.14]))

      const pauldron = new THREE.Group()
      pauldron.name = `pauldron_${suffix}`
      pauldron.position.fromArray(this.local(shoulder, [1.08 * side, 2.55, 0]))
      pauldron.rotation.z = -0.2 * side
      shoulder.add(pauldron)
      this.add(this.chamferBox(0.72, 0.5, 0.86, 0.1), this.materials.steel, pauldron, { outline: 1.05 })
      // Clear of the pauldron's outline hull on every side
      this.add(this.chamferBox(0.6, 0.1, 0.74, 0.03), this.materials.plate, pauldron, { position: [0, 0.25, 0], outline: [1.04, 1.2, 1.04] })

      this.add(this.chamferBox(0.4, 0.66, 0.42, 0.06), this.materials.steelDark, shoulder, { position: this.local(shoulder, [1.12 * side, 2.0, 0.02]), outline: 1.06 })
      this.add(this.facet(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 8).rotateZ(Math.PI / 2)), this.materials.steelDark, elbow, { outline: [1.04, 1.1, 1.1] })
      this.add(this.chamferBox(0.52, 0.66, 0.54, 0.07), this.materials.steel, elbow, { position: this.local(elbow, [1.18 * side, 1.25, 0.1]), outline: 1.06 })

      // Cuff, fist and knuckles: faces 0.03 or more apart where they overlap
      this.add(this.chamferBox(0.62, 0.16, 0.7, 0.03), this.materials.steelDark, hand, { position: this.local(hand, [1.2 * side, 0.86, 0.13]), outline: [1.04, 1.15, 1.04] })
      this.add(this.chamferBox(0.8, 0.66, 0.8, 0.11), this.materials.stone, hand, { position: this.local(hand, [1.2 * side, 0.55, 0.22]), outline: 1.05 })
      this.add(this.chamferBox(0.86, 0.14, 0.12, 0.03), this.materials.steelDark, hand, { position: this.local(hand, [1.2 * side, 0.42, 0.62]), outline: 1.1 })
    }
  }

  // An open box on the chest's top (side walls a little lower than the front and back ones, so their tops
  // never share a plane), and two levers
  setCockpit() {
    const wallY = 2.76
    for (const z of [-0.41, 0.41]) {
      this.add(this.chamferBox(1.16, 0.36, 0.12, 0.03), this.materials.steelDark, this.waist, { position: this.local(this.waist, [0, wallY, z]), outline: 1.06 })
    }
    for (const x of [-0.49, 0.49]) {
      this.add(this.chamferBox(0.12, 0.32, 0.88, 0.03), this.materials.steelDark, this.waist, { position: this.local(this.waist, [x, wallY - 0.02, 0]), outline: 1.06 })
    }

    this.levers = {}
    for (const side of [-1, 1]) {
      const suffix = side < 0 ? 'R' : 'L'
      const lever = (this.levers[suffix] = this.joint(`lever_${suffix}`, this.waist, [0.24 * side, 2.65, 0.24]))
      lever.rotation.x = -0.25 // leaning toward the pilot
      this.add(this.facet(new THREE.CylinderGeometry(0.03, 0.03, 0.38, 6)), this.materials.wood, lever, { position: [0, 0.19, 0], outline: 1.4 })
      // The pilot's glove, on the knob
      this.add(this.chamferBox(0.14, 0.14, 0.14, 0.03), this.materials.robe, lever, { position: [0, 0.37, 0], outline: 1.12 })
    }
  }

  // The unarmored minion: a robed torso and sleeves reaching for the levers, a floppy hood with a dark face
  // and glowing eyes, brass goggles pushed up on the hood
  setPilot() {
    this.pilot = this.joint('pilot', this.waist, [0, 2.68, -0.07])
    this.neck = this.joint('neck', this.pilot, [0, 3.14, -0.05])

    this.add(this.chamferBox(0.6, 0.5, 0.46, 0.08), this.materials.robe, this.pilot, { position: this.local(this.pilot, [0, 2.89, -0.07]), outline: 1.06 })
    for (const side of [-1, 1]) {
      this.add(this.chamferBox(0.15, 0.15, 0.3, 0.03), this.materials.robe, this.pilot, { position: this.local(this.pilot, [0.27 * side, 3.03, 0.02]), rotation: [0.1, 0.1 * side, 0], outline: 1.1 })
    }

    const head = [0, 3.33, -0.05]
    const at = (x, y, z) => this.local(this.neck, [head[0] + x, head[1] + y, head[2] + z])
    this.add(this.chamferBox(0.6, 0.52, 0.58, 0.13), this.materials.robeLight, this.neck, { position: at(0, 0, 0), outline: 1.06 })
    const tip = new THREE.Group()
    tip.position.fromArray(at(0.06, 0.17, -0.33))
    tip.rotation.set(-0.8, 0, -0.4)
    this.neck.add(tip)
    this.add(this.chamferBox(0.36, 0.22, 0.36, 0.07), this.materials.robeLight, tip, { outline: 1.08 })

    // The hood's shadow with two eye holes, and the glowing eyes filling them: side by side on one plane,
    // never overlapping
    const face = new THREE.Shape()
    const w = 0.19
    const h = 0.14
    face.moveTo(-w, -h)
    face.lineTo(w, -h)
    face.lineTo(w, h)
    face.lineTo(-w, h)
    face.closePath()
    const eyes = []
    for (const side of [-1, 1]) {
      const hole = new THREE.Path()
      hole.absarc(0.09 * side, 0.01, 0.045, 0, Math.PI * 2, true)
      face.holes.push(hole)
      const eye = new THREE.Shape()
      eye.absarc(0.09 * side, 0.01, 0.045, 0, Math.PI * 2, false)
      eyes.push(eye)
    }
    const faceZ = 0.29 + 0.006
    this.add(new THREE.ShapeGeometry(face), this.materials.ink, this.neck, { position: at(0, -0.04, faceZ), outline: false })
    this.add(new THREE.ShapeGeometry(eyes), this.materials.glow, this.neck, { position: at(0, -0.04, faceZ), outline: false })

    // Goggles: a strap clear of the hood's outline hull, two brass rims with glass lenses on its front
    const goggles = new THREE.Group()
    goggles.name = 'goggles'
    goggles.position.fromArray(at(0, 0.14, 0))
    goggles.rotation.x = -0.15
    this.neck.add(goggles)
    this.add(this.chamferBox(0.7, 0.08, 0.68, 0.02), this.materials.brass, goggles, { outline: [1.03, 1.25, 1.03] })
    for (const side of [-1, 1]) {
      this.add(this.facet(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 8).rotateX(Math.PI / 2)), this.materials.brass, goggles, { position: [0.12 * side, 0.02, 0.35], outline: 1.12 })
      this.add(this.facet(new THREE.CylinderGeometry(0.065, 0.065, 0.1, 8).rotateX(Math.PI / 2)), this.materials.glass, goggles, { position: [0.12 * side, 0.02, 0.36], outline: false })
    }
  }

  // A stack on the back, its foot sunk in the chest, and the smoke puffs rising from it
  setExhaust() {
    const x = 0.42
    const z = -0.66
    this.add(this.facet(new THREE.CylinderGeometry(0.13, 0.15, 0.75, 8)), this.materials.steelDark, this.waist, { position: this.local(this.waist, [x, 2.75, z]), outline: [1.1, 1.02, 1.1] })
    this.add(this.facet(new THREE.CylinderGeometry(0.19, 0.19, 0.08, 8)), this.materials.steel, this.waist, { position: this.local(this.waist, [x, 3.13, z]), outline: [1.08, 1.3, 1.08] })

    this.smoke = new THREE.Group()
    this.smoke.name = 'smoke'
    this.smoke.position.fromArray(this.local(this.waist, [x, 3.2, z]))
    this.smoke.visible = false
    this.waist.add(this.smoke)
    const puff = this.facet(new THREE.IcosahedronGeometry(1, 0))
    this.puffs = [0, 1, 2].map(() => this.add(puff, this.materials.smoke, this.smoke, { outline: 1.1 }))
    // Each puff's outline hull follows it; all start at size 0
    this.puffHulls = this.puffs.map((mesh) => this.smoke.children[this.smoke.children.indexOf(mesh) + 1])
    for (const part of this.smoke.children) part.scale.setScalar(0)
  }

  // Gorilla stance: the chest leaning forward, the arms reaching a little ahead
  setStance() {
    this.waist.rotation.x = 0.08
    this.group.getObjectByName('shoulder_R').rotation.x = -0.15
    this.group.getObjectByName('shoulder_L').rotation.x = -0.15
  }

  update(elapsed) {
    // A heavy sway of the upper body
    this.waist.position.y = 1.35 + Math.sin(elapsed * 1.1) * 0.03
    this.waist.rotation.y = Math.sin(elapsed * 0.5) * 0.04
    // The core pulses
    this.core.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.06)
    // The pilot fiddles with the levers and looks around now and then
    this.levers.R.rotation.x = -0.25 + Math.sin(elapsed * 2.3) * 0.08
    this.levers.L.rotation.x = -0.25 + Math.sin(elapsed * 1.9 + 1) * 0.08
    this.neck.rotation.y = Math.sin(elapsed * 0.4 + 2) * 0.35 * Math.max(Math.sin(elapsed * 0.16), 0)

    // Smoke: three puffs rising, growing then fading out, one after the other
    this.smoke.visible = true
    this.puffs.forEach((mesh, i) => {
      const progress = (elapsed * 0.45 + i / 3) % 1
      const size = Math.sin(progress * Math.PI) * 0.16
      for (const part of [mesh, this.puffHulls[i]]) {
        part.position.set(progress * 0.25, progress * 1.1, -progress * 0.2)
        part.rotation.set(progress * 2, progress * 3, 0)
      }
      mesh.scale.setScalar(size)
      this.puffHulls[i].scale.setScalar(size * 1.1)
    })
  }
}
