import * as THREE from 'three'
import Experience from '../Experience.js'
import Environment from './Environment.js'
import Island from './Island.js'
import Water from './Water.js'
import Cloud from './Cloud.js'
import DoubleTap from './Projects/DoubleTap.js'

export default class World {
  constructor() {
    this.experience = new Experience()
    this.resources = this.experience.resources

    // Circles on the ground plane the character can't enter: { position, radius }
    this.colliders = []

    this.resources.on('ready', () => {
      this.environment = new Environment()
      this.island = new Island()
      this.water = new Water()

      // North is -z: straight ahead from the spawn point
      this.doubleTap = new DoubleTap({ position: new THREE.Vector3(0, 0, -12) })
      this.colliders.push(this.doubleTap.collider)

      this.cloud = new Cloud()
      this.experience.camera.follow(this.cloud.group)
    })
  }

  update() {
    this.water?.update()
    this.doubleTap?.update()
    this.cloud?.update()
    this.environment?.update()
  }
}
