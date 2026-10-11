import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

// Exports a model (e.g. an Overlord unit) to a binary glTF (.glb) for other engines, like the Unity game.
// Works in the browser and in Node (see scripts/export-units.mjs).
//
// glTF has no cel shading and no "draw back faces only", so a copy is adapted first; the model is untouched:
// - toon materials become plain PBR ones (base color, fully rough, not metallic), keeping their names; a toon
//   shader on the other side brings the bands back
// - outline hulls (back-side ink copies) are turned inside out (reversed winding) with an unlit ink
//   material: the "inverted hull" outline, which renders with any standard shader and back-face culling.
//   They're named `<part>_outline`, so they're easy to find and switch off
// - unnamed meshes are named after their material (`robe`, `steel_2`...); groups keep their names, as
//   pivots to animate; nodes are written as translation / rotation / scale (not matrices), the joints'
//   rest pose as an animator sees it
export async function exportGlb(object, { outlines = true } = {}) {
  const copy = prepareForExport(object, { outlines })
  const exporter = new GLTFExporter()
  return exporter.parseAsync(copy, { binary: true, onlyVisible: true, trs: true })
}

export function prepareForExport(object, { outlines = true } = {}) {
  const copy = object.clone(true)
  copy.position.set(0, 0, 0) // the model's own origin, wherever it stands in the scene
  copy.rotation.set(0, 0, 0)
  copy.scale.set(1, 1, 1)

  const converted = new Map()
  const stripped = new Map()
  const ink = new THREE.MeshBasicMaterial({ name: 'outline', color: '#1a1626' })
  const counts = {}
  const unique = (name) => {
    counts[name] = (counts[name] ?? 0) + 1
    return counts[name] === 1 ? name : `${name}_${counts[name]}`
  }

  const hulls = []
  copy.traverse((child) => {
    if (!child.isMesh) return
    if (child.material.side === THREE.BackSide) {
      hulls.push(child)
      return
    }
    child.material = convertMaterial(child.material, converted)
    child.name ||= unique(child.material.name || 'part')
    if (!child.material.map) child.geometry = withoutUvs(child.geometry, stripped)
  })

  for (const hull of hulls) {
    if (!outlines) {
      hull.removeFromParent()
      continue
    }
    // Named after the part it outlines: its sibling sharing the same geometry
    const shared = [hull.geometry, stripped.get(hull.geometry)]
    const part = hull.parent.children.find((sibling) => sibling !== hull && shared.includes(sibling.geometry))
    hull.name = unique(`${part?.name ?? 'part'}_outline`)
    hull.geometry = turnInsideOut(hull.geometry)
    hull.geometry.deleteAttribute('uv')
    hull.material = ink
  }
  return copy
}

// Toon -> PBR with the same color and name; basic (unlit) materials are kept, glTF has them too
function convertMaterial(material, converted) {
  if (!material.isMeshToonMaterial) return material
  if (!converted.has(material)) {
    converted.set(material, new THREE.MeshStandardMaterial({ name: material.name, color: material.color, map: material.map, roughness: 1, metalness: 0 }))
  }
  return converted.get(material)
}

// Texture coordinates are dead weight without a texture; geometries shared by several meshes stay shared
function withoutUvs(geometry, stripped) {
  if (!geometry.attributes.uv) return geometry
  if (!stripped.has(geometry)) {
    const copy = geometry.clone()
    copy.deleteAttribute('uv')
    stripped.set(geometry, copy)
  }
  return stripped.get(geometry)
}

// Reversed triangle winding and flipped normals: the faces that were drawn from the inside now face out
function turnInsideOut(source) {
  const geometry = source.clone()
  if (geometry.index) {
    const index = geometry.index.array
    for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]]
  } else {
    for (const attribute of Object.values(geometry.attributes)) {
      const size = attribute.itemSize
      const array = attribute.array
      for (let i = 0; i < attribute.count; i += 3) {
        for (let k = 0; k < size; k++) [array[(i + 1) * size + k], array[(i + 2) * size + k]] = [array[(i + 2) * size + k], array[(i + 1) * size + k]]
      }
    }
  }
  const normal = geometry.attributes.normal
  if (normal) for (let i = 0; i < normal.array.length; i++) normal.array[i] = -normal.array[i]
  return geometry
}
