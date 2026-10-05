import * as THREE from 'three'
import Experience from '../Experience.js'
import { island, islandRadiusGLSL } from './islandShape.js'

// Flat toon sea out to the horizon: hard-edged shallow band around the beach,
// wobbling foam against the sand and wave rings rolling outward. Fades into the fog.
export default class Water {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.debug = this.experience.debug

    this.material = new THREE.ShaderMaterial({
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uBeachWidth: { value: island.beachWidth },
          uShallowWidth: { value: 6 },
          uFoamWidth: { value: 0.45 },
          uDeepColor: { value: new THREE.Color('#2c86d6') },
          uShallowColor: { value: new THREE.Color('#5ccbe6') },
          uFoamColor: { value: new THREE.Color('#ffffff') },
        },
      ]),
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>

        varying vec2 vWorldXZ;

        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldXZ = worldPosition.xz;

          vec4 mvPosition = viewMatrix * worldPosition;
          gl_Position = projectionMatrix * mvPosition;

          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>

        uniform float uTime;
        uniform float uBeachWidth;
        uniform float uShallowWidth;
        uniform float uFoamWidth;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uFoamColor;

        varying vec2 vWorldXZ;

        ${islandRadiusGLSL}

        void main() {
          float angle = atan(vWorldXZ.y, vWorldXZ.x);
          float shoreDistance = length(vWorldXZ) - islandRadius(angle) - uBeachWidth;
          float wobble = sin(angle * 23.0 + uTime * 1.6) * 0.12 + sin(angle * 11.0 - uTime * 1.1) * 0.1;

          vec3 color = shoreDistance < uShallowWidth + wobble * 2.0 ? uShallowColor : uDeepColor;

          // Foam hugging the beach
          if (shoreDistance < uFoamWidth + wobble) color = uFoamColor;

          // Two staggered wave rings leaving the shore, thinning out as they travel
          for (int i = 0; i < 2; i++) {
            float progress = fract(uTime * 0.22 + float(i) * 0.5);
            float ring = uFoamWidth + 0.5 + progress * (uShallowWidth - 1.0);
            float thickness = 0.22 * (1.0 - progress);
            if (abs(shoreDistance - ring - wobble * 0.6) < thickness) color = uFoamColor;
          }

          gl_FragColor = vec4(color, 1.0);

          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    })

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), this.material)
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.position.y = island.waterLevel
    this.scene.add(this.mesh)

    this.setDebug()
  }

  setDebug() {
    if (!this.debug.active) return

    const uniforms = this.material.uniforms
    const folder = this.debug.ui.addFolder('Water')
    folder.addColor(uniforms.uDeepColor, 'value').name('deep')
    folder.addColor(uniforms.uShallowColor, 'value').name('shallow')
    folder.addColor(uniforms.uFoamColor, 'value').name('foam')
    folder.add(uniforms.uShallowWidth, 'value', 1, 15, 0.1).name('shallowWidth')
    folder.add(uniforms.uFoamWidth, 'value', 0, 2, 0.01).name('foamWidth')
  }

  update() {
    this.material.uniforms.uTime.value = this.time.elapsed
  }
}
