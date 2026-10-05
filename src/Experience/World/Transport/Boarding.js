import * as THREE from 'three'
import Experience from '../../Experience.js'
import ZoneRing from '../Effects/ZoneRing.js'

// Landmark (see Interactions) for riding a vehicle between islands: the AF airplane, the pirate ship...
// Offered while the vehicle is parked at a stop on the character's island, with a ring on the ground around
// it. Boarding hides the character in a smoke poof and the camera follows the vehicle; when the route says
// it has landed, the character steps out at the route's drop-off spot.
//
// route: { parkedAt (stop name), travelling, depart(), dropOff(stop) -> { position, yaw }, events 'landed' (stop) }
// stops: { [stop name]: { island (IslandShape), prompt } }
export default class Boarding {
  constructor({ route, vehicle, character, stops, ringColor, zoneRadius = 6.5, ringRadius = 6, promptHeight = 2.6 }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.inputs = this.experience.inputs
    this.camera = this.experience.camera

    this.route = route
    this.vehicle = vehicle
    this.character = character
    this.stops = stops
    this.promptHeight = promptHeight

    this.zone = { position: vehicle.position, radius: zoneRadius }
    this.route.on('landed', (stop) => this.disembark(stop))

    // Ground ring around the parked vehicle showing where boarding is offered; hidden while it can't be boarded
    this.ringAnchor = new THREE.Group()
    this.scene.add(this.ringAnchor)
    this.ring = new ZoneRing({ parent: this.ringAnchor, radius: ringRadius, color: ringColor })
  }

  get available() {
    return !this.route.travelling && this.character.island === this.stops[this.route.parkedAt].island
  }

  get promptLabel() {
    return this.stops[this.route.parkedAt].prompt
  }

  get pickTargets() {
    return [this.vehicle]
  }

  getPromptAnchor(target) {
    return target.copy(this.vehicle.position).setY(this.vehicle.position.y + this.promptHeight)
  }

  setActive(active) {
    this.ring.setActive(active)
  }

  interact() {
    if (!this.available) return

    this.ring.setActive(false)
    this.inputs.movementLocked = true
    this.character.setHidden(true)
    this.camera.follow(this.vehicle, { vertical: true })
    this.route.depart()
  }

  disembark(stop) {
    const { position, yaw } = this.route.dropOff(stop)
    position.y = this.character.group.position.y

    this.character.teleport(position, { island: this.stops[stop].island, yaw })
    this.camera.follow(this.character.group)
    this.character.setHidden(false)
    this.inputs.movementLocked = false
  }

  update() {
    const position = this.vehicle.position
    this.ringAnchor.position.set(position.x, 0, position.z)
    this.ringAnchor.visible = this.available
    this.ring.update(this.time.delta, this.time.elapsed)
  }
}
