import * as THREE from 'three'
import Experience from '../Experience.js'
import InteractPrompt from '../UI/InteractPrompt.js'
import ProjectCard from '../UI/ProjectCard.js'

const movementActions = new Set(['forward', 'backward', 'left', 'right', 'dash'])
// Pointer travel (px) under which a press counts as a click rather than an orbit drag
const clickTolerance = 6

// Connects the character to landmarks (see the interface documented in Projects/DoubleTap.js):
// walking into a landmark's zone shows a prompt; E, clicking the prompt or clicking the landmark opens it
// (camera focus + project card); E again taps it; Esc, the backdrop, the close button or moving closes it.
// Landmarks may also define `available` (false hides them), `promptLabel`, and `interact()` to run their
// own action instead of opening a card (the airplane's boarding).
export default class Interactions {
  constructor({ character, landmarks }) {
    this.experience = new Experience()
    this.inputs = this.experience.inputs
    this.camera = this.experience.camera
    this.sizes = this.experience.sizes
    this.canvas = this.experience.canvas

    this.character = character
    this.landmarks = landmarks
    this.active = null
    this.open = null

    this.prompt = new InteractPrompt()
    this.card = new ProjectCard()
    this.anchor = new THREE.Vector3()
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()

    this.prompt.on('click', () => this.active && this.openLandmark(this.active))
    this.card.on('close', () => this.close())
    this.inputs.on('actionStart', (action) => this.onAction(action))
    this.setPointer()
  }

  onAction(action) {
    if (action === 'interact') {
      // First press opens; any press while open taps the phone, so a quick double press does both
      if (this.open) this.open.react()
      else if (this.active) this.openLandmark(this.active)
    } else if (this.open && (action === 'close' || movementActions.has(action))) {
      this.close()
    }
  }

  setPointer() {
    let downX = 0
    let downY = 0

    this.canvas.addEventListener('pointerdown', (event) => {
      downX = event.clientX
      downY = event.clientY
    })

    this.canvas.addEventListener('pointerup', (event) => {
      if (this.open) return
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > clickTolerance) return

      this.pointer.set((event.clientX / this.sizes.width) * 2 - 1, -(event.clientY / this.sizes.height) * 2 + 1)
      this.raycaster.setFromCamera(this.pointer, this.camera.instance)
      const landmark = this.landmarks.find(
        (candidate) => candidate.available !== false && this.raycaster.intersectObjects(candidate.pickTargets, true).length > 0
      )
      if (landmark) this.openLandmark(landmark)
    })
  }

  openLandmark(landmark) {
    if (this.open) return

    if (landmark.interact) {
      this.prompt.hide()
      landmark.interact()
      return
    }

    this.open = landmark
    this.inputs.movementLocked = true
    landmark.setOpen(true)
    this.character.setHidden(true)
    this.prompt.hide()
    this.card.show(landmark.project)
    this.camera.focus(landmark.getFocusPose(this.sizes, this.camera.instance.fov))
  }

  close() {
    if (!this.open) return

    this.open.setOpen(false)
    this.open = null
    this.character.setHidden(false)
    this.inputs.movementLocked = false
    this.card.hide()
    this.camera.unfocus()
    // Still standing in the zone: offer to reopen
    if (this.active) this.prompt.show(this.labelFor(this.active))
  }

  labelFor(landmark) {
    return landmark.promptLabel ?? `Open ${landmark.project.title}`
  }

  // Closest landmark whose zone contains the character, if any
  findActive() {
    const position = this.character.group.position
    let closest = null
    let closestDistance = Infinity

    // Nothing to offer while the character is hidden (flying, or a project is open)
    if (!this.character.group.visible) return null

    for (const landmark of this.landmarks) {
      if (landmark.available === false) continue
      const { position: center, radius } = landmark.zone
      const distance = Math.hypot(position.x - center.x, position.z - center.z)
      if (distance < radius && distance < closestDistance) {
        closest = landmark
        closestDistance = distance
      }
    }

    return closest
  }

  update() {
    if (this.open) return

    const active = this.findActive()
    if (active !== this.active) {
      this.active?.setActive(false)
      active?.setActive(true)
      this.active = active
      if (active) this.prompt.show(this.labelFor(active))
      else this.prompt.hide()
    }

    if (this.active) {
      this.active.getPromptAnchor(this.anchor).project(this.camera.instance)
      this.prompt.setPosition(((this.anchor.x + 1) / 2) * this.sizes.width, ((1 - this.anchor.y) / 2) * this.sizes.height)
    }
  }
}
