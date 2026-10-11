import * as THREE from 'three'
import { createGradientMap, createOutlineMaterial } from '../toon.js'

// Base of Overlord's units: standalone models (no scene, no world), shown on the board and exported to glTF
// for the Unity game (npm run export:units, see units.js).
//
// Rig: rigid parts under named joints (groups), so Unity animates them as a Generic rig. Every unit has the
// same joints, at rest without rotation:
//
//   <Unit> (origin at the feet)
//   └ waist                      the belt; the robe stays on the root
//     ├ neck → the head
//     ├ shoulder_R → elbow_R → hand_R → the right hand's weapon
//     └ shoulder_L → elbow_L → hand_L → the left hand's weapon (or nothing)
//
// Local axes: facing +z, y up, 1 unit = 1 m; the unit's right hand is on -x. Joints are placed in model
// space (`joint`); a part added to a joint is positioned with `local(joint, modelPosition)`.
export default class Unit {
  constructor(name, colors) {
    this.gradientMap = createGradientMap()
    this.outlineMaterial = createOutlineMaterial()
    // Named, so exported parts and materials are recognizable (see Utils/exportGlb.js)
    this.materials = Object.fromEntries(Object.entries(colors).map(([key, color]) => [key, new THREE.MeshToonMaterial({ name: key, color, gradientMap: this.gradientMap })]))
    if (colors.ink) this.materials.ink = new THREE.MeshBasicMaterial({ name: 'ink', color: colors.ink })

    this.group = new THREE.Group()
    this.group.name = name
    this.origins = new Map([[this.group, new THREE.Vector3()]])
  }

  // A named joint at `origin` (model space) under `parent`
  joint(name, parent, origin) {
    const joint = new THREE.Group()
    joint.name = name
    joint.position.fromArray(origin).sub(this.origins.get(parent))
    this.origins.set(joint, new THREE.Vector3(...origin))
    parent.add(joint)
    return joint
  }

  // A model-space position, in a joint's space (at rest)
  local(joint, position) {
    return new THREE.Vector3(...position).sub(this.origins.get(joint)).toArray()
  }

  // Adds a mesh with an ink hull (scale `outline`, a number or [x, y, z]) to `parent`
  add(geometry, material, parent, { position = [0, 0, 0], rotation = [0, 0, 0], outline = 1.06 } = {}) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(...position)
    mesh.rotation.set(...rotation)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    if (outline) {
      const hull = new THREE.Mesh(geometry, this.outlineMaterial)
      hull.position.copy(mesh.position)
      hull.rotation.copy(mesh.rotation)
      if (Array.isArray(outline)) hull.scale.set(...outline)
      else hull.scale.setScalar(outline)
      parent.add(hull)
    }
    return mesh
  }

  // Flat faces (unshared vertices): MeshToonMaterial has no flatShading
  facet(geometry) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry
    flat.computeVertexNormals()
    return flat
  }

  // A box with chamfered edges, centered on the origin
  chamferBox(width, height, depth, bevel = 0.04) {
    const shape = new THREE.Shape()
    const w = width / 2 - bevel
    const h = height / 2 - bevel
    shape.moveTo(-w, -h)
    shape.lineTo(w, -h)
    shape.lineTo(w, h)
    shape.lineTo(-w, h)
    shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1 })
    return this.facet(geometry.translate(0, 0, -(depth - bevel * 2) / 2))
  }
}
