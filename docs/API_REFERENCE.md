# Typejoy — API Reference

All exports come from `dist/bundle.js` (built via `npx esbuild src/index.ts --bundle --outfile=dist/bundle.js --format=esm`).

---

## createSession (recommended entry point)

```typescript
function createSession(options: SessionOptions): TypejoySession
```

Wires a full, safely-ordered game session. See [Plugin Guide](PLUGIN_GUIDE.md) for ordering guarantees.

### SessionOptions

```typescript
interface SessionOptions {
  container: HTMLElement;                    // render target
  content: string;                           // text to type (each char = a note)
  bpm?: number;                              // default 60
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert'; // default 'easy'
  hooks?: Partial<GamePlugin>;               // your plugin (optional)
  feedback?: Partial<FeedbackLayerOptions>;  // width/height/theme (optional)
}
```

### TypejoySession

```typescript
interface TypejoySession {
  judge: BeatClockJudge;
  feedback: FeedbackLayer;
  beatMap: StaticBeatMap;
  rawBus: RawBus;
  normBus: NormalizedBus;
  songTime(): number;   // ms since session start
  destroy(): void;      // full teardown
}
```

---

## GamePlugin

```typescript
interface GamePlugin {
  onGameStart?(config: GameConfig): void;
  onGameEnd?(results: GameResults): void;
  onHit?(judgment: Judgment, key: string, delta: number): void;
  onMiss?(key: string, expectedKey: string): void;
  onWrongKey?(key: string, expectedKey: string): void;
  onNoteStale?(note: Note): void;
  onCombo?(count: number, multiplier: number): void;
  onComboBreak?(previousCount: number): void;
  onStreakThreshold?(count: number): void;
  onSongComplete?(results: GameResults): void;
  getCanvasContext?(): HTMLCanvasElement | null;
  getFeedbackLayer?(): FeedbackLayer;
}
```

---

## Core classes

### RawBus

Captures raw `keydown`/`keyup` events with `performance.now()` timestamps captured at the source.

```typescript
class RawBus {
  constructor(target?: GlobalEventHandlers & EventTarget); // default window
  onKeyDown(fn: (e: RawKeyEvent) => void): () => void;
  onEvent(fn: (e: RawKeyEvent) => void): () => void;
  start(): void;
  stop(): void;
  inject(key: string, code: string, type: 'keydown'|'keyup', timestamp?: number): void; // testing
  get isListening(): boolean;
}
```

### NormalizedBus

Produces clean character events from raw events (handles shift/caps, filters key repeats).

```typescript
class NormalizedBus {
  constructor(rawBus: { onEvent: (fn) => () => void });
  start(): void;
  stop(): void;
  onChar(fn: (e: NormalizedEvent) => void): () => void;
  injectRaw(raw: RawKeyEvent): void;
}
```

### BeatClockJudge

Evaluates keystrokes against the beat-map.

```typescript
class BeatClockJudge {
  constructor(beatMap: BeatMap, config: JudgeConfig, hooks?: Partial<GamePlugin>);
  attach(normalizedBus: { onChar: (fn) => () => void }): void;
  detach(): void;
  setStartTime(time: number): void;
  getSongTime(): number;
  onJudgment(fn: (e: JudgmentEvent) => void): () => void;
  onChar(evt: NormalizedEvent): void;
  tick(): void;                    // stale-note detection, call on interval
  getCurrentPosition(): number;
  getCurrentNote(): BeatNote | undefined;
  getNextNotes(count?: number): Array<{ note: BeatNote; timeUntilHit: number }>;
  getNotes(): readonly BeatNote[];
  reset(): void;
  get state(): JudgeState;         // { combo, maxCombo, multiplier, cursor, isComplete }
}
```

```typescript
interface JudgeConfig {
  difficulty: Difficulty;
  windows?: Partial<TimingWindows>;   // override timing
  comboThresholds?: { subtle: number; moderate: number; intense: number }; // default 10/25/50
}
```

### BeatMapGenerator

Converts text into rhythmic notes.

```typescript
class BeatMapGenerator {
  generate(content: string, options: GeneratorOptions): Note[];
}
```

```typescript
interface GeneratorOptions {
  bpm: number;
  difficulty: Difficulty;
  wordsPerMinute?: number;   // overrides bpm if set (WPM × 5 = BPM)
}
```

Notes are spaced at `beatInterval = 60000 / bpm`, offset by a per-difficulty lead-in so the first approach ring is visible at start. Character order is sacred — the generator never reorders or drops characters.

### StaticBeatMap

Read-only, immutable note container.

```typescript
class StaticBeatMap {
  constructor(notes: BeatNote[]);   // defensive copy + sort by time
  readonly notes: readonly BeatNote[];
  readonly length: number;
  getNote(index: number): BeatNote | undefined;
  getNotesInRange(startMs: number, endMs: number): BeatNote[];
}
```

### FeedbackLayer

Renders keyboard + particles + approach rings + stats.

```typescript
class FeedbackLayer {
  constructor(options: FeedbackLayerOptions);
  renderHit(judgment: Judgment, key: string, delta: number): void;
  renderMiss(key: string, expectedKey: string): void;
  renderStale(note: Note): void;
  renderCombo(count: number, multiplier: number): void;
  pulseKey(key: string, bpm: number): void;
  setTheme(theme: ThemeDescriptor): void;
  setJudge(judge: JudgeLike): void;         // wire approach rings + indicator
  setPreemptTime(ms: number): void;
  setNoteCount(count: number): void;
  markNoteJudged(note: BeatNote, judgment: Judgment | 'miss'): void;
  setHighContrast(enabled: boolean): void;
  setReducedMotion(enabled: boolean): void;
  setNudgeEnabled(enabled: boolean): void;
  announce(message: string): void;          // ARIA live region
  getKeyboardElement(): SVGSVGElement;
  getCanvasOverlay(): HTMLCanvasElement;
  getContainer(): HTMLElement;
  getLiveRegion(): HTMLElement;
  stats: { perfect: number; great: number; good: number; miss: number };
  getAccuracy(): number;                    // 0..1 weighted
  getRanking(): 'S'|'A'|'B'|'C'|'D'|'F';
  resetStats(): void;
  playCelebration(): void;                  // confetti burst
  reset(): void;
  resize(width: number, height: number): void;
  start(): void;
  stop(): void;
}
```

```typescript
interface FeedbackLayerOptions {
  container: HTMLElement;
  theme?: ThemeDescriptor;
  width?: number;   // default 900
  height?: number;  // default 320
}
```

---

## Types

```typescript
type Judgment = 'perfect' | 'great' | 'good';
type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface Note {
  key: string;
  time: number;      // ms from song start
  window: number;    // timing window in ms
  lane?: number;
  resolved?: boolean;
}

interface RawKeyEvent {
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  timestamp: number;   // performance.now() at capture
  modifiers: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean; capsLock: boolean };
  repeat: boolean;
  nativeEvent?: KeyboardEvent;
}

interface NormalizedEvent {
  char: string;
  raw: RawKeyEvent;
  phase: 'press' | 'release';
}

interface JudgmentEvent {
  judgment: Judgment | 'miss';
  key: string;
  delta: number;       // ms off from the note's ideal time
  note: BeatNote;
  timestamp: number;
}

interface TimingWindows {
  perfect: number;
  great: number;
  good: number;
}

interface ThemeDescriptor {
  name: string;
  colors: ColorPalette;
  particleStyle: 'spark' | 'ring' | 'star' | 'confetti' | 'none';
  glowStyle: 'soft' | 'neon' | 'pulse' | 'none';
  intensity: number;        // 0..1
  shakeIntensity: number;   // 0..1
  particleDensity: number;
  beatPulseEnabled: boolean;
  comboThresholds: { subtle: number; moderate: number; intense: number };
}
```

---

## Timing windows (defaults)

```typescript
// types.ts TIMING_WINDOWS
{
  easy:   { perfect: 500, great: 700, good: 1000 },
  medium: { perfect: 300, great: 500, good: 700 },
  hard:   { perfect: 150, great: 300, good: 500 },
  expert: { perfect: 80,  great: 150, good: 250 },
}
```

## Lead-in times (matched to ring preempt)

```typescript
// beatmap-generator.ts LEAD_IN_MS
{ easy: 1500, medium: 1000, hard: 600, expert: 350 }
```

## Combo multiplier

```
0-9   → 1x
10-24 → 2x
25-49 → 4x
50+   → 8x
```

## Ranking thresholds

```
S ≥ 95%  |  A ≥ 85%  |  B ≥ 70%  |  C ≥ 55%  |  D ≥ 40%  |  F < 40%
```
