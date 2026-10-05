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

**Rollbacks:** prefer `git revert <hash>` (keeps history). Only use `git reset --hard` or force-push when the user explicitly asks, after showing what will be lost. Tag notable milestones (e.g. `git tag v0.1-cloud-character`) when the user asks or a release-worthy state is reached.
