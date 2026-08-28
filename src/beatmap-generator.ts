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

/** Lead-in time before the first note (ms) — matched to each difficulty's
 *  approach-ring preempt time so the first ring is visible at game start. */
const LEAD_IN_MS: Record<Difficulty, number> = {
  easy: 1500,
  medium: 1000,
  hard: 600,
  expert: 350,
};

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
// Step 1 — Density filtering
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decides whether a character should be skipped based on difficulty.
 * - easy:   keep every character.
 * - medium: skip spaces if they would create excessive clustering.
 * - hard:   keep every character (no skipping).
 * - expert: keep every character.
 */
function shouldSkip(_key: string, difficulty: Difficulty, _index: number): boolean {
  switch (difficulty) {
    case 'easy':
    case 'medium':
    case 'hard':
    case 'expert':
      // Never skip spaces — they are part of the user's content
      return false;
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export { effectiveBpm, TIMING_WINDOWS };