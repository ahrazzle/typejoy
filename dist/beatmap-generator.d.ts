import type { Note, Difficulty } from './types.js';
export interface GeneratorOptions {
    /** Tempo in beats per minute */
    bpm: number;
    /** Difficulty tier (controls timing window and note density) */
    difficulty: Difficulty;
    /** Target words per minute — alternative to BPM. If set, overrides bpm. */
    wordsPerMinute?: number;
}
/** Timing window per difficulty (ms) — how tight the hit window is. */
declare const TIMING_WINDOWS: Record<Difficulty, number>;
/** Returns the hand ('left' | 'right') for a given key character. */
declare function handOf(key: string): 'left' | 'right';
/**
 * Computes the effective BPM. If `wordsPerMinute` is provided, derives BPM
 * from the rule: 1 note/beat × 5 chars/word → WPM = bpm / 5  →  bpm = WPM × 5.
 */
declare function effectiveBpm(options: GeneratorOptions): number;
export declare class BeatMapGenerator {
    /**
     * Generate a rhythmic note array from typing content.
     *
     * @param content  The text to convert (each character becomes a note).
     * @param options  Tempo, difficulty, and optional WPM target.
     * @returns An ordered array of notes ready to wrap in a StaticBeatMap.
     */
    generate(content: string, options: GeneratorOptions): Note[];
}
export { effectiveBpm, handOf, TIMING_WINDOWS };
//# sourceMappingURL=beatmap-generator.d.ts.map