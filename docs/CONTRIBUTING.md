# Typejoy — Contributing Guide

Thanks for building on Typejoy! This guide covers dev setup, the test suite, and conventions so your contribution lands cleanly.

---

## Dev setup

```bash
git clone https://github.com/ahrazzle/typejoy.git
cd typejoy
npm install
```

The project is TypeScript compiled to an ESM bundle with esbuild:

```bash
npx esbuild src/index.ts --bundle --outfile=dist/bundle.js --format=esm
```

For development, run a local server (ES modules need HTTP, not `file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000/demo.html
```

---

## Tests

```bash
npm test           # event bus + generator tests (tsx)
npm run typecheck  # tsc --noEmit
```

Test files:
- `test/eventbus.test.ts` — RawBus, NormalizedBus, BeatClockJudge, PluginRegistry, hooks, accessors
- `test/beatmap-generator.test.ts` — note generation, timing, density, edge cases

**Rule:** any change to a source file must keep the full suite green, and any new behavior needs a test.

---

## Architecture

```
src/
  index.ts                 # public exports (the API surface)
  session.ts               # createSession() facade — the recommended entry point
  RawBus.ts                # raw keydown/keyup capture, timestamped at source
  NormalizedBus.ts         # char normalization (shift/caps, repeat filtering)
  BeatClockJudge.ts        # timing judgment, combo, stale detection
  BeatMap.ts               # StaticBeatMap — immutable note container
  beatmap-generator.ts     # text → rhythmic notes (lead-in, per-difficulty)
  feedback-layer.ts        # keyboard + particles + approach rings + stats
  approach-ring-system.ts  # osu!/Stepmania-style approach rings
  particle-system.ts       # canvas particles, ripples, screen shake, glow
  svg-keyboard.ts          # SVG keyboard renderer
  keyboard-layout.ts       # QWERTY layout + key normalization
  debug-plugin.ts          # dev-only contract validator (no UI by default)
  types.ts                 # shared types, theme, timing windows
```

---

## Conventions

### Coding style

- One responsibility per module/function
- Annotate logic and purpose — another agent should continue without you
- Match existing indentation (2 spaces), naming, and comment style
- Prefer `readonly` for immutable fields; defensive-copy inputs

### Pipeline order is sacred

The wiring order in `createSession()` is load-bearing. Never reorder:

1. `new FeedbackLayer(...)` — constructed, NOT started
2. `new BeatClockJudge(...)` — created from the beat-map
3. `feedback.setJudge(judge)` — approach rings + indicator wired
4. `judge.setStartTime(now)` — timing baseline before keys can arrive
5. `feedback.start()` — animation begins (safe: judge exists)
6. `normBus.start(); judge.attach(normBus); rawBus.start()` — events flow

Starting animation before `setJudge` was the root cause of several demo bugs. Keep the facade as the safe path.

### Character order is sacred

`BeatMapGenerator` never reorders or drops characters — it's a typing game. Difficulty scaling is timing windows, not content mutation. (The old hand-alternation shuffle and note-doubling were removed for exactly this reason.)

### Timing model

- All timestamps captured with `performance.now()` at the raw event source
- `judge.setStartTime(now)` anchors song time; `getSongTime()` = `now - startTime`
- Delta = `songTime - note.time`
- Case-insensitive comparison everywhere (`toLowerCase()` both sides)

### The "announce and hope" rule

Never report a fix as live until the **served bundle** proves it. After `git push`, verify at:

```
https://raw.githubusercontent.com/ahrazzle/typejoy/main/dist/bundle.js
```

(grep the exact string you shipped, or check the count of a marker symbol). Local source ≠ what the browser loads.

---

## Pull request checklist

- [ ] Full test suite passes (`npm test`)
- [ ] Type-check clean (`npm run typecheck`)
- [ ] Bundle rebuilt (`npx esbuild ...`)
- [ ] Served bundle verified after push (raw.githubusercontent URL)
- [ ] Docs updated if the public API changed (`README.md`, `docs/`)

---

## Repository layout

```
README.md              # quickstart + architecture
docs/
  PLUGIN_GUIDE.md      # building games on the framework
  API_REFERENCE.md     # every exported class/method/type
  EXAMPLE_PLUGIN.md    # full walkthrough: Particle Pop
  CONTRIBUTING.md      # this file
demo.html              # the reference demo (also the test harness)
src/                   # framework source
test/                  # test suites
dist/bundle.js         # built bundle (committed for GitHub Pages)
```
