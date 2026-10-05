import * as THREE from 'three'

// Shared helpers for the cel-shaded look (anime / Ninja Storm style).

// Sampled by MeshToonMaterial to quantize lighting into flat bands: shadow, mid tone, highlight.
export function createGradientMap(steps = [90, 170, 255]) {
  const texture = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

// Inverted-hull outline: back faces of a slightly larger copy show as an ink line around the silhouette.
export function createOutlineMaterial(color = '#1a1626') {
  return new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
}

// Shared clock for wind-animated materials; World advances it every frame.
export const windUniforms = { uWindTime: { value: 0 } }

// Sways vertices sideways, more the higher they are (0 at y = 0, full at y = `height`), like plants in the wind.
// Neighbouring instances move in phase, so gusts visibly travel across the field.
export function applyWind(material, { height = 1, amplitude = 0.1, speed = 1.6 } = {}) {
  const float = (value) => value.toFixed(4)

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniforms.uWindTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        {
          vec3 origin = vec3(0.0);
          #ifdef USE_INSTANCING
            origin = instanceMatrix[3].xyz;
          #endif
          origin = (modelMatrix * vec4(origin, 1.0)).xyz;

          float gust = sin(uWindTime * ${float(speed)} + origin.x * 0.3 + origin.z * 0.2) * 0.7
                     + sin(uWindTime * ${float(speed * 2.7)} + origin.z * 0.9) * 0.3;
          float bend = clamp(position.y / ${float(height)}, 0.0, 1.0);
          transformed.xz += vec2(1.0, 0.6) * gust * ${float(amplitude)} * bend * bend;
        }`
      )
  }

  // onBeforeCompile closures all stringify the same, so tell three.js these variants need distinct programs
  material.customProgramCacheKey = () => `wind-${height}-${amplitude}-${speed}`
}
