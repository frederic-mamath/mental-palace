# Mental Palace

A 3D portfolio built as a memory palace, where each place holds a project. Inspired by Bruno Simon's portfolio, with cel-shaded art direction in the spirit of Naruto Ninja Storm.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Add `#debug` to the URL to open the lil-gui debug panel.

## Controls

| Action | Keys |
| --- | --- |
| Move | WASD (ZQSD on AZERTY) or arrow keys, relative to the camera |
| Sprint | Shift |
| Dash | Space (toward the held direction, or straight ahead) |
| Orbit / zoom camera | Mouse drag / wheel |

## Structure

```
src/Experience/
  Experience.js     singleton wiring everything together
  Camera.js         perspective camera + OrbitControls following the character
  Renderer.js       WebGL renderer
  sources.js        assets to preload (models, textures)
  Utils/            EventEmitter, Sizes, Time, Inputs, Resources, Debug
  World/            World, Environment, Floor, Cloud (main character), toon helpers
    Projects/       one landmark per project (DoubleTap: giant iPhone, north of spawn)
    Effects/        reusable visual effects (Afterimages, DustBurst)
```
