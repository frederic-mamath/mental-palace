import * as THREE from 'three'
import Experience from '../../Experience.js'
import ZoneRing from '../Effects/ZoneRing.js'
import { islands } from '../islands.js'

const stopIslands = { airstrip: islands.entrepreneur, city: islands.city }
const prompts = { airstrip: 'Board AF flight to Paris', city: 'Fly back to the island' }

// Landmark (see Interactions) for taking the airplane: offered when it's parked on the character's island.
// Boarding hides the character in a smoke poof and the camera follows the flight; once the airplane has
// rolled to a stop on the other island, the character steps out beside it while it turns around.
export default class Boarding {
  constructor({ flight, airplane, character }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.inputs = this.experience.inputs
    this.camera = this.experience.camera

    this.flight = flight
    this.airplane = airplane
    this.character = character

    this.zone = { position: airplane.group.position, radius: 6.5 }
    this.flight.on('landed', (stop) => this.disembark(stop))

    // Ground ring around the parked airplane showing where boarding is offered, in the livery's red
    // (reads on both grass and asphalt); hidden while it can't be boarded
    this.ringAnchor = new THREE.Group()
    this.scene.add(this.ringAnchor)
    this.ring = new ZoneRing({ parent: this.ringAnchor, radius: 6, color: '#d6202f' })
  }

  get available() {
    return !this.flight.flying && this.character.island === stopIslands[this.flight.parkedAt]
  }

  get promptLabel() {
    return prompts[this.flight.parkedAt]
  }

  get pickTargets() {
    return [this.airplane.group]
  }

  getPromptAnchor(target) {
    return target.copy(this.airplane.group.position).setY(this.airplane.group.position.y + 2.6)
  }

  setActive(active) {
    this.ring.setActive(active)
  }

  interact() {
    if (!this.available) return

    this.ring.setActive(false)
    this.inputs.movementLocked = true
    this.character.setHidden(true)
    this.camera.follow(this.airplane.group, { vertical: true })
    this.flight.depart()
  }

  // Step out beside the stopped airplane, off the runway (terminal side in the city, away from the
  // Double Tap phone on the airstrip), facing away from it, far enough to stay clear of the wingtips
  // while it turns around
  disembark(stop) {
    const side = stop === 'city' ? 1 : -1
    const { frame } = this.flight
    const position = frame.toWorld(this.flight.stops[stop].s, side * 5.5, this.character.group.position.y)
    const yaw = Math.atan2(frame.v.x * side, frame.v.y * side)

    this.character.teleport(position, { island: stopIslands[stop], yaw })
    this.camera.follow(this.character.group)
    this.character.setHidden(false)
    this.inputs.movementLocked = false
  }

  update() {
    const position = this.airplane.group.position
    this.ringAnchor.position.set(position.x, 0, position.z)
    this.ringAnchor.visible = this.available
    this.ring.update(this.time.delta, this.time.elapsed)
  }
}
