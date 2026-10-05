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
