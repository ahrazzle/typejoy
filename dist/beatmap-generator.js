// ============================================================================
// BeatMapGenerator — Converts typing content into rhythmic note arrays
// ============================================================================
// The bridge between "typing lesson" and "rhythm game." Takes a string of
// characters and produces a Note[] spaced according to BPM, with difficulty-
// based density and key-hand alternation.
import { TIMING_WINDOWS } from './types.js';
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
/** Per-difficulty note timing window (ms). Single-sourced from the framework's
 *  canonical TIMING_WINDOWS — the generator stamps the `perfect` window onto
 *  each note. The judge applies its own full window set at judgment time. */
const PERFECT_WINDOWS = {
    easy: TIMING_WINDOWS.easy.perfect,
    medium: TIMING_WINDOWS.medium.perfect,
    hard: TIMING_WINDOWS.hard.perfect,
    expert: TIMING_WINDOWS.expert.perfect,
    impossible: TIMING_WINDOWS.impossible.perfect,
};
/** Lead-in time before the first note (ms) — matched to each difficulty's
 *  approach-ring preempt time so the first ring is visible at game start. */
export const LEAD_IN_MS = {
    easy: 1500,
    medium: 1000,
    hard: 600,
    expert: 350,
    impossible: 250,
};
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Computes the effective BPM. If `wordsPerMinute` is provided, derives BPM
 * from the rule: 1 note/beat × 5 chars/word → WPM = bpm / 5  →  bpm = WPM × 5.
 */
function effectiveBpm(options) {
    if (options.wordsPerMinute != null && options.wordsPerMinute > 0) {
        return options.wordsPerMinute * 5;
    }
    return options.bpm;
}
// ─────────────────────────────────────────────────────────────────────────────
// BeatMapGenerator
// ─────────────────────────────────────────────────────────────────────────────
export class BeatMapGenerator {
    /**
     * Generate a rhythmic note array from typing content.
     *
     * @param content  The text to convert (each character becomes a note).
     * @param options  Tempo, difficulty, and optional WPM target.
     * @returns An ordered array of notes ready to wrap in a StaticBeatMap.
     */
    generate(content, options) {
        const bpm = effectiveBpm(options);
        const beatInterval = 60000 / bpm;
        const window = PERFECT_WINDOWS[options.difficulty];
        // ── Step 1: Split into characters, assign times ──────────────────────
        // Character order is sacred — every character becomes a note, in order.
        // No density filtering: skipping notes breaks the typing contract.
        const chars = Array.from(content);
        const notes = [];
        for (let i = 0; i < chars.length; i++) {
            notes.push({
                key: chars[i],
                time: LEAD_IN_MS[options.difficulty] + Math.round(i * beatInterval),
                window,
            });
        }
        // ── Step 2: Difficulty scaling (timing windows only) ──────────────────
        // Hard/expert use tighter timing windows; character order is sacred.
        // No note doubling — that belongs in rhythm games, not typing.
        return notes;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
export { effectiveBpm };
//# sourceMappingURL=beatmap-generator.js.map