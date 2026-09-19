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
    comboThresholds;
    _combo = 0;
    _maxCombo = 0;
    _cursor = 0;
    _lastThreshold = 0;
    _startTime = 0; // Song start time (performance.now())
    _songCompleteFired = false;
    _judgmentCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
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
        this.comboThresholds = config.comboThresholds ?? { subtle: 10, moderate: 25, intense: 50 };
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
    /** Public accessor for the underlying beat-map notes (for approach rings). */
    getNotes() {
        return this.beatMap.notes;
    }
    /**
     * Read-only accessor for the note at a given beat position.
     * Both the judge and the feedback layer can query this independently.
     */
    getNoteAt(beatPosition) {
        return this.beatMap.notes[beatPosition];
    }
    /**
     * Get the current *expected* note (the note the cursor is pointing at).
     */
    getExpectedNote() {
        return this.beatMap.notes[this._cursor];
    }
    /**
     * Get the note at the current cursor position (the note the player should hit now).
     * Consumed by the feedback layer to render the expected-key indicator.
     */
    getCurrentNote() {
        return this.beatMap.notes[this._cursor];
    }
    /**
     * Get the next N upcoming notes with their time-until-hit values.
     * Used by the approach ring system to render multiple simultaneous rings.
     * @param count  Number of upcoming notes to return
     * @returns Array of notes with timeUntilHit in ms
     */
    getNextNotes(count = 3) {
        const songTime = this.getSongTime();
        const result = [];
        for (let i = this._cursor; i < this.beatMap.length && result.length < count; i++) {
            const note = this.beatMap.notes[i];
            const timeUntilHit = note.time - songTime;
            // Only include notes that are within the approach window
            if (timeUntilHit > -200) {
                result.push({ note, timeUntilHit });
            }
        }
        return result;
    }
    /**
     * Subscribe to judgment events (for the feedback layer, stats, etc.).
     */
    onJudgment(fn) {
        this.judgmentListeners.add(fn);
        return () => this.judgmentListeners.delete(fn);
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
    /** Set the song start time (must be called before judging begins) */
    setStartTime(time) {
        this._startTime = time;
    }
    /** Get the current song time relative to start */
    getSongTime() {
        return performance.now() - this._startTime;
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
        // If the song is complete, ignore any remaining keypresses
        if (this._cursor >= this.beatMap.length)
            return;
        const expected = this.getExpectedNote();
        if (!expected) {
            // No more notes — song complete.
            return;
        }
        // Correct key — compute timing delta relative to song start
        const songTime = evt.raw.timestamp - this._startTime;
        const delta = songTime - expected.time;
        const absDelta = Math.abs(delta);
        // Ignore keypresses that happen before the note's window opens (e.g., during lead-in)
        if (delta < -this.windows.good) {
            // Too early — don't register as wrong, don't break combo
            return;
        }
        // Case-insensitive comparison — a kid with caps lock on (or capitalizing
        // the first letter, as taught) should still hit the note.
        if (evt.char.toLowerCase() !== expected.key.toLowerCase()) {
            // WRONG KEY — emit onWrongKey hook for feedback, but don't advance cursor or break combo
            this.hooks.onWrongKey?.(evt.char, expected.key);
            return;
        }
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
        this._judgmentCounts[judgment]++;
        // Emit onStreakThreshold when combo crosses a threshold
        this.checkStreakThreshold();
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
        this.maybeFireSongComplete();
    }
    handleMiss(evt, expected, delta) {
        // Correct key, wrong time → miss. Breaks combo.
        const previousCombo = this._combo;
        this._combo = 0;
        this._judgmentCounts.miss++;
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
        this.hooks.onMiss?.(evt.char, expected.key, delta, expected);
        if (previousCombo > 0)
            this.hooks.onComboBreak?.(previousCombo);
        this.hooks.onCombo?.(0, 1);
        this.maybeFireSongComplete();
    }
    // ---- Stale note detection -----------------------------------------------
    /**
     * Call this on every frame (or tick) with the current song time.
     * Detects notes whose windows have fully passed without a correct press
     * and fires onNoteStale for each. Advances the cursor past them.
     *
     * @param currentSongTime  Current song time in ms (same clock as note.time).
     *                         Defaults to the live song clock (performance.now()
     *                         relative to setStartTime) when omitted.
     */
    tick(currentSongTime = this.getSongTime()) {
        const songTime = currentSongTime;
        while (this._cursor < this.beatMap.length) {
            const note = this.beatMap.notes[this._cursor];
            // A note is stale if current time has passed note.time + good window.
            if (songTime > note.time + this.windows.good) {
                this._cursor++;
                const previousCombo = this._combo;
                this._combo = 0;
                this._judgmentCounts.miss++;
                this.hooks.onNoteStale?.(note);
                if (previousCombo > 0)
                    this.hooks.onComboBreak?.(previousCombo);
                this.hooks.onCombo?.(0, 1);
            }
            else {
                break;
            }
        }
        this.maybeFireSongComplete();
    }
    /**
     * Fire onSongComplete exactly once when the cursor has moved past the last
     * note. Carries the final GameResults (judgment counts, score, accuracy).
     */
    maybeFireSongComplete() {
        if (this._songCompleteFired)
            return;
        if (this.beatMap.length === 0)
            return;
        if (this._cursor < this.beatMap.length)
            return;
        this._songCompleteFired = true;
        const { perfect, great, good, miss } = this._judgmentCounts;
        const total = this.beatMap.length;
        // Accuracy weights match the feedback layer: perfect=1, great=0.75, good=0.5, miss=0
        const accuracy = (perfect + great * 0.75 + good * 0.5) / total;
        const results = {
            title: '',
            artist: '',
            score: perfect * 300 + great * 200 + good * 100,
            maxCombo: this._maxCombo,
            totalNotes: total,
            judgments: { perfect, great, good, miss },
            accuracy,
            passed: accuracy >= 0.6,
            duration: this.beatMap.notes[total - 1].time,
        };
        this.hooks.onSongComplete?.(results);
    }
    /** Read-only judgment counts (perfect/great/good/miss) for this session. */
    get judgmentCounts() {
        return { ...this._judgmentCounts };
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
    /**
     * Checks if the current combo has crossed a threshold since the last emission.
     * Called after every successful hit. Fires onStreakThreshold once per threshold.
     */
    checkStreakThreshold() {
        const { subtle, moderate, intense } = this.comboThresholds;
        if (this._combo >= intense && this._lastThreshold < intense) {
            this._lastThreshold = intense;
            this.hooks.onStreakThreshold?.(intense);
        }
        else if (this._combo >= moderate && this._lastThreshold < moderate) {
            this._lastThreshold = moderate;
            this.hooks.onStreakThreshold?.(moderate);
        }
        else if (this._combo >= subtle && this._lastThreshold < subtle) {
            this._lastThreshold = subtle;
            this.hooks.onStreakThreshold?.(subtle);
        }
    }
    /** Reset judge state (for replays / retries). */
    reset() {
        this._combo = 0;
        this._maxCombo = 0;
        this._cursor = 0;
        this._lastThreshold = 0;
        this._songCompleteFired = false;
        this._judgmentCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
    }
}
//# sourceMappingURL=BeatClockJudge.js.map