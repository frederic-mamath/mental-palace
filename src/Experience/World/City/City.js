import * as THREE from 'three'
import Experience from '../../Experience.js'
import Island from '../Island.js'
import { createGradientMap, createOutlineMaterial } from '../toon.js'
import { createRandom, range } from '../Decor/scatter.js'
import { createCityFrame } from './cityFrame.js'
import Buildings from './Buildings.js'
import Airport from './Airport.js'
import EiffelTower from './EiffelTower.js'

// Paris-inspired city island: asphalt plateau with stone quays, Haussmann blocks on a street grid
// aligned with the flight path, a tree-lined boulevard from the airport to a round place with a
// column, and a lawn with the Eiffel Tower. Layout values are in city coordinates (see cityFrame.js).
const layout = {
  blockSpacing: 11.5,
  blockSize: 7.6, // sidewalk slab; leaves 3.9-wide streets between blocks
  boulevardHalfWidth: 4.5,
  runwayLength: 22,
  runwayWidth: 3.4,
  place: { along: 1.75, across: 0, radius: 4 },
  park: { minAlong: 15.2, maxAlong: 22.8, minAcross: -23.6, maxAcross: -4.5 },
}

export default class City {
  constructor({ shape, origin }) {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.shape = shape
    this.frame = createCityFrame(origin.center, shape.center)
    this.random = createRandom(11)
    this.gradientMap = createGradientMap()
    this.outlineMaterial = createOutlineMaterial()

    this.island = new Island({ shape, palette: { top: '#767a85', cliff: '#cdbf9f', shore: '#b3a589' } })

    // Runway starts just inside the quay facing the entrepreneur island and runs inland (+u)
    const edge = shape.radiusAt(shape.angleOf(origin.center.x, origin.center.z))
    this.runway = { start: -edge + 3, length: layout.runwayLength, width: layout.runwayWidth }
    // Runway, apron and terminal (+v side), control tower (-v side)
    this.airportZone = { minAlong: -Infinity, maxAlong: this.runway.start + this.runway.length + 2, minAcross: -9, maxAcross: 15 }
    this.airport = new Airport({ frame: this.frame, runway: this.runway })

    this.blocks = this.layoutBlocks()
    this.setBlocks()
    this.setBoulevardTrees()
    this.setPlace()
    this.setPark()
  }

  // Grid slots on the island, clear of the airport, place and park. A slot where the whole block fits
  // becomes a full block (sidewalk + 2 x 2 buildings); otherwise each building that fits on its own
  // gets its own lot, so the city edges and the airport surroundings fill in irregularly.
  layoutBlocks() {
    const { blockSpacing, blockSize, boulevardHalfWidth, place, park } = layout
    const unit = (blockSize - 1) / 2
    const corner = new THREE.Vector3()

    const fits = (along, across, half) => {
      const onIsland = [[-1, -1], [-1, 1], [1, -1], [1, 1]].every(([cu, cv]) => {
        this.frame.toWorld(along + cu * (half + 1), across + cv * (half + 1), 0, corner)
        return this.shape.edgeDistance(corner.x, corner.z) < -1
      })
      const overlaps = (zone) =>
        along + half > zone.minAlong && along - half < zone.maxAlong && across + half > zone.minAcross && across - half < zone.maxAcross
      // Distance from the place's center to the square
      const dx = Math.max(Math.abs(along - place.along) - half, 0)
      const dy = Math.max(Math.abs(across - place.across) - half, 0)
      const nearPlace = Math.hypot(dx, dy) < place.radius + 0.6
      return onIsland && !overlaps(this.airportZone) && !overlaps(park) && !nearPlace
    }

    const lots = []
    for (let column = -4; column <= 3; column++) {
      const along = -4 + column * blockSpacing
      for (let row = 0; row < 3; row++) {
        for (const side of [-1, 1]) {
          const across = side * (boulevardHalfWidth + blockSize / 2 + row * blockSpacing)
          const buildings = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
            .map(([cu, cv]) => ({ along: along + (cu * unit) / 2, across: across + (cv * unit) / 2 }))

          if (fits(along, across, blockSize / 2)) {
            lots.push({ along, across, size: blockSize, buildings })
          } else {
            for (const building of buildings) {
              if (fits(building.along, building.across, unit / 2 + 0.3)) lots.push({ ...building, size: unit + 0.6, buildings: [building] })
            }
          }
        }
      }
    }

    return lots
  }

  // Each lot: a stone sidewalk slab carrying its Haussmann buildings, of slightly different heights
  setBlocks() {
    const unit = (layout.blockSize - 1) / 2
    const units = this.blocks.flatMap((lot) =>
      lot.buildings.map((building) => ({
        ...building,
        width: unit,
        depth: unit,
        height: range(this.random, 4.6, 5.4),
        roofHeight: range(this.random, 1.2, 1.6),
      }))
    )
    this.buildings = new Buildings({ frame: this.frame, units, random: this.random })

    const sidewalks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.2, 1).translate(0, 0.1, 0),
      new THREE.MeshToonMaterial({ color: '#d8cdb6', gradientMap: this.gradientMap }),
      this.blocks.length
    )
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.frame.yaw)
    const scale = new THREE.Vector3()
    this.blocks.forEach((lot, i) => {
      this.frame.toWorld(lot.along, lot.across, 0, position)
      sidewalks.setMatrixAt(i, matrix.compose(position, quaternion, scale.set(lot.size, 1, lot.size)))
    })
    sidewalks.receiveShadow = true
    this.scene.add(sidewalks)
  }

  // Plane trees lining both sides of the boulevard (airport to place), around the place,
  // and along the quays like the banks of the Seine (except at the airport)
  setBoulevardTrees() {
    const spots = []
    const { boulevardHalfWidth, place } = layout
    for (let along = this.airportZone.maxAlong + 1; along < place.along - place.radius - 1; along += 3.2) {
      for (const side of [-1, 1]) spots.push([along, side * (boulevardHalfWidth - 1.1)])
    }
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + 0.3
      spots.push([place.along + Math.cos(angle) * (place.radius + 1.6), place.across + Math.sin(angle) * (place.radius + 1.6)])
    }

    // Quay trees: walk around the coast just inside the edge, keeping clear of the airport and buildings
    const world = new THREE.Vector3()
    const inZone = (along, across, zone, margin) =>
      along > zone.minAlong - margin && along < zone.maxAlong + margin && across > zone.minAcross - margin && across < zone.maxAcross + margin
    const quaySteps = 64
    for (let i = 0; i < quaySteps; i++) {
      const angle = (i / quaySteps) * Math.PI * 2
      const radius = this.shape.radiusAt(angle) - 2.2
      world.set(this.shape.center.x + Math.cos(angle) * radius, 0, this.shape.center.z + Math.sin(angle) * radius)
      // Back to city coordinates
      const dx = world.x - this.shape.center.x
      const dz = world.z - this.shape.center.z
      const along = dx * this.frame.u.x + dz * this.frame.u.y
      const across = dx * this.frame.v.x + dz * this.frame.v.y
      const nearBuilding = this.blocks.some((lot) => Math.abs(along - lot.along) < lot.size / 2 + 1 && Math.abs(across - lot.across) < lot.size / 2 + 1)
      if (!inZone(along, across, this.airportZone, 1) && !inZone(along, across, layout.park, 1) && !nearBuilding) spots.push([along, across])
    }

    this.trees = this.createTrees(spots)
  }

  createTrees(spots) {
    const crownGeometry = new THREE.IcosahedronGeometry(1, 1)
    crownGeometry.computeVertexNormals()
    const crowns = new THREE.InstancedMesh(crownGeometry, new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: this.gradientMap }), spots.length)
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.12, 0.16, 1.6, 6).translate(0, 0.8, 0),
      new THREE.MeshToonMaterial({ color: '#7a5a3c', gradientMap: this.gradientMap }),
      spots.length
    )
    const crownOutlines = new THREE.InstancedMesh(crownGeometry, this.outlineMaterial, spots.length)
    const greens = ['#5f9e4a', '#6aab52', '#55913f'].map((color) => new THREE.Color(color))

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    spots.forEach(([along, across], i) => {
      const size = range(this.random, 0.85, 1.15)
      this.frame.toWorld(along, across, 0, position)
      trunks.setMatrixAt(i, matrix.compose(position, quaternion, scale.set(size, size, size)))

      position.y = 2.3 * size
      quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.random() * Math.PI * 2)
      crowns.setMatrixAt(i, matrix.compose(position, quaternion, scale.set(1.15 * size, size, 1.15 * size)))
      crowns.setColorAt(i, greens[Math.floor(this.random() * greens.length)])
      crownOutlines.setMatrixAt(i, matrix.compose(position, quaternion, scale.set(1.15 * size + 0.07, size + 0.07, 1.15 * size + 0.07)))
      quaternion.identity()
    })

    crowns.castShadow = true
    trunks.castShadow = true
    this.scene.add(crowns, crownOutlines, trunks)
    return { crowns, trunks, crownOutlines }
  }

  // Round paved place with a column topped by a golden figure, at the end of the boulevard
  setPlace() {
    const { place } = layout
    const group = new THREE.Group()
    this.frame.toWorld(place.along, place.across, 0, group.position)
    this.scene.add(group)

    const stone = new THREE.MeshToonMaterial({ color: '#d8cdb6', gradientMap: this.gradientMap })
    const bronze = new THREE.MeshToonMaterial({ color: '#4f6b5c', gradientMap: this.gradientMap })
    const gold = new THREE.MeshToonMaterial({ color: '#e8b830', gradientMap: this.gradientMap })
    const t = 0.06
    const parts = [
      { geometry: new THREE.CylinderGeometry(place.radius, place.radius, 0.15, 48), material: stone, y: 0.075, outline: false },
      { geometry: new THREE.CylinderGeometry(1.1, 1.3, 1, 8), material: stone, y: 0.65 },
      { geometry: new THREE.CylinderGeometry(0.35, 0.42, 6, 16), material: bronze, y: 4.15 },
      { geometry: new THREE.CylinderGeometry(0.55, 0.45, 0.3, 16), material: bronze, y: 7.3 },
      { geometry: new THREE.IcosahedronGeometry(0.4, 1), material: gold, y: 7.85 },
    ]
    for (const { geometry, material, y, outline = true } of parts) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.y = y
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
      if (outline) {
        geometry.computeBoundingSphere()
        const hull = new THREE.Mesh(geometry, this.outlineMaterial)
        hull.position.y = y
        hull.scale.setScalar(1 + t / Math.max(geometry.boundingSphere.radius * 0.5, 0.2))
        group.add(hull)
      }
    }
  }

  // Lawn in place of two blocks, with gravel paths and the Eiffel Tower in the middle
  setPark() {
    const { park } = layout
    const along = (park.minAlong + park.maxAlong) / 2
    const across = (park.minAcross + park.maxAcross) / 2
    const group = new THREE.Group()
    this.frame.toWorld(along, across, 0, group.position)
    group.rotation.y = this.frame.yaw
    this.scene.add(group)

    const lengthAlong = park.maxAlong - park.minAlong
    const lengthAcross = park.maxAcross - park.minAcross
    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(lengthAlong, 0.16, lengthAcross).translate(0, 0.08, 0),
      new THREE.MeshToonMaterial({ color: '#7fcf6b', gradientMap: this.gradientMap })
    )
    lawn.receiveShadow = true
    const path = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, lengthAcross).translate(0, 0.09, 0),
      new THREE.MeshToonMaterial({ color: '#e6d9b8', gradientMap: this.gradientMap })
    )
    path.receiveShadow = true
    group.add(lawn, path)

    this.eiffelTower = new EiffelTower({ position: group.position.clone(), yaw: this.frame.yaw })
  }
}
