// Flicker check: finds z-fighting (coplanar surfaces flickering) anywhere a visitor looks.
//
// Renders each view twice with only the camera's near plane changed. That changes how depth is stored,
// not where anything lands on screen, so the only pixels that differ are depth ties: two surfaces at the
// same depth, which flicker as the camera moves. Thin lines along outlines are precision noise at grazing
// angles; only patches count (flickering pixels with mostly flickering neighbors), and a cell with
// several patch pixels is a real overlap. Views: every landmark (close and from higher up, from four sides),
// the zones that aren't landmarks (listed below) and every island from above; new landmarks are covered
// without editing this file.
//
// Usage: npm run check:flicker   (CHROME_PATH=... to use another Chrome; diff images are written to
// the folder printed at the end, flicker in magenta)
import { createServer } from 'vite'
import puppeteer from 'puppeteer-core'
import { PNG } from 'pngjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const cell = 40 // px: flicker is counted per square cell of the image
const minNeighbors = 5 // of 8: a flickering pixel counts only inside a patch, not on a thin line
const maxPerCell = Number(process.env.FLICKER_MAX ?? 6) // more patch pixels than this in one cell fails
const verbose = process.env.FLICKER_VERBOSE === '1'
const outDir = join(tmpdir(), 'mental-palace-flicker')
mkdirSync(outDir, { recursive: true })

const server = await createServer({ logLevel: 'error', server: { port: 0 } })
await server.listen()
const url = server.resolvedUrls.local[0]
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 1000, height: 640 },
})

let failed = 0
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.waitForFunction(() => window.experience?.world?.interactions, { timeout: 30000 })

  // Stop the loop (so both renders show the same frame) and list the views
  const views = await page.evaluate(() => {
    const { time, camera, world } = window.experience
    cancelAnimationFrame(time.frame)
    time.tick = () => {}
    camera.focused = true
    const views = []
    world.interactions.landmarks.forEach((landmark, i) => {
      const { x, z } = landmark.zone.position
      const name = landmark.project?.title ?? landmark.promptLabel ?? landmark.constructor.name ?? `landmark ${i}`
      for (let side = 0; side < 4; side++) {
        const angle = (side / 4) * Math.PI * 2 + 0.4
        for (const [distance, height] of [[9, 5], [22, 16]]) {
          views.push({ name: `${name} ${side}-${distance}`, position: [x + Math.cos(angle) * distance, height, z + Math.sin(angle) * distance], target: [x, 0.5, z] })
        }
      }
    })
    // Zones that aren't landmarks: their center, from the same sides
    for (const [name, zone] of [['Overlord', world.overlord]]) {
      if (!zone) continue
      const { x, z } = zone.group.position
      for (let side = 0; side < 4; side++) {
        const angle = (side / 4) * Math.PI * 2 + 0.4
        for (const [distance, height] of [[7, 4], [16, 11]]) {
          views.push({ name: `${name} ${side}-${distance}`, position: [x + Math.cos(angle) * distance, height, z + Math.sin(angle) * distance], target: [x, 0.5, z] })
        }
      }
    }
    for (const shape of [world.island.shape, world.city.shape, world.hobbyIsland.shape]) {
      const { x, z } = shape.center
      views.push({ name: `${shape.name} island`, position: [x + shape.radius * 0.9, shape.radius * 1.3, z + shape.radius * 0.9], target: [x, 0, z] })
    }
    return views
  })

  const render = async (near) => {
    await page.evaluate((near) => {
      const { camera, renderer, scene } = window.experience
      camera.instance.near = near
      camera.instance.updateProjectionMatrix()
      renderer.instance.render(scene, camera.instance)
    }, near)
    return PNG.sync.read(await page.screenshot())
  }

  for (const [index, view] of views.entries()) {
    await page.evaluate(({ position, target }) => {
      const { instance, controls } = window.experience.camera
      controls.target.set(...target)
      instance.position.set(...position)
      instance.lookAt(controls.target)
    }, view)
    const a = await render(0.1)
    const b = await render(0.37)

    const { width, height } = a
    const flickers = new Uint8Array(width * height)
    for (let pixel = 0; pixel < flickers.length; pixel++) {
      const i = pixel * 4
      flickers[pixel] = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 30 ? 1 : 0
    }
    const cells = new Map()
    const diff = new PNG({ width, height })
    for (let pixel = 0; pixel < flickers.length; pixel++) {
      const i = pixel * 4
      const x = pixel % width
      const y = Math.floor(pixel / width)
      let flicker = false
      if (flickers[pixel] && x > 0 && y > 0 && x < width - 1 && y < height - 1) {
        let neighbors = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) neighbors += flickers[pixel + dy * width + dx]
        flicker = neighbors - 1 >= minNeighbors
      }
      if (flicker) {
        const key = `${Math.floor(x / cell)},${Math.floor(y / cell)}`
        cells.set(key, (cells.get(key) ?? 0) + 1)
      }
      diff.data[i] = flicker ? 255 : a.data[i] * 0.35
      diff.data[i + 1] = flicker ? 0 : a.data[i + 1] * 0.35
      diff.data[i + 2] = flicker ? 255 : a.data[i + 2] * 0.35
      diff.data[i + 3] = 255
    }

    const worst = [...cells.entries()].sort((x, y) => y[1] - x[1])[0]
    const bad = worst && worst[1] > maxPerCell
    if (verbose) console.log(`${view.name}: ${worst?.[1] ?? 0}`)
    if (bad) {
      failed++
      const file = join(outDir, `${String(index).padStart(2, '0')}-${view.name.replace(/[^a-z0-9]+/gi, '-')}.png`)
      writeFileSync(file, PNG.sync.write(diff))
      const [cx, cy] = worst[0].split(',').map(Number)
      console.log(`FAIL ${view.name}: ${worst[1]} flickering pixels around (${cx * cell}, ${cy * cell}) -> ${file}`)
    }
  }

  if (errors.length) {
    failed++
    console.log(`Page errors:\n${errors.join('\n')}`)
  }
  console.log(failed ? `\n${failed} view(s) flicker, see ${outDir}` : `No flicker in ${views.length} views.`)
} finally {
  await browser.close()
  await server.close()
}
process.exit(failed ? 1 : 0)
