import * as THREE from 'three'
import Experience from '../Experience.js'

export default class Environment {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.debug = this.experience.debug

    this.setSky()
    this.setLights()
    this.setDebug()
  }

  setSky() {
    this.skyColor = new THREE.Color('#8ecbff')
    this.scene.background = this.skyColor
    this.scene.fog = new THREE.Fog(this.skyColor, 25, 60)
  }

  setLights() {
    // Bluish ambient tints the shadow band, like the cool shadows in anime backgrounds
    this.ambientLight = new THREE.AmbientLight('#b8d4ff', 1.2)
    this.scene.add(this.ambientLight)

    this.sunLight = new THREE.DirectionalLight('#fff3dc', 2.5)
    this.sunLight.position.set(4, 8, 5)
    this.sunLight.castShadow = true
    this.sunLight.shadow.mapSize.set(2048, 2048)
    this.sunLight.shadow.camera.near = 1
    this.sunLight.shadow.camera.far = 25
    this.sunLight.shadow.camera.left = -10
    this.sunLight.shadow.camera.right = 10
    this.sunLight.shadow.camera.top = 10
    this.sunLight.shadow.camera.bottom = -10
    this.sunLight.shadow.normalBias = 0.03
    this.scene.add(this.sunLight)
  }

  setDebug() {
    if (!this.debug.active) return

    const folder = this.debug.ui.addFolder('Environment')
    folder.addColor(this, 'skyColor').name('sky').onChange(() => this.scene.fog.color.copy(this.skyColor))
    folder.addColor(this.ambientLight, 'color').name('ambientColor')
    folder.add(this.ambientLight, 'intensity', 0, 5, 0.01).name('ambientIntensity')
    folder.addColor(this.sunLight, 'color').name('sunColor')
    folder.add(this.sunLight, 'intensity', 0, 10, 0.01).name('sunIntensity')
    folder.add(this.sunLight.position, 'x', -10, 10, 0.01).name('sunX')
    folder.add(this.sunLight.position, 'y', 0, 15, 0.01).name('sunY')
    folder.add(this.sunLight.position, 'z', -10, 10, 0.01).name('sunZ')
  }
}
