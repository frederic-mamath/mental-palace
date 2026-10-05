import EventEmitter from './EventEmitter.js'

// Times are in seconds. Delta is clamped so a backgrounded tab doesn't cause a huge jump.
export default class Time extends EventEmitter {
  constructor() {
    super()

    this.start = performance.now()
    this.current = this.start
    this.elapsed = 0
    this.delta = 1 / 60

    this.frame = requestAnimationFrame(() => this.tick())
  }

  tick() {
    const now = performance.now()
    this.delta = Math.min((now - this.current) / 1000, 0.1)
    this.current = now
    this.elapsed = (now - this.start) / 1000

    this.trigger('tick')

    this.frame = requestAnimationFrame(() => this.tick())
  }

  destroy() {
    cancelAnimationFrame(this.frame)
  }
}
