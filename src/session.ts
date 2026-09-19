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
import { BeatMapGenerator, LEAD_IN_MS } from './beatmap-generator.js';
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
export function createSession(options: SessionOptions): TypejoySession {
  const difficulty = options.difficulty ?? 'easy';
  const bpm = options.bpm ?? 60;
  const userHooks = options.hooks ?? {};

  // 1. Feedback layer — constructed but NOT started (no animation yet)
  const feedback = new FeedbackLayer({
    container: options.container,
    ...options.feedback,
  });

  // 2. Beat-map + judge.
  //    Judge events are wired into the feedback layer automatically
  //    (hit/miss visuals, ring collapse, combo display, celebration);
  //    the caller's hooks are forwarded alongside, never replaced.
  const notes = new BeatMapGenerator().generate(options.content, { bpm, difficulty });
  const beatMap = new StaticBeatMap(notes);
  const hooks: Partial<PluginHooks> = {
    ...userHooks,
    onHit: (event) => {
      if (event.judgment === 'miss') {
        feedback.renderMiss(event.key, event.note.key);
      } else {
        feedback.renderHit(event.judgment, event.key, event.delta);
      }
      feedback.markNoteJudged(event.note, event.judgment);
      userHooks.onHit?.(event);
    },
    onMiss: (key, expectedKey, delta, note) => {
      feedback.renderMiss(key, expectedKey);
      if (note) feedback.markNoteJudged(note, 'miss');
      userHooks.onMiss?.(key, expectedKey, delta, note);
    },
    onWrongKey: (key, expectedKey) => {
      feedback.renderMiss(key, expectedKey);
      userHooks.onWrongKey?.(key, expectedKey);
    },
    onNoteStale: (note) => {
      feedback.markNoteJudged(note, 'miss');
      userHooks.onNoteStale?.(note);
    },
    onCombo: (count, multiplier) => {
      feedback.renderCombo(count, multiplier);
      userHooks.onCombo?.(count, multiplier);
    },
    onSongComplete: (results) => {
      feedback.playCelebration();
      userHooks.onSongComplete?.(results);
    },
  };
  const judge = new BeatClockJudge(beatMap, { difficulty }, hooks);

  // 3. Wire judge into feedback BEFORE starting animation (approach rings + indicator)
  feedback.setJudge(judge);
  feedback.setPreemptTime(LEAD_IN_MS[difficulty]);

  // 4. Timing baseline — set before any key can arrive
  const startTime = performance.now();
  judge.setStartTime(startTime);

  // 5. Start animation loops (safe: judge exists now)
  feedback.start();

  // 5b. Stale-note tick loop — without this, unplayed notes never resolve
  //      and onSongComplete would never fire.
  const tickHandle = setInterval(() => judge.tick(), 100);

  // 6. Attach the bus chain — keydown events now flow through the judge
  const rawBus = new RawBus(window);
  const normBus = new NormalizedBus(rawBus);
  normBus.start();
  judge.attach(normBus);
  rawBus.start();

  let destroyed = false;
  return {
    judge,
    feedback,
    beatMap,
    rawBus,
    normBus,
    songTime: () => performance.now() - startTime,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      clearInterval(tickHandle);
      rawBus.stop();
      normBus.stop();
      judge.detach();
      feedback.stop();
      // Remove the keyboard DOM so repeated sessions don't stack
      feedback.getContainer().replaceChildren();
    },
  };
}
