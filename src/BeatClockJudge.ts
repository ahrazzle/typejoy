// ============================================================================
// BeatClockJudge — Evaluates keystrokes against the beat-map
// ============================================================================
//
// Flow:
//   NormalizedBus → BeatClockJudge.onChar()
//     1. Look up the current expected note via beat-map cursor.
//     2. If pressed key === expected key:
//          - Compute timing delta = pressedTime - note.time
//          - Classify judgment from timing windows
//          - Advance cursor, update combo, emit judgment
//     3. If pressed key !== expected key:
//          - SILENTLY IGNORE. No judgment, no cursor advance, no combo break.
//
// Wrong keys are invisible to the judge. They never break combo, never
// advance the beat-map, never trigger feedback.

import type {
  NormalizedEvent,
  BeatMap,
  BeatNote,
  Difficulty,
  Judgment,
  JudgmentEvent,
  TimingWindows,
  PluginHooks,
  Listener,
} from './types.js';
import { TIMING_WINDOWS } from './types.js';

type JudgmentListener = Listener<JudgmentEvent>;

/**
 * Configuration for the judge at construction time.
 */
export interface JudgeConfig {
  difficulty: Difficulty;
  /** Override timing windows (optional; falls back to difficulty defaults) */
  windows?: Partial<TimingWindows>;
  /** Combo thresholds at which onStreakThreshold fires (default: 10/25/50) */
  comboThresholds?: { subtle: number; moderate: number; intense: number };
}

export interface JudgeState {
  /** Current combo count */
  combo: number;
  /** Maximum combo achieved this session */
  maxCombo: number;
  /** Multiplier derived from combo (1x, 2x, 4x, 8x) */
  multiplier: number;
  /** Cursor position in the beat-map */
  cursor: number;
  /** Whether the judge has processed all notes */
  isComplete: boolean;
}

export class BeatClockJudge {
  private readonly beatMap: BeatMap;
  private readonly windows: TimingWindows;
  private readonly hooks: Partial<PluginHooks>;
  private readonly comboThresholds: { subtle: number; moderate: number; intense: number };

  private _combo = 0;
  private _maxCombo = 0;
  private _cursor = 0;
  private _lastThreshold = 0;
  private _startTime: number = 0;  // Song start time (performance.now())

  // Subscribers to judgment events (for feedback layer, logging, etc.)
  private readonly judgmentListeners = new Set<JudgmentListener>();

  // The normalized bus subscription handle (for start/stop)
  private unsubChar: (() => void) | null = null;

  constructor(beatMap: BeatMap, config: JudgeConfig, hooks: Partial<PluginHooks> = {}) {
    this.beatMap = beatMap;
    const base = TIMING_WINDOWS[config.difficulty];
    this.windows = {
      perfect: config.windows?.perfect ?? base.perfect,
      great: config.windows?.great ?? base.great,
      good: config.windows?.good ?? base.good,
    };
    this.comboThresholds = config.comboThresholds ?? { subtle: 10, moderate: 25, intense: 50 };
    this.hooks = hooks;
  }

  // ---- Cursor / state access ----------------------------------------------

  /**
   * Read-only accessor for the current beat-map cursor position.
   * Exposed so the feedback layer can query the current note independently.
   */
  getCurrentPosition(): number {
    return this._cursor;
  }

  /**
   * Read-only accessor for the note at a given beat position.
   * Both the judge and the feedback layer can query this independently.
   */
  getNoteAt(beatPosition: number): BeatNote | undefined {
    return this.beatMap.notes[beatPosition];
  }

  /**
   * Get the current *expected* note (the note the cursor is pointing at).
   */
  getExpectedNote(): BeatNote | undefined {
    return this.beatMap.notes[this._cursor];
  }

  /**
   * Get the note at the current cursor position (the note the player should hit now).
   * Consumed by the feedback layer to render the expected-key indicator.
   */
  getCurrentNote(): BeatNote | undefined {
    return this.beatMap.notes[this._cursor];
  }

  /**
   * Get the note that will next require attention within lookaheadMs.
   * Consumed by the feedback layer to pre-load visual cues.
   * @param lookaheadMs  Time window in ms (default: 2000)
   */
  getNextNote(lookaheadMs: number = 2000): BeatNote | undefined {
    if (this._cursor >= this.beatMap.length) return undefined;
    const now = this.beatMap.notes[this._cursor].time;
    for (let i = this._cursor + 1; i < this.beatMap.length; i++) {
      const note = this.beatMap.notes[i];
      if (note.time - now <= lookaheadMs) {
        return note;
      }
    }
    return undefined;
  }

  /**
   * Subscribe to judgment events (for the feedback layer, stats, etc.).
   */
  onJudgment(fn: JudgmentListener): () => void {
    this.judgmentListeners.add(fn);
    return () => this.judgmentListeners.delete(fn);
  }

  // ---- Subscription -------------------------------------------------------

  /**
   * Subscribe to the NormalizedBus. Only `press` events are judged.
   */
  attach(normalizedBus: { onChar: (fn: Listener<NormalizedEvent>) => () => void }): void {
    if (this.unsubChar) return;
    this.unsubChar = normalizedBus.onChar((evt: NormalizedEvent) => this.onChar(evt));
  }

  detach(): void {
    this.unsubChar?.();
    this.unsubChar = null;
  }

  /** Set the song start time (must be called before judging begins) */
  setStartTime(time: number): void {
    this._startTime = time;
  }

  /** Get the current song time relative to start */
  getSongTime(): number {
    return performance.now() - this._startTime;
  }

  // ---- State accessors ----------------------------------------------------

  get state(): JudgeState {
    return {
      combo: this._combo,
      maxCombo: this._maxCombo,
      multiplier: this.computeMultiplier(this._combo),
      cursor: this._cursor,
      isComplete: this._cursor >= this.beatMap.length,
    };
  }

  get combo(): number {
    return this._combo;
  }

  get maxCombo(): number {
    return this._maxCombo;
  }

  // ---- Core judging logic -------------------------------------------------

  /**
   * Handle a normalized character press.
   *
   * Algorithm:
   *   1. Get expected note from cursor.
   *   2. If no more notes → ignore (song is complete).
   *   3. If key === expected key:
   *        - delta = pressedTime - expectedTime
   *        - if |delta| <= good window → judge (perfect/great/good)
   *        - if |delta| > good window → onMiss (correct key, wrong time)
   *        - advance cursor in both cases
   *   4. If key !== expected key → SILENT IGNORE.
   */
  onChar(evt: NormalizedEvent): void {
    if (evt.phase !== 'press') return;

    const expected = this.getExpectedNote();
    if (!expected) {
      // No more notes — song complete.
      return;
    }

    if (evt.char !== expected.key) {
      // WRONG KEY — emit onWrongKey hook for feedback, but don't advance cursor or break combo
      this.hooks.onWrongKey?.(evt.char, expected.key);
      return;
    }

    // Correct key — compute timing delta relative to song start
    const songTime = evt.raw.timestamp - this._startTime;
    const delta = songTime - expected.time;
    const absDelta = Math.abs(delta);

    let judgment: Judgment;
    if (absDelta <= this.windows.perfect) {
      judgment = 'perfect';
    } else if (absDelta <= this.windows.great) {
      judgment = 'great';
    } else if (absDelta <= this.windows.good) {
      judgment = 'good';
    } else {
      // Correct key, but outside all windows → miss.
      this.handleMiss(evt, expected, delta);
      return;
    }

    this.handleHit(judgment, evt, expected, delta);
  }

  // ---- Hit / miss handlers ------------------------------------------------

  private handleHit(
    judgment: Judgment,
    evt: NormalizedEvent,
    note: BeatNote,
    delta: number
  ): void {
    // Update combo
    this._combo++;
    if (this._combo > this._maxCombo) this._maxCombo = this._combo;

    // Emit onStreakThreshold when combo crosses a threshold
    this.checkStreakThreshold();

    // Advance cursor
    this._cursor++;

    const multiplier = this.computeMultiplier(this._combo);
    const event: JudgmentEvent = {
      judgment,
      key: evt.char,
      delta,
      note,
      timestamp: evt.raw.timestamp,
    };

    // Emit to subscribers
    for (const fn of this.judgmentListeners) fn(event);

    // Emit to plugins
    this.hooks.onHit?.(event);
    this.hooks.onCombo?.(this._combo, multiplier);
  }

  private handleMiss(
    evt: NormalizedEvent,
    expected: BeatNote,
    delta: number
  ): void {
    // Correct key, wrong time → miss. Breaks combo.
    const previousCombo = this._combo;
    this._combo = 0;

    // Still advance cursor — the note was attempted.
    this._cursor++;

    const event: JudgmentEvent = {
      judgment: 'miss',
      key: evt.char,
      delta,
      note: expected,
      timestamp: evt.raw.timestamp,
    };

    // Emit to subscribers
    for (const fn of this.judgmentListeners) fn(event);

    // Emit to plugins
    this.hooks.onMiss?.(evt.char, expected.key, delta);
    this.hooks.onComboBreak?.(previousCombo);
    this.hooks.onCombo?.(0, 1);
  }

  // ---- Stale note detection -----------------------------------------------

  /**
   * Call this on every frame (or tick) with the current song time.
   * Detects notes whose windows have fully passed without a correct press
   * and fires onNoteStale for each. Advances the cursor past them.
   *
   * @param currentSongTime  Current song time in ms (same clock as note.time)
   */
  tick(_currentSongTime: number): void {
    const songTime = this.getSongTime();
    while (this._cursor < this.beatMap.length) {
      const note = this.beatMap.notes[this._cursor];
      // A note is stale if current time has passed note.time + good window.
      if (songTime > note.time + this.windows.good) {
        this._cursor++;
        const previousCombo = this._combo;
        this._combo = 0;
        this.hooks.onNoteStale?.(note);
        this.hooks.onComboBreak?.(previousCombo);
        this.hooks.onCombo?.(0, 1);
      } else {
        break;
      }
    }
  }

  // ---- Helpers ------------------------------------------------------------

  /**
   * Combo multiplier mapping (osu!-style):
   *   0-9   → 1x
   *   10-24 → 2x
   *   25-49 → 4x
   *   50+   → 8x
   */
  private computeMultiplier(combo: number): number {
    if (combo >= 50) return 8;
    if (combo >= 25) return 4;
    if (combo >= 10) return 2;
    return 1;
  }

  /**
   * Checks if the current combo has crossed a threshold since the last emission.
   * Called after every successful hit. Fires onStreakThreshold once per threshold.
   */
  private checkStreakThreshold(): void {
    const { subtle, moderate, intense } = this.comboThresholds;
    if (this._combo >= intense && this._lastThreshold < intense) {
      this._lastThreshold = intense;
      this.hooks.onStreakThreshold?.(intense);
    } else if (this._combo >= moderate && this._lastThreshold < moderate) {
      this._lastThreshold = moderate;
      this.hooks.onStreakThreshold?.(moderate);
    } else if (this._combo >= subtle && this._lastThreshold < subtle) {
      this._lastThreshold = subtle;
      this.hooks.onStreakThreshold?.(subtle);
    }
  }

  /** Reset judge state (for replays / retries). */
  reset(): void {
    this._combo = 0;
    this._maxCombo = 0;
    this._cursor = 0;
    this._lastThreshold = 0;
  }
}