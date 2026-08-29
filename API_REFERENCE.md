# Typejoy — API Reference

> Every public symbol exported from `src/index.ts`, documented with its **actual** signature from the source. If a signature here disagrees with the code, trust the code — and fix this document. Import anything here from the built bundle: `import { RawBus, FeedbackLayer, … } from './dist/game.js'` (or from `src/` when developing in-repo).

The barrel (`src/index.ts`) exports:

```ts
// Classes
RawBus, NormalizedBus, BeatClockJudge, StaticBeatMap, BeatMapGenerator,
FeedbackLayer, SVGKeyboardRenderer, ParticleSystem, DebugPlugin

// Functions
normalizeKey, buildKeyMap

// Types (type-only exports)
Judgment, Note, GameConfig, AccessibilityConfig, GameResults,
ParticleStyle, GlowStyle, ColorPalette, ThemeDescriptor, DEFAULT_THEME,
GamePlugin, FeedbackLayer as FeedbackLayerInterface,
FeedbackLayerOptions, KeyboardRendererOptions, RenderedKey,
QWERTY_LAYOUT, KeyDef, KeyboardLayout
```

---

## Types

### `Judgment`

```ts
export type Judgment = 'perfect' | 'great' | 'good';
```

`'miss'` is **not** a `Judgment` — it appears only in `JudgmentEvent.judgment` as a union extension: `Judgment | 'miss'`.

### `Note` (a.k.a. `BeatNote`)

```ts
export interface Note {
  /** The expected key (e.g., 'a', 'space', 'arrowup') */
  key: string;
  /** Time in ms from song start when this note should be hit */
  time: number;
  /** Timing window in ms — how early/late you can be */
  window: number;
  /** Lane or column hint for visual display */
  lane?: number;
  /** Whether this note has been resolved (hit or missed) */
  resolved?: boolean;
}
export type BeatNote = Note;
```

### `BeatMap`

```ts
export interface BeatMap {
  notes: readonly BeatNote[];
  length: number;
  getNote(index: number): BeatNote | undefined;
  getNotesInRange(startMs: number, endMs: number): BeatNote[];
}
```

`StaticBeatMap` implements this. See below.

### `GameConfig`

```ts
export interface GameConfig {
  title: string;
  artist: string;
  bpm: number;
  difficulty: Difficulty;
  /** Ordered list of notes to hit */
  notes: Note[];
  /** Timing windows per judgment in ms */
  timingWindows: TimingWindows;
  /** Whether nudge hints are enabled (disabled at higher difficulties) */
  nudgeEnabled: boolean;
  /** Accessibility options */
  accessibility: AccessibilityConfig;
}
```

`Difficulty = 'easy' | 'medium' | 'hard' | 'expert'`
`TimingWindows = { perfect: number; great: number; good: number }` (see [PLUGIN_GUIDE.md](./docs/PLUGIN_GUIDE.md#3-timing-windows-per-difficulty) for per-difficulty values).

```ts
export interface AccessibilityConfig {
  highContrast: boolean;
  oneHandedMode: boolean;
  /** Multiplier applied to timing windows (1.0 = default, >1.0 = more forgiving) */
  timingWindowScale: number;
  /** Whether to announce combo milestones via ARIA live regions */
  announceCombos: boolean;
  /** Whether to announce song progress */
  announceProgress: boolean;
  /** Reduced motion — disables screen shake and heavy particles */
  reducedMotion: boolean;
}
```

### `GameResults`

```ts
export interface GameResults {
  title: string;
  artist: string;
  score: number;
  maxCombo: number;
  totalNotes: number;
  judgments: { perfect: number; great: number; good: number; miss: number };
  accuracy: number;   // 0.0 – 1.0
  passed: boolean;
  duration: number;
}
```

### Event types

```ts
export interface RawKeyEvent {
  type: 'keydown' | 'keyup';
  key: string;               // e.key
  code: string;              // e.code
  timestamp: number;         // performance.now() captured at the source
  modifiers: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean; capsLock: boolean };
  repeat: boolean;
  nativeEvent?: KeyboardEvent;
}

export interface NormalizedEvent {
  char: string;              // the normalized character ('a', ' ', '1', …)
  raw: RawKeyEvent;          // the raw event it came from
  phase: 'press' | 'release'; // keydown → 'press', keyup → 'release'
}

export interface JudgmentEvent {
  judgment: Judgment | 'miss';
  key: string;
  delta: number;             // ms; (raw.timestamp − startTime) − note.time
  note: BeatNote;
  timestamp: number;
}
```

### `PluginHooks` (the judge-facing hooks)

```ts
export interface PluginHooks {
  onHit?(event: JudgmentEvent): void;
  onMiss?(key: string, expectedKey: string, delta: number, note?: BeatNote): void;
  onWrongKey?(key: string, expectedKey: string): void;
  onNoteStale?(note: BeatNote): void;
  onCombo?(count: number, multiplier: number): void;
  onComboBreak?(previousCount: number): void;
  onStreakThreshold?(count: number): void;
}
```

This is what you pass to `new BeatClockJudge(beatMap, config, hooks)`. `onWrongKey` exists only here — the `GamePlugin` interface deliberately has no wrong-key callback.

### `GamePlugin` — the plugin contract

See [PLUGIN_GUIDE.md](./docs/PLUGIN_GUIDE.md#1-the-contract-at-a-glance) for the full interface and semantics. `FeedbackLayer` is also exported from `types.ts` as the `FeedbackLayer` interface (re-exported from the barrel as `FeedbackLayerInterface`).

### Theme types

```ts
export type ParticleStyle = 'spark' | 'ring' | 'star' | 'confetti' | 'none';
export type GlowStyle = 'soft' | 'neon' | 'pulse' | 'none';
```

```ts
export interface ThemeDescriptor {
  name: string;
  colors: ColorPalette;
  /** Visual particle style for hit feedback */
  particleStyle: ParticleStyle;
  /** Glow rendering style */
  glowStyle: GlowStyle;
  /** Overall animation intensity 0.0 → 1.0 */
  intensity: number;
  /** Screen shake intensity 0.0 → 1.0 */
  shakeIntensity: number;
  /** Particle count multiplier */
  particleDensity: number;
  /** Whether beat-pulsing on keys is enabled */
  beatPulseEnabled: boolean;
  /** Combo milestone thresholds */
  comboThresholds: { subtle: number; moderate: number; intense: number };
}
```

`ColorPalette`:

```ts
export interface ColorPalette {
  primary: string;      // perfect hits
  secondary: string;    // great hits
  tertiary: string;     // good hits
  danger: string;       // misses / wrong keys
  surface: string;      // keyboard background
  keycap: string;       // keycap base color
  keycapText: string;   // keycap text color
  keycapBorder: string;
  comboGlow: string;
  nudgeGlow: string;
  highContrast?: { primary; secondary; danger; surface; keycap; keycapText };
}
```

**`DEFAULT_THEME`** (`ThemeDescriptor`): name `'typejoy-default'`; colors `primary #00e5ff`, `secondary #76ff03`, `tertiary #ffea00`, `danger #ff1744`, `surface #1a1a2e`, `keycap #2d2d44`, `keycapText #e0e0e0`, `keycapBorder #3d3d5c`, `comboGlow #e040fb`, `nudgeGlow #ff9100`; `particleStyle 'spark'`, `glowStyle 'neon'`, `intensity 0.8`, `shakeIntensity 0.5`, `particleDensity 1.0`, `beatPulseEnabled true`, `comboThresholds { subtle: 10, moderate: 25, intense: 50 }`.

Also exported from `types.ts` (not re-exported by the barrel): `TIMING_WINDOWS: Record<Difficulty, TimingWindows>`.

---

## `RawBus` — raw key capture

`src/RawBus.ts` · Captures `keydown`/`keyup` from a DOM target (default `window`), stamping each event with `performance.now()` *inside* the DOM handler.

```ts
constructor(target?: GlobalEventHandlers & EventTarget)
// Defaults to window. A no-op target is used in non-DOM environments (SSR/tests).

onKeyDown(fn: (evt: RawKeyEvent) => void): () => void
// Subscribe to keydown events. Returns an unsubscribe function.

onEvent(fn: (evt: RawKeyEvent) => void): () => void
// Subscribe to ALL raw events (both keydown and keyup). Returns an unsubscribe function.

start(): void
// Attach DOM listeners (capture phase). No-op if already listening.

stop(): void
// Remove DOM listeners. No-op if not listening.

get isListening(): boolean

inject(key: string, code: string, type: 'keydown' | 'keyup', timestamp?: number): void
// Push a synthetic RawKeyEvent (testing / headless). Timestamp defaults to performance.now();
// pass a pre-stamped value to control timing.
```

> There is no `onKeyUp` method — keyup events arrive through `onEvent` (with `evt.type === 'keyup'`).

---

## `NormalizedBus` — normalization

`src/NormalizedBus.ts` · Consumes raw events and emits `NormalizedEvent`s. Applies shift/caps-lock/layout normalization (US QWERTY mapping), filters key-repeat auto-repeats, and only `keydown` produces `phase: 'press'`.

```ts
constructor(rawBus: { onEvent: (fn: (evt: RawKeyEvent) => void) => () => void })
// Structurally typed — any object with onEvent() works (RawBus or a test mock).

start(): void
stop(): void

onChar(fn: (evt: NormalizedEvent) => void): () => void
// Subscribe to normalized events. Returns an unsubscribe function.

injectRaw(raw: RawKeyEvent): void
// Push a raw event directly through normalization (testing).
```

Also exported: **`normalizeKey(raw: RawKeyEvent): string`** — the standalone normalizer. Rules: letters lower-case with shift XOR caps lock making uppercase; shifted non-letters map to their shifted glyph; `Space` → `' '`; unknown layouts fall back to `e.key`.

---

## `BeatClockJudge` — judgment engine

`src/BeatClockJudge.ts` · Compares normalized chars against the beat-map cursor, classifies timing, tracks combo/multiplier, detects stale notes, and dispatches to `PluginHooks`.

```ts
interface JudgeConfig {
  difficulty: Difficulty;
  /** Override timing windows (optional; falls back to difficulty defaults) */
  windows?: Partial<TimingWindows>;
  /** Combo thresholds at which onStreakThreshold fires (default: 10/25/50) */
  comboThresholds?: { subtle: number; moderate: number; intense: number };
}

interface JudgeState {
  combo: number;
  maxCombo: number;
  multiplier: number;   // 1x / 2x / 4x / 8x
  cursor: number;       // position in the beat-map
  isComplete: boolean;  // cursor >= beatMap.length
}

constructor(beatMap: BeatMap, config: JudgeConfig, hooks: Partial<PluginHooks> = {})

attach(normalizedBus: { onChar: (fn: (evt: NormalizedEvent) => void) => () => void }): void
// Subscribe the judge to a NormalizedBus. Only 'press' events are judged.

detach(): void
// Unsubscribe. Safe to call when not attached.

setStartTime(time: number): void
// MUST be called before the bus starts listening. time = performance.now() at song start.

getSongTime(): number
// performance.now() − startTime (ms on the same clock as note.time).

getCurrentNote(): BeatNote | undefined
// The note at the current cursor position (what the player should hit now).

getNextNotes(count: number = 3): Array<{ note: BeatNote; timeUntilHit: number }>
// Upcoming notes from the cursor, only those within the approach window (> −200 ms).

getExpectedNote(): BeatNote | undefined
// Alias of getCurrentNote — the note the cursor points at.

getCurrentPosition(): number
// Read-only cursor position.

getNoteAt(beatPosition: number): BeatNote | undefined
// Note at a given beat index.

onJudgment(fn: (event: JudgmentEvent) => void): () => void
// Subscribe to every judgment (hits AND misses) as JudgmentEvent. Returns unsubscribe.

get state(): JudgeState
get combo(): number
get maxCombo(): number

onChar(evt: NormalizedEvent): void
// Entry point from the bus. Judging algorithm (see PLUGIN_GUIDE §The GamePlugin contract).

tick(_currentSongTime: number): void
// Call every frame/interval. Detects notes past (note.time + good window),
// advances the cursor past them, resets combo, fires onNoteStale + onComboBreak + onCombo(0,1).

reset(): void
// Zero combo, maxCombo, cursor, threshold tracking (for replays). Does not re-arm the bus.
```

> Note `tick` ignores its parameter and reads `getSongTime()` internally — call it as `judge.tick()`.

---

## `StaticBeatMap` — read-only note container

`src/BeatMap.ts` · Defensively copies and `Object.freeze`s its note array, sorted by `time`.

```ts
constructor(notes: BeatNote[])

readonly notes: readonly BeatNote[]
readonly length: number

getNote(index: number): BeatNote | undefined
getNotesInRange(startMs: number, endMs: number): BeatNote[]
// Notes with time >= startMs && time <= endMs.
```

---

## `BeatMapGenerator` — content → rhythm

`src/beatmap-generator.ts` · Converts typing content into a `Note[]` spaced to a BPM, with difficulty-scaled timing windows and a lead-in so the first approach ring is visible.

```ts
interface GeneratorOptions {
  bpm: number;
  difficulty: Difficulty;
  /** Target words per minute — alternative to BPM. If set, overrides bpm (bpm = wpm × 5). */
  wordsPerMinute?: number;
}

generate(content: string, options: GeneratorOptions): Note[]
// Each kept character becomes a note: time = LEAD_IN_MS[difficulty] + index × (60000 / bpm),
// window = TIMING_WINDOWS[difficulty] (the perfect-window ms).
```

Lead-ins: `easy 1500`, `medium 1000`, `hard 600`, `expert 350`. Character order is always preserved. Also exported: `effectiveBpm(options)` and a `TIMING_WINDOWS` map (`easy 500, medium 300, hard 150, expert 80`).

---

## `FeedbackLayer` — shared feedback surface

`src/feedback-layer.ts` · Owns the SVG keyboard, the particle canvas, and the approach-ring canvas. Plugins render through its public API.

> **Two things named `FeedbackLayer`.** The `GamePlugin` contract's `getFeedbackLayer(): FeedbackLayer` is typed against the *narrow* interface declared in `src/types.ts` — it has the render methods, theme, element access, and `reset/resize/start/stop`, but **not** the a11y/stats extras. The **class** in `feedback-layer.ts` (what the barrel exports and what `demo.html` constructs) has everything below. If your plugin calls `announce()`, `markNoteJudged()`, `setHighContrast()`, `setReducedMotion()`, `setNudgeEnabled()`, or `resetStats()`, hold the concrete class reference (import it from the barrel or from `feedback-layer.js`) — it structurally satisfies the interface, so `implements GamePlugin` still holds. Class-only members are marked ⚡ below.

```ts
interface FeedbackLayerOptions {
  container: HTMLElement;
  theme?: ThemeDescriptor;   // default DEFAULT_THEME
  width?: number;            // default 900
  height?: number;           // default 300
}

constructor(options: FeedbackLayerOptions)

// ── Plugin event handlers (call these from your plugin / host hooks) ──
renderHit(judgment: Judgment, key: string, delta: number): void
// Depress + highlight the key, emit ripple/burst/confetti/shake per judgment.

renderMiss(key: string, expectedKey: string): void
// Gentle red shake + muted flash on the pressed (wrong) key.

renderStale(note: Note): void
// Currently a no-op — nudges are only rendered for the expected key.

renderCombo(count: number, multiplier: number): void
// Updates the combo counter (hides below 2) and escalates effects at thresholds.

pulseKey(key: string, bpm: number): void
// Beat-synced pulse; respects theme.beatPulseEnabled + reducedMotion.

// ── Configuration ──
setTheme(theme: ThemeDescriptor): void
setJudge(judge: {
  getCurrentNote(): BeatNote | undefined;
  getNextNotes(count: number): Array<{ note: BeatNote; timeUntilHit: number }>;
  getSongTime(): number;
  beatMap: { notes: BeatNote[] };
}): void
// Connect the judge for the expected-key indicator + approach rings.

setPreemptTime(ms: number): void
// Approach-ring lead time (easy 1500, medium 1000, hard 600, expert 350).

setNoteCount(count: number): void
// How many upcoming notes get approach rings.

markNoteJudged(note: BeatNote, judgment: 'perfect' | 'great' | 'good' | 'miss'): void  ⚡
// Collapse/expand a note's ring on the hit frame. Wire from onHit/onMiss/onNoteStale.

setHighContrast(enabled: boolean): void  ⚡
setReducedMotion(enabled: boolean): void  ⚡
setNudgeEnabled(enabled: boolean): void  ⚡
announce(message: string): void  ⚡
// ARIA live-region announcement.

// ── Stats / results ──
resetStats(): void  ⚡
getAccuracy(): number
// Weighted: perfect 1.0, great 0.75, good 0.5, miss 0 → 0.0–1.0.
getRanking(): string
// S ≥ .95, A ≥ .85, B ≥ .70, C ≥ .55, D ≥ .40, else F.
playCelebration(): void
// Confetti bursts + edge glow.

// ── Element access (rarely needed — prefer the render methods) ──
getKeyboardElement(): SVGSVGElement
getCanvasOverlay(): HTMLCanvasElement
getLiveRegion(): HTMLElement
getContainer(): HTMLElement
// (demo.html reads `feedbackLayer.stats` — a private field holding the judgment tallies.)

// ── Lifecycle ──
reset(): void      // clears keyboard/particles/rings/combo/stats
resize(width: number, height: number): void
start(): void      // begins particle + approach-ring + nudge animation loops
stop(): void       // stops loops, resets keyboard visual state
```

---

## `ApproachRingSystem` — osu!-style rings

`src/approach-ring-system.ts` · Shrinking rings on upcoming keys, colored by proximity (white → cyan → green → yellow). Normally driven by `FeedbackLayer` — you rarely construct it directly.

```ts
constructor(canvas: HTMLCanvasElement)

setPreemptTime(ms: number): void
setNoteCount(count: number): void
resize(width: number, height: number): void
clear(): void
markJudged(note: BeatNote, judgment: 'perfect' | 'great' | 'good' | 'miss'): void
update(): void   // spawn rings for upcoming notes, expire old ones
render(): void
start(): void    // rAF loop (update + render)
stop(): void

// Public fields set by FeedbackLayer.setJudge:
judge: { getSongTime; beatMap; getNextNotes } | null
keyboard: { getKeyElement } | null
container: HTMLElement | null
```

---

## `SVGKeyboardRenderer` — the keyboard

`src/svg-keyboard.ts` · ARIA-labeled SVG QWERTY keyboard with spring-physics depression, pulse, shake, nudge glow, and highlights.

```ts
interface KeyboardRendererOptions {
  layout?: KeyboardLayout;  // default QWERTY_LAYOUT
  unitSize?: number;        // default 48
  keyGap?: number;          // default 4
  borderRadius?: number;    // default 4
}

constructor(container: HTMLElement, options?: KeyboardRendererOptions)

getKeyElement(keyId: string): SVGElement | undefined
// keyId is the layout id: 'a', 'space', 'arrowup', 'semicolon', …

depressKey(keyId: string): void   // spring-physics depression (overshoot + bounce)
pulseKey(keyId: string, bpm: number): void  // beat-synced brightness pulse
shakeKey(keyId: string): void     // wrong-key horizontal shake

setNudgeGlow(keyId: string, intensity: number): void
clearNudgeGlow(keyId: string): void

setKeyHighlight(keyId: string, color: string, opacity?: number /* default 0.6 */): void
clearKeyHighlight(keyId: string): void

applyTheme(theme: ThemeDescriptor, highContrast?: boolean /* default false */): void
reset(): void            // clears highlights, nudges, pulse/shake state
getElement(): SVGSVGElement
```

---

## `ParticleSystem` — canvas effects

`src/particle-system.ts` · Particle bursts, ripples, specular sweeps, screen shake, and edge glow on a `pointer-events: none` canvas.

```ts
constructor(canvas: HTMLCanvasElement)

setTheme(theme: ThemeDescriptor): void
setReducedMotion(reduced: boolean): void
resize(width: number, height: number): void

emitRipple(x: number, y: number, judgment: Judgment | 'wrong'): void
emitSpecularSweep(): void
emitBurst(x: number, y: number, judgment: Judgment, style: ParticleStyle, density?: number /* default 1.0 */): void
emitMutedFlash(x: number, y: number): void
emitWrongKeyBurst(x: number, y: number): void
addShake(intensity: number, duration?: number /* default 200 */): void
addEdgeGlow(color: string, intensity: number, duration?: number /* default 300 */): void
getShakeOffset(): { x: number; y: number }

clear(): void    // removes all particles/effects
start(): void    // rAF loop
stop(): void
```

---

## `DebugPlugin` — reference `GamePlugin` implementation

`src/debug-plugin.ts` · The shipped contract validator. Full walkthrough in [docs/EXAMPLE_PLUGIN.md](./docs/EXAMPLE_PLUGIN.md).

```ts
class DebugPlugin implements GamePlugin {
  readonly name = 'debug-validator';
  constructor() {}

  // GamePlugin methods — see PLUGIN_GUIDE §The GamePlugin contract.
  onGameStart(config: GameConfig): void
  onGameEnd(results: GameResults): void
  onHit(judgment: Judgment, key: string, delta: number): void
  onMiss(key: string, expectedKey: string): void
  onNoteStale(note: Note): void
  onCombo(count: number, multiplier: number): void
  onStreakThreshold(count: number): void
  onSongComplete(results: GameResults): void
  getCanvasContext(): HTMLCanvasElement | null   // returns null (DOM-based UI)
  getFeedbackLayer(): FeedbackLayer

  // Framework integration
  setFeedbackLayer(layer: FeedbackLayer): void
  destroy(): void   // cancels rAF + removes UI
}
```

---

## `PluginRegistry` — multi-plugin fan-out

`src/PluginHooks.ts` · A lightweight registry that dispatches to many `PluginHooks` at once. **Not** re-exported from the barrel — import from `src/PluginHooks.js` when you need it.

```ts
register(plugin: PluginHooks): () => void   // returns an unregister function
get count(): number
onHit(event: JudgmentEvent): void
onMiss(key: string, expectedKey: string, delta: number): void
onNoteStale(note: BeatNote): void
onCombo(count: number, multiplier: number): void
onComboBreak(previousCount: number): void
```

The same file also exports a console-logging `DebugPlugin implements PluginHooks` — different from the `GamePlugin`-implementing `DebugPlugin` in `debug-plugin.ts`.

---

## `keyboard-layout` helpers

```ts
QWERTY_LAYOUT: KeyboardLayout        // 5 rows, 15 units wide
KeyDef { id, label, width, row, col, isHomeRow?, finger? }
KeyboardLayout { name, rows, totalWidth, totalHeight }

buildKeyMap(layout: KeyboardLayout): Map<string, KeyDef>

normalizeKey(key: string): string
// Lowercases and maps aliases: ' '→'space', 'arrowup'→'arrow-up',
// 'return'→'enter', ';'→'semicolon', "'"→'quote', '['→'bracket-left', …
```
