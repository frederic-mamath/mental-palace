import EventEmitter from '../Utils/EventEmitter.js'

// Floating "E  Open <project>" bubble that follows a point in the world. Clicking it also opens.
// Events: 'click'
export default class InteractPrompt extends EventEmitter {
  constructor() {
    super()

    this.element = document.createElement('button')
    this.element.type = 'button'
    this.element.className = 'interact-prompt'

    this.key = document.createElement('span')
    this.key.className = 'interact-prompt__key'
    this.key.textContent = 'E'

    this.label = document.createElement('span')
    this.label.className = 'interact-prompt__label'

    this.element.append(this.key, this.label)
    this.element.addEventListener('click', () => this.trigger('click'))
    document.body.appendChild(this.element)
  }

  show(text) {
    this.label.textContent = text
    this.element.classList.add('is-visible')
  }

  hide() {
    this.element.classList.remove('is-visible')
  }

  // Screen position in CSS pixels; the bubble sits centered above it
  setPosition(x, y) {
    this.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
  }
}
