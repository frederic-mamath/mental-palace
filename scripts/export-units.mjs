// Exports every Overlord unit (src/Experience/World/Overlord/units.js) to exports/overlord/<name>.glb, for
// the Unity game. See src/Experience/Utils/exportGlb.js for how the models are adapted to glTF.
//
// Usage: npm run export:units            (outlines baked as inverted hulls)
//        npm run export:units -- --no-outlines
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// GLTFExporter reads its binary chunks with the browser's FileReader; Node has Blob but no FileReader
globalThis.FileReader ??= class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer
      this.onloadend?.()
    })
  }
}

const { exportGlb } = await import('../src/Experience/Utils/exportGlb.js')
const { units } = await import('../src/Experience/World/Overlord/units.js')

const outlines = !process.argv.includes('--no-outlines')
const outDir = join(import.meta.dirname, '..', 'exports', 'overlord')
mkdirSync(outDir, { recursive: true })

for (const [name, Unit] of Object.entries(units)) {
  const unit = new Unit()
  const glb = await exportGlb(unit.group, { outlines })
  const file = join(outDir, `${name}${outlines ? '' : '-no-outlines'}.glb`)
  writeFileSync(file, Buffer.from(glb))
  console.log(`${file} (${(glb.byteLength / 1024).toFixed(0)} KB)`)
}
