# Typejoy

A rhythm-typing game framework for kids (ages 7–10) — an open-source TypeScript engine for building games where your **keystrokes are the instrument**. Modeled on the timing-and-flow design of Guitar Hero, osu!, and Beat Saber, but instead of a plastic guitar or falling notes, players type highlighted keys on a real keyboard to the beat of a song. The framework ships the input pipeline, the judgment engine, and the feedback rendering ("the feel"); your game — a plugin — supplies the visual world and the rules.

---

## What you can build

Any game where typing to a rhythm is the core mechanic, for example:

- **Word Racer** — a car accelerates on each perfect hit and crawls when you miss.
- **Falling-notes typing** — osu!-style notes fall onto keys; hit them exactly when they land.
- **Beat-match sentences** — type the lyric as the backing track plays; timing accuracy is your score.

You don't touch the input pipeline, the timing windows, or the juice (particles, screen shake, approach rings). You implement one interface — `GamePlugin` — and the framework does the rest.

---

## Architecture

Three layers, each decoupled from the one above it:

```
┌─────────────────────────────────────────────────────────────┐
│  GAME LAYER    your GamePlugin (implements the contract)     │
│                onHit / onMiss / onCombo / onSongComplete     │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  INPUT LAYER   RawBus → NormalizedBus → BeatClockJudge       │
│                (capture)   (normalize)    (judge + hooks)    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  FEEDBACK LAYER  FeedbackLayer                               │
│                  ├ SVG keyboard (SVGKeyboardRenderer)        │
│                  ├ canvas particles (ParticleSystem)         │
│                  └ approach rings (ApproachRingSystem)       │
└─────────────────────────────────────────────────────────────┘
```

### 1. Input layer

| Stage | Class | Job |
|---|---|---|
| Capture | `RawBus` | Listens to `keydown`/`keyup` on `window` (capture phase) and stamps each event with `performance.now()` **inside the DOM handler** — the timestamp is taken at the source, before any downstream processing. |
| Normalize | `NormalizedBus` | Turns a `RawKeyEvent` into a normalized `char`, handling shift, caps lock, keyboard layout, and filtering out key-repeat auto-repeat. Only real presses flow through. |
| Judge | `BeatClockJudge` | Compares each normalized char against the beat-map's expected note, classifies the timing (`perfect`/`great`/`good`/`miss`), tracks combo and multiplier, detects stale notes, and dispatches to your `PluginHooks`. |

### 2. Feedback layer

The `FeedbackLayer` is where game *feel* lives. It owns:

- **`SVGKeyboardRenderer`** — a crisp, ARIA-labeled SVG QWERTY keyboard with spring-physics key depression, beat pulse, shake, nudge glow, and highlights.
- **`ParticleSystem`** — a `pointer-events: none` canvas overlay for particle bursts, ripples, specular sweeps, screen shake, and screen-edge glow.
- **`ApproachRingSystem`** — osu!-style shrinking rings on upcoming keys so kids can *read* what's coming next.

Your plugin never draws directly onto this layer's internals — it calls the `FeedbackLayer` public API (`renderHit`, `renderMiss`, `renderCombo`, …) and the layer decides how it looks.

### 3. Game layer

`GamePlugin` — a single TypeScript interface your game implements. The framework (your host wiring, see `demo.html`) calls you with the `GameConfig`, hands you judgments and combo updates, and expects you to render through `getCanvasContext()` (your own canvas) and `getFeedbackLayer()` (shared feedback).

**→ Read [PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md) — the plugin contract, a complete worked example, and the pitfalls. This is the document that gets you shipping.**

---

## Quick start

```bash
npm install          # install dev deps (typescript, tsx, esbuild)
npm test             # run the event-bus test suite (RawBus → Judge → hooks)
npm run typecheck    # tsc --noEmit — strict, catches unused vars/params
npm run build        # esbuild src/index.ts → dist/bundle.js (ESM bundle)
```

### Run the demo

```bash
# Option A — open directly
open demo.html

# Option B — serve locally (no deps needed)
python3 -m http.server 8000
# then visit http://localhost:8000/demo.html
```

The demo wires the full pipeline end-to-end: type a phrase, pick a BPM and difficulty, hit **▶ Start Game**, and type the highlighted keys to the beat. `demo.html` is also the canonical reference for how a host wires the framework — copy its `startGame()` wiring.

### Deploy to GitHub Pages

`dist/` is committed to the repo, so the pages site works as soon as you push. See [CONTRIBUTING.md](./CONTRIBUTING.md#deploying-to-github-pages).

---

## Directory structure

```
src/
├── index.ts               # Barrel — re-exports the entire public API from one module
├── types.ts               # All shared types + the GamePlugin contract + ThemeDescriptor + DEFAULT_THEME
├── RawBus.ts              # Captures keydown/keyup with performance.now() at the source
├── NormalizedBus.ts       # Normalizes raw events (shift/caps/layout) → clean chars; filters repeats
├── BeatClockJudge.ts      # Judgment engine: timing windows, combo, multiplier, stale detection, hooks dispatch
├── BeatMap.ts             # StaticBeatMap — read-only, defensive-copy note container
├── beatmap-generator.ts   # BeatMapGenerator — turns typing content into a rhythmic Note[] at a given BPM
├── PluginHooks.ts         # PluginRegistry (multi-plugin fan-out) + a console-logging DebugPlugin
├── debug-plugin.ts        # DebugPlugin — a full GamePlugin implementation (the contract validator)
├── feedback-layer.ts      # FeedbackLayer — the shared feedback surface (keyboard + particles + rings)
├── svg-keyboard.ts        # SVGKeyboardRenderer — ARIA-labeled SVG keyboard with spring-key physics
├── particle-system.ts     # ParticleSystem — canvas bursts, ripples, shake, edge glow, specular sweeps
├── approach-ring-system.ts# ApproachRingSystem — osu!-style shrinking rings on upcoming keys
└── keyboard-layout.ts     # QWERTY_LAYOUT key definitions + normalizeKey() alias mapping

test/
├── eventbus.test.ts       # npm test — RawBus → NormalizedBus → Judge → hooks (46 assertions)
├── beatmap-generator.test.ts  # generator timing/density tests (51 assertions)
└── integration.test.ts    # full pipeline exercised with injected events

demo.html                  # The end-to-end host: wiring, controls, results overlay, onboarding
index.html                 # GitHub Pages landing page
dist/                      # Committed build output (bundle.js / game.js + tsc .js/.d.ts)
```

---

## Documentation index

| Document | What it's for |
|---|---|
| [PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md) | **Start here as a game builder.** The `GamePlugin` contract, event flow, timing/multiplier tables, a complete "Word Racer" plugin built step by step, best practices, and pitfalls. |
| [API_REFERENCE.md](./API_REFERENCE.md) | Every exported class, method signature, type, and option, straight from `src/`. |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Tests, build, GitHub Pages deploy, code style, and testing conventions. |
| [docs/EXAMPLE_PLUGIN.md](./docs/EXAMPLE_PLUGIN.md) | A walkthrough of `DebugPlugin` — the shipped reference implementation. |

---

## License

Proprietary / internal — see the repository owner. This is a framework handoff for teams building on top of it.
