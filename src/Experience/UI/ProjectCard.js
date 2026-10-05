import EventEmitter from '../Utils/EventEmitter.js'

// Anime-style project card sliding in beside the focused landmark, over a dimmed world.
// Built with textContent only, so project text can never inject markup.
// Events: 'close' (close button or click on the dimmed backdrop)
export default class ProjectCard extends EventEmitter {
  constructor() {
    super()

    this.backdrop = document.createElement('div')
    this.backdrop.className = 'project-backdrop'
    this.backdrop.addEventListener('click', () => this.trigger('close'))

    this.element = document.createElement('aside')
    this.element.className = 'project-card'
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-hidden', 'true')

    document.body.append(this.backdrop, this.element)
  }

  show(project) {
    this.render(project)
    this.element.style.setProperty('--accent', project.accent)
    this.element.setAttribute('aria-hidden', 'false')
    this.element.setAttribute('aria-label', project.title)
    this.backdrop.classList.add('is-visible')
    this.element.classList.add('is-visible')
  }

  hide() {
    this.element.setAttribute('aria-hidden', 'true')
    this.backdrop.classList.remove('is-visible')
    this.element.classList.remove('is-visible')
  }

  render(project) {
    const create = (tag, className, text) => {
      const element = document.createElement(tag)
      if (className) element.className = className
      if (text) element.textContent = text
      return element
    }

    const band = create('div', 'project-card__band')
    band.append(create('span', 'project-card__status', project.status))
    const close = create('button', 'project-card__close', '×')
    close.type = 'button'
    close.setAttribute('aria-label', 'Close')
    close.addEventListener('click', () => this.trigger('close'))
    band.append(close)

    const header = create('header', 'project-card__header')
    const icon = create('img', 'project-card__icon')
    icon.src = project.icon
    icon.alt = ''
    const titles = create('div')
    titles.append(create('h2', 'project-card__title', project.title), create('p', 'project-card__tagline', project.tagline))
    header.append(icon, titles)

    const highlights = create('ul', 'project-card__highlights')
    for (const highlight of project.highlights) highlights.append(create('li', null, highlight))

    const role = create('section', 'project-card__section')
    role.append(create('h3', null, 'Role'), create('p', null, project.role))

    const stack = create('section', 'project-card__section')
    const chips = create('ul', 'project-card__chips')
    for (const item of project.stack) chips.append(create('li', null, item))
    stack.append(create('h3', null, 'Stack'), chips)

    const links = create('footer', 'project-card__links')
    for (const { label, url } of project.links) {
      const link = create('a', 'project-card__link', label)
      link.href = url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      links.append(link)
    }

    const body = create('div', 'project-card__body')
    body.append(header, create('p', 'project-card__summary', project.summary), highlights, role, stack, links)
    body.append(create('p', 'project-card__hint', 'Esc or move to close · E to tap the phone'))

    this.element.replaceChildren(band, body)
  }
}
