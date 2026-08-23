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
import { TIMING_WINDOWS } from './types.js';
export class BeatClockJudge {
    beatMap;
    windows;
    hooks;
    _combo = 0;
    _maxCombo = 0;
    _cursor = 0;
    // Subscribers to judgment events (for feedback layer, logging, etc.)
    judgmentListeners = new Set();
    // The normalized bus subscription handle (for start/stop)
    unsubChar = null;
    constructor(beatMap, config, hooks = {}) {
        this.beatMap = beatMap;
        const base = TIMING_WINDOWS[config.difficulty];
        this.windows = {
            perfect: config.windows?.perfect ?? base.perfect,
            great: config.windows?.great ?? base.great,
            good: config.windows?.good ?? base.good,
        };
        this.hooks = hooks;
    }
    // ---- Cursor / state access ----------------------------------------------
    /**
     * Read-only accessor for the current beat-map cursor position.
     * Exposed so the feedback layer can query the current note independently.
     */
    getCurrentPosition() {
        return this._cursor;
    }
    /**
     * Read-only accessor for the note at a given beat position.
     * Both the judge and the feedback layer can query this independently.
     */
    getCurrentNote(beatPosition) {
        return this.beatMap.notes[beatPosition];
    }
    /**
     * Get the current *expected* note (the note the cursor is pointing at).
     */
    getExpectedNote() {
        return this.beatMap.notes[this._cursor];
    }
    // ---- Subscription -------------------------------------------------------
    /**
     * Subscribe to the NormalizedBus. Only `press` events are judged.
     */
    attach(normalizedBus) {
        if (this.unsubChar)
            return;
        this.unsubChar = normalizedBus.onChar((evt) => this.onChar(evt));
    }
    detach() {
        this.unsubChar?.();
        this.unsubChar = null;
    }
    /**
     * Subscribe to judgment events (for the feedback layer, stats, etc.).
     */
    onJudgment(fn) {
        this.judgmentListeners.add(fn);
        return () => this.judgmentListeners.delete(fn);
    }
    // ---- State accessors ----------------------------------------------------
    get state() {
        return {
            combo: this._combo,
            maxCombo: this._maxCombo,
            multiplier: this.computeMultiplier(this._combo),
            cursor: this._cursor,
            isComplete: this._cursor >= this.beatMap.length,
        };
    }
    get combo() {
        return this._combo;
    }
    get maxCombo() {
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
    onChar(evt) {
        if (evt.phase !== 'press')
            return;
        const expected = this.getExpectedNote();
        if (!expected) {
            // No more notes — song complete.
            return;
        }
        if (evt.char !== expected.key) {
            // WRONG KEY — silently ignore. No judgment, no combo break, no cursor advance.
            return;
        }
        // Correct key — compute timing delta.
        const delta = evt.raw.timestamp - expected.time;
        const absDelta = Math.abs(delta);
        let judgment;
        if (absDelta <= this.windows.perfect) {
            judgment = 'perfect';
        }
        else if (absDelta <= this.windows.great) {
            judgment = 'great';
        }
        else if (absDelta <= this.windows.good) {
            judgment = 'good';
        }
        else {
            // Correct key, but outside all windows → miss.
            this.handleMiss(evt, expected, delta);
            return;
        }
        this.handleHit(judgment, evt, expected, delta);
    }
    // ---- Hit / miss handlers ------------------------------------------------
    handleHit(judgment, evt, note, delta) {
        // Update combo
        this._combo++;
        if (this._combo > this._maxCombo)
            this._maxCombo = this._combo;
        // Advance cursor
        this._cursor++;
        const multiplier = this.computeMultiplier(this._combo);
        const event = {
            judgment,
            key: evt.char,
            delta,
            note,
            timestamp: evt.raw.timestamp,
        };
        // Emit to subscribers
        for (const fn of this.judgmentListeners)
            fn(event);
        // Emit to plugins
        this.hooks.onHit?.(event);
        this.hooks.onCombo?.(this._combo, multiplier);
    }
    handleMiss(evt, expected, delta) {
        // Correct key, wrong time → miss. Breaks combo.
        const previousCombo = this._combo;
        this._combo = 0;
        // Still advance cursor — the note was attempted.
        this._cursor++;
        const event = {
            judgment: 'miss',
            key: evt.char,
            delta,
            note: expected,
            timestamp: evt.raw.timestamp,
        };
        // Emit to subscribers
        for (const fn of this.judgmentListeners)
            fn(event);
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
    tick(currentSongTime) {
        while (this._cursor < this.beatMap.length) {
            const note = this.beatMap.notes[this._cursor];
            // A note is stale if current time has passed note.time + good window.
            if (currentSongTime > note.time + this.windows.good) {
                this._cursor++;
                const previousCombo = this._combo;
                this._combo = 0;
                this.hooks.onNoteStale?.(note);
                this.hooks.onComboBreak?.(previousCombo);
                this.hooks.onCombo?.(0, 1);
            }
            else {
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
    computeMultiplier(combo) {
        if (combo >= 50)
            return 8;
        if (combo >= 25)
            return 4;
        if (combo >= 10)
            return 2;
        return 1;
    }
    /** Reset judge state (for replays / retries). */
    reset() {
        this._combo = 0;
        this._maxCombo = 0;
        this._cursor = 0;
    }
}
//# sourceMappingURL=BeatClockJudge.js.map