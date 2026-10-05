import * as THREE from 'three'
import Experience from '../Experience.js'
import Environment from './Environment.js'
import Island from './Island.js'
import Water from './Water.js'
import Cloud from './Cloud.js'
import DoubleTap from './Projects/DoubleTap.js'
import AirFranceHangar from './Projects/AirFranceHangar.js'
import Interactions from './Interactions.js'
import projects from '../projects.js'
import PalmTrees from './Decor/PalmTrees.js'
import Rocks from './Decor/Rocks.js'
import Grass from './Decor/Grass.js'
import Flowers from './Decor/Flowers.js'
import { createRandom } from './Decor/scatter.js'
import { islands } from './islands.js'
import WindField from './WindField.js'
import City from './City/City.js'
import HobbyIsland from './Hobby/HobbyIsland.js'
import Airstrip from './Airstrip.js'
import Airplane from './Airplane/Airplane.js'
import Flight from './Airplane/Flight.js'
import Boarding from './Airplane/Boarding.js'

export default class World {
  constructor() {
    this.experience = new Experience()
    this.resources = this.experience.resources

    // Circles on the ground plane the character can't enter: { position, radius }
    this.colliders = []

    this.resources.on('ready', () => {
      this.environment = new Environment()
      this.island = new Island({ shape: islands.entrepreneur })
      this.water = new Water({ islands: Object.values(islands) })
      this.city = new City({ shape: islands.city, origin: islands.entrepreneur })
      this.hobbyIsland = new HobbyIsland({ shape: islands.hobby, origin: islands.entrepreneur })
      this.airFranceHangar = new AirFranceHangar({ project: projects.airFrance, frame: this.city.frame, ...this.city.hangarSite })

      // North is -z: straight ahead from the spawn point
      this.doubleTap = new DoubleTap({ project: projects.doubleTap, position: new THREE.Vector3(0, 0, -12) })
      this.colliders.push(this.doubleTap.collider)

      this.airstrip = new Airstrip({ island: islands.entrepreneur, destination: islands.city })
      this.setDecor()
      // After the decor, so this new collider doesn't change where decor was placed
      this.colliders.push(this.airstrip.collider)

      this.airplane = new Airplane()
      this.flight = new Flight({ airplane: this.airplane, airstrip: this.airstrip, city: this.city, colliders: this.colliders })

      // City obstacles, for when the cloud flies over (added after the decor, like every late collider)
      this.colliders.push(...this.city.colliders, this.airFranceHangar.collider, ...this.hobbyIsland.colliders)

      this.cloud = new Cloud()
      this.windField = new WindField(this.cloud)
      this.boarding = new Boarding({ flight: this.flight, airplane: this.airplane, character: this.cloud })
      this.interactions = new Interactions({ character: this.cloud, landmarks: [this.doubleTap, this.airFranceHangar, this.boarding] })
      this.experience.camera.follow(this.cloud.group, { snap: true })
    })
  }

  // Decor goes around what's already placed: big pieces first (they add colliders), small ones last.
  // One seed per kind, so tweaking one kind doesn't reshuffle the others.
  // Pieces on the airstrip are removed after placement rather than avoided, so the rest of the layout
  // stays exactly as it was before the airstrip existed; removed large pieces leave `cleared` zones that
  // later decor still avoids (as it avoided their colliders) without blocking the character.
  setDecor() {
    const spawn = { position: new THREE.Vector3(), radius: 2.5 }
    const cleared = []
    const avoid = (margin, { keepSpawnClear = true } = {}) => [
      ...(keepSpawnClear ? [spawn] : []),
      ...[...this.colliders, ...cleared].map(({ position, radius }) => ({ position, radius: radius + margin })),
    ]
    // Palm crowns and rocks need more room than grass around the strip
    const offStrip = (margin) => (x, z) => this.airstrip.contains(x, z, margin)

    const island = islands.entrepreneur
    const colliders = this.colliders
    this.palmTrees = new PalmTrees({ island, random: createRandom(1), avoid: avoid(2), colliders, exclude: offStrip(3), cleared })
    this.rocks = new Rocks({ island, random: createRandom(2), avoid: avoid(1.5), colliders, exclude: offStrip(2), cleared })
    // Grass may grow under the spawn point: it bends away from the cloud anyway
    this.grass = new Grass({ island, random: createRandom(3), avoid: avoid(0.2, { keepSpawnClear: false }), exclude: offStrip(0.3) })
    this.flowers = new Flowers({ island, random: createRandom(4), avoid: avoid(0.5), exclude: offStrip(0.8) })
  }

  update() {
    this.water?.update()
    this.palmTrees?.update()
    this.airstrip?.update()
    this.flight?.update()
    this.boarding?.update()
    this.doubleTap?.update()
    this.airFranceHangar?.update()
    this.hobbyIsland?.update()
    this.cloud?.update()
    this.windField?.update()
    this.interactions?.update()
    this.environment?.update()
  }
}
