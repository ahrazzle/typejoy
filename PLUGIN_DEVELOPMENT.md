# Plugin Development — The GamePlugin Contract

> This is the one document a team needs to build a game on Typejoy. Read it top to bottom once, then keep the `GamePlugin` interface and the Pitfalls section open while you code. If you can build the **Word Racer** example at the end of this document, you understand the framework.

**You write one thing: a class implementing `GamePlugin`.** The framework handles keystroke capture, normalization, timing judgment, combo math, and the shared feedback effects. Your plugin receives events and renders its own game world.

---

## 1. The contract at a glance

```ts
// from src/types.ts (re-exported by src/index.ts)
export interface GamePlugin {
  /** Called once when a game session begins */
  onGameStart(config: GameConfig): void;
  /** Called when the game session ends (quit, timeout, etc.) */
  onGameEnd(results: GameResults): void;
  /** Called when the player hits the right key within a timing window */
  onHit(judgment: Judgment, key: string, delta: number): void;
  /** Called when the player presses the wrong key */
  onMiss(key: string, expectedKey: string): void;
  /** Called when a note passes its window without being hit */
  onNoteStale(note: Note): void;
  /** Called when the combo counter updates */
  onCombo(count: number, multiplier: number): void;
  /** Called when the combo crosses a milestone threshold */
  onStreakThreshold(count: number): void;
  /** Called when all notes have been resolved */
  onSongComplete(results: GameResults): void;
  /** Returns the canvas element for the plugin's visual output (if any) */
  getCanvasContext(): HTMLCanvasElement | null;
  /** Returns the FeedbackLayer this plugin renders feedback through */
  getFeedbackLayer(): FeedbackLayer;
}
```

Every method is **optional to call but mandatory to implement** — the interface requires all of them. If your game doesn't care about, say, `onStreakThreshold`, implement it as a no-op (or throw-only in debug). The host calls them in the order described below.

The **host** is whatever wires the framework together (see `demo.html`). It constructs the buses and judge, and *fans judgments out* to your plugin and to the `FeedbackLayer`. You don't wire the bus; you get events. The "judge-facing" hooks your host can wire are the `PluginHooks` interface (see [API_REFERENCE.md](./API_REFERENCE.md#types) and the demo).

---

## 2. The event flow

```
  player presses a key
        │
        ▼
┌────────────────┐  keydown captured in the DOM listener itself.
│  RawBus        │  timestamp = performance.now() AT THIS MOMENT (absolute clock,
│                │  same clock as your host's startTime — NOT relative to anything).
└────────────────┘
        │  RawKeyEvent { key, code, timestamp, modifiers{shift,ctrl,alt,meta,capsLock}, repeat }
        ▼
┌────────────────┐  shift/caps-lock/layout normalization. Converts the raw event to a
│ NormalizedBus  │  single char. Filters out key-repeat auto-repeats. Only genuine
│                │  presses become `phase: 'press'` events.
└────────────────┘
        │  NormalizedEvent { char, raw, phase }
        ▼
┌────────────────┐  judge.onChar(evt):
│ BeatClockJudge │  1. expects a note (cursor points at it)
│                │  2. key mismatch  → onWrongKey hook (wrong keys are IGNORED, no combo break)
│                │  3. too early     → silently ignored (lead-in protection)
│                │  4. key matches   → delta = (raw.timestamp − startTime) − note.time
│                │     |delta| ≤ perfect → 'perfect'   |delta| ≤ great → 'great'
│                │     |delta| ≤ good    → 'good'      otherwise       → miss
│                │  5. advance cursor, update combo/multiplier
└────────────────┘
        │
        ▼
┌────────────────┐  Your host's PluginHooks object routes to:
│   PluginHooks  │    yourGamePlugin.onHit(...)   +  feedbackLayer.renderHit(...)
│  (host wired)  │    yourGamePlugin.onCombo(...) +  feedbackLayer.renderCombo(...)
└────────────────┘    etc. (the demo shows every route)
```

Separately, the host runs a **tick loop** (`setInterval`/`requestAnimationFrame` calling `judge.tick()`) which detects **stale notes** — notes whose window has fully passed without being hit. `tick()` advances the cursor past them, resets the combo, and fires `onNoteStale`.

### The two callback surfaces

There are **two** similar-looking interfaces. Don't confuse them:

| Interface | Who implements it | How it's called |
|---|---|---|
| `GamePlugin` | **You** — your game class | The **host** calls these on your object (`plugin.onHit(...)`, `plugin.onSongComplete(...)`, …) |
| `PluginHooks` | Your **host's** wiring | Passed into `new BeatClockJudge(beatMap, config, hooks)` — the **judge** calls these internally |

In the demo, `debugPlugin` (a `GamePlugin`) and `feedbackLayer` are both fed from the same judge `PluginHooks` object. When you build your own game, you do the same: one hooks object fans each event to your plugin **and** to the feedback layer.

---

## 3. Timing windows (per difficulty)

`BeatClockJudge` classifies a hit by `|delta|` against three windows. The headline "tightness" number for each difficulty is the **perfect** window:

| Difficulty | perfect (±) | great (±) | good (±) |
|---|---|---|---|
| `easy` | **500 ms** | 700 ms | 1000 ms |
| `medium` | **300 ms** | 500 ms | 700 ms |
| `hard` | **150 ms** | 300 ms | 500 ms |
| `expert` | **80 ms** | 150 ms | 250 ms |

> These come from `TIMING_WINDOWS` in `src/types.ts`. The `BeatMapGenerator` stamps each generated note with the perfect-window value as its `note.window`. The judge lets you override any window per-game via `JudgeConfig.windows` — e.g. kids' "relaxed" mode can widen `good` further. The `AccessibilityConfig.timingWindowScale` is the intended way to make a fixed beat-map more forgiving without touching the map.

**miss** = correct key, but `|delta|` exceeds `good` (you were just too early or too late), *or* the note went stale. A miss resets the combo to 0.

---

## 4. Combo & multiplier

Multiplier is derived from the current combo (osu!-style, computed in `BeatClockJudge.computeMultiplier`):

| Combo | Multiplier |
|---|---|
| 0–9 | ×1 |
| 10–24 | ×2 |
| 25–49 | ×4 |
| 50+ | ×8 |

`onCombo(count, multiplier)` fires after every hit (and after a miss with `count = 0, multiplier = 1`). `onStreakThreshold(count)` fires **once per threshold crossing** at 10, 25, and 50 (configurable via `JudgeConfig.comboThresholds`).

---

## 5. Judgment color coding

The framework's canonical judgment colors (they are also `DEFAULT_THEME.colors`):

| Judgment | Color | Hex |
|---|---|---|
| perfect | cyan | `#00e5ff` |
| great | green | `#76ff03` |
| good | yellow | `#ffea00` |
| miss | red | `#ff1744` |

Use these in your plugin's own rendering so feedback stays consistent with the shared layer (the approach rings, key highlights, and debug UI all use them).

---

## 6. How plugins render

Two ways, and the contract says exactly which to use for what:

### `getCanvasContext(): HTMLCanvasElement | null` — your own game world

Create a `<canvas>` (typically in `onGameStart`), mount it inside the feedback layer's container (`getFeedbackLayer().getContainer()`), and return it from `getCanvasContext()`. This canvas is **yours** — draw your game here (the car, the falling notes, the track, the words). Set `pointer-events: none` on it so keystrokes pass through. The host may call `getCanvasContext()` to find your canvas; returning `null` is fine if your game is DOM-based instead.

### `getFeedbackLayer(): FeedbackLayer` — the shared feedback surface

Everything that is *framework feel* goes through the `FeedbackLayer`:

```ts
feedbackLayer.renderHit('perfect', key, delta);   // key depression + particles + ripple
feedbackLayer.renderMiss(key, expectedKey);        // gentle red shake on wrong keys
feedbackLayer.renderCombo(count, multiplier);      // combo counter display
feedbackLayer.renderStale(note);                   // (currently a no-op — nudges are for the expected key)
feedbackLayer.pulseKey(key, bpm);                  // beat-synced key pulse
feedbackLayer.announce('25 combo!');               // ARIA live-region announcement
```

**Never reach into the feedback layer's internals.** It owns the SVG keyboard, the particle canvas, and the approach rings. If you find yourself calling `getKeyboardElement()` or touching `getCanvasOverlay()`'s `2d` context, stop — you want the public render methods above, or your own canvas.

---

## 7. Worked example: the "Word Racer" plugin

A complete, working `GamePlugin` built step by step. The premise: your typing powers a car along a track. **Perfect/great hits accelerate it, a miss slows it down, and the race ends when `onSongComplete` fires.** The shared feedback (key depressions, particles, combo counter) comes free from the `FeedbackLayer`.

### Step 1 — The skeleton and state

```ts
import type { GamePlugin, GameConfig, GameResults, Judgment, Note } from './src/types.js';
// The contract's getFeedbackLayer() is typed as the *narrow* FeedbackLayer interface
// (render methods only). To call announce()/markNoteJudged()/setHighContrast() etc.,
// hold the concrete FeedbackLayer *class* — it satisfies the interface, so the class
// still satisfies `implements GamePlugin`.
import { FeedbackLayer } from './src/feedback-layer.js';

export class WordRacerPlugin implements GamePlugin {
  private feedbackLayer: FeedbackLayer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  // Car state
  private carX = 0;          // 0 (start) → 1 (finish line)
  private speed = 0;         // px-per-frame accumulator
  private finished = false;
  private animationId: number | null = null;
```

### Step 2 — Lifecycle: start, end, complete

```ts
  onGameStart(config: GameConfig): void {
    this.carX = 0;
    this.speed = 0;
    this.finished = false;
    this.ensureCanvas();          // create + mount our own canvas
    this.startRenderLoop();       // rAF loop: update() then render()
  }

  onGameEnd(results: GameResults): void {
    // Host is tearing the session down (quit / timeout / restart).
    this.finished = true;
    this.stopRenderLoop();
  }

  onSongComplete(results: GameResults): void {
    // All notes resolved — the race is over. Snap to the finish line.
    this.finished = true;
    this.carX = 1;
    this.stopRenderLoop();
  }
```

### Step 3 — The fun part: judgment-driven car physics

```ts
  onHit(judgment: Judgment, key: string, delta: number): void {
    // Perfect/great → stomp the accelerator. Good → keep pace.
    this.speed += judgment === 'perfect' || judgment === 'great' ? 2.5 : 1.0;
    // Shared juice is the feedback layer's job, not ours:
    this.feedbackLayer?.renderHit(judgment, key, delta);
  }

  onMiss(key: string, expectedKey: string): void {
    // A wrong key (or a correct key at the wrong time) — hit the brakes.
    this.speed = Math.max(0, this.speed - 4);
    this.feedbackLayer?.renderMiss(key, expectedKey);
  }

  onNoteStale(note: Note): void {
    // We slept on a note; coast down a little.
    this.speed = Math.max(0, this.speed - 2);
  }

  onCombo(count: number, multiplier: number): void {
    // Multiplier could juice the car; for now just surface it:
    this.feedbackLayer?.renderCombo(count, multiplier);
  }

  onStreakThreshold(count: number): void {
    // Milestone reached — a game with audio could play a sting here.
    this.feedbackLayer?.announce(`${count} combo!`);
  }
```

### Step 4 — The two accessors (mandatory)

```ts
  getCanvasContext(): HTMLCanvasElement | null {
    return this.canvas;            // our own racing canvas
  }

  getFeedbackLayer(): FeedbackLayer {
    if (!this.feedbackLayer) {
      throw new Error('setFeedbackLayer() must be called before the game starts');
    }
    return this.feedbackLayer;
  }

  // Integration helper the host calls once, before onGameStart.
  setFeedbackLayer(layer: FeedbackLayer): void {
    this.feedbackLayer = layer;
  }
```

### Step 5 — Canvas setup and the render loop

```ts
  private ensureCanvas(): void {
    if (this.canvas) return;
    const layer = this.getFeedbackLayer();
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';  // keystrokes must pass through
    layer.getContainer().appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  private startRenderLoop(): void {
    const loop = () => {
      if (this.finished) return;
      this.update();
      this.render();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  private stopRenderLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private update(): void {
    this.speed *= 0.98;                                  // friction
    this.carX = Math.min(1, this.carX + this.speed * 0.002); // forward progress
  }

  private render(): void {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.clientWidth || 900;
    const h = this.canvas.clientHeight || 320;
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // Track
    ctx.fillStyle = '#2a2a44';
    ctx.fillRect(0, h * 0.55, w, 6);
    // Finish line
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w - 20, h * 0.55 - 10, 8, 26);
    // Car (cyan, matching the perfect color family)
    const carY = h * 0.55 - 14;
    const carX = 24 + this.carX * (w - 80);
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(carX - 16, carY - 10, 32, 20);
    ctx.fillStyle = '#0d0d1a';
    ctx.beginPath();
    ctx.arc(carX, carY, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

### Step 6 — Wire it like the demo

Copy the wiring shape from `demo.html`'s `startGame()` and swap the plugin. The pipeline order **matters** (see Pitfalls):

```ts
import { RawBus, NormalizedBus, BeatClockJudge, StaticBeatMap,
         BeatMapGenerator, FeedbackLayer } from './dist/game.js';
import { WordRacerPlugin } from './WordRacerPlugin.js';

const stage = document.getElementById('stage');
const feedbackLayer = new FeedbackLayer({ container: stage, width: 900, height: 320 });

const racer = new WordRacerPlugin();
racer.setFeedbackLayer(feedbackLayer);

const notes = new BeatMapGenerator().generate('hello world', { bpm: 60, difficulty: 'easy' });
const beatMap = new StaticBeatMap(notes);

const rawBus = new RawBus(window);
const normBus = new NormalizedBus(rawBus);

const judge = new BeatClockJudge(beatMap, { difficulty: 'easy' }, {
  onHit: (e) => { racer.onHit(e.judgment, e.key, e.delta);
                  feedbackLayer.renderHit(e.judgment, e.key, e.delta);
                  feedbackLayer.markNoteJudged(e.note, e.judgment); },
  onMiss: (key, expectedKey) => { racer.onMiss(key, expectedKey);
                                  feedbackLayer.renderMiss(key, expectedKey); },
  onNoteStale: (note) => { racer.onNoteStale(note);
                           feedbackLayer.renderStale(note); },
  onCombo: (count, mult) => { racer.onCombo(count, mult);
                              feedbackLayer.renderCombo(count, mult); },
  onStreakThreshold: (count) => racer.onStreakThreshold(count),
  onWrongKey: (key, expectedKey) => feedbackLayer.renderMiss(key, expectedKey),
});

// ── CRITICAL ORDER ──────────────────────────────────────────────
const startTime = performance.now();
judge.setStartTime(startTime);   // 1. before the bus listens — see Pitfalls
normBus.start();                 // 2. NormalizedBus first
judge.attach(normBus);           // 3. judge subscribes
rawBus.start();                  // 4. RawBus LAST — only now can keys be judged
// ────────────────────────────────────────────────────────────────

feedbackLayer.setJudge(judge);                       // expected-key indicator + rings
feedbackLayer.setPreemptTime(1500);                  // easy = 1500ms rings
feedbackLayer.reset();
feedbackLayer.start();

racer.onGameStart({
  title: 'hello world', artist: 'Typejoy', bpm: 60, difficulty: 'easy',
  notes: beatMap.notes,
  timingWindows: { perfect: 500, great: 700, good: 1000 },
  nudgeEnabled: true,
  accessibility: { highContrast: false, oneHandedMode: false,
    timingWindowScale: 1.0, announceCombos: true,
    announceProgress: true, reducedMotion: false },
});

// stale-note tick loop — end the game when every note is resolved
const tickHandle = setInterval(() => {
  judge.tick();
  if (judge.state.isComplete) { endGame(); }
}, 50);

function endGame() {
  rawBus.stop(); normBus.stop(); judge.detach(); clearInterval(tickHandle);
  const results: GameResults = {
    title: 'hello world', artist: 'Typejoy', score: 100,
    maxCombo: judge.state.maxCombo, totalNotes: beatMap.length,
    judgments: { perfect: 0, great: 0, good: 0, miss: 0 },
    accuracy: feedbackLayer.getAccuracy(), passed: true, duration: 0,
  };
  racer.onSongComplete(results);
  racer.onGameEnd(results);
  feedbackLayer.stop();
}
```

That's it — a complete rhythm game on the framework. `racer.onGameEnd` stops the loop; the feedback layer keeps showing the last combo state until the host resets.

---

## 8. Best practices

1. **Always use `performance.now()`-based timestamps.** The judge's `delta` is computed from `RawBus`'s `performance.now()` stamp and your `setStartTime` value. Never `Date.now()` (wall-clock) and never guess times in your plugin — read `judge.state.cursor`/`getSongTime()` through the host if you need the current position.
2. **Never mutate the beat-map's notes.** `StaticBeatMap` defensively copies and `Object.freeze`s its array specifically so nobody corrupts cursor logic. Treat `config.notes` and `beatMap.notes` as read-only.
3. **Plugins never touch the DOM directly — except their own canvas.** Use `feedbackLayer.renderHit/renderMiss/renderCombo/announce/pulseKey` for shared feedback. Your own `<canvas>` (returned by `getCanvasContext()`) is the one place you may create DOM.
4. **Lower-case all key lookups.** Keys in the beat-map are lowercase (e.g. `'a'`), keyboard ids are lowercase (`'space'`, `'arrowup'`), and the judge compares case-insensitively so a kid with caps lock on still scores. If you look up a key element or compare keys, `toLowerCase()` first.
5. **Map `' '` → `'space'` for keyboard lookups.** In the beat-map a space note has `key: ' '`; in the keyboard layout the key id is `'space'`. `normalizeKey()` (exported from `src/index.ts`) does this alias mapping plus `arrowup`→`arrow-up`, `;`→`semicolon`, etc. — use it whenever you translate a game key into a keyboard id.
6. **Return early from render loops when finished.** Guard your `requestAnimationFrame` loop with a `finished` flag so `onSongComplete`/`onGameEnd` actually stops work.
7. **Throw a clear error in `getFeedbackLayer()` if the layer wasn't injected** — it turns a silent `undefined` crash into an actionable one, exactly like `DebugPlugin` does.

---

## 9. Pitfalls (read before you ship)

1. **`setStartTime()` must be called before the bus starts.** If the `RawBus` starts listening before the judge has its start time, early keystrokes produce a wrong (or negative) `getSongTime()`, and the first notes can be misjudged or silently dropped. The demo's order is: `setStartTime(startTime)` → `normBus.start()` → `judge.attach(normBus)` → `rawBus.start()`. Never start the bus first.
2. **Wrong keys fire `onWrongKey`, not `onMiss`.** The judge *silently ignores* a mismatched key: no judgment, no cursor advance, no combo break. Only your host's `onWrongKey` hook fires (in the demo it renders a gentle red shake via `feedbackLayer.renderMiss`). If your plugin wants to react to mistypes, the host must forward `onWrongKey` to you — the `GamePlugin` interface has no `onWrongKey`, by design.
3. **Keydown timestamps are absolute `performance.now()` values; `delta = (timestamp − startTime) − note.time`.** Do not assume `delta` is relative to anything but the song start. A note with `time: 1500` hit at exactly `startTime + 1500` has `delta = 0` (perfect). This is why `startTime` must be captured once, at game start, and shared with the judge.
4. **Stale notes advance the cursor.** When `judge.tick()` detects a note past its window, it advances the cursor, resets the combo, and fires `onNoteStale` — your `onMiss` is *not* called for stale notes. If your game shows the player's current letter (like the demo's "Type This" row), drive it from `judge.state.cursor`, not from your own idea of "the note I'm waiting on", or your UI will fall out of sync after a stale note.
5. **The `GamePlugin.onMiss` signature is `(key, expectedKey)` — no delta, no note.** The judge-facing `PluginHooks.onMiss` is `(key, expectedKey, delta, note?)`. If you need the delta of a miss, read it from the host's hook, not from your plugin method.
6. **Restart hygiene.** The demo creates a fresh judge, plugin, and buses per game and `detach()`/`stop()`s them on teardown. Reusing a judge across games without `reset()` (or `detach()` + `attach()`) leaks subscriptions and stale cursors. `BeatClockJudge.reset()` zeroes combo/cursor but does **not** re-arm a stopped bus.
