import * as THREE from 'three'
import Experience from '../Experience.js'
import Environment from './Environment.js'
import Island from './Island.js'
import Water from './Water.js'
import Cloud from './Cloud.js'
import DoubleTap from './Projects/DoubleTap.js'
import PalmTrees from './Decor/PalmTrees.js'
import Rocks from './Decor/Rocks.js'
import Grass from './Decor/Grass.js'
import Flowers from './Decor/Flowers.js'
import { createRandom } from './Decor/scatter.js'
import { windUniforms } from './toon.js'

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

      this.setDecor()

      this.cloud = new Cloud()
      windUniforms.uPusherTrail.value.copy(this.cloud.group.position)
      this.experience.camera.follow(this.cloud.group)
    })
  }

  // Decor goes around what's already placed: big pieces first (they add colliders), small ones last.
  // One seed per kind, so tweaking one kind doesn't reshuffle the others.
  setDecor() {
    const spawn = { position: new THREE.Vector3(), radius: 2.5 }
    const avoid = (margin, { keepSpawnClear = true } = {}) => [
      ...(keepSpawnClear ? [spawn] : []),
      ...this.colliders.map(({ position, radius }) => ({ position, radius: radius + margin })),
    ]

    this.palmTrees = new PalmTrees({ random: createRandom(1), avoid: avoid(2), colliders: this.colliders })
    this.rocks = new Rocks({ random: createRandom(2), avoid: avoid(1.5), colliders: this.colliders })
    // Grass may grow under the spawn point: it bends away from the cloud anyway
    this.grass = new Grass({ random: createRandom(3), avoid: avoid(0.2, { keepSpawnClear: false }) })
    this.flowers = new Flowers({ random: createRandom(4), avoid: avoid(0.5) })
  }

  update() {
    windUniforms.uWindTime.value = this.experience.time.elapsed
    if (this.cloud) {
      const position = this.cloud.group.position
      windUniforms.uPusherPosition.value.copy(position)
      windUniforms.uPusherTrail.value.lerp(position, 1 - Math.exp(-3 * this.experience.time.delta))
    }
    this.water?.update()
    this.palmTrees?.update()
    this.doubleTap?.update()
    this.cloud?.update()
    this.environment?.update()
  }
}
