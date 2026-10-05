export default class EventEmitter {
  constructor() {
    this.callbacks = new Map()
  }

  on(name, callback) {
    if (!this.callbacks.has(name)) this.callbacks.set(name, new Set())
    this.callbacks.get(name).add(callback)
    return this
  }

  off(name, callback) {
    if (callback) this.callbacks.get(name)?.delete(callback)
    else this.callbacks.delete(name)
    return this
  }

  trigger(name, ...args) {
    this.callbacks.get(name)?.forEach((callback) => callback(...args))
    return this
  }
}
