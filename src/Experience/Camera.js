import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import Experience from './Experience.js'

export default class Camera {
  constructor() {
    this.experience = new Experience()
    this.sizes = this.experience.sizes
    this.scene = this.experience.scene
    this.canvas = this.experience.canvas

    this.target = null
    // Smoothed point the camera actually tracks; it trails the target so fast moves read on screen
    this.followPosition = new THREE.Vector3()
    this.followDelta = new THREE.Vector3()
    this.followSpeed = 6
    this.fovOffset = 0

    this.setInstance()
    this.setControls()
  }

  setInstance() {
    this.baseFov = 35
    this.instance = new THREE.PerspectiveCamera(this.baseFov, this.sizes.width / this.sizes.height, 0.1, 250)
    // Pulled back and up so the island reads as a whole
    this.instance.position.set(16, 19, 25)
    this.scene.add(this.instance)
  }

  setControls() {
    this.controls = new OrbitControls(this.instance, this.canvas)
    this.controls.target.set(0, 1.5, 0)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.minDistance = 6
    this.controls.maxDistance = 45
    this.controls.maxPolarAngle = Math.PI * 0.45
  }

  // Keeps the orbit centered on `object` while preserving the user's orbit angle and zoom.
  // Only follows on the horizontal plane so the character's bobbing doesn't shake the view.
  follow(object) {
    this.target = object
    this.followPosition.copy(object.position)
  }

  updateFollow() {
    const easing = 1 - Math.exp(-this.followSpeed * this.experience.time.delta)

    this.followDelta.copy(this.followPosition)
    this.followPosition.lerp(this.target.position, easing)
    this.followDelta.subVectors(this.followPosition, this.followDelta)
    this.followDelta.y = 0

    this.instance.position.add(this.followDelta)
    this.controls.target.add(this.followDelta)
  }

  // Short field-of-view widening that settles back, for impacts and bursts of speed
  kick(amount) {
    this.fovOffset = Math.max(this.fovOffset, amount)
  }

  updateKick() {
    if (this.fovOffset === 0) return

    this.fovOffset *= Math.exp(-6 * this.experience.time.delta)
    if (this.fovOffset < 0.01) this.fovOffset = 0
    this.instance.fov = this.baseFov + this.fovOffset
    this.instance.updateProjectionMatrix()
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height
    this.instance.updateProjectionMatrix()
  }

  update() {
    if (this.target) this.updateFollow()
    this.updateKick()
    this.controls.update()
  }
}
