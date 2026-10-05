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
| Transport (`Transport/Boarding.js`) | a route implementing `parkedAt`, `travelling`, `depart()`, `dropOff(stop)`, `'landed'` (see `Airplane/Flight.js`) plus a vehicle object and stops config |
| Colliders (`Cloud.resolveCollisions`) | pushing circles `{ position, radius }` or rectangles `{ position, axis, halfLength, halfWidth }` (optional `disabled`) into `world.colliders` |
| Decor (`Decor/`) | Grass, Flowers, Rocks, PalmTrees with `island`, seeded `random`, `avoid`, `exclude` |
| Effects (`Effects/`) | self-contained pooled effects (ZoneRing, HeartPop, DustBurst, Afterimages, BoomRing, SpeedLines) with `spawn`/`update` |
| Wind (`toon.js` `applyWind`, `WindField.js`) | `applyWind(material, ...)` on any instanced plant material |

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
