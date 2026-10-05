import Experience from '../Experience.js'
import { windUniforms } from './toon.js'

// Drives the shared wind uniforms from the character: steady push and trailing wake while moving,
// a stronger, wider gust while dashing, and a shockwave ring at each dash take-off.
export default class WindField {
  constructor(character) {
    this.experience = new Experience()
    this.time = this.experience.time
    this.debug = this.experience.debug
    this.character = character

    this.params = {
      pushRadius: 3.5,
      pushStrength: 0.8,
      dashPushRadius: 5.5,
      dashPushStrength: 1.3,
      trailFollow: 3,
    }
    // 0 → 1 while dashing, eased so the gust swells and settles instead of popping
    this.gust = 0

    windUniforms.uPusherTrail.value.copy(character.group.position)
    character.on('dashStart', (position) => this.startShockwave(position))

    this.setDebug()
  }

  startShockwave(position) {
    windUniforms.uShockwaveOrigin.value.copy(position)
    windUniforms.uShockwaveAge.value = 0
  }

  setDebug() {
    if (!this.debug.active) return

    const folder = this.debug.ui.addFolder('Wind')
    folder.add(this.params, 'pushRadius', 0, 10, 0.1)
    folder.add(this.params, 'pushStrength', 0, 2, 0.01)
    folder.add(this.params, 'dashPushRadius', 0, 12, 0.1)
    folder.add(this.params, 'dashPushStrength', 0, 3, 0.01)
    folder.add(this.params, 'trailFollow', 0.5, 10, 0.1).name('trailRecovery')
    folder.add(windUniforms.uShockwaveSpeed, 'value', 2, 40, 0.1).name('shockwaveSpeed')
    folder.add(windUniforms.uShockwaveWidth, 'value', 0.2, 5, 0.01).name('shockwaveWidth')
    folder.add(windUniforms.uShockwaveLifetime, 'value', 0.1, 2, 0.01).name('shockwaveLifetime')
    folder.add(windUniforms.uShockwaveStrength, 'value', 0, 3, 0.01).name('shockwaveStrength')
  }

  update() {
    const delta = this.time.delta
    const position = this.character.group.position
    const ease = (rate) => 1 - Math.exp(-rate * delta)

    // Swell fast when the dash starts, settle slower after it ends
    const dashing = this.character.dash.timer > 0
    this.gust += ((dashing ? 1 : 0) - this.gust) * ease(dashing ? 20 : 4)

    windUniforms.uWindTime.value = this.time.elapsed
    windUniforms.uPusherPosition.value.copy(position)
    windUniforms.uPusherTrail.value.lerp(position, ease(this.params.trailFollow))
    windUniforms.uPushRadius.value = this.params.pushRadius + (this.params.dashPushRadius - this.params.pushRadius) * this.gust
    // A hidden character (smoke poof) pushes nothing
    const presence = this.character.group.visible ? 1 : 0
    windUniforms.uPushStrength.value =
      (this.params.pushStrength + (this.params.dashPushStrength - this.params.pushStrength) * this.gust) * presence
    windUniforms.uShockwaveAge.value += delta
  }
}
