import type { NormalizedEvent, BeatMap, BeatNote, Difficulty, JudgmentEvent, TimingWindows, PluginHooks, Listener } from './types.js';
type JudgmentListener = Listener<JudgmentEvent>;
/**
 * Configuration for the judge at construction time.
 */
export interface JudgeConfig {
    difficulty: Difficulty;
    /** Override timing windows (optional; falls back to difficulty defaults) */
    windows?: Partial<TimingWindows>;
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
    private _combo;
    private _maxCombo;
    private _cursor;
    private readonly judgmentListeners;
    private unsubChar;
    constructor(beatMap: BeatMap, config: JudgeConfig, hooks?: Partial<PluginHooks>);
    /**
     * Read-only accessor for the current beat-map cursor position.
     * Exposed so the feedback layer can query the current note independently.
     */
    getCurrentPosition(): number;
    /**
     * Read-only accessor for the note at a given beat position.
     * Both the judge and the feedback layer can query this independently.
     */
    getCurrentNote(beatPosition: number): BeatNote | undefined;
    /**
     * Get the current *expected* note (the note the cursor is pointing at).
     */
    getExpectedNote(): BeatNote | undefined;
    /**
     * Subscribe to the NormalizedBus. Only `press` events are judged.
     */
    attach(normalizedBus: {
        onChar: (fn: Listener<NormalizedEvent>) => () => void;
    }): void;
    detach(): void;
    /**
     * Subscribe to judgment events (for the feedback layer, stats, etc.).
     */
    onJudgment(fn: JudgmentListener): () => void;
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
     * @param currentSongTime  Current song time in ms (same clock as note.time)
     */
    tick(currentSongTime: number): void;
    /**
     * Combo multiplier mapping (osu!-style):
     *   0-9   → 1x
     *   10-24 → 2x
     *   25-49 → 4x
     *   50+   → 8x
     */
    private computeMultiplier;
    /** Reset judge state (for replays / retries). */
    reset(): void;
}
export {};
//# sourceMappingURL=BeatClockJudge.d.ts.map