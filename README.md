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
| Open a project | Walk into its ring, then E (or click the landmark / the prompt) |
| Tap the project | E while it's open |
| Close a project | Esc, click outside the card, or move |
| Take the plane | Walk up to it, then E (or click it): flies to the other island |
| Orbit / zoom camera | Mouse drag / wheel |

## Structure

```
src/Experience/
  Experience.js     singleton wiring everything together
  Camera.js         perspective camera + OrbitControls following the character
  Renderer.js       WebGL renderer
  sources.js        assets to preload (models, textures)
  projects.js       portfolio content, one entry per project landmark
  UI/               DOM overlays (InteractPrompt, ProjectCard)
  Utils/            EventEmitter, Sizes, Time, Inputs, Resources, Debug
  World/            World, Environment, Island, Water, Cloud (main character), toon helpers
                    islands.js: island outlines (IslandShape) shared by land, water foam, decor and movement limits
                    WindField.js: drives grass/flower bending from the character (push, wake, dash gust, shockwave)
                    Interactions.js: zones, prompt, camera focus and project card for landmarks
                    Airstrip.js: bush airstrip on the flight line toward the city
    Projects/       one landmark per project (DoubleTap: giant iPhone, north of spawn;
                    AirFranceHangar: PROGNOS diorama by the city runway; focusPose: shared camera framing)
    Effects/        reusable visual effects (Afterimages, DustBurst, SpeedLines, BoomRing, ZoneRing, HeartPop)
    Decor/          seeded scatter of grass, flowers, rocks and palm trees
    City/           Paris-inspired city island (street grid, Haussmann buildings, Eiffel Tower, airport)
    Hobby/          hobby island (shonen, online games, FF7): zones, paths, signpost, decor
    Airplane/       AF airliner model and its flights between the two runways
    Transport/      boarding any vehicle between islands (prompt, ring, poof, camera follow, drop-off)
```
