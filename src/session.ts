// ============================================================================
// SessionFacade — The safe way to wire a Typejoy game session
// ============================================================================
// Hides the whole wiring sequence (RawBus → NormalizedBus → BeatClockJudge →
// FeedbackLayer) behind one call so forkers can't misorder it. This is the
// exact premature-start bug class we fought in the demo: starting the feedback
// animation loops before the judge exists.
//
// Safe order enforced here:
//   1. create feedback layer (no animation)
//   2. create judge from beat-map
//   3. setJudge(judge)  → approach rings + expected-key indicator wired
//   4. setStartTime()   → timing baseline BEFORE any key can arrive
//   5. start()          → animation loops begin
//   6. attach bus chain → keydown events flow
//
// Usage:
//   const session = createSession({
//     container: document.getElementById('stage'),
//     content: 'hello world',
//     bpm: 60,
//     difficulty: 'easy',
//     hooks: { onHit: (e) => {...}, ... },
//   });
//   session.destroy();  // full teardown, safe to call again

import { RawBus } from './RawBus.js';
import { NormalizedBus } from './NormalizedBus.js';
import { BeatClockJudge } from './BeatClockJudge.js';
import { StaticBeatMap } from './BeatMap.js';
import { BeatMapGenerator } from './beatmap-generator.js';
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

/** Precomputed per-difficulty lead-in — matches the ring preempt times. */
const LEAD_IN_MS: Record<Difficulty, number> = {
  easy: 1500,
  medium: 1000,
  hard: 600,
  expert: 350,
  impossible: 250,
};

/**
 * Create a fully-wired, safely-ordered Typejoy session.
 * Everything a forker needs to go from DOM node to playable game.
 */
export function createSession(options: SessionOptions): TypejoySession {
  const difficulty = options.difficulty ?? 'easy';
  const bpm = options.bpm ?? 60;

  // 1. Feedback layer — constructed but NOT started (no animation yet)
  const feedback = new FeedbackLayer({
    container: options.container,
    ...options.feedback,
  });

  // 2. Beat-map + judge
  const notes = new BeatMapGenerator().generate(options.content, { bpm, difficulty });
  const beatMap = new StaticBeatMap(notes);
  const judge = new BeatClockJudge(beatMap, { difficulty }, options.hooks);

  // 3. Wire judge into feedback BEFORE starting animation (approach rings + indicator)
  feedback.setJudge(judge);
  feedback.setPreemptTime(LEAD_IN_MS[difficulty]);

  // 4. Timing baseline — set before any key can arrive
  const startTime = performance.now();
  judge.setStartTime(startTime);

  // 5. Start animation loops (safe: judge exists now)
  feedback.start();

  // 6. Attach the bus chain — keydown events now flow through the judge
  const rawBus = new RawBus(window);
  const normBus = new NormalizedBus(rawBus);
  normBus.start();
  judge.attach(normBus);
  rawBus.start();

  return {
    judge,
    feedback,
    beatMap,
    rawBus,
    normBus,
    songTime: () => performance.now() - startTime,
    destroy: () => {
      rawBus.stop();
      normBus.stop();
      judge.detach();
      feedback.stop();
      // Remove the keyboard DOM so repeated sessions don't stack
      feedback.getContainer().replaceChildren();
    },
  };
}
