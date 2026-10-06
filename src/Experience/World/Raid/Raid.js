import * as THREE from 'three'
import Experience from '../../Experience.js'
import { IslandShape } from '../islands.js'
import ZoneRing from '../Effects/ZoneRing.js'
import BoomRing from '../Effects/BoomRing.js'
import RaidInstance from './RaidInstance.js'
import Telegraph from './Telegraph.js'
import RaidHud from '../../UI/RaidHud.js'

const instance = { center: new THREE.Vector3(78, 26, -95), radius: 11 }
const maxHearts = 3
const bestKey = 'mental-palace:raid-best'

// Difficulty ramps from 0 to 1 over this many seconds: attacks come more often, with less warning
const rampSeconds = 80
const lerp = THREE.MathUtils.lerp

// The raid boss mini-game. Its entrance is a landmark (see Interactions) on the Arena's rune circle,
// with a challenge ring: E there teleports the cloud into an instance, an arena floating in the sky over
// the sea, where a boss telegraphs attacks on the floor (circles, cones, lines, a donut). Each hit costs
// one of three hearts; survive as long as possible. Best time kept on this device. E retries after a
// wipe; Esc leaves at any time, back to the rune circle.
// States: idle (outside) -> countdown -> fight -> wiped -> countdown... ; leave() returns to idle.
export default class Raid {
  constructor({ entrance, homeIsland, character }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.inputs = this.experience.inputs
    this.camera = this.experience.camera

    this.entrance = entrance
    this.homeIsland = homeIsland
    this.character = character
    this.state = 'idle'
    this.attacks = []
    this.best = this.loadBest()

    // The instance's floor keeps the cloud on it like an island would (not registered: no water foam)
    this.shape = new IslandShape({ name: 'raid', center: { x: instance.center.x, z: instance.center.z }, radius: instance.radius, beachWidth: 0, harmonics: [] })
    this.instance = new RaidInstance(instance)
    this.impacts = new BoomRing({ count: 6, lifetime: 0.45, startRadius: 0.8, endRadius: 3.2, color: '#ff8a8a' })
    this.hud = new RaidHud()

    // Entrance landmark: zone and ring on the rune circle
    this.zone = { position: entrance.clone(), radius: 2.4 }
    this.ringAnchor = new THREE.Group()
    this.ringAnchor.position.set(entrance.x, 0.18, entrance.z)
    this.scene.add(this.ringAnchor)
    this.ring = new ZoneRing({ parent: this.ringAnchor, radius: 2.2, kind: 'challenge' })

    this.inputs.on('actionStart', (action) => this.onAction(action))
  }

  // --- Landmark interface (entrance) ---

  get available() {
    return this.state === 'idle' && this.character.island === this.homeIsland
  }

  get promptLabel() {
    return 'Enter the raid'
  }

  get pickTargets() {
    return []
  }

  getPromptAnchor(target) {
    return target.copy(this.entrance).setY(2.6)
  }

  setActive(active) {
    this.ring.setActive(active)
  }

  interact() {
    if (this.available) this.enter()
  }

  // --- Entering and leaving ---

  // Moves the cloud (and the camera with it, at once) to a point on another floor
  moveCharacter(point, island, groundHeight, yaw) {
    const from = this.character.group.position.clone()
    const { hoverHeight, size } = this.character.params
    const to = new THREE.Vector3(point.x, groundHeight + hoverHeight * size, point.z)
    this.character.teleport(to, { island, groundHeight, yaw })
    this.camera.jumpBy(to.clone().sub(from))
    this.experience.world.environment.groundLevel = groundHeight
  }

  enter() {
    this.ring.setActive(false)
    this.character.setHidden(true)
    // Start in the south of the arena, facing the boss
    const spawn = instance.center.clone().add(new THREE.Vector3(0, 0, instance.radius * 0.6))
    this.moveCharacter(spawn, this.shape, instance.center.y, Math.PI)
    this.character.setHidden(false)
    this.hud.show()
    this.hud.setBest(this.best)
    this.startRun()
  }

  leave() {
    this.clearAttacks()
    this.hud.hide()
    this.character.group.visible = true
    this.character.setHidden(true)
    this.moveCharacter(this.entrance, this.homeIsland, 0, this.character.yaw)
    this.character.setHidden(false)
    this.state = 'idle'
  }

  // --- A run ---

  startRun() {
    this.clearAttacks()
    this.hud.hidePanel()
    this.state = 'countdown'
    this.countdown = 3
    this.elapsed = 0
    this.hearts = maxHearts
    this.invulnerable = 0
    this.nextAttack = 1
    this.hud.setTime(0)
    this.hud.setHearts(this.hearts, maxHearts)
  }

  wipe() {
    this.state = 'wiped'
    this.character.group.visible = true
    const record = this.elapsed > this.best
    if (record) {
      this.best = this.elapsed
      this.saveBest(this.best)
      this.hud.setBest(this.best)
    }
    this.hud.showPanel({ time: this.elapsed, best: this.best, record })
  }

  onAction(action) {
    if (this.state === 'idle') return
    if (action === 'close') this.leave()
    else if (action === 'interact' && this.state === 'wiped') this.startRun()
  }

  // --- Attacks ---

  clearAttacks() {
    for (const attack of this.attacks) attack.dispose()
    this.attacks = []
  }

  // The cloud's position in the arena's local space
  characterLocal() {
    const position = this.character.group.position
    return { x: position.x - instance.center.x, z: position.z - instance.center.z }
  }

  // Picks the next pattern; the further into the run, the more often attacks come and the shorter the warning
  spawnPattern() {
    const difficulty = Math.min(this.elapsed / rampSeconds, 1)
    const delay = lerp(1.6, 0.95, difficulty)
    const player = this.characterLocal()
    const radius = instance.radius
    const add = (type, params) => this.attacks.push(new Telegraph({ parent: this.instance.group, type, params, delay, layer: this.attacks.length % 8 }))
    const randomPoint = () => {
      const angle = Math.random() * Math.PI * 2
      const distance = Math.sqrt(Math.random()) * (radius - 2)
      return { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance }
    }

    const roll = Math.random()
    const donutActive = this.attacks.some((attack) => attack.type === 'donut' && attack.state !== 'done')
    if (this.elapsed > 12 && !donutActive && roll < 0.14) {
      add('donut', { inner: 3.2, outer: radius + 0.8 })
    } else if (roll < 0.5) {
      // Circles: one on the cloud, more scattered around as the fight goes on
      add('circle', { ...player, radius: 2.4 })
      const extra = difficulty > 0.25 ? 1 + Math.floor(Math.random() * (1 + difficulty * 2)) : 0
      for (let i = 0; i < extra; i++) add('circle', { ...randomPoint(), radius: 2.2 })
    } else if (roll < 0.75) {
      // Cone from under the boss, toward the cloud, reaching the arena's rim
      add('cone', { x: 0, z: 0, angle: Math.atan2(player.z, player.x), length: radius + 0.4, halfAngle: 0.45 })
    } else {
      // Line through the cloud at a random angle, clipped to the arena: the chord of the floor's circle
      // along that direction, so it never sticks out over the edge
      const angle = Math.random() * Math.PI
      const direction = { x: Math.cos(angle), z: Math.sin(angle) }
      const along = player.x * direction.x + player.z * direction.z
      const half = Math.sqrt(Math.max((radius + 0.6) ** 2 - (player.x ** 2 + player.z ** 2 - along ** 2), 0))
      const middle = -along // offset from the cloud to the chord's midpoint, along the direction
      add('line', { x: player.x + direction.x * middle, z: player.z + direction.z * middle, angle, length: half * 2, width: 2.4 })
    }
    this.instance.castPulse()
  }

  hit() {
    this.hearts -= 1
    this.invulnerable = 1.2
    this.hud.setHearts(this.hearts, maxHearts)
    this.hud.flash()
    this.camera.kick(4)
    if (this.hearts <= 0) this.wipe()
  }

  // --- Best time, kept on this device (storage may be unavailable: then it lasts until the page reloads) ---

  loadBest() {
    try {
      return Number(localStorage.getItem(bestKey)) || 0
    } catch {
      return 0
    }
  }

  saveBest(seconds) {
    try {
      localStorage.setItem(bestKey, String(seconds))
    } catch {
      // Private mode or blocked storage: keep it in memory only
    }
  }

  update() {
    const delta = this.time.delta
    const inside = this.state !== 'idle'
    this.ring.update(delta, this.time.elapsed)
    this.ringAnchor.visible = this.available
    this.instance.update(inside ? this.character.group.position : null)
    this.impacts.update(delta)
    if (!inside) return

    if (this.state === 'countdown') {
      this.countdown -= delta
      this.hud.setCountdown(this.countdown > 0 ? Math.ceil(this.countdown) : 'Fight!')
      if (this.countdown <= -0.6) {
        this.hud.setCountdown(null)
        this.state = 'fight'
      }
    }

    if (this.state === 'fight') {
      this.elapsed += delta
      this.hud.setTime(this.elapsed)
      if (this.elapsed >= this.nextAttack) {
        this.spawnPattern()
        const difficulty = Math.min(this.elapsed / rampSeconds, 1)
        this.nextAttack = this.elapsed + lerp(2.1, 0.8, difficulty)
      }

      // Blink while invulnerable after a hit
      this.invulnerable = Math.max(this.invulnerable - delta, 0)
      this.character.group.visible = this.invulnerable === 0 || Math.floor(this.invulnerable * 10) % 2 === 0
    }

    // Attacks keep animating after a wipe, but only hurt during the fight
    const player = this.characterLocal()
    for (const attack of this.attacks) {
      if (!attack.update(delta)) continue
      const world = attack.group.getWorldPosition(new THREE.Vector3())
      if (attack.type === 'circle') this.impacts.spawn(world.setY(instance.center.y + 0.2))
      if (attack.type === 'donut') this.camera.kick(2)
      if (this.state === 'fight' && this.invulnerable === 0 && attack.contains(player.x, player.z)) this.hit()
    }
    this.attacks = this.attacks.filter((attack) => {
      if (attack.state !== 'done') return true
      attack.dispose()
      return false
    })
  }
}
