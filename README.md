# Mental Palace

A 3D portfolio built as a memory palace, where each place holds a project. Inspired by Bruno Simon's portfolio, with cel-shaded art direction in the spirit of Naruto Ninja Storm.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Add `#debug` to the URL to open the lil-gui debug panel.

## Structure

```
src/Experience/
  Experience.js     singleton wiring everything together
  Camera.js         perspective camera + OrbitControls
  Renderer.js       WebGL renderer
  sources.js        assets to preload (models, textures)
  Utils/            EventEmitter, Sizes, Time, Resources, Debug
  World/            World, Environment, Floor, Cloud (main character), toon helpers
```
