import Experience from '../Experience.js'
import Environment from './Environment.js'
import Floor from './Floor.js'
import Cloud from './Cloud.js'

export default class World {
  constructor() {
    this.experience = new Experience()
    this.resources = this.experience.resources

    this.resources.on('ready', () => {
      this.environment = new Environment()
      this.floor = new Floor()
      this.cloud = new Cloud()
      this.experience.camera.follow(this.cloud.group)
    })
  }

  update() {
    this.cloud?.update()
  }
}
