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
import Boarding from './Transport/Boarding.js'
import Pier, { shoreAlong } from './Ship/Pier.js'
import Ship from './Ship/Ship.js'
import Voyage from './Ship/Voyage.js'
import Raid from './Raid/Raid.js'
import { createCityFrame } from './City/cityFrame.js'

export default class World {
  constructor() {
    this.experience = new Experience()
    this.resources = this.experience.resources

    // Circles on the ground plane the character can't enter: { position, radius }
    this.colliders = []
    // Rectangles over the water the character may walk on (piers)
    this.walkways = []

    this.resources.on('ready', () => {
      this.environment = new Environment()
      this.island = new Island({ shape: islands.entrepreneur })
      this.water = new Water({ islands: Object.values(islands) })
      this.city = new City({ shape: islands.city, origin: islands.entrepreneur })
      this.setSeaRoute()
      this.hobbyIsland = new HobbyIsland({ shape: islands.hobby, origin: islands.entrepreneur, keepClear: (x, z, margin) => this.jetty.contains(x, z, margin) })
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

      this.ship = new Ship()
      this.voyage = new Voyage({ ship: this.ship, ...this.seaRoute })

      // City obstacles, for when the cloud flies over (added after the decor, like every late collider)
      this.colliders.push(...this.city.colliders, this.airFranceHangar.collider, ...this.hobbyIsland.colliders)

      this.cloud = new Cloud()
      this.windField = new WindField(this.cloud)
      this.boarding = new Boarding({
        route: this.flight,
        vehicle: this.airplane.group,
        character: this.cloud,
        stops: {
          airstrip: { island: islands.entrepreneur, prompt: 'Board AF flight to Paris' },
          city: { island: islands.city, prompt: 'Fly back to the island' },
        },
      })
      this.shipBoarding = new Boarding({
        route: this.voyage,
        vehicle: this.ship.group,
        character: this.cloud,
        ringRadius: 2.4,
        promptHeight: 2.4,
        followVertical: false, // don't bob the camera with the waves
        stops: {
          pier: { island: islands.entrepreneur, prompt: 'Set sail for the hobby island', zone: this.seaRoute.zones.pier },
          cove: { island: islands.hobby, prompt: 'Sail back home', zone: this.seaRoute.zones.cove },
        },
      })
      this.raid = new Raid({ entrance: this.hobbyIsland.arena.raid.center, homeIsland: islands.hobby, character: this.cloud })
      this.interactions = new Interactions({
        character: this.cloud,
        landmarks: [this.doubleTap, this.airFranceHangar, ...this.hobbyIsland.storyStones, this.raid, this.boarding, this.shipBoarding],
      })
      this.experience.camera.follow(this.cloud.group, { snap: true })
    })
  }

  // Sea route to the hobby island: a pier on the entrepreneur island's north shore (moved east of the
  // straight line, clear of the Double Tap phone) and a jetty in the cove, the ship mooring off each tip.
  // Boarding happens at each pier's root, on land.
  setSeaRoute() {
    const home = islands.entrepreneur
    const hobby = islands.hobby
    const frame = createCityFrame(home.center, hobby.center, home.center)
    const distance = Math.hypot(hobby.center.x - home.center.x, hobby.center.z - home.center.z)
    const pierAcross = 6
    const coveAcross = 0

    const homeEdge = shoreAlong(home, frame, pierAcross, 0, 60)
    const coveEdge = shoreAlong(hobby, frame, coveAcross, distance, distance - 60)
    this.pier = new Pier({ frame, across: pierAcross, landEnd: homeEdge - 1.5, seaEnd: homeEdge + home.beachWidth + 5.5 })
    this.jetty = new Pier({ frame, across: coveAcross, landEnd: coveEdge + 1.5, seaEnd: coveEdge - hobby.beachWidth - 5.5 })
    this.walkways.push(this.pier.walkway, this.jetty.walkway)

    const shipHalf = 3.8 // half the ship's length plus a little: it moors with its stern or bow at the tip
    this.seaRoute = {
      frame,
      stops: {
        pier: { s: this.pier.seaEnd + shipHalf, heading: 0, across: pierAcross, dropOff: { along: homeEdge - 2.5, across: pierAcross, facing: -1 } },
        cove: { s: this.jetty.seaEnd - shipHalf, heading: Math.PI, across: coveAcross, dropOff: { along: coveEdge + 2.5, across: coveAcross, facing: 1 } },
      },
      // Board from the middle of each pier, the ring drawn on its deck
      zones: {
        pier: { position: frame.toWorld(this.pier.middle, pierAcross), radius: 3, ringHeight: 0.08 },
        cove: { position: frame.toWorld(this.jetty.middle, coveAcross), radius: 3, ringHeight: 0.08 },
      },
    }
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
    // Palm crowns and rocks need more room than grass around the strip (and the pier's water lane)
    const offStrip = (margin) => (x, z) => this.airstrip.contains(x, z, margin) || this.pier.contains(x, z, margin)

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
    this.voyage?.update()
    this.shipBoarding?.update()
    this.raid?.update()
    this.doubleTap?.update()
    this.airFranceHangar?.update()
    this.hobbyIsland?.update()
    this.cloud?.update()
    this.windField?.update()
    this.interactions?.update()
    this.environment?.update()
  }
}
