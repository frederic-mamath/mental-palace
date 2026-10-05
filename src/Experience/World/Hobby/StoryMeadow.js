import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, addOutlined } from '../toon.js'

// The hobby island's north zone, for Final Fantasy VII (homage, no copied design): a field of yellow and
// white flowers (planted by HobbyIsland) and a huge broadsword planted among them, slightly tilted.
// Built in the zone's own space: x toward the island's north (along), z toward its east (across).
export default class StoryMeadow {
  constructor({ frame, zone, colliders }) {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.group = new THREE.Group()
    frame.toWorld(zone.along, zone.across, 0, this.group.position)
    this.group.rotation.y = frame.yaw
    this.scene.add(this.group)
    this.group.updateMatrixWorld()

    const gradientMap = createGradientMap()
    const steel = new THREE.MeshToonMaterial({ color: '#c9d1db', gradientMap })
    const dark = new THREE.MeshToonMaterial({ color: '#2a2833', gradientMap })
    const grip = new THREE.MeshToonMaterial({ color: '#7a4a2a', gradientMap })

    const sword = new THREE.Group()
    const base = new THREE.Vector3(-0.4, 0, 2.0)
    sword.position.copy(base)
    sword.rotation.set(0.08, 0.4, -0.16)
    this.group.add(sword)

    // Broad blade with a point, its tip sunk into the ground
    const blade = new THREE.Shape()
    blade.moveTo(-0.3, 0)
    blade.lineTo(0, -0.45)
    blade.lineTo(0.3, 0)
    blade.lineTo(0.3, 3.0)
    blade.lineTo(-0.3, 3.0)
    blade.closePath()
    const bladeGeometry = new THREE.ExtrudeGeometry(blade, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }).translate(0, -0.25, -0.04)
    addOutlined(sword, bladeGeometry, steel, { outline: [1.05, 1.02, 1.6] })
    addOutlined(sword, new THREE.BoxGeometry(1.0, 0.14, 0.22), dark, { position: [0, 2.82, 0], outline: 1.08 })
    addOutlined(sword, new THREE.CylinderGeometry(0.07, 0.07, 0.7, 10), grip, { position: [0, 3.24, 0], outline: [1.25, 1.02, 1.25] })
    addOutlined(sword, new THREE.SphereGeometry(0.11, 10, 8), dark, { position: [0, 3.65, 0], outline: 1.12 })

    colliders.push({ position: this.group.localToWorld(base.clone()).setY(0), radius: 0.45 })
  }
}
