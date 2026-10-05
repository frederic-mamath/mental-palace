import * as THREE from 'three'
import Route from '../Transport/Route.js'
import DustBurst from '../Effects/DustBurst.js'
import { sea } from '../islands.js'

const profile = {
  castOff: 8, // distance to reach sailing speed
  docking: 10, // distance to slow down before the jetty
  speed: 9,
  detour: 7, // sideways bulge over the open sea
  turn: 4, // seconds to swing around off the jetty after arriving
}

// The ship's route between the pier on the entrepreneur island ('pier') and the jetty in the hobby
// island's cove ('cove'), along the frame between the two islands: cast off, sail, dock, swing around
// (see Transport/Route.js). It moors off each pier's tip, in line with it, so it can swing around in open
// water while the passenger steps out on land. Adds heaving, rolling and pitching on the waves, leaning
// into turns, and a foam wake.
//   stops: { pier, cove }: { s (ship center), heading, across, dropOff (frame point on land) }
export default class Voyage extends Route {
  constructor({ ship, frame, stops }) {
    super({ frame, stops, parkedAt: 'pier', baseHeight: sea.waterLevel })

    this.ship = ship
    this.trips = {
      pier: this.createVoyage('pier', 'cove'),
      cove: this.createVoyage('cove', 'pier'),
    }

    this.wake = new DustBurst({ count: 30, lifetime: 0.9, color: '#ffffff' })
    this.wakeTimer = 0
    this.lean = 0
    this.previousPosition = new THREE.Vector3()

    this.update()
    this.previousPosition.copy(this.ship.group.position)
  }

  // Step out on land at the pier's root, facing inland (away from the ship)
  dropOff(stop) {
    const { along, across, facing } = this.stops[stop].dropOff
    const direction = { x: this.frame.u.x * facing, z: this.frame.u.y * facing }
    return { position: this.frame.toWorld(along, across), yaw: Math.atan2(direction.x, direction.z) }
  }

  createVoyage(from, to) {
    const start = this.stops[from]
    const end = this.stops[to]
    const d = Math.sign(end.s - start.s)
    const distance = Math.abs(end.s - start.s)
    const castOffEnd = start.s + d * profile.castOff
    const dockingStart = end.s - d * profile.docking
    // From one pier's line to the other's, bulging out to sea in between (outbound and return on opposite sides)
    const lateral = (s) => {
      const x = THREE.MathUtils.clamp((s - start.s) / (end.s - start.s), 0, 1)
      const blend = x * x * (3 - 2 * x)
      return THREE.MathUtils.lerp(start.across, end.across, blend) + d * profile.detour * Math.sin(Math.PI * x) ** 2
    }

    return this.createTrip({
      from,
      to,
      lateral,
      turnDuration: profile.turn,
      phases: [
        { name: 'castOff', duration: (2 * profile.castOff) / profile.speed, s: [start.s, castOffEnd], ease: 'accelerate' },
        { name: 'sail', duration: (distance - profile.castOff - profile.docking) / profile.speed, s: [castOffEnd, dockingStart] },
        { name: 'dock', duration: (2 * profile.docking) / profile.speed, s: [dockingStart, end.s], ease: 'decelerate' },
      ],
    })
  }

  applyPose({ position, forward, delta }) {
    const elapsed = this.time.elapsed
    const group = this.ship.group

    // Lean out of turns a little, like a sailing ship heeling
    const yawNow = Math.atan2(forward.z, forward.x)
    const yawRate = this.previousYaw === undefined ? 0 : Math.atan2(Math.sin(yawNow - this.previousYaw), Math.cos(yawNow - this.previousYaw)) / Math.max(delta, 1e-3)
    this.previousYaw = yawNow
    this.lean += (THREE.MathUtils.clamp(-yawRate * 0.25, -0.2, 0.2) - this.lean) * (1 - Math.exp(-3 * delta))

    group.position.copy(position)
    group.position.y += Math.sin(elapsed * 1.3) * 0.07
    this.orient(group, forward, Math.sin(elapsed * 0.9) * 0.05 + this.lean)
    group.rotateZ(Math.sin(elapsed * 1.1) * 0.03)
    this.ship.update(elapsed)

    // Foam puffs off the stern while under way
    const speed = position.distanceTo(this.previousPosition) / Math.max(delta, 1e-3)
    this.previousPosition.copy(position)
    this.wakeTimer -= delta
    if (speed > 1.5 && this.wakeTimer <= 0) {
      const stern = position.clone().addScaledVector(forward, -this.ship.length / 2)
      this.wake.spawn(stern, forward, 2, { y: sea.waterLevel + 0.1, size: 1.3 })
      this.wakeTimer = 0.1
    }
    this.wake.update(delta)
  }
}
