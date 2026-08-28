# Example Plugin — `DebugPlugin`, the Contract Validator

`src/debug-plugin.ts` ships a full `GamePlugin` implementation whose purpose is **not entertainment — it's validation**. It's the first plugin ever built on the framework: the moment it ran end-to-end with a real beat-map flowing through the bus to the feedback layer, the plugin contract was proven. Any team building a real game can use it as the reference for "what a correct plugin looks like" and as a scaffolding template.

---

## What it does

Three pieces of deliberately simple visual state, driven entirely by the `GamePlugin` callbacks:

| Visual | Driven by | What it shows |
|---|---|---|
| **Combo circle** | `onHit` / `onCombo` | A centered circle that scales with the current combo (`scale = 1 + min(combo × 0.02, 0.5)`) and recolors to the last judgment (`perfect` cyan / `great` green / `good` yellow / `miss` red). |
| **Progress bar** | `onHit` / `onNoteStale` | A bar that fills with resolved notes: `progress / totalNotes`, colored cyan→green. |
| **Judgment log** | every callback | A scrolling monospace feed of the last 6 events — HIT, MISS, STALE, COMBO, STREAK THRESHOLD, SONG COMPLETE. |

It also tallies `{ perfect, great, good, miss }` counts (fed by `onHit`, `onMiss`, and `onNoteStale`) and prints a final line in `onGameEnd`/`onSongComplete` with score, accuracy, and max combo.

### Why it's called a *validator*

It exercises **every** `GamePlugin` method meaningfully. If all nine methods are producing visible output, then:

1. the input pipeline captured and normalized keystrokes,
2. the judge classified timing and advanced the cursor,
3. the host fan-out (PluginHooks → plugin + feedback layer) is wired correctly,
4. stale-note detection works (the tick loop reaches `onNoteStale`), and
5. song completion reaches `onSongComplete`/`onGameEnd`.

That's the whole contract, end to end.

---

## How it's wired in demo.html

The canonical host pattern. Read `demo.html`'s `startGame()` for the full code; the essential wiring:

```js
import { RawBus, NormalizedBus, BeatClockJudge, StaticBeatMap,
         BeatMapGenerator, FeedbackLayer, DebugPlugin } from './dist/game.js?v=6';

const stage = document.getElementById('stage');
const feedbackLayer = new FeedbackLayer({ container: stage, width: 900, height: 320 });

// A fresh DebugPlugin per game, so one session can't leak into the next.
const debugPlugin = new DebugPlugin();
debugPlugin.setFeedbackLayer(feedbackLayer);   // must happen before onGameStart
feedbackLayer.resetStats();

// Build the beat-map from the user's content/BPM/difficulty.
const notes = new BeatMapGenerator().generate(content, { bpm, difficulty });
const beatMap = new StaticBeatMap(notes);

// Build the pipeline.
const rawBus = new RawBus(window);
const normBus = new NormalizedBus(rawBus);
const judge = new BeatClockJudge(beatMap, { difficulty }, {
  onHit: (event) => {
    debugPlugin.onHit(event.judgment, event.key, event.delta);
    feedbackLayer.renderHit(event.judgment, event.key, event.delta);
    feedbackLayer.markNoteJudged(event.note, event.judgment);
  },
  onMiss: (key, expectedKey) => {
    debugPlugin.onMiss(key, expectedKey);
    feedbackLayer.renderMiss(key, expectedKey);
  },
  onNoteStale: (note) => {
    debugPlugin.onNoteStale(note);
    feedbackLayer.renderStale(note);
    feedbackLayer.markNoteJudged(note, 'miss');
  },
  onCombo: (count, multiplier) => {
    debugPlugin.onCombo(count, multiplier);
    feedbackLayer.renderCombo(count, multiplier);
  },
  onStreakThreshold: (count) => debugPlugin.onStreakThreshold(count),
  onWrongKey: (key, expectedKey) => feedbackLayer.renderMiss(key, expectedKey),
});

// Order matters: start time BEFORE the bus listens.
const startTime = performance.now();
judge.setStartTime(startTime);
normBus.start();
judge.attach(normBus);
rawBus.start();                 // RawBus starts LAST

feedbackLayer.setJudge(judge);
feedbackLayer.setPreemptTime(1500);
feedbackLayer.reset();
feedbackLayer.start();

debugPlugin.onGameStart({
  title: content, artist: 'Typejoy', bpm, difficulty,
  notes: beatMap.notes,
  timingWindows: { perfect: 150, great: 200, good: 300 },
  nudgeEnabled: true,
  accessibility: { highContrast: false, oneHandedMode: false,
    timingWindowScale: 1.0, announceCombos: true,
    announceProgress: true, reducedMotion: false },
});

// Tick loop drives stale detection and completion.
const tickHandle = setInterval(() => {
  judge.tick();
  if (judge.state.isComplete) endGame();
}, 50);
```

On teardown (`endGame`), the demo stops the buses **first** (`rawBus.stop()`, `normBus.stop()`, `clearInterval`), `judge.detach()`s, computes `feedbackLayer.getAccuracy()`/`getRanking()` for the results overlay, calls `debugPlugin.onSongComplete(results)` then `debugPlugin.onGameEnd(results)`, and finally `feedbackLayer.stop()`.

### Debug UI is off by default

`DebugPlugin` has a private `showDebugUI = false` flag. With it false (the shipped default), the plugin still tracks state and logs internally, but **creates no visible DOM** — the kids' game doesn't show debug chrome. Flip it to `true` in `src/debug-plugin.ts` (or expose it) during development to see the circle, progress bar, and log feed rendered as absolutely-positioned elements inside the feedback layer's container.

---

## How a real game differs

`DebugPlugin` is a skeleton with the minimum viable rendering. A real game (like the Word Racer in [PLUGIN_DEVELOPMENT.md](../PLUGIN_DEVELOPMENT.md#7-worked-example-the-word-racer-plugin)) changes five things:

1. **A real canvas, not DOM divs.** `DebugPlugin.getCanvasContext()` returns `null` because its UI is DOM-based (and hidden by default). A real game creates its own `<canvas>` in `onGameStart`, mounts it in the feedback layer's container, and returns it from `getCanvasContext()` — giving you full per-frame drawing control.
2. **Game state that means something.** Where DebugPlugin just tallies, a real plugin turns judgments into gameplay: car speed, score popups, falling-note positions, health, or level progression. The callbacks are the same; the interpretation is yours.
3. **`onGameStart(config)` reads the config.** Real games parse `config.notes` (and `config.bpm`, `config.difficulty`) to lay out their world (e.g. spacing falling notes by `note.time`). DebugPlugin only reads `config.notes.length` for the progress bar.
4. **Own render loop with its own cleanup.** DebugPlugin's loop is a single `requestAnimationFrame` guarded by `destroy()`. A real plugin needs the same discipline — cancel the frame in `onSongComplete`/`onGameEnd`, remove its canvas, and null references so replays don't accumulate DOM or leaked frames.
5. **Results that matter.** DebugPlugin just logs `onSongComplete`. A real game shows a win/lose state, high scores, or stars — using the `GameResults` object (score, maxCombo, accuracy, judgments) it's handed.

Everything else — keystroke capture, normalization, timing, combo math, approach rings, particles, keyboard physics — is already built. That's the entire point of the framework: **your job is the five deltas above, not the pipeline.**
