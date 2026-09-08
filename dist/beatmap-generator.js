// ============================================================================
// BeatMapGenerator — Converts typing content into rhythmic note arrays
// ============================================================================
// The bridge between "typing lesson" and "rhythm game." Takes a string of
// characters and produces a Note[] spaced according to BPM, with difficulty-
// based density and key-hand alternation.
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
/** Timing window per difficulty (ms) — how tight the hit window is. */
const TIMING_WINDOWS = {
    easy: 150,
    medium: 80,
    hard: 40,
    expert: 25,
};
/** Characters typed by the left hand. */
const LEFT_HAND_KEYS = new Set([
    'q', 'w', 'e', 'r', 't',
    'a', 's', 'd', 'f', 'g',
    'z', 'x', 'c', 'v', 'b',
]);
/** Characters typed by the right hand (includes space). */
/** Common letters that get doubled notes on hard difficulty. */
const COMMON_LETTERS = new Set(['e', 't', 'a', 'o', 'i', 'n', 's', 'r']);
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
/** Returns the hand ('left' | 'right') for a given key character. */
function handOf(key) {
    if (LEFT_HAND_KEYS.has(key))
        return 'left';
    // Default to right hand for any character not in left-hand set.
    return 'right';
}
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
        const window = TIMING_WINDOWS[options.difficulty];
        // ── Step 1: Split into characters, assign times ──────────────────────
        const chars = Array.from(content);
        const notes = [];
        for (let i = 0; i < chars.length; i++) {
            const key = chars[i];
            // Apply difficulty-based density filtering.
            if (shouldSkip(key, options.difficulty, i)) {
                continue;
            }
            notes.push({
                key,
                time: Math.round(i * beatInterval),
                window,
            });
        }
        // ── Step 2: Hard difficulty — double notes for common letters ─────────
        if (options.difficulty === 'hard') {
            injectDoubledNotes(notes, beatInterval);
        }
        // ── Step 3: Hand-alternation shuffle ─────────────────────────────────
        applyHandAlternation(notes);
        return notes;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Density filtering
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Decides whether a character should be skipped based on difficulty.
 * - easy:   keep every character.
 * - medium: skip spaces if they would create excessive clustering.
 * - hard:   keep every character (no skipping).
 * - expert: keep every character.
 */
function shouldSkip(key, difficulty, _index) {
    switch (difficulty) {
        case 'easy':
        case 'hard':
        case 'expert':
            return false;
        case 'medium':
            // On medium, skip spaces — they are non-essential for rhythm feel
            // and would otherwise double-count pauses between words.
            return key === ' ';
        default:
            return false;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Doubled notes (hard difficulty)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * For hard difficulty, inserts an extra note for common letters. The doubled
 * note is placed one half-beat after the original so it feels like a quick
 * tap on the same key.
 */
function injectDoubledNotes(notes, beatInterval) {
    const halfBeat = Math.round(beatInterval / 2);
    let inserted = 0;
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (COMMON_LETTERS.has(note.key)) {
            // Insert a doubled note at +half-beat.
            const doubled = {
                key: note.key,
                time: note.time + halfBeat,
                window: note.window,
            };
            notes.splice(i + inserted + 1, 0, doubled);
            inserted++;
            // Skip the note we just inserted so we don't double-count it.
            i++;
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Hand-alternation shuffle
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Detects three consecutive same-hand notes and swaps the middle one with
 * the next available opposite-hand note, preserving timing.
 *
 * The swap only occurs when it improves alternation (i.e. the swap partner
 * is on the opposite hand and is not also creating a triple).
 */
function applyHandAlternation(notes) {
    if (notes.length < 3)
        return;
    for (let i = 0; i < notes.length - 2; i++) {
        const hand0 = handOf(notes[i].key);
        const hand1 = handOf(notes[i + 1].key);
        const hand2 = handOf(notes[i + 2].key);
        // Triple same hand detected (e.g. left-left-left or right-right-right).
        if (hand0 === hand1 && hand1 === hand2) {
            // Find the next note on the opposite hand to swap with.
            const oppositeHand = hand0 === 'left' ? 'right' : 'left';
            const swapIdx = findOppositeHandNote(notes, i + 3, oppositeHand);
            if (swapIdx !== -1) {
                // Swap notes[i+1] with notes[swapIdx] — but keep times fixed.
                // We only swap the *keys*; times and windows stay in place so the
                // overall rhythm is preserved.
                const tmpKey = notes[i + 1].key;
                notes[i + 1].key = notes[swapIdx].key;
                notes[swapIdx].key = tmpKey;
            }
        }
    }
}
/**
 * Finds the index of the next note (starting at `from`) whose key belongs to
 * the specified hand. Returns -1 if none found.
 */
function findOppositeHandNote(notes, from, hand) {
    for (let i = from; i < notes.length; i++) {
        if (handOf(notes[i].key) === hand) {
            return i;
        }
    }
    return -1;
}
// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
export { effectiveBpm, handOf, TIMING_WINDOWS };
//# sourceMappingURL=beatmap-generator.js.map