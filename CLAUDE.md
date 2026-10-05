# Mental Palace

3D portfolio built as a memory palace (each place holds a project). Inspired by Bruno Simon's portfolio, cel-shaded art direction in the spirit of Naruto Ninja Storm. Vite + Three.js, Three.js Journey "Experience" architecture (see README.md).

- `npm run dev` to run, `npm run build` to verify before committing.
- Debug panel: append `#debug` to the URL.

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
