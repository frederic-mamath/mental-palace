import Experience from '../../Experience.js'

// Anime speed lines: thin wedges streaking in from the screen edges toward the center.
// Drawn on a 2D canvas over the WebGL one and re-randomized every frame for the flicker.
export default class SpeedLines {
  constructor({ count = 60, color = '255, 255, 255', fadeDuration = 0.25 } = {}) {
    this.experience = new Experience()
    this.sizes = this.experience.sizes

    this.count = count
    this.color = color
    this.fadeDuration = fadeDuration
    this.hold = 0
    this.intensity = 0

    this.canvas = document.createElement('canvas')
    this.canvas.className = 'speed-lines'
    document.body.appendChild(this.canvas)
    this.context = this.canvas.getContext('2d')

    this.resize()
    this.sizes.on('resize', () => this.resize())
  }

  resize() {
    this.canvas.width = this.sizes.width * this.sizes.pixelRatio
    this.canvas.height = this.sizes.height * this.sizes.pixelRatio
  }

  // Full strength for `hold` seconds, then fades out
  burst(hold) {
    this.hold = hold
    this.intensity = 1
  }

  update(delta) {
    if (this.intensity === 0) return

    if (this.hold > 0) this.hold -= delta
    else this.intensity = Math.max(this.intensity - delta / this.fadeDuration, 0)

    const { width, height } = this.canvas
    const ctx = this.context
    ctx.clearRect(0, 0, width, height)
    if (this.intensity === 0) return

    const centerX = width / 2
    const centerY = height / 2
    const outer = Math.hypot(width, height) / 2
    const thickness = 6 * this.sizes.pixelRatio

    ctx.fillStyle = `rgba(${this.color}, ${0.7 * this.intensity})`
    ctx.beginPath()
    for (let i = 0; i < this.count; i++) {
      const angle = Math.random() * Math.PI * 2
      // Lines stop short of the center, leaving the character clear
      const inner = outer * (0.45 + Math.random() * 0.3)
      const spread = (thickness * (0.3 + Math.random())) / outer

      ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner)
      ctx.lineTo(centerX + Math.cos(angle - spread) * outer, centerY + Math.sin(angle - spread) * outer)
      ctx.lineTo(centerX + Math.cos(angle + spread) * outer, centerY + Math.sin(angle + spread) * outer)
      ctx.closePath()
    }
    ctx.fill()
  }
}
