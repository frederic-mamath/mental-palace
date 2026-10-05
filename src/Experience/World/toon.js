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

// Shared state for wind-animated materials, driven every frame by WindField.
// - pusher: the character; plants around it bend away, as if pushed by its downdraft
// - trail: lags behind the pusher, so a wake of parted plants follows it and recovers gradually
// - shockwave: a ring of flattened plants spreading out from a point (dash take-off)
export const windUniforms = {
  uWindTime: { value: 0 },
  uPusherPosition: { value: new THREE.Vector3(1e5, 0, 1e5) },
  uPusherTrail: { value: new THREE.Vector3(1e5, 0, 1e5) },
  uPushRadius: { value: 3.5 },
  uPushStrength: { value: 0.8 },
  uShockwaveOrigin: { value: new THREE.Vector3(1e5, 0, 1e5) },
  uShockwaveAge: { value: 1e5 },
  uShockwaveSpeed: { value: 14 },
  uShockwaveWidth: { value: 1.6 },
  uShockwaveLifetime: { value: 0.7 },
  uShockwaveStrength: { value: 1.2 },
  uLeanLimit: { value: 1.2 },
}

// Sways vertices sideways, more the higher they are (0 at y = 0, full at y = `height`), like plants in the wind.
// Neighbouring instances move in phase, so gusts visibly travel across the field.
export function applyWind(material, { height = 1, amplitude = 0.1, speed = 1.6 } = {}) {
  const float = (value) => value.toFixed(4)

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uWindTime;
        uniform vec3 uPusherPosition;
        uniform vec3 uPusherTrail;
        uniform float uPushRadius;
        uniform float uPushStrength;
        uniform vec3 uShockwaveOrigin;
        uniform float uShockwaveAge;
        uniform float uShockwaveSpeed;
        uniform float uShockwaveWidth;
        uniform float uShockwaveLifetime;
        uniform float uShockwaveStrength;
        uniform float uLeanLimit;

        // World-space offset leaning a plant at origin away from pusher and flattening it a little,
        // fading out smoothly toward the push radius
        vec3 pushOffset(vec3 origin, vec3 pusher, float strength) {
          vec2 away = origin.xz - pusher.xz;
          float pushDistance = length(away);
          float push = (1.0 - smoothstep(0.0, uPushRadius, pushDistance)) * strength;
          vec2 direction = away / max(pushDistance, 0.001);
          return vec3(direction.x * push, -push * 0.6, direction.y * push);
        }

        // Same lean, but only on a thin ring that expands from the shockwave origin and fades out
        vec3 shockwaveOffset(vec3 origin) {
          vec2 away = origin.xz - uShockwaveOrigin.xz;
          float waveDistance = length(away);
          float front = uShockwaveAge * uShockwaveSpeed;
          float ring = 1.0 - smoothstep(0.0, uShockwaveWidth, abs(waveDistance - front));
          float fade = 1.0 - clamp(uShockwaveAge / uShockwaveLifetime, 0.0, 1.0);
          float push = ring * fade * uShockwaveStrength;
          vec2 direction = away / max(waveDistance, 0.001);
          return vec3(direction.x * push, -push * 0.6, direction.y * push);
        }`
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            mat4 placement = modelMatrix * instanceMatrix;
          #else
            mat4 placement = modelMatrix;
          #endif
          // World position of the plant's base: the whole plant reacts as one piece
          vec3 origin = placement[3].xyz;
          float bend = clamp(position.y / ${float(height)}, 0.0, 1.0);
          bend *= bend;

          float gust = sin(uWindTime * ${float(speed)} + origin.x * 0.3 + origin.z * 0.2) * 0.7
                     + sin(uWindTime * ${float(speed * 2.7)} + origin.z * 0.9) * 0.3;
          transformed.xz += vec2(1.0, 0.6) * gust * ${float(amplitude)} * bend;

          vec3 worldOffset = pushOffset(origin, uPusherPosition, uPushStrength)
                           + pushOffset(origin, uPusherTrail, uPushStrength * 0.6)
                           + shockwaveOffset(origin);
          // Where pushes overlap, cap the lean so plants don't fold into the ground
          float lean = length(worldOffset);
          if (lean > 0.0) {
            worldOffset *= min(lean, uLeanLimit) / lean;
            // Back into the plant's local space, undoing its instance rotation and scale
            transformed += inverse(mat3(placement)) * worldOffset * bend;
          }
        }`
      )
  }

  // onBeforeCompile closures all stringify the same, so tell three.js these variants need distinct programs
  material.customProgramCacheKey = () => `wind-${height}-${amplitude}-${speed}`
}

// Adds a mesh and its ink outline (an inverted hull: the same geometry scaled up around its own origin) to
// `parent`. `outline` is a scale factor (number or [x, y, z]); position and rotation apply to both.
export function addOutlined(parent, geometry, material, { position = [0, 0, 0], rotation = [0, 0, 0], outline = 1.06, castShadow = true } = {}) {
  const mesh = new THREE.Mesh(geometry, material)
  const hull = new THREE.Mesh(geometry, outlineMaterialShared)
  for (const object of [mesh, hull]) {
    object.position.set(...position)
    object.rotation.set(...rotation)
  }
  if (Array.isArray(outline)) hull.scale.set(...outline)
  else hull.scale.setScalar(outline)
  mesh.castShadow = castShadow
  mesh.receiveShadow = true
  parent.add(mesh, hull)
  return mesh
}
const outlineMaterialShared = createOutlineMaterial()
