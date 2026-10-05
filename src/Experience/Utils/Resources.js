import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import EventEmitter from './EventEmitter.js'

export default class Resources extends EventEmitter {
  constructor(sources) {
    super()

    this.sources = sources
    this.items = {}
    this.toLoad = sources.length
    this.loaded = 0

    this.setLoaders()
    this.startLoading()
  }

  setLoaders() {
    this.loaders = {
      gltfLoader: new GLTFLoader(),
      textureLoader: new THREE.TextureLoader(),
      cubeTextureLoader: new THREE.CubeTextureLoader(),
    }
  }

  startLoading() {
    // Defer so listeners registered right after construction still receive 'ready'
    if (this.toLoad === 0) {
      setTimeout(() => this.trigger('ready'))
      return
    }

    const onError = (source) => (error) => console.error(`Failed to load "${source.name}"`, error)

    for (const source of this.sources) {
      const onLoad = (file) => this.sourceLoaded(source, file)

      if (source.type === 'gltfModel') {
        this.loaders.gltfLoader.load(source.path, onLoad, undefined, onError(source))
      } else if (source.type === 'texture') {
        this.loaders.textureLoader.load(source.path, onLoad, undefined, onError(source))
      } else if (source.type === 'cubeTexture') {
        this.loaders.cubeTextureLoader.load(source.path, onLoad, undefined, onError(source))
      }
    }
  }

  sourceLoaded(source, file) {
    this.items[source.name] = file
    this.loaded++

    this.trigger('progress', this.loaded / this.toLoad)
    if (this.loaded === this.toLoad) this.trigger('ready')
  }
}
