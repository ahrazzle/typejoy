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

## Common pitfalls

1. **Don't call `feedback.start()` before `setJudge()`** — use `createSession()` or follow the manual order exactly.
2. **Clean up old sessions** — call `session.destroy()` before creating a new one, or keyboard DOM and event listeners stack.
3. **Case is handled** — comparisons are case-insensitive; you don't need to normalize.
4. **The debug plugin is dev-only** — it renders no UI unless `showDebugUI = true`. Don't copy its wiring into your game.
