// Raid mini-game overlay: a top bar (timer, hearts, best time), a big countdown, a red flash on hits, and
// the end-of-run panel. DOM built with textContent only.
const format = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds - minutes * 60
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`
}

export default class RaidHud {
  constructor() {
    const create = (tag, className, parent = document.body) => {
      const element = document.createElement(tag)
      element.className = className
      parent.append(element)
      return element
    }

    this.bar = create('div', 'raid-bar')
    create('span', 'raid-bar__label', this.bar).textContent = 'RAID'
    this.timer = create('span', 'raid-bar__timer', this.bar)
    this.hearts = create('span', 'raid-bar__hearts', this.bar)
    this.best = create('span', 'raid-bar__best', this.bar)
    create('span', 'raid-bar__hint', this.bar).textContent = 'Esc to leave'

    this.countdown = create('div', 'raid-countdown')
    this.flashOverlay = create('div', 'raid-flash')

    this.panel = create('div', 'raid-panel')
    this.panelTitle = create('h2', 'raid-panel__title', this.panel)
    this.panelTime = create('p', 'raid-panel__time', this.panel)
    this.panelBest = create('p', 'raid-panel__best', this.panel)
    create('p', 'raid-panel__hint', this.panel).textContent = 'E · Try again     Esc · Leave'
  }

  show() {
    this.bar.classList.add('is-visible')
  }

  hide() {
    for (const element of [this.bar, this.countdown, this.panel]) element.classList.remove('is-visible')
  }

  setTime(seconds) {
    this.timer.textContent = format(seconds)
  }

  setHearts(hearts, max) {
    this.hearts.textContent = '♥'.repeat(hearts) + '♡'.repeat(max - hearts)
  }

  setBest(seconds) {
    this.best.textContent = seconds > 0 ? `Best ${format(seconds)}` : 'Best --:--.-'
  }

  // A number, a word ("Fight!") or null to hide it
  setCountdown(text) {
    if (text === null) {
      this.countdown.classList.remove('is-visible')
      return
    }
    if (this.countdown.textContent !== String(text)) {
      this.countdown.textContent = text
      // Restart the pop animation
      this.countdown.classList.remove('is-visible')
      void this.countdown.offsetWidth
      this.countdown.classList.add('is-visible')
    }
  }

  flash() {
    this.flashOverlay.classList.remove('is-flashing')
    void this.flashOverlay.offsetWidth
    this.flashOverlay.classList.add('is-flashing')
  }

  showPanel({ time, best, record }) {
    this.panelTitle.textContent = record ? 'New record!' : 'Wipe!'
    this.panel.classList.toggle('is-record', record)
    this.panelTime.textContent = `You survived ${format(time)}`
    this.panelBest.textContent = `Best ${format(best)}`
    this.panel.classList.add('is-visible')
  }

  hidePanel() {
    this.panel.classList.remove('is-visible')
  }
}
