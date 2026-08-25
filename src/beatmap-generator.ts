// ============================================================================
// BeatMapGenerator — Converts typing content into rhythmic note arrays
// ============================================================================
// The bridge between "typing lesson" and "rhythm game." Takes a string of
// characters and produces a Note[] spaced according to BPM, with difficulty-
// based density and key-hand alternation.

import type { Note, Difficulty } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GeneratorOptions {
  /** Tempo in beats per minute */
  bpm: number;
  /** Difficulty tier (controls timing window and note density) */
  difficulty: Difficulty;
  /** Target words per minute — alternative to BPM. If set, overrides bpm. */
  wordsPerMinute?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Timing window per difficulty (ms) — how tight the hit window is. */
const TIMING_WINDOWS: Record<Difficulty, number> = {
  easy: 500,
  medium: 300,
  hard: 150,
  expert: 80,
};

/** Lead-in time before the first note (ms) — gives players time to prepare. */
const LEAD_IN_MS = 3000;

/** Common letters that get doubled notes on hard difficulty. */
const COMMON_LETTERS = new Set(['e', 't', 'a', 'o', 'i', 'n', 's', 'r']);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the effective BPM. If `wordsPerMinute` is provided, derives BPM
 * from the rule: 1 note/beat × 5 chars/word → WPM = bpm / 5  →  bpm = WPM × 5.
 */
function effectiveBpm(options: GeneratorOptions): number {
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
  generate(content: string, options: GeneratorOptions): Note[] {
    const bpm = effectiveBpm(options);
    const beatInterval = 60000 / bpm;
    const window = TIMING_WINDOWS[options.difficulty];

    // ── Step 1: Split into characters, assign times ──────────────────────
    const chars = Array.from(content);
    const notes: Note[] = [];

    for (let i = 0; i < chars.length; i++) {
      const key = chars[i];

      // Apply difficulty-based density filtering.
      if (shouldSkip(key, options.difficulty, i)) {
        continue;
      }

      notes.push({
        key,
        time: LEAD_IN_MS + Math.round(i * beatInterval),
        window,
      });
    }

    // ── Step 2: Hard difficulty — double notes for common letters ─────────
    if (options.difficulty === 'hard') {
      injectDoubledNotes(notes, beatInterval);
    }

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
function shouldSkip(key: string, difficulty: Difficulty, _index: number): boolean {
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
function injectDoubledNotes(notes: Note[], beatInterval: number): void {
  const halfBeat = Math.round(beatInterval / 2);
  let inserted = 0;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (COMMON_LETTERS.has(note.key)) {
      // Insert a doubled note at +half-beat.
      const doubled: Note = {
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
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export { effectiveBpm, TIMING_WINDOWS };