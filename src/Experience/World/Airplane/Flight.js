import * as THREE from 'three'
import Route, { smoothstep } from '../Transport/Route.js'

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

// The airplane's route between the airstrip ('airstrip') and the city runway ('city'), both on the
// flight line: take-off roll, climb, cruise, approach, rollout, turn around (see Transport/Route.js).
// Adds banking, landing gear and a ground-only collider.
export default class Flight extends Route {
  constructor({ airplane, airstrip, city, colliders }) {
    // Runway ends as distances along the flight line, from the entrepreneur island's center
    const frame = airstrip.frame
    const cityRunwayStart = city.frame.toWorld(city.runway.start, 0)
    const cityStart = frame.toFrame(cityRunwayStart.x, cityRunwayStart.z).along

    super({
      frame,
      stops: {
        airstrip: { s: airstrip.start + 1, heading: 0 }, // parked facing the city
        city: { s: cityStart + city.runway.length - 2, heading: Math.PI }, // parked facing home
      },
      parkedAt: 'airstrip',
      baseHeight: airplane.groundClearance,
    })

    this.airplane = airplane
    this.trips = {
      airstrip: this.createFlight({ from: 'airstrip', to: 'city', touchdown: cityStart + 1, direction: 1 }),
      city: this.createFlight({ from: 'city', to: 'airstrip', touchdown: airstrip.end - 1, direction: -1 }),
    }

    this.bank = 0
    this.gear = 1

    // Solid while on the ground (the cloud bumps into it), ignored once airborne
    this.collider = { position: new THREE.Vector3(), radius: 2.6, disabled: false }
    colliders.push(this.collider)

    this.update()
  }

  get flying() {
    return this.travelling
  }

  // Where a passenger steps out once the airplane has stopped: beside it, off the runway (terminal side in
  // the city, away from the Double Tap phone on the airstrip), facing away from it, far enough to stay
  // clear of the wingtips while it turns around
  dropOff(stop) {
    const side = stop === 'city' ? 1 : -1
    return {
      position: this.frame.toWorld(this.stops[stop].s, side * 5.5),
      yaw: Math.atan2(this.frame.v.x * side, this.frame.v.y * side),
    }
  }

  // One flight from parked at `from` to parked at `to`, facing back: durations follow from distances and speeds
  createFlight({ from, to, touchdown, direction }) {
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

    return this.createTrip({
      from,
      to,
      lateral,
      turnDuration: profile.turn,
      phases: [
        { name: 'takeoff', duration: (2 * profile.takeoffRoll) / profile.rollSpeed, s: [start, liftOff], ease: 'accelerate' },
        { name: 'climb', duration: profile.climbDistance / profile.climbSpeed, s: [liftOff, climbEnd], altitude: (t) => cruise * smoothstep(t) },
        { name: 'cruise', duration: Math.abs(approachStart - climbEnd) / profile.cruiseSpeed, s: [climbEnd, approachStart], altitude: () => cruise },
        { name: 'approach', duration: profile.approachDistance / profile.approachSpeed, s: [approachStart, touchdown], altitude: (t) => cruise * (1 - smoothstep(t)) },
        { name: 'rollout', duration: (2 * Math.abs(stop - touchdown)) / profile.rollSpeed, s: [touchdown, stop], ease: 'decelerate' },
      ],
    })
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

  applyPose({ position, forward, altitude, delta }) {
    // Bank into turns, proportional to how fast the horizontal heading changes. The right wing is local +z,
    // and turning right increases the heading angle here, so a positive rate rolls right (positive)
    const yawNow = Math.atan2(forward.z, forward.x)
    const yawRate = this.previousYaw === undefined ? 0 : Math.atan2(Math.sin(yawNow - this.previousYaw), Math.cos(yawNow - this.previousYaw)) / Math.max(delta, 1e-3)
    this.previousYaw = yawNow
    const targetBank = altitude > 0.5 ? THREE.MathUtils.clamp(yawRate * 0.8, -0.6, 0.6) : 0
    this.bank += (targetBank - this.bank) * (1 - Math.exp(-4 * delta))

    // Gear folds away after take-off and comes down for landing
    const gearTarget = altitude < 2.5 ? 1 : 0
    this.gear += (gearTarget - this.gear) * (1 - Math.exp(-3 * delta))
    this.airplane.setGear(this.gear)

    this.airplane.group.position.copy(position)
    this.orient(this.airplane.group, forward, this.bank)

    this.collider.position.set(position.x, 0, position.z)
    this.collider.disabled = altitude > 1.5
  }
}
