# Mental Palace

3D portfolio built as a memory palace (each place holds a project). Inspired by Bruno Simon's portfolio, cel-shaded art direction in the spirit of Naruto Ninja Storm. Vite + Three.js, Three.js Journey "Experience" architecture (see README.md).

- `npm run dev` to run, `npm run build` to verify before committing.
- Debug panel: append `#debug` to the URL.

## Building through systems

New features plug into existing systems rather than being built from scratch next to them.

- **Extend before duplicating.** If a feature resembles something that exists (a second vehicle, another project landmark, another island), generalize the existing system first, then build the feature on top of it.
- **Generalize in a separate `refactor` commit**, before the `feat` that needs it, and prove it changes nothing (see "Multi-step features": before/after fingerprint of behavior or layout).
- **Small, documented interfaces.** A system talks to its plug-ins through a few named properties/methods, documented in a comment at the top of the system (or of its reference implementation). Keep plug-ins unaware of each other.
- **Content is data.** Texts, links and colors live in data files (`src/Experience/projects.js`), not in the 3D code.
- **Layouts are seeded and stable.** Decor uses `createRandom(seed)`, one seed per kind and island. Adding things must not move what exists: remove pieces after placement (`exclude` / `cleared`) instead of adding avoid zones, add late colliders after the decor, and check with a decor dump that untouched instances are identical.
- **Verify in a real browser.** Headless Chrome (puppeteer-core + the installed Chrome, swiftshader) for screenshots, numeric checks (paths, timings, collisions) and before/after comparisons; the user then tests manually.

Existing systems (all under `src/Experience/World/` unless noted):

| System | Plug in by |
| --- | --- |
| Islands (`islands.js`) | adding an `IslandShape` (center, radius, harmonics, bays): land, water foam, movement limits and decor sampling follow |
| Landmarks (`Interactions.js`) | implementing the interface documented in `Projects/DoubleTap.js` (zone, prompt anchor, focus pose, active/open/react), or `interact()` for a custom action; content in `projects.js`; camera framing via `Projects/focusPose.js` |
| Transport (`Transport/Boarding.js`, `Transport/Route.js`) | a route extending `Route` (trips of phases along a flight frame, turnaround, `'landed'`/`'arrived'`) with its own phases, `applyPose` and `dropOff(stop)` (see `Airplane/Flight.js`), plus a vehicle object and stops config for `Boarding` |
| Colliders (`Cloud.resolveCollisions`) | pushing circles `{ position, radius }` or rectangles `{ position, axis, halfLength, halfWidth }` (optional `disabled`) into `world.colliders` |
| Decor (`Decor/`) | Grass, Flowers, Rocks, PalmTrees with `island`, seeded `random`, `avoid`, `exclude` |
| Effects (`Effects/`) | self-contained pooled effects (ZoneRing, HeartPop, DustBurst, Afterimages, BoomRing, SpeedLines) with `spawn`/`update` |
| Wind (`toon.js` `applyWind`, `WindField.js`) | `applyWind(material, ...)` on any instanced plant material |

## Glossary

Shared vocabulary between the user and Claude. Use these words with these meanings, in conversation and in code; add a term when a new concept appears.

**World**
- **Island**: a piece of land in the sea, defined by an `IslandShape`. **Entrepreneur island** (origin, wild; personal projects, sport, routines), **professional island** or **city** (Paris-inspired, north-west; career from 25 to 35), **hobby island** (north; shonen manga and games, storytelling, mini-games).
- **Plateau**: an island's flat top (y = 0) where the character walks. **Shore**: the lower ring around it (sand **beach** on wild islands, stone **quay ledge** in the city). **Bay**: a dent in a coastline; the hobby island's bay is the **cove**.
- **Zone (island)**: a themed area of an island (e.g. the hobby island's Training Ground, Arena, Story Meadow, Pirate Cove).
- **Frame**: the along / across coordinates of the line between two islands (`cityFrame.js`); runways and the city grid follow it.
- **Decor**: grass, flowers, rocks, palms (and city trees) placed by seeded scatter. **Seed**: the number fixing a decor layout. **Cleared zone**: where removed decor would have stood, still avoided by later decor so nothing else moves.

**Character**
- **Cloud**: the main character. **Dash**: Space burst with **afterimages**, **dust**, **speed lines**, **boom ring** and a **shockwave** in the grass. **Gust**: the stronger grass push while dashing. **Wake**: grass recovering behind the cloud. **Poof**: the smoke burst when the cloud hides or reappears.

**Interaction**
- **Landmark**: an object the character can interact with (Double Tap phone, Air France Industries hangar, a vehicle). **Interaction zone**: the circle where it becomes **active**. **Ring**: the ground circle showing that zone. **Prompt**: the floating "E · ..." bubble.
- **Open**: interacting with a project landmark: the **focus** (camera glide to its **focus pose**), the dimmed **backdrop** and the **card** (project card: status band, summary, highlights, role, stack, lesson, links). **Tap / react**: pressing E while open. **Lesson**: the card's closing pull quote.
- **Project**: an entry in `projects.js` shown on a card. **Story beat**: a hobby island card about how a story shaped the user.

**Transport**
- **Vehicle**: what carries the cloud between islands (AF airplane, pirate ship). **Route**: its trips between **stops** (`Flight` for the plane). **Board**: get on (E at the vehicle). **Trip**: one journey between two stops. **Drop-off**: where the cloud steps out when the vehicle has **landed** (stopped), before it turns around and is **parked**.
- **Airstrip**: the bush runway on the entrepreneur island. **Pier**: the ship's dock.

**Process**
- **Step**: one commit of a multi-step feature, followed by the user's **manual test**. **Fingerprint**: a before/after record proving a refactor changed nothing. **Milestone tag**: `v0.<n>-<slug>` on a tested state.

## Git workflow: one commit per change

The history must stay navigable so any version can be inspected, reverted or rolled back.

**When to commit:** at the end of every prompt that adds a feature, fixes a bug, refactors, or changes config/docs. This is a standing instruction; no need to ask first. Do not commit when the prompt was only a question, an exploration, or when the work is unfinished or broken: say so instead.

**Before committing:**
- `npm run build` must pass. If it fails, fix it or tell the user; never commit a broken build.
- Review `git status` / `git diff`: stage only files related to the change, never secrets, `node_modules`, `dist`.

**One logical change per commit.** If a prompt contains several unrelated changes, make several commits.

**Message format** (Conventional Commits):

```
<type>(<scope>): <imperative summary, max ~70 chars>

<why the change was made and anything non-obvious; wrap at ~72 chars>

Co-Authored-By: Claude <noreply@anthropic.com>
```

- types: `feat`, `fix`, `refactor`, `style` (visual/art direction), `perf`, `docs`, `chore` (deps, tooling, config)
- scope: the area touched, e.g. `cloud`, `camera`, `environment`, `world`, `resources`, `debug`
- example: `feat(cloud): add keyboard movement with follow camera`

**After committing:** push to `origin main`, then report the short hash and message to the user.

**Rollbacks:** prefer `git revert <hash>` (keeps history). Only use `git reset --hard` or force-push when the user explicitly asks, after showing what will be lost.

## Milestone tags

Tags mark known-good states to jump back to (`git checkout <tag>`) or compare against (`git diff <tag>`).

- **When:** before starting a multi-step feature (a safe point to roll back to) and when a multi-step feature is complete. Also when the user asks. No need to ask first.
- **Name:** `v0.<n>-<kebab-slug>` describing the state reached, with `<n>` one above the latest tag (`git tag --sort=-creatordate | head -1`), e.g. `v0.2-entrepreneur-island`, `v0.3-city-island`.
- **Annotated** with a one-line summary of what the state contains: `git tag -a v0.3-city-island -m "..."`, then `git push origin <tag>`.
- Only tag a commit that builds and was manually tested by the user. Never move or delete a pushed tag; create a new one instead.

## Multi-step features

When a feature is too big for one commit (new systems, refactors plus features, several visible parts):

1. Propose a plan first: a table of steps, each one a commit (`refactor` steps before the `feat` steps that need them), with what the user should test manually after it. Ask about design choices that change the build.
2. Tag the current state (see above), then build one step at a time.
3. A step that should change nothing visible (refactor) is verified with a before/after comparison (fingerprint of geometry, instance positions, colliders...), not just a screenshot.
4. After each step: commit, push, give the user a short manual test checklist, and **stop** until they confirm or report issues.
5. When the last step is confirmed, tag the finished feature.
