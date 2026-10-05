import * as THREE from 'three'
import Debug from './Utils/Debug.js'
import Sizes from './Utils/Sizes.js'
import Time from './Utils/Time.js'
import Inputs from './Utils/Inputs.js'
import Resources from './Utils/Resources.js'
import Camera from './Camera.js'
import Renderer from './Renderer.js'
import World from './World/World.js'
import sources from './sources.js'

let instance = null

// Singleton: any class can call `new Experience()` to reach the shared scene, time, resources...
export default class Experience {
  constructor(canvas) {
    if (instance) return instance
    instance = this

    // Handy for poking around from the console
    window.experience = this

    this.canvas = canvas
    this.debug = new Debug()
    this.sizes = new Sizes()
    this.time = new Time()
    this.inputs = new Inputs()
    this.scene = new THREE.Scene()
    this.resources = new Resources(sources)
    this.camera = new Camera()
    this.renderer = new Renderer()
    this.world = new World()

    this.sizes.on('resize', () => this.resize())
    this.time.on('tick', () => this.update())
  }

  resize() {
    this.camera.resize()
    this.renderer.resize()
  }

  update() {
    // World first so the camera follows the character's position from this frame
    this.world.update()
    this.camera.update()
    this.renderer.update()
  }

  destroy() {
    this.sizes.destroy()
    this.time.destroy()
    this.inputs.destroy()

    this.scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return

      child.geometry.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.dispose()
        }
        material.dispose()
      }
    })

    this.camera.controls.dispose()
    this.renderer.instance.dispose()
    this.debug.destroy()

    instance = null
  }
}
