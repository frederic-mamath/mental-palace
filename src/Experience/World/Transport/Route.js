import * as THREE from 'three'
import Experience from '../../Experience.js'
import EventEmitter from '../../Utils/EventEmitter.js'

export const smoothstep = (t) => t * t * (3 - 2 * t)
export const easings = {
  linear: (t) => t,
  accelerate: (t) => t * t,
  decelerate: (t) => 1 - (1 - t) ** 2,
}

// A vehicle's trips between two stops on the same straight line (a flight frame's u axis), shared by the
// airplane (Airplane/Flight.js) and the ship (Ship/Voyage.js). A trip is a list of phases, each moving
// the vehicle along the line (s), with a sideways offset (lateral) and an optional altitude; the last phase
// turns it around in place to face the way back.
//
// The vehicle waits parked at a stop until depart() sends it on its next trip.
// Events: 'landed' (stop name) when the last phase (the turnaround) begins, 'arrived' (stop name) once
// parked. Implements the route interface of Transport/Boarding (subclasses add dropOff).
//
// Subclasses build this.trips with createTrip() and implement applyPose({ position, forward, altitude,
// delta }); they may override clockRate().
//   frame: the flight frame; stops: { [name]: { s, heading } }, heading measured from +u toward +v
//   baseHeight: height of the vehicle's center when altitude is 0
export default class Route extends EventEmitter {
  constructor({ frame, stops, parkedAt, baseHeight }) {
    super()

    this.experience = new Experience()
    this.time = this.experience.time

    this.frame = frame
    this.stops = stops
    this.parkedAt = parkedAt
    this.baseHeight = baseHeight
    this.trips = {}
    this.trip = null
    this.elapsed = 0

    this.forward = new THREE.Vector3()
    this.lastForward = new THREE.Vector3()
    this.sample = { position: new THREE.Vector3(), ahead: new THREE.Vector3(), behind: new THREE.Vector3() }
  }

  get travelling() {
    return this.trip !== null
  }

  // Where the vehicle will stop on its next trip
  get destination() {
    return this.trips[this.parkedAt].to
  }

  depart() {
    if (this.trip) return
    this.trip = this.trips[this.parkedAt]
    this.elapsed = 0
    this.landed = false
  }

  // Assembles a trip: phases get their start times, the shared sideways offset, and a final turnaround
  createTrip({ from, to, phases, lateral, turnDuration }) {
    const heading = this.stops[from].heading
    const stop = this.stops[to].s
    const all = [...phases, { name: 'turn', duration: turnDuration, s: [stop, stop], heading: [heading, heading + Math.PI] }]

    let elapsed = 0
    for (const phase of all) {
      phase.lateral = lateral
      phase.altitude ??= () => 0
      phase.start = elapsed
      elapsed += phase.duration
    }
    return { from, to, phases: all, duration: elapsed }
  }

  // World position of the vehicle's center `time` seconds into the current trip (or parked);
  // also returns the explicit heading when there is one (parked, turning)
  positionAt(time, target) {
    if (!this.trip) {
      const stop = this.stops[this.parkedAt]
      this.frame.toWorld(stop.s, 0, this.baseHeight, target)
      return { phase: null, altitude: 0, heading: stop.heading }
    }

    const t = THREE.MathUtils.clamp(time, 0, this.trip.duration)
    const phase = this.trip.phases.find((candidate) => t < candidate.start + candidate.duration) ?? this.trip.phases.at(-1)
    const progress = Math.min((t - phase.start) / phase.duration, 1)
    const s = THREE.MathUtils.lerp(phase.s[0], phase.s[1], easings[phase.ease ?? 'linear'](progress))
    const altitude = phase.altitude(progress)
    this.frame.toWorld(s, phase.lateral(s), this.baseHeight + altitude, target)
    const heading = phase.heading ? THREE.MathUtils.lerp(phase.heading[0], phase.heading[1], smoothstep(progress)) : null
    return { phase, altitude, heading }
  }

  // How fast the trip's clock runs (1 = as scheduled)
  clockRate() {
    return 1
  }

  // Orients `object` to face `forward` (its nose along local +x), rolled by `roll` around that axis
  orient(object, forward, roll = 0) {
    const right = new THREE.Vector3().crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize()
    const up = new THREE.Vector3().crossVectors(right, forward)
    object.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, up, right))
    object.rotateX(roll)
  }

  update() {
    const delta = this.time.delta

    if (this.trip) {
      this.elapsed += delta * this.clockRate()

      // Even if a long frame skips past the turnaround entirely, 'landed' still comes before 'arrived'
      if (!this.landed && this.elapsed >= this.trip.phases.at(-1).start) {
        this.landed = true
        this.trigger('landed', this.trip.to)
      }

      if (this.elapsed >= this.trip.duration) {
        this.parkedAt = this.trip.to
        this.trip = null
        this.trigger('arrived', this.parkedAt)
      }
    }

    const { position, ahead, behind } = this.sample
    const { phase, altitude, heading } = this.positionAt(this.elapsed, position)
    this.phase = phase

    // Facing: the explicit heading when parked or turning, otherwise the direction of travel
    // (including climbs and descents, which pitch the nose); keep the last one when not moving
    if (heading !== null) {
      this.forward.set(this.frame.u.x * Math.cos(heading) + this.frame.v.x * Math.sin(heading), 0, this.frame.u.y * Math.cos(heading) + this.frame.v.y * Math.sin(heading))
      this.lastForward.copy(this.forward)
    } else {
      this.positionAt(this.elapsed + 0.08, ahead)
      this.positionAt(this.elapsed - 0.08, behind)
      this.forward.subVectors(ahead, behind)
      if (this.forward.lengthSq() > 1e-4) this.lastForward.copy(this.forward.normalize())
      else this.forward.copy(this.lastForward)
    }

    this.applyPose({ position, forward: this.forward, altitude, delta })
  }
}
