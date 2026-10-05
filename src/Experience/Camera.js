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

    // Focus mode: a scripted glide to a pose ({ position, target }) and back, with the orbit controls off
    this.focused = false
    this.transition = null
    this.savedPose = null

    this.setInstance()
    this.setControls()
  }

  setInstance() {
    this.baseFov = 35
    this.instance = new THREE.PerspectiveCamera(this.baseFov, this.sizes.width / this.sizes.height, 0.1, 450)
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
  // By default only follows on the horizontal plane, so the character's bobbing doesn't shake the view;
  // `vertical` also follows height changes (the airplane climbing). Switching targets glides over unless
  // `snap` is set.
  follow(object, { vertical = false, snap = false } = {}) {
    this.target = object
    this.followVertical = vertical
    if (snap) this.followPosition.copy(object.position)
    // Measure height changes from where the view is now, so following a lower object doesn't drop the camera
    this.followHeightOffset = this.followPosition.y - object.position.y
  }

  updateFollow() {
    const easing = 1 - Math.exp(-this.followSpeed * this.experience.time.delta)
    const goal = this.target.position

    this.followDelta.copy(this.followPosition)
    this.followPosition.x += (goal.x - this.followPosition.x) * easing
    this.followPosition.z += (goal.z - this.followPosition.z) * easing
    if (this.followVertical) this.followPosition.y += (goal.y + this.followHeightOffset - this.followPosition.y) * easing
    this.followDelta.subVectors(this.followPosition, this.followDelta)

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

  // Moves the whole view by `offset` at once (camera, orbit target and follow point), keeping its angle:
  // for teleports, where gliding across the map would look wrong
  jumpBy(offset) {
    this.instance.position.add(offset)
    this.controls.target.add(offset)
    this.followPosition.add(offset)
  }

  focus(pose, duration = 1.1) {
    if (!this.focused) {
      this.savedPose = { position: this.instance.position.clone(), target: this.controls.target.clone() }
    }
    this.focused = true
    this.controls.enabled = false
    this.startTransition(pose, duration)
  }

  unfocus(duration = 0.9) {
    if (!this.focused) return
    this.focused = false
    this.startTransition(this.savedPose, duration, () => {
      this.controls.enabled = true
    })
  }

  startTransition(pose, duration, onComplete) {
    this.transition = {
      from: { position: this.instance.position.clone(), target: this.controls.target.clone() },
      to: pose,
      elapsed: 0,
      duration,
      onComplete,
    }
  }

  updateTransition() {
    const transition = this.transition
    transition.elapsed += this.experience.time.delta
    const t = Math.min(transition.elapsed / transition.duration, 1)
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    this.instance.position.lerpVectors(transition.from.position, transition.to.position, eased)
    this.controls.target.lerpVectors(transition.from.target, transition.to.target, eased)
    this.instance.lookAt(this.controls.target)

    if (t === 1) {
      this.transition = null
      transition.onComplete?.()
    }
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height
    this.instance.updateProjectionMatrix()
  }

  update() {
    if (this.transition) {
      this.updateTransition()
      return
    }
    // Hold the focused pose: no following, no orbit
    if (this.focused) return

    if (this.target) this.updateFollow()
    this.updateKick()
    this.controls.update()
  }
}
