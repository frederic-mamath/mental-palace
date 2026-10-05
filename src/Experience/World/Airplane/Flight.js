import * as THREE from 'three'
import Experience from '../../Experience.js'
import EventEmitter from '../../Utils/EventEmitter.js'

const smoothstep = (t) => t * t * (3 - 2 * t)
const easings = {
  linear: (t) => t,
  accelerate: (t) => t * t,
  decelerate: (t) => 1 - (1 - t) ** 2,
}

// Toon-scale speeds (units per second) and flight profile. Lift-off, climb, cruise, approach and touchdown
// all share the same pace, so the airplane never jumps in speed between phases
const profile = {
  takeoffRoll: 11, // runway distance before lift-off
  climbDistance: 22,
  approachDistance: 22,
  cruiseAltitude: 10,
  detour: 9, // sideways bulge of the flight path over the sea; outbound and return bulge on opposite sides
  rollSpeed: 8,
  climbSpeed: 8,
  cruiseSpeed: 8,
  approachSpeed: 8,
  turn: 2.4, // seconds to turn around on the runway after landing
  airSpeedup: 2, // the trip's clock runs this much faster in the air (see clockRate)
}

// The airplane's trips between the airstrip ('airstrip') and the city runway ('city'). Both lie on the
// same straight line (the flight frame's u axis), so a trip is described by a distance along that line (s),
// an altitude, and a sideways offset for the curve over the sea.
//
// The airplane waits parked, facing the way back, until depart() sends it on its next trip:
// take-off roll, climb, cruise, approach, rollout, turn around. Events: 'arrived' (stop name).
export default class Flight extends EventEmitter {
  constructor({ airplane, airstrip, city, colliders }) {
    super()

    this.experience = new Experience()
    this.time = this.experience.time

    this.airplane = airplane
    this.frame = airstrip.frame

    // Runway ends as distances along the flight line, from the entrepreneur island's center
    const cityRunwayStart = city.frame.toWorld(city.runway.start, 0)
    const cityStart = this.frame.toFrame(cityRunwayStart.x, cityRunwayStart.z).along
    this.stops = {
      airstrip: { s: airstrip.start + 1, heading: 0 }, // parked facing the city
      city: { s: cityStart + city.runway.length - 2, heading: Math.PI }, // parked facing home
    }

    this.trips = {
      airstrip: this.createTrip({ from: 'airstrip', to: 'city', touchdown: cityStart + 1, direction: 1 }),
      city: this.createTrip({ from: 'city', to: 'airstrip', touchdown: airstrip.end - 1, direction: -1 }),
    }

    this.parkedAt = 'airstrip'
    this.trip = null
    this.elapsed = 0

    this.forward = new THREE.Vector3()
    this.lastForward = new THREE.Vector3()
    this.bank = 0
    this.gear = 1
    this.sample = { position: new THREE.Vector3(), ahead: new THREE.Vector3(), behind: new THREE.Vector3() }

    // Solid while on the ground (the cloud bumps into it), ignored once airborne
    this.collider = { position: new THREE.Vector3(), radius: 2.6, disabled: false }
    colliders.push(this.collider)

    this.update()
  }

  get flying() {
    return this.trip !== null
  }

  // Where the airplane will land on its next trip
  get destination() {
    return this.trips[this.parkedAt].to
  }

  depart() {
    if (this.trip) return
    this.trip = this.trips[this.parkedAt]
    this.elapsed = 0
  }

  // One trip from parked at `from` to parked at `to`, facing back: durations follow from distances and speeds
  createTrip({ from, to, touchdown, direction }) {
    const d = direction
    const start = this.stops[from].s
    const stop = this.stops[to].s
    const liftOff = start + d * profile.takeoffRoll
    const climbEnd = liftOff + d * profile.climbDistance
    const approachStart = touchdown - d * profile.approachDistance
    const cruise = profile.cruiseAltitude
    // Sideways offset over the sea: a single smooth bulge between lift-off and touchdown (flat at both ends)
    const lateral = (s) => {
      const x = THREE.MathUtils.clamp((s - liftOff) / (touchdown - liftOff), 0, 1)
      return d * profile.detour * Math.sin(Math.PI * x) ** 2
    }
    const ground = () => 0
    const heading = this.stops[from].heading

    const phases = [
      { name: 'takeoff', duration: (2 * profile.takeoffRoll) / profile.rollSpeed, s: [start, liftOff], ease: 'accelerate', altitude: ground },
      { name: 'climb', duration: profile.climbDistance / profile.climbSpeed, s: [liftOff, climbEnd], altitude: (t) => cruise * smoothstep(t) },
      { name: 'cruise', duration: Math.abs(approachStart - climbEnd) / profile.cruiseSpeed, s: [climbEnd, approachStart], altitude: () => cruise },
      { name: 'approach', duration: profile.approachDistance / profile.approachSpeed, s: [approachStart, touchdown], altitude: (t) => cruise * (1 - smoothstep(t)) },
      { name: 'rollout', duration: (2 * Math.abs(stop - touchdown)) / profile.rollSpeed, s: [touchdown, stop], ease: 'decelerate', altitude: ground },
      // Turn around in place to face the way back (heading measured from +u toward +v)
      { name: 'turn', duration: profile.turn, s: [stop, stop], altitude: ground, heading: [heading, heading + Math.PI] },
    ]

    let elapsed = 0
    for (const phase of phases) {
      phase.lateral = lateral
      phase.start = elapsed
      elapsed += phase.duration
    }
    return { from, to, phases, duration: elapsed }
  }

  // World position of the airplane's center `time` seconds into the current trip (or parked);
  // also returns the explicit heading when there is one (parked, turning)
  positionAt(time, target) {
    if (!this.trip) {
      const stop = this.stops[this.parkedAt]
      this.frame.toWorld(stop.s, 0, this.airplane.groundClearance, target)
      return { phase: null, altitude: 0, heading: stop.heading }
    }

    const t = THREE.MathUtils.clamp(time, 0, this.trip.duration)
    const phase = this.trip.phases.find((candidate) => t < candidate.start + candidate.duration) ?? this.trip.phases.at(-1)
    const progress = Math.min((t - phase.start) / phase.duration, 1)
    const s = THREE.MathUtils.lerp(phase.s[0], phase.s[1], easings[phase.ease ?? 'linear'](progress))
    const altitude = phase.altitude(progress)
    this.frame.toWorld(s, phase.lateral(s), this.airplane.groundClearance + altitude, target)
    const heading = phase.heading ? THREE.MathUtils.lerp(phase.heading[0], phase.heading[1], smoothstep(progress)) : null
    return { phase, altitude, heading }
  }

  // How fast the trip's clock runs: normal on the ground, ramping up to airSpeedup over the second half of
  // the take-off roll, sped up through the climb, cruise and approach, ramping back down just after touchdown.
  // The path stays the same; only the pace changes, smoothly, so there's no jolt in speed.
  clockRate() {
    const { phase } = this
    if (!phase) return 1
    const progress = (this.elapsed - phase.start) / phase.duration
    const extra = profile.airSpeedup - 1
    if (phase.name === 'takeoff') return 1 + extra * smoothstep(THREE.MathUtils.clamp((progress - 0.5) / 0.5, 0, 1))
    if (phase.name === 'rollout') return 1 + extra * (1 - smoothstep(THREE.MathUtils.clamp(progress / 0.4, 0, 1)))
    if (phase.name === 'turn') return 1
    return profile.airSpeedup
  }

  update() {
    const delta = this.time.delta

    if (this.trip) {
      this.elapsed += delta * this.clockRate()
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
    // (including climb and descent, which pitches the nose)
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
