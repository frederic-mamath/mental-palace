import * as THREE from 'three'
import Experience from '../../Experience.js'
import { createGradientMap, addOutlined } from '../toon.js'
import { createRuneTexture } from '../Hobby/Arena.js'

// The raid instance's scenery, floating in the sky over the sea: a round stone arena on a rocky base with a
// glowing rune circle and broken pillars around its rim, and the boss, a dark crystal with glowing eyes and
// orbiting shards, hovering over the middle and turning to face the cloud.
//   center: world point on the arena floor (its height is the floor's)
export default class RaidInstance {
  constructor({ center, radius }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time

    this.center = center
    this.radius = radius
    this.gradientMap = createGradientMap()

    this.group = new THREE.Group()
    this.group.position.copy(center)
    this.scene.add(this.group)

    this.setArena()
    this.setBoss()
  }

  toon(color, options = {}) {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.gradientMap, ...options })
  }

  setArena() {
    const radius = this.radius
    // Floor slab (top at y = 0) and a tapering rock underneath, as if torn out of the ground
    addOutlined(this.group, new THREE.CylinderGeometry(radius + 0.8, radius + 0.4, 1.4, 40).translate(0, -0.7, 0), this.toon('#8f8a99'), { outline: [1.01, 1.05, 1.01] })
    const rock = new THREE.ConeGeometry(radius + 0.4, 9, 9, 1).toNonIndexed().rotateX(Math.PI).translate(0, -1.4 - 4.5, 0)
    rock.computeVertexNormals()
    addOutlined(this.group, rock, this.toon('#5f5a6a'), { outline: [1.02, 1.01, 1.02] })

    const runes = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.9, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: createRuneTexture('#c084fc'), transparent: true, depthWrite: false, opacity: 0.7 })
    )
    runes.position.y = 0.02
    this.runes = runes
    this.group.add(runes)

    // Broken pillars along the rim, outside the walkable area
    const stone = this.toon('#6f6a7c')
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + 0.2
      const height = 1.2 + ((i * 7) % 5) * 0.45
      const pillar = new THREE.CylinderGeometry(0.42, 0.5, height, 6).translate(0, height / 2, 0)
      addOutlined(this.group, pillar, stone, { position: [Math.cos(angle) * (radius + 0.35), 0, Math.sin(angle) * (radius + 0.35)], rotation: [0, angle, (i % 3) * 0.05], outline: [1.12, 1.02, 1.12] })
    }
  }

  setBoss() {
    this.boss = new THREE.Group()
    this.boss.position.y = 5
    this.group.add(this.boss)

    const body = addOutlined(this.boss, new THREE.OctahedronGeometry(1.6, 0).scale(1, 1.4, 1), this.toon('#4c1d78'), { outline: 1.06 })
    this.bodyMaterial = body.material
    // Eyes on the front (local +z), unlit so they glow; brighter while casting
    this.eyeMaterial = new THREE.MeshBasicMaterial({ color: '#ffd84a' })
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), this.eyeMaterial)
      eye.position.set(side * 0.38, 0.3, 1.02)
      eye.rotation.set(-0.35, side * 0.5, side * -0.25)
      this.boss.add(eye)
    }
    // Shards orbiting the body
    this.shards = Array.from({ length: 6 }, (_, i) => {
      const shard = addOutlined(this.boss, new THREE.OctahedronGeometry(0.32, 0).scale(1, 1.6, 1), this.toon('#a855f7', { emissive: '#4c1d78', emissiveIntensity: 0.6 }), { outline: 1.1 })
      shard.userData.angle = (i / 6) * Math.PI * 2
      return shard
    })
    // The shards' outlines are the meshes added right after each shard
    this.shardOutlines = this.shards.map((shard) => shard.parent.children[shard.parent.children.indexOf(shard) + 1])
    this.cast = 0
  }

  // Short flash and swell when the boss casts an attack
  castPulse() {
    this.cast = 1
  }

  update(target) {
    const delta = this.time.delta
    const elapsed = this.time.elapsed
    this.runes.rotation.y = elapsed * 0.1

    this.cast = Math.max(this.cast - delta * 2.5, 0)
    this.boss.position.y = 5 + Math.sin(elapsed * 1.3) * 0.3
    this.boss.scale.setScalar(1 + this.cast * 0.12)
    this.eyeMaterial.color.setRGB(1, 0.85 - this.cast * 0.5, 0.3 - this.cast * 0.25)

    // Turn toward the cloud (smoothly)
    if (target) {
      const desired = Math.atan2(target.x - this.center.x, target.z - this.center.z)
      const difference = Math.atan2(Math.sin(desired - this.boss.rotation.y), Math.cos(desired - this.boss.rotation.y))
      this.boss.rotation.y += difference * (1 - Math.exp(-3 * delta))
    }

    this.shards.forEach((shard, i) => {
      const angle = shard.userData.angle + elapsed * 0.9
      const position = [Math.cos(angle) * 2.8, Math.sin(elapsed * 2 + i) * 0.6, Math.sin(angle) * 2.8]
      shard.position.set(...position)
      shard.rotation.y = elapsed * 2
      this.shardOutlines[i].position.copy(shard.position)
      this.shardOutlines[i].rotation.copy(shard.rotation)
    })
  }
}
