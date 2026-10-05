import EventEmitter from './EventEmitter.js'

// Keyboard state by action. Uses `event.code` (physical key position),
// so WASD on QWERTY is also ZQSD on AZERTY.
const bindings = {
  forward: ['KeyW', 'ArrowUp'],
  backward: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  dash: ['Space'],
}

export default class Inputs extends EventEmitter {
  constructor() {
    super()

    this.actions = Object.fromEntries(Object.keys(bindings).map((action) => [action, false]))
    this.codeToAction = new Map()
    for (const [action, codes] of Object.entries(bindings)) {
      for (const code of codes) this.codeToAction.set(code, action)
    }

    this.onKeyDown = (event) => this.setKey(event, true)
    this.onKeyUp = (event) => this.setKey(event, false)
    // Releasing a key while the window is unfocused never fires keyup
    this.onBlur = () => {
      for (const action in this.actions) this.actions[action] = false
    }

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  setKey(event, pressed) {
    // Let the debug panel's text fields receive keys
    if (event.target instanceof HTMLInputElement) return

    const action = this.codeToAction.get(event.code)
    if (!action) return

    event.preventDefault()
    if (this.actions[action] === pressed) return

    this.actions[action] = pressed
    this.trigger(pressed ? 'actionStart' : 'actionEnd', action)
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
  }
}
