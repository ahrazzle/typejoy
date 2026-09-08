# Contributing to Typejoy

The workflow for anyone working on the framework itself (or its docs). Plugin authors building a *game* on top should read [docs/PLUGIN_GUIDE.md](./docs/PLUGIN_GUIDE.md) instead — this file is about the engine and the repo.

---

## Prerequisites

- Node.js ≥ 18 (repo tested on Node 22)
- `npm install` once at the repo root (installs `typescript`, `tsx`, `esbuild`)

---

## Running tests

The repo has two assertion-based test suites (no test framework — plain `tsx` scripts with a pass/fail tally):

```bash
# Event bus: RawBus → NormalizedBus → BeatClockJudge → PluginHooks (46 assertions)
npm test

# Beat-map generator: timing, density, lead-in, range queries (51 assertions)
npx tsx test/beatmap-generator.test.ts

# Integration: full pipeline driven by injected events (headless, no DOM)
npx tsx test/integration.test.ts
```

Both suites exit non-zero on any failure. Expected output ends with:

```
============================================================
Results: 46 passed, 0 failed
============================================================
```

### Testing conventions

- **Components are tested in isolation.** The event-bus suite exercises `RawBus`/`NormalizedBus`/`Judge` with injected events (`rawBus.inject`, `normBus.injectRaw`) and direct `judge.onChar` calls — no real DOM, no timers. The generator suite checks note math directly.
- **Integration bugs are caught by manual review.** This is a documented lesson from development: several real bugs (ghost space notes, medium difficulty dropping spaces, doubled notes on hard/expert, `judgmentCounts` vs `stats` property mismatches) only surfaced when the wiring in `demo.html` was exercised by hand in the browser. The `tsx` suites can't catch DOM/`requestAnimationFrame`/`setInterval` interaction bugs, so **any change to the wiring or to `FeedbackLayer` must be verified manually in `demo.html`** — run a game, type through it, check the results overlay. Fixes from those manual rounds are the majority of the git history.
- When you fix a bug found manually, add a unit assertion for it to the relevant suite so it doesn't regress silently.

---

## Building

The framework bundles to a single ESM file with esbuild:

```bash
npx esbuild src/index.ts --bundle --outfile=dist/bundle.js --format=esm
```

`npm run build` runs exactly this command.

**Two details that trip people up:**

1. **`demo.html` imports `./dist/game.js`**, not `bundle.js`. `game.js` is a copy of the same bundle — keep them in sync. The simplest habit: build to `dist/bundle.js`, then `cp dist/bundle.js dist/game.js`, and bump the cache-buster.
2. **`dist/` is committed.** The GitHub Pages site serves straight from it, so a build is part of "deploy", not a CI step. Don't add `dist/` to `.gitignore`.

`tsc` also emits per-module `dist/*.js` + `.d.ts` (via `tsconfig.json`, `outDir: dist`) — `npm run typecheck` is the compile gate; esbuild is what actually ships.

---

## Deploying to GitHub Pages

The repo has no GitHub Actions workflow — Pages serves the committed `dist/` directory (and `index.html`) from `main`. Deploy is just a push:

```bash
git add -A
git commit -m "build: rebuild bundle"
git push origin main
```

Then:

1. **Wait 1–3 minutes** for the Pages CDN to pick up the new files. The site is at `https://ahrazzle.github.io/typejoy/` (or your fork's `<org>.github.io/<repo>/`).
2. **Cache-bust.** `demo.html` loads `./dist/game.js?v=6`. After every rebuild that changes behavior, bump the version string (e.g. `?v=7`) in `demo.html`'s import — otherwise the browser and the CDN may serve a stale bundle and you'll "fix" things that are already fixed. The `v=` number in the import should always match the latest build.
3. Verify in a hard-refresh (`Cmd+Shift+R`), not a soft reload.

---

## Code style

Enforced by `tsconfig.json` (`tsc --noEmit`):

- **TypeScript strict mode** — `strict: true`.
- **No unused locals or parameters** — `noUnusedLocals`, `noUnusedParameters`. If a parameter is intentionally unused (e.g. `renderStale(_note: Note)`), prefix it with `_`; the same convention applies to `tick(_currentSongTime)`.
- **JSDoc on every public method.** Public methods carry a one-line `/** … */` describing behavior, not just the type — match the existing style in `src/`.
- Additional strictness: `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitAny` (via `strict`).
- Filenames: PascalCase for classes (`RawBus.ts`, `BeatClockJudge.ts`), kebab-case for modules with mixed exports (`feedback-layer.ts`, `beatmap-generator.ts`). Match the existing file names — `index.ts` imports them by exact name.
- Internal imports use `.js` extensions (`from './types.js'`) because the repo is ESM (`"type": "module"`). Keep that convention.

---

## Where things live

| Concern | File |
|---|---|
| Public API surface | `src/index.ts` (barrel) |
| Types + `GamePlugin` contract | `src/types.ts` |
| Input pipeline | `src/RawBus.ts`, `src/NormalizedBus.ts`, `src/BeatClockJudge.ts` |
| Beat-maps | `src/BeatMap.ts`, `src/beatmap-generator.ts` |
| Feedback | `src/feedback-layer.ts`, `src/svg-keyboard.ts`, `src/particle-system.ts`, `src/approach-ring-system.ts`, `src/keyboard-layout.ts` |
| Reference plugin | `src/debug-plugin.ts` |
| End-to-end wiring | `demo.html` |

Docs live in `docs/` (`PLUGIN_GUIDE.md`, `API_REFERENCE.md`, `EXAMPLE_PLUGIN.md`, `CONTRIBUTING.md`) with `README.md` at the root. `npm run docs` runs a consistency check that every method documented in `API_REFERENCE.md` actually exists in `src/` — run it after touching either the docs or the code.

---

## Conventional commits in this repo

History uses a loose `type: summary` style (`fix:`, `feat:`, `build:`, `docs:`). Match it — it makes the deploy log readable.
