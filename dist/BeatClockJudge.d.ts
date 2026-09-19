import type { NormalizedEvent, BeatMap, BeatNote, Difficulty, JudgmentEvent, TimingWindows, PluginHooks, Listener } from './types.js';
type JudgmentListener = Listener<JudgmentEvent>;
/**
 * Configuration for the judge at construction time.
 */
export interface JudgeConfig {
    difficulty: Difficulty;
    /** Override timing windows (optional; falls back to difficulty defaults) */
    windows?: Partial<TimingWindows>;
    /** Combo thresholds at which onStreakThreshold fires (default: 10/25/50) */
    comboThresholds?: {
        subtle: number;
        moderate: number;
        intense: number;
    };
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
export declare class BeatClockJudge {
    private readonly beatMap;
    private readonly windows;
    private readonly hooks;
    private readonly comboThresholds;
    private _combo;
    private _maxCombo;
    private _cursor;
    private _lastThreshold;
    private _startTime;
    private _songCompleteFired;
    private _judgmentCounts;
    private readonly judgmentListeners;
    private unsubChar;
    constructor(beatMap: BeatMap, config: JudgeConfig, hooks?: Partial<PluginHooks>);
    /**
     * Read-only accessor for the current beat-map cursor position.
     * Exposed so the feedback layer can query the current note independently.
     */
    getCurrentPosition(): number;
    /** Public accessor for the underlying beat-map notes (for approach rings). */
    getNotes(): readonly BeatNote[];
    /**
     * Read-only accessor for the note at a given beat position.
     * Both the judge and the feedback layer can query this independently.
     */
    getNoteAt(beatPosition: number): BeatNote | undefined;
    /**
     * Get the current *expected* note (the note the cursor is pointing at).
     */
    getExpectedNote(): BeatNote | undefined;
    /**
     * Get the note at the current cursor position (the note the player should hit now).
     * Consumed by the feedback layer to render the expected-key indicator.
     */
    getCurrentNote(): BeatNote | undefined;
    /**
     * Get the next N upcoming notes with their time-until-hit values.
     * Used by the approach ring system to render multiple simultaneous rings.
     * @param count  Number of upcoming notes to return
     * @returns Array of notes with timeUntilHit in ms
     */
    getNextNotes(count?: number): Array<{
        note: BeatNote;
        timeUntilHit: number;
    }>;
    /**
     * Subscribe to judgment events (for the feedback layer, stats, etc.).
     */
    onJudgment(fn: JudgmentListener): () => void;
    /**
     * Subscribe to the NormalizedBus. Only `press` events are judged.
     */
    attach(normalizedBus: {
        onChar: (fn: Listener<NormalizedEvent>) => () => void;
    }): void;
    detach(): void;
    /** Set the song start time (must be called before judging begins) */
    setStartTime(time: number): void;
    /** Get the current song time relative to start */
    getSongTime(): number;
    get state(): JudgeState;
    get combo(): number;
    get maxCombo(): number;
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
    onChar(evt: NormalizedEvent): void;
    private handleHit;
    private handleMiss;
    /**
     * Call this on every frame (or tick) with the current song time.
     * Detects notes whose windows have fully passed without a correct press
     * and fires onNoteStale for each. Advances the cursor past them.
     *
     * @param currentSongTime  Current song time in ms (same clock as note.time).
     *                         Defaults to the live song clock (performance.now()
     *                         relative to setStartTime) when omitted.
     */
    tick(currentSongTime?: number): void;
    /**
     * Fire onSongComplete exactly once when the cursor has moved past the last
     * note. Carries the final GameResults (judgment counts, score, accuracy).
     */
    private maybeFireSongComplete;
    /** Read-only judgment counts (perfect/great/good/miss) for this session. */
    get judgmentCounts(): {
        perfect: number;
        great: number;
        good: number;
        miss: number;
    };
    /**
     * Combo multiplier mapping (osu!-style):
     *   0-9   → 1x
     *   10-24 → 2x
     *   25-49 → 4x
     *   50+   → 8x
     */
    private computeMultiplier;
    /**
     * Checks if the current combo has crossed a threshold since the last emission.
     * Called after every successful hit. Fires onStreakThreshold once per threshold.
     */
    private checkStreakThreshold;
    /** Reset judge state (for replays / retries). */
    reset(): void;
}
export {};
//# sourceMappingURL=BeatClockJudge.d.ts.map