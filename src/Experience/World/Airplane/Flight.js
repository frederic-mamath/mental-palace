import * as THREE from 'three'
import Experience from '../../Experience.js'

const smoothstep = (t) => t * t * (3 - 2 * t)
const easings = {
  linear: (t) => t,
  accelerate: (t) => t * t,
  decelerate: (t) => 1 - (1 - t) ** 2,
}

// Toon-scale speeds (units per second) and flight profile
const profile = {
  takeoffRoll: 11, // runway distance before lift-off
  climbDistance: 22,
  approachDistance: 22,
  cruiseAltitude: 10,
  detour: 9, // sideways bulge of the flight path over the sea; outbound and return bulge on opposite sides
  rollSpeed: 8,
  climbSpeed: 8,
  cruiseSpeed: 7,
  approachSpeed: 7.5,
  hold: 2.5, // seconds parked at each end
  turn: 2.4, // seconds to turn around on the runway
}

// Scripted round trip between the airstrip and the city runway. Both lie on the same straight line
// (the flight frame's u axis), so the whole trip is described by a distance along that line (s), an
// altitude, and a sideways offset for the curve over the sea. The schedule loops:
// hold, take-off roll, climb, cruise, approach, rollout, turn around, then the same way back.
export default class Flight {
  constructor({ airplane, airstrip, city, colliders }) {
    this.experience = new Experience()
    this.time = this.experience.time

    this.airplane = airplane
    this.frame = airstrip.frame

    // Runway ends as distances along the flight line, from the entrepreneur island's center
    const cityRunwayStart = city.frame.toWorld(city.runway.start, 0)
    const cityStart = this.frame.toFrame(cityRunwayStart.x, cityRunwayStart.z).along
    this.stops = {
      airstrip: airstrip.start + 1,
      airstripTouchdown: airstrip.end - 1,
      cityTouchdown: cityStart + 1,
      city: cityStart + city.runway.length - 2,
    }

    this.phases = [
      ...this.createTrip({ from: this.stops.airstrip, touchdown: this.stops.cityTouchdown, to: this.stops.city, direction: 1, heading: 0, name: 'outbound' }),
      ...this.createTrip({ from: this.stops.city, touchdown: this.stops.airstripTouchdown, to: this.stops.airstrip, direction: -1, heading: Math.PI, name: 'return' }),
    ]
    let start = 0
    for (const phase of this.phases) {
      phase.start = start
      start += phase.duration
    }
    this.duration = start
    this.elapsed = 0

    this.forward = new THREE.Vector3()
    this.lastForward = new THREE.Vector3(this.frame.u.x, 0, this.frame.u.y)
    this.bank = 0
    this.gear = 1
    this.sample = { position: new THREE.Vector3(), ahead: new THREE.Vector3(), behind: new THREE.Vector3() }

    // Solid while on the ground (the cloud bumps into it), ignored once airborne
    this.collider = { position: new THREE.Vector3(), radius: 2.6, disabled: false }
    colliders.push(this.collider)

    this.update()
  }

  // One leg, from parked at `from` to parked at `to` facing back: durations follow from distances and speeds
  createTrip({ from, touchdown, to, direction, heading, name }) {
    const d = direction
    const liftOff = from + d * profile.takeoffRoll
    const climbEnd = liftOff + d * profile.climbDistance
    const approachStart = touchdown - d * profile.approachDistance
    const cruise = profile.cruiseAltitude
    // Sideways offset over the sea: a single smooth bulge between lift-off and touchdown (flat at both ends)
    const lateral = (s) => {
      const x = THREE.MathUtils.clamp((s - liftOff) / (touchdown - liftOff), 0, 1)
      return d * profile.detour * Math.sin(Math.PI * x) ** 2
    }
    const ground = () => 0

    return [
      { name: `${name}:hold`, duration: profile.hold, s: [from, from], altitude: ground, lateral },
      { name: `${name}:takeoff`, duration: (2 * profile.takeoffRoll) / profile.rollSpeed, s: [from, liftOff], ease: 'accelerate', altitude: ground, lateral },
      { name: `${name}:climb`, duration: profile.climbDistance / profile.climbSpeed, s: [liftOff, climbEnd], altitude: (t) => cruise * smoothstep(t), lateral },
      { name: `${name}:cruise`, duration: Math.abs(approachStart - climbEnd) / profile.cruiseSpeed, s: [climbEnd, approachStart], altitude: () => cruise, lateral },
      { name: `${name}:approach`, duration: profile.approachDistance / profile.approachSpeed, s: [approachStart, touchdown], altitude: (t) => cruise * (1 - smoothstep(t)), lateral },
      { name: `${name}:rollout`, duration: (2 * Math.abs(to - touchdown)) / profile.rollSpeed, s: [touchdown, to], ease: 'decelerate', altitude: ground, lateral },
      // Turn around in place to face the way back (heading measured from +u toward +v)
      { name: `${name}:turn`, duration: profile.turn, s: [to, to], altitude: ground, lateral, heading: [heading, heading + Math.PI] },
    ]
  }

  phaseAt(time) {
    const t = ((time % this.duration) + this.duration) % this.duration
    const phase = this.phases.find((candidate) => t < candidate.start + candidate.duration) ?? this.phases.at(-1)
    return { phase, progress: (t - phase.start) / phase.duration }
  }

  // World position of the airplane's center at `time`; also returns the heading for in-place turns
  positionAt(time, target) {
    const { phase, progress } = this.phaseAt(time)
    const s = THREE.MathUtils.lerp(phase.s[0], phase.s[1], easings[phase.ease ?? 'linear'](progress))
    const altitude = phase.altitude(progress)
    this.frame.toWorld(s, phase.lateral(s), this.airplane.groundClearance + altitude, target)
    const heading = phase.heading ? THREE.MathUtils.lerp(phase.heading[0], phase.heading[1], smoothstep(progress)) : null
    return { phase, altitude, heading }
  }

  update() {
    const delta = this.time.delta
    this.elapsed += delta

    const { position, ahead, behind } = this.sample
    const { phase, altitude, heading } = this.positionAt(this.elapsed, position)
    this.phase = phase

    // Facing: an explicit heading while turning on the ground, otherwise the direction of travel
    // (including climb and descent, which pitches the nose); keep the last one while parked
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

    // Bank into turns, proportional to how fast the horizontal heading changes. The right wing is local +z,
    // and turning right increases the heading angle here, so a positive rate rolls right (positive)
    const yawNow = Math.atan2(this.forward.z, this.forward.x)
    const yawRate = this.previousYaw === undefined ? 0 : Math.atan2(Math.sin(yawNow - this.previousYaw), Math.cos(yawNow - this.previousYaw)) / Math.max(delta, 1e-3)
    this.previousYaw = yawNow
    const targetBank = altitude > 0.5 ? THREE.MathUtils.clamp(yawRate * 0.8, -0.6, 0.6) : 0
    this.bank += (targetBank - this.bank) * (1 - Math.exp(-4 * delta))

    // Gear folds away after take-off and comes down for landing
    const gearTarget = altitude < 2.5 ? 1 : 0
    this.gear += (gearTarget - this.gear) * (1 - Math.exp(-3 * delta))
    this.airplane.setGear(this.gear)

    const group = this.airplane.group
    group.position.copy(position)
    const right = new THREE.Vector3().crossVectors(this.forward, THREE.Object3D.DEFAULT_UP).normalize()
    const up = new THREE.Vector3().crossVectors(right, this.forward)
    group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(this.forward, up, right))
    group.rotateX(this.bank)

    this.collider.position.set(position.x, 0, position.z)
    this.collider.disabled = altitude > 1.5
  }
}
