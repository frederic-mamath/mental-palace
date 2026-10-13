import * as THREE from 'three'
import Unit from './Unit.js'

const colors = {
  robe: '#24479a',
  robeLight: '#3f86d6',
  leather: '#9a6236',
  leatherDark: '#5e3a22',
  wood: '#8a5a33',
  brass: '#d4a640',
  feather: '#f2eee4',
  string: '#efe4c8',
  crystal: '#6fc7ff',
  ink: '#1a1626',
}

// Overlord's archer (melee beats archer, archer beats caster, caster beats melee): a nimble ranger with no
// armor, the first minion whose legs show. A pointed blue cowl with a glowing visor slit in its shadow and a
// scarf over the lower face, a short leather tunic with a belt and a strap across the chest, blue sleeves
// and leggings, leather bracers and boots, a quiver of crystal-tipped arrows on its back, and a wooden bow
// with blue crystals at the grip and tips.
//
// Joints as in Unit.js, with legs (hip -> knee -> foot). Stance: side-on like a real archer, the bow arm
// straight toward the target, the string drawn to the cheek, aiming up to lob arrows over the units in front
// of it (it stands behind the juggernaut). The bow is a group under hand_L, the nocked arrow and the drawn
// string are in it. `update(elapsed)` plays a slow idle: breathing, holding the aim (a slight tremble), the
// scarf tail fluttering.
export default class ArcherMinion extends Unit {
  constructor() {
    super('ArcherMinion', colors)
    this.materials.glow = new THREE.MeshBasicMaterial({ name: 'glow', color: '#bff4ff' })

    this.waist = this.joint('waist', this.group, [0, 1.0, 0])
    this.neck = this.joint('neck', this.waist, [0, 1.6, 0.03])

    this.setLegs()
    this.setTunic()
    this.setTorso()
    this.setHead()
    this.setQuiver()
    this.setArms()
    this.setBow()
    this.setStance()

    // In its own space: covers the body and the bow
    this.colliders = [{ position: new THREE.Vector3(0, 0, 0.15), radius: 0.9 }]
  }

  // Blue leggings in leather boots, from the hips down
  setLegs() {
    for (const side of [-1, 1]) {
      const suffix = side < 0 ? 'R' : 'L'
      const x = 0.17 * side
      const hip = this.joint(`hip_${suffix}`, this.group, [x, 0.85, 0])
      const knee = this.joint(`knee_${suffix}`, hip, [x, 0.6, 0.02])
      const foot = this.joint(`foot_${suffix}`, knee, [x, 0.16, 0.03])
      // Each piece 0.03 or more narrower than the one it sinks into
      this.add(this.chamferBox(0.24, 0.36, 0.26, 0.04), this.materials.robe, hip, { position: this.local(hip, [x, 0.72, 0.01]), outline: 1.08 })
      this.add(this.chamferBox(0.18, 0.36, 0.2, 0.03), this.materials.robe, knee, { position: this.local(knee, [x, 0.5, 0.02]), outline: 1.08 })
      this.add(this.chamferBox(0.24, 0.34, 0.3, 0.04), this.materials.leatherDark, foot, { position: this.local(foot, [x, 0.17, 0.04]), outline: 1.08 })
      this.add(this.chamferBox(0.2, 0.12, 0.14, 0.03), this.materials.leatherDark, foot, { position: this.local(foot, [x, 0.06, 0.22]), outline: 1.1 })
    }
  }

  // A short octagonal leather tunic over the thighs, a dark belt with a brass buckle
  setTunic() {
    const bottom = 0.62
    const height = 0.5
    const top = 0.34
    const flare = 0.42
    const tunic = new THREE.CylinderGeometry(top, flare, height, 8).rotateY(Math.PI / 8).translate(0, bottom + height / 2, 0)
    this.add(this.facet(tunic), this.materials.leather, this.group, { outline: [1.05, 1.01, 1.05] })

    const beltY = 1.0
    const beltRadius = flare - (flare - top) * ((beltY - bottom) / height) + 0.03
    this.add(this.facet(new THREE.CylinderGeometry(beltRadius, beltRadius, 0.08, 8).rotateY(Math.PI / 8)), this.materials.leatherDark, this.group, { position: [0, beltY, 0], outline: [1.04, 1.25, 1.04] })
    this.add(this.chamferBox(0.1, 0.1, 0.05, 0.015), this.materials.brass, this.group, { position: [0, beltY, beltRadius * Math.cos(Math.PI / 8) + 0.025], outline: 1.15 })
  }

  // The leather chest (narrower than the tunic's top, so their sides stay apart), a strap across it, the scarf
  setTorso() {
    this.add(this.chamferBox(0.56, 0.42, 0.44, 0.06), this.materials.leather, this.waist, { position: this.local(this.waist, [0, 1.3, 0]), outline: [1.05, 1.06, 1.06] })
    this.add(this.chamferBox(0.08, 0.62, 0.06, 0.015), this.materials.leatherDark, this.waist, { position: this.local(this.waist, [0, 1.3, 0.22]), rotation: [0, 0, -0.75], outline: 1.1 })
    this.add(this.chamferBox(0.42, 0.14, 0.4, 0.05), this.materials.robe, this.waist, { position: this.local(this.waist, [0, 1.57, 0.03]), outline: 1.08 })
  }

  // The pointed cowl: a rounded hood, a peak leaning back, a dark face with a glowing visor slit, the scarf
  // pulled up over the lower face, its tail hanging down the back
  setHead() {
    const head = [0, 1.85, 0]
    const at = (x, y, z) => this.local(this.neck, [head[0] + x, head[1] + y, head[2] + z])
    this.add(this.chamferBox(0.5, 0.5, 0.52, 0.11), this.materials.robeLight, this.neck, { position: at(0, 0, 0), outline: 1.06 })
    this.add(this.facet(new THREE.ConeGeometry(0.29, 0.36, 4).rotateY(Math.PI / 4)), this.materials.robeLight, this.neck, { position: at(0, 0.36, -0.08), rotation: [-0.4, 0, 0], outline: 1.06 })

    // Shadow and slit side by side on one plane, never overlapping
    const face = new THREE.Shape()
    face.moveTo(-0.17, -0.13)
    face.lineTo(0.17, -0.13)
    face.lineTo(0.17, 0.13)
    face.lineTo(-0.17, 0.13)
    face.closePath()
    const slit = [[-0.13, 0.04], [0.13, 0.04], [0.11, 0.08], [-0.11, 0.08]].map(([x, y]) => new THREE.Vector2(x, y))
    face.holes.push(new THREE.Path([...slit].reverse()))
    const faceZ = 0.26 + 0.006
    this.add(new THREE.ShapeGeometry(face), this.materials.ink, this.neck, { position: at(0, -0.02, faceZ), outline: false })
    this.add(new THREE.ShapeGeometry(new THREE.Shape(slit)), this.materials.glow, this.neck, { position: at(0, -0.02, faceZ), outline: false })

    // The scarf's mask: its back face 0.03 in front of the face
    this.add(this.chamferBox(0.44, 0.18, 0.1, 0.04), this.materials.robe, this.neck, { position: at(0, -0.12, faceZ + 0.08), outline: 1.08 })
    this.scarfTail = new THREE.Group()
    this.scarfTail.name = 'scarf'
    this.scarfTail.position.fromArray(at(0.1, -0.22, -0.28))
    this.neck.add(this.scarfTail)
    this.add(this.chamferBox(0.14, 0.4, 0.05, 0.02), this.materials.robe, this.scarfTail, { position: [0, -0.2, 0], outline: 1.1 })
  }

  // A leather quiver slung across the back, its opening by the right shoulder, three arrows sticking out
  setQuiver() {
    const quiver = new THREE.Group()
    quiver.name = 'quiver'
    quiver.position.fromArray(this.local(this.waist, [0.05, 1.32, -0.36]))
    quiver.rotation.z = 0.4
    this.waist.add(quiver)
    this.add(this.facet(new THREE.CylinderGeometry(0.11, 0.09, 0.62, 8)), this.materials.leather, quiver, { outline: [1.08, 1.02, 1.08] })
    this.add(this.facet(new THREE.CylinderGeometry(0.125, 0.125, 0.06, 8)), this.materials.leatherDark, quiver, { position: [0, 0.29, 0], outline: [1.06, 1.3, 1.06] })
    for (const [x, z, lift] of [[-0.04, 0.03, 0.1], [0.04, 0.02, 0.04], [0, -0.04, 0.07]]) {
      const arrow = new THREE.Group()
      arrow.position.set(x, 0.3 + lift, z)
      quiver.add(arrow)
      this.add(this.facet(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 5)), this.materials.wood, arrow, { position: [0, 0, 0], outline: false })
      this.fletching(arrow, 0.06)
    }
  }

  // Two crossed feathers around an arrow's shaft (along y), centered `y` up it
  fletching(parent, y) {
    for (const turn of [0, Math.PI / 2]) {
      this.add(new THREE.BoxGeometry(0.1, 0.12, 0.008), this.materials.feather, parent, { position: [0, y, 0], rotation: [0, turn, 0], outline: [1.15, 1.08, 2] })
    }
  }

  // Blue sleeves, leather bracers, dark gloves; modeled down, posed by the stance
  setArms() {
    this.shoulders = {}
    this.elbows = {}
    this.hands = {}
    for (const side of [-1, 1]) {
      const suffix = side < 0 ? 'R' : 'L'
      const shoulder = (this.shoulders[suffix] = this.joint(`shoulder_${suffix}`, this.waist, [0.36 * side, 1.45, 0.02]))
      const elbow = (this.elbows[suffix] = this.joint(`elbow_${suffix}`, shoulder, [0.4 * side, 1.15, 0.03]))
      const hand = (this.hands[suffix] = this.joint(`hand_${suffix}`, elbow, [0.43 * side, 0.85, 0.05]))
      this.add(this.chamferBox(0.17, 0.3, 0.17, 0.03), this.materials.robe, shoulder, { position: this.local(shoulder, [0.38 * side, 1.3, 0.025]), rotation: [0, 0, 0.13 * side], outline: 1.08 })
      this.add(this.chamferBox(0.16, 0.26, 0.16, 0.03), this.materials.leather, elbow, { position: this.local(elbow, [0.415 * side, 1.0, 0.04]), rotation: [0, 0, 0.1 * side], outline: 1.08 })
      this.add(this.chamferBox(0.13, 0.13, 0.13, 0.025), this.materials.leatherDark, hand, { outline: 1.12 })
    }
  }

  // The bow, built in its own space: grip at the origin, limbs along y bending back (-z) toward the archer,
  // crystals at the grip and tips; it's turned toward the target by the stance
  setBow() {
    this.bow = new THREE.Group()
    this.bow.name = 'bow'
    this.hands.L.add(this.bow)

    this.add(this.chamferBox(0.06, 0.2, 0.07, 0.015), this.materials.leatherDark, this.bow, { outline: 1.15 })
    this.add(this.facet(new THREE.OctahedronGeometry(0.06)), this.materials.crystal, this.bow, { position: [0, 0, 0.06], outline: 1.15 })
    this.tips = []
    for (const side of [-1, 1]) {
      const points = [[0, 0.08 * side, 0], [0, 0.32 * side, -0.05], [0, 0.52 * side, -0.15]].map((p) => new THREE.Vector3(...p))
      for (let i = 0; i < points.length - 1; i++) this.limb(points[i], points[i + 1])
      const tip = points.at(-1)
      this.add(this.facet(new THREE.OctahedronGeometry(0.045)), this.materials.crystal, this.bow, { position: tip.toArray(), outline: 1.15 })
      this.tips.push(tip)
    }
  }

  // A tapering wooden segment from `a` to `b` (bow space)
  limb(a, b) {
    const length = a.distanceTo(b)
    const segment = this.facet(new THREE.CylinderGeometry(0.025, 0.035, length + 0.04, 6))
    const mesh = this.add(segment, this.materials.wood, this.bow, { position: a.clone().add(b).multiplyScalar(0.5).toArray(), outline: 1.25 })
    const hull = this.bow.children.at(-1)
    for (const part of [mesh, hull]) part.quaternion.setFromUnitVectors(new THREE.Vector3(0, Math.sign(b.y - a.y), 0), b.clone().sub(a).normalize())
  }

  // Side-on, the bow arm toward the target, the string drawn to the cheek; the target is up ahead, over the
  // units in front
  setStance() {
    this.waist.rotation.y = -0.85 // the left shoulder forward
    this.neck.rotation.set(-0.12, 0.8, 0, 'YXZ') // the head turned back toward the target

    const aim = new THREE.Vector3(0, Math.sin(0.32), Math.cos(0.32))
    const draw = 0.48
    const cheek = new THREE.Vector3(-0.2, 1.7, 0.15) // the right cheek's edge: the bow stays clear of the face
    const grip = cheek.clone().addScaledVector(aim, draw)
    this.reach(this.shoulders.L, this.elbows.L, this.hands.L, grip, new THREE.Vector3(1, -0.3, 0))
    this.reach(this.shoulders.R, this.elbows.R, this.hands.R, cheek, new THREE.Vector3(-1, 0.2, -0.6))

    // The bow facing the target, canted outward (its top away from the face); then the drawn string and the
    // arrow in bow space
    this.group.updateMatrixWorld(true)
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(aim, -aim.y).normalize().applyAxisAngle(aim, 0.3)
    const facing = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, aim), up, aim)
    const world = new THREE.Quaternion().setFromRotationMatrix(facing)
    this.bow.quaternion.copy(this.hands.L.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world))
    this.bow.position.copy(this.hands.L.worldToLocal(grip.clone()))
    this.bow.updateMatrixWorld(true)
    const nock = this.bow.worldToLocal(this.hands.R.getWorldPosition(new THREE.Vector3()))

    for (const tip of this.tips) {
      const length = tip.distanceTo(nock)
      const string = this.add(new THREE.BoxGeometry(0.012, length, 0.012), this.materials.string, this.bow, { position: tip.clone().add(nock).multiplyScalar(0.5).toArray(), outline: false })
      string.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(nock).normalize())
    }

    const arrow = new THREE.Group()
    arrow.name = 'arrow'
    arrow.position.copy(nock)
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nock.clone().negate().normalize())
    this.bow.add(arrow)
    const length = nock.length() + 0.22
    this.add(this.facet(new THREE.CylinderGeometry(0.014, 0.014, length, 5)), this.materials.wood, arrow, { position: [0, length / 2, 0], outline: 1.6 })
    this.add(this.facet(new THREE.OctahedronGeometry(0.04).scale(1, 1.8, 1)), this.materials.crystal, arrow, { position: [0, length + 0.05, 0], outline: 1.15 })
    this.fletching(arrow, 0.09)

    this.rest = { shoulderL: this.shoulders.L.quaternion.clone() }
  }

  update(elapsed) {
    // Breathing
    this.waist.position.y = 1.0 + Math.sin(elapsed * 1.7) * 0.015
    // Holding the aim: a slight tremble of the bow arm
    this.shoulders.L.quaternion.copy(this.rest.shoulderL).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(elapsed * 2.6) * 0.012, 0, Math.sin(elapsed * 1.9) * 0.012)))
    // The scarf's tail flutters
    this.scarfTail.rotation.set(0.2 + Math.sin(elapsed * 2.4) * 0.12, 0, Math.sin(elapsed * 1.7) * 0.1)
  }
}
