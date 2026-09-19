import { RawBus } from './RawBus.js';
import { NormalizedBus } from './NormalizedBus.js';
import { BeatClockJudge } from './BeatClockJudge.js';
import { StaticBeatMap } from './BeatMap.js';
import { LEAD_IN_MS } from './beatmap-generator.js';
import { FeedbackLayer, FeedbackLayerOptions } from './feedback-layer.js';
import type { Difficulty, PluginHooks } from './types.js';
export interface SessionOptions {
    /** DOM element the keyboard + effects render into */
    container: HTMLElement;
    /** The text to type (each character becomes a note) */
    content: string;
    /** Beats per minute (default 60) */
    bpm?: number;
    /** Difficulty tier — controls timing windows + lead-in (default easy) */
    difficulty?: Difficulty;
    /** Extra plugin hooks to forward judge events to (optional) */
    hooks?: Partial<PluginHooks>;
    /** FeedbackLayer options (width/height/theme) */
    feedback?: Partial<Omit<FeedbackLayerOptions, 'container'>>;
}
export interface TypejoySession {
    judge: BeatClockJudge;
    feedback: FeedbackLayer;
    beatMap: StaticBeatMap;
    rawBus: RawBus;
    normBus: NormalizedBus;
    /** Full teardown — stops buses, stops animation, removes keyboard */
    destroy(): void;
    /** Current song time in ms (relative to session start) */
    songTime(): number;
}
/** Precomputed per-difficulty lead-in — single-sourced from the generator so
 *  the session's ring preempt time always matches the first note's lead-in. */
export { LEAD_IN_MS };
/**
 * Create a fully-wired, safely-ordered Typejoy session.
 * Everything a forker needs to go from DOM node to playable game.
 */
export declare function createSession(options: SessionOptions): TypejoySession;
//# sourceMappingURL=session.d.ts.map