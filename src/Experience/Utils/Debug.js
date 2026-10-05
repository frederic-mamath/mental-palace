import GUI from 'lil-gui'

// Open the site with #debug in the URL to show the panel.
export default class Debug {
  constructor() {
    this.active = window.location.hash === '#debug'

    if (this.active) this.ui = new GUI()
  }

  destroy() {
    this.ui?.destroy()
  }
}
