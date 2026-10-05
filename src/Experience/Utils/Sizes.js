import EventEmitter from './EventEmitter.js'

export default class Sizes extends EventEmitter {
  constructor() {
    super()

    this.update()

    this.onResize = () => {
      this.update()
      this.trigger('resize')
    }
    window.addEventListener('resize', this.onResize)
  }

  update() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.pixelRatio = Math.min(window.devicePixelRatio, 2)
  }

  destroy() {
    window.removeEventListener('resize', this.onResize)
  }
}
