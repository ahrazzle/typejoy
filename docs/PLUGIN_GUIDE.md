# Typejoy — Plugin Development Guide

Build a custom game on top of the Typejoy framework. You write a plugin that consumes judged events and renders your own scene; the framework handles the keyboard, timing, particles, approach rings, and stats.

---

## The 30-second version

```typescript
import { createSession, GamePlugin } from './dist/game.js';

// 1. Implement the plugin contract
const myGame: GamePlugin = {
  onGameStart(config) { /* init your scene */ },
  onHit(judgment, key, delta) { /* spawn an effect, move a character */ },
  onMiss(key, expectedKey) { /* react to wrong key */ },
  onCombo(count, multiplier) { /* escalate your visuals */ },
  onSongComplete(results) { /* show your end screen */ },
  getCanvasContext() { return myCanvas; },
  getFeedbackLayer() { return feedbackLayer; },
};

// 2. Create a session, passing hooks
const session = createSession({
  container: stage,
  content: 'hello world',
  bpm: 60,
  difficulty: 'easy',
  hooks: myGame, // your plugin IS the hooks object
});
```

---

## The GamePlugin contract

Every plugin implements (optionally) these hooks:

| Hook | Signature | When |
|---|---|---|
| `onGameStart` | `(config: GameConfig) => void` | Session starts — beat-map, BPM, difficulty known |
| `onGameEnd` | `(results: GameResults) => void` | Session ends |
| `onHit` | `(judgment, key, delta) => void` | Correct key within a timing window |
| `onMiss` | `(key, expectedKey) => void` | Correct key outside all windows (late/early) |
| `onWrongKey` | `(key, expectedKey) => void` | Wrong key pressed (doesn't break combo) |
| `onNoteStale` | `(note: Note) => void` | Note passed without being hit |
| `onCombo` | `(count, multiplier) => void` | Combo updated |
| `onComboBreak` | `(previousCount) => void` | Combo broken |
| `onStreakThreshold` | `(count) => void` | Combo crosses a threshold (10/25/50) |
| `onSongComplete` | `(results: GameResults) => void` | All notes resolved |

All hooks are optional. Implement only what your game needs.

### GameResults shape

```typescript
interface GameResults {
  title: string;
  artist: string;
  score: number;
  maxCombo: number;
  totalNotes: number;
  judgments: { perfect: number; great: number; good: number; miss: number };
  accuracy: number;   // 0..1 — Perfect=1, Great=0.75, Good=0.5, Miss=0
  passed: boolean;
  duration: number;
}
```

---

## Rendering your scene

You have two options:

### 1. DOM layer (simple)

Create your own DOM elements in `onGameStart` and append them to the feedback layer's container:

```typescript
onGameStart(config) {
  this.feedbackLayer = session.feedback; // from createSession
  this.container = this.feedbackLayer.getContainer();
  this.scoreEl = document.createElement('div');
  this.scoreEl.style.cssText = 'position:absolute;top:60px;right:16px;color:#fff;';
  this.container.appendChild(this.scoreEl);
}
```

### 2. Canvas layer (for particle-heavy scenes)

The feedback layer has a canvas overlay you can draw on:

```typescript
getCanvasContext() {
  return this.feedbackLayer.getCanvasOverlay();
}
```

Draw in a `requestAnimationFrame` loop you own. The keyboard and particles render on their own layers underneath — you draw on top.

---

## Approach rings

The framework renders approach rings that shrink toward each key as its note approaches (osu!/Stepmania-style). Rings:
- Spawn when a note is within the preempt time (1500ms easy → 350ms expert)
- Shrink from 4x key size to 1x at the hit moment
- Change color by proximity (white → cyan → green → yellow)
- Collapse on judgment — hit, miss, or stale — keeping them synced with your gameplay

You don't manage these. They're part of `FeedbackLayer`.

---

## Stats, accuracy, and ranking

The feedback layer tracks judgment counts and exposes:

```typescript
feedbackLayer.stats;          // { perfect, great, good, miss }
feedbackLayer.getAccuracy();  // 0..1 weighted average
feedbackLayer.getRanking();   // 'S' | 'A' | 'B' | 'C' | 'D' | 'F'
feedbackLayer.resetStats();   // clear for a new round
```

Ranking thresholds: S ≥ 95%, A ≥ 85%, B ≥ 70%, C ≥ 55%, D ≥ 40%, else F.

---

## Session lifecycle

### createSession()

```typescript
const session = createSession({
  container: HTMLElement,        // required
  content: string,               // required — text to type
  bpm?: number,                  // default 60
  difficulty?: Difficulty,       // default 'easy'
  hooks?: Partial<GamePlugin>,   // your plugin
  feedback?: Partial<FeedbackLayerOptions>, // width/height/theme
});
```

The wiring order is guaranteed safe:
1. Feedback layer constructed (no animation)
2. Judge created from beat-map
3. `feedback.setJudge(judge)` — approach rings + expected-key indicator wired
4. `judge.setStartTime(now)` — timing baseline before any key arrives
5. `feedback.start()` — animation loops begin
6. Bus chain attached — keydown events flow

### destroy()

```typescript
session.destroy();
```

Stops raw/normalized buses, detaches the judge, stops animation loops, and removes the keyboard DOM so a fresh session doesn't stack visuals.

---

## Advanced: manual wiring (no facade)

If you need finer control, wire components directly:

```typescript
import { RawBus, NormalizedBus, BeatClockJudge,
         BeatMapGenerator, StaticBeatMap, FeedbackLayer } from './dist/game.js';

const feedback = new FeedbackLayer({ container: stage, width: 900, height: 320 });

const notes = new BeatMapGenerator().generate(content, { bpm, difficulty });
const beatMap = new StaticBeatMap(notes);
const judge = new BeatClockJudge(beatMap, { difficulty }, {
  onHit: (e) => feedback.renderHit(e.judgment, e.key, e.delta),
  onMiss: (k, ek) => feedback.renderMiss(k, ek),
  onNoteStale: (n) => feedback.renderStale(n),
  onCombo: (c, m) => feedback.renderCombo(c, m),
});

// SAFE ORDER — do not start animation before judge is wired
feedback.setJudge(judge);
judge.setStartTime(performance.now());
feedback.start();

const raw = new RawBus(window);
const norm = new NormalizedBus(raw);
norm.start();
judge.attach(norm);
raw.start();
```

**Ordering pitfall:** `feedback.start()` before `feedback.setJudge(judge)` starts animation loops with no judge — approach rings crash or render nothing. The facade exists to prevent this; prefer it.

---

## Worked example: the "Word Racer" plugin

A complete, working `GamePlugin` built step by step. The premise: your typing powers a car along a track. **Perfect/great hits accelerate it, a miss slows it down, and the race ends when `onSongComplete` fires.** The shared feedback (key depressions, particles, combo counter) comes free from the `FeedbackLayer`.

### Step 1 — The skeleton and state

```ts
import type { GamePlugin, GameConfig, GameResults, Judgment, Note } from './dist/game.js';
// The contract's getFeedbackLayer() is typed as the *narrow* FeedbackLayer interface
// (render methods only). To call announce()/markNoteJudged()/setHighContrast() etc.,
// hold the concrete FeedbackLayer *class* — it satisfies the interface, so the class
// still satisfies `implements GamePlugin`.
import { FeedbackLayer } from './dist/game.js';

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

## Best practices

1. **Always use `performance.now()`-based timestamps.** The judge's `delta` is computed from `RawBus`'s `performance.now()` stamp and your `setStartTime` value. Never `Date.now()` (wall-clock) and never guess times in your plugin — read `judge.state.cursor`/`getSongTime()` through the host if you need the current position.
2. **Never mutate the beat-map's notes.** `StaticBeatMap` defensively copies and `Object.freeze`s its array specifically so nobody corrupts cursor logic. Treat `config.notes` and `beatMap.notes` as read-only.
3. **Plugins never touch the DOM directly — except their own canvas.** Use `feedbackLayer.renderHit/renderMiss/renderCombo/announce/pulseKey` for shared feedback. Your own `<canvas>` (returned by `getCanvasContext()`) is the one place you may create DOM.
4. **Lower-case all key lookups.** Keys in the beat-map are lowercase (e.g. `'a'`), keyboard ids are lowercase (`'space'`, `'arrowup'`), and the judge compares case-insensitively so a kid with caps lock on still scores. If you look up a key element or compare keys, `toLowerCase()` first.
5. **Map `' '` → `'space'` for keyboard lookups.** In the beat-map a space note has `key: ' '`; in the keyboard layout the key id is `'space'`. `normalizeKey()` (exported from `src/index.ts`) does this alias mapping plus `arrowup`→`arrow-up`, `;`→`semicolon`, etc. — use it whenever you translate a game key into a keyboard id.
6. **Return early from render loops when finished.** Guard your `requestAnimationFrame` loop with a `finished` flag so `onSongComplete`/`onGameEnd` actually stops work.
7. **Throw a clear error in `getFeedbackLayer()` if the layer wasn't injected** — it turns a silent `undefined` crash into an actionable one, exactly like `DebugPlugin` does.

---

## Pitfalls (read before you ship)

1. **`setStartTime()` must be called before the bus starts.** If the `RawBus` starts listening before the judge has its start time, early keystrokes produce a wrong (or negative) `getSongTime()`, and the first notes can be misjudged or silently dropped. The demo's order is: `setStartTime(startTime)` → `normBus.start()` → `judge.attach(normBus)` → `rawBus.start()`. Never start the bus first.
2. **Wrong keys fire `onWrongKey`, not `onMiss`.** The judge *silently ignores* a mismatched key: no judgment, no cursor advance, no combo break. Only your host's `onWrongKey` hook fires (in the demo it renders a gentle red shake via `feedbackLayer.renderMiss`). If your plugin wants to react to mistypes, the host must forward `onWrongKey` to you — the `GamePlugin` interface has no `onWrongKey`, by design.
3. **Keydown timestamps are absolute `performance.now()` values; `delta = (timestamp − startTime) − note.time`.** Do not assume `delta` is relative to anything but the song start. A note with `time: 1500` hit at exactly `startTime + 1500` has `delta = 0` (perfect). This is why `startTime` must be captured once, at game start, and shared with the judge.
4. **Stale notes advance the cursor.** When `judge.tick()` detects a note past its window, it advances the cursor, resets the combo, and fires `onNoteStale` — your `onMiss` is *not* called for stale notes. If your game shows the player's current letter (like the demo's "Type This" row), drive it from `judge.state.cursor`, not from your own idea of "the note I'm waiting on", or your UI will fall out of sync after a stale note.
5. **The `GamePlugin.onMiss` signature is `(key, expectedKey)` — no delta, no note.** The judge-facing `PluginHooks.onMiss` is `(key, expectedKey, delta, note?)`. If you need the delta of a miss, read it from the host's hook, not from your plugin method.
6. **Restart hygiene.** The demo creates a fresh judge, plugin, and buses per game and `detach()`/`stop()`s them on teardown. Reusing a judge across games without `reset()` (or `detach()` + `attach()`) leaks subscriptions and stale cursors. `BeatClockJudge.reset()` zeroes combo/cursor but does **not** re-arm a stopped bus.
