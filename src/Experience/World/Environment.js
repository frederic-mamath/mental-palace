import * as THREE from 'three'
import Experience from '../Experience.js'

export default class Environment {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.debug = this.experience.debug
    this.camera = this.experience.camera
    // Height of the ground the shadows fall on (raised while the character is in the raid instance)
    this.groundLevel = 0

    this.setSky()
    this.setLights()
    this.setDebug()
  }

  setSky() {
    this.skyColor = new THREE.Color('#8ecbff')
    this.scene.background = this.skyColor
    // Clear over the island, hazy at the city on the horizon, the open sea melting into the sky
    this.scene.fog = new THREE.Fog(this.skyColor, 70, 240)
  }

  setLights() {
    // Bluish ambient tints the shadow band, like the cool shadows in anime backgrounds
    this.ambientLight = new THREE.AmbientLight('#b8d4ff', 1.2)
    this.scene.add(this.ambientLight)

    this.sunLight = new THREE.DirectionalLight('#fff3dc', 2.5)
    // Direction to the sun; the light and its shadow box follow the view (see update)
    this.sunOffset = new THREE.Vector3(4, 8, 5)
    this.sunLight.position.copy(this.sunOffset)
    this.sunLight.castShadow = true
    this.sunLight.shadow.mapSize.set(2048, 2048)
    this.sunLight.shadow.camera.near = 1
    this.sunLight.shadow.camera.far = 60
    this.sunLight.shadow.camera.left = -20
    this.sunLight.shadow.camera.right = 20
    this.sunLight.shadow.camera.top = 20
    this.sunLight.shadow.camera.bottom = -20
    this.sunLight.shadow.normalBias = 0.03
    this.scene.add(this.sunLight, this.sunLight.target)
  }

  setDebug() {
    if (!this.debug.active) return

    const folder = this.debug.ui.addFolder('Environment')
    folder.addColor(this, 'skyColor').name('sky').onChange(() => this.scene.fog.color.copy(this.skyColor))
    folder.addColor(this.ambientLight, 'color').name('ambientColor')
    folder.add(this.ambientLight, 'intensity', 0, 5, 0.01).name('ambientIntensity')
    folder.addColor(this.sunLight, 'color').name('sunColor')
    folder.add(this.sunLight, 'intensity', 0, 10, 0.01).name('sunIntensity')
    folder.add(this.sunOffset, 'x', -10, 10, 0.01).name('sunX')
    folder.add(this.sunOffset, 'y', 0, 15, 0.01).name('sunY')
    folder.add(this.sunOffset, 'z', -10, 10, 0.01).name('sunZ')
  }

  // A shadow box covering the whole island would blur the shadows, so a smaller one tracks what the camera looks at
  update() {
    const focus = this.camera.controls.target
    this.sunLight.target.position.set(focus.x, this.groundLevel, focus.z)
    this.sunLight.position.copy(this.sunLight.target.position).addScaledVector(this.sunOffset, 3)
  }
}
