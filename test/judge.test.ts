/**
 * Typejoy Judge + Bus — Regression Tests
 *
 * Covers behavior added/fixed after the initial suites:
 *   - tick() honors its explicit song-time parameter
 *   - RawBus.onKeyDown never fires for keyup events
 *   - onSongComplete fires exactly once with correct GameResults
 *   - No onComboBreak noise when combo is already 0
 *   - reset() clears song-complete state
 *   - LEAD_IN_MS is single-sourced (generator ↔ session)
 *
 * Run: npm test
 */

import { RawBus } from '../src/RawBus';
import { BeatClockJudge } from '../src/BeatClockJudge';
import { StaticBeatMap } from '../src/BeatMap';
import { BeatMapGenerator, LEAD_IN_MS } from '../src/beatmap-generator';
import { LEAD_IN_MS as SESSION_LEAD_IN } from '../src/session';
import type {
  BeatNote,
  NormalizedEvent,
  RawKeyEvent,
  GameResults,
  PluginHooks as PluginHooksInterface,
} from '../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// Harness (matches the style of the other suites)
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message} (expected ${expected}, got ${actual})`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TIGHT = { perfect: 40, great: 80, good: 150 };

function makeRaw(char: string, code: string, type: 'keydown' | 'keyup', timestamp: number): RawKeyEvent {
  return {
    type,
    key: char,
    code,
    timestamp,
    modifiers: { shift: false, ctrl: false, alt: false, meta: false, capsLock: false },
    repeat: false,
  };
}

/** Drive a press directly into the judge at an explicit song time. */
function press(judge: BeatClockJudge, startTime: number, char: string, songTime: number): void {
  const evt: NormalizedEvent = {
    char,
    phase: 'press',
    raw: makeRaw(char, 'Key' + char.toUpperCase(), 'keydown', startTime + songTime),
  };
  judge.onChar(evt);
}

function twoNoteJudge(hooks: Partial<PluginHooksInterface>): { judge: BeatClockJudge; startTime: number } {
  const notes: BeatNote[] = [
    { key: 'f', time: 1000, window: 150 },
    { key: 'j', time: 2000, window: 150 },
  ];
  const judge = new BeatClockJudge(new StaticBeatMap(notes), { difficulty: 'easy', windows: TIGHT }, hooks);
  const startTime = performance.now();
  judge.setStartTime(startTime);
  return { judge, startTime };
}

// ─────────────────────────────────────────────────────────────────────────────
// [1] tick() honors its explicit song-time parameter
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[1] tick() uses the passed song time, not the live clock');
{
  let staleCount = 0;
  const { judge } = twoNoteJudge({ onNoteStale: () => { staleCount++; } });

  // Live clock says songTime ≈ 0 (startTime = now). Passing 5000 explicitly
  // must mark both notes stale (1000+150 and 2000+150 < 5000).
  judge.tick(5000);
  assertEqual(staleCount, 2, 'Both notes stale when tick(5000) is passed explicitly');

  // Fresh judge: tick(100) must NOT mark anything stale (1000+150 > 100).
  let staleCount2 = 0;
  const second = twoNoteJudge({ onNoteStale: () => { staleCount2++; } });
  second.judge.tick(100);
  assertEqual(staleCount2, 0, 'No stale notes when tick(100) is passed');
  assertEqual(second.judge.state.cursor, 0, 'Cursor unmoved');
}

// ─────────────────────────────────────────────────────────────────────────────
// [2] RawBus.onKeyDown never fires for keyup
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[2] RawBus.onKeyDown filters keyup events');
{
  const rawBus = new RawBus();
  const seen: string[] = [];
  rawBus.onKeyDown((evt) => { seen.push(`${evt.type}:${evt.key}`); });

  rawBus.inject('f', 'KeyF', 'keydown', 1000);
  rawBus.inject('f', 'KeyF', 'keyup', 1100);
  rawBus.inject('j', 'KeyJ', 'keydown', 1200);

  assertEqual(seen.length, 2, 'onKeyDown fired twice (keydown only)');
  assertEqual(seen[0], 'keydown:f', 'First event is keydown:f');
  assertEqual(seen[1], 'keydown:j', 'Second event is keydown:j');
}

// ─────────────────────────────────────────────────────────────────────────────
// [3] onSongComplete fires exactly once (hit path)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[3] onSongComplete — fires once with correct results (hits)');
{
  const completions: GameResults[] = [];
  const { judge, startTime } = twoNoteJudge({
    onSongComplete: (r) => { completions.push(r); },
  });

  press(judge, startTime, 'f', 1000); // perfect
  assertEqual(completions.length, 0, 'Not complete after first note');
  press(judge, startTime, 'j', 2000); // perfect
  assertEqual(completions.length, 1, 'Complete fires after last note');

  const r = completions[0];
  assertEqual(r.totalNotes, 2, 'totalNotes = 2');
  assertEqual(r.judgments.perfect, 2, 'perfect = 2');
  assertEqual(r.judgments.miss, 0, 'miss = 0');
  assertEqual(r.score, 600, 'score = 2 × 300');
  assertEqual(r.accuracy, 1, 'accuracy = 1.0');
  assertEqual(r.ranking, 'S', 'ranking = S');
  assertEqual(r.maxCombo, 2, 'maxCombo = 2');
  assertEqual(r.passed, true, 'passed = true');
  assertEqual(r.duration, 2000, 'duration = last note time');

  // Further input and ticks must not fire it again.
  press(judge, startTime, 'f', 3000);
  judge.tick(99999);
  assertEqual(completions.length, 1, 'Still exactly one completion');
}

// ─────────────────────────────────────────────────────────────────────────────
// [4] onSongComplete fires via the stale path (misses counted)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[4] onSongComplete — fires once with correct results (stale)');
{
  const completions: GameResults[] = [];
  const { judge } = twoNoteJudge({
    onSongComplete: (r) => { completions.push(r); },
  });

  judge.tick(99999);
  assertEqual(completions.length, 1, 'Complete fires after notes go stale');

  const r = completions[0];
  assertEqual(r.judgments.miss, 2, 'miss = 2');
  assertEqual(r.score, 0, 'score = 0');
  assertEqual(r.accuracy, 0, 'accuracy = 0');
  assertEqual(r.ranking, 'F', 'ranking = F');
  assertEqual(r.passed, false, 'passed = false');
}

// ─────────────────────────────────────────────────────────────────────────────
// [5] No onComboBreak noise when combo is already 0
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[5] No combo-break events when combo is already 0');
{
  const breaks: number[] = [];
  // Three notes: hit the first (combo 1), let the second go stale (break),
  // let the third go stale too (combo already 0 → no break).
  const notes: BeatNote[] = [
    { key: 'f', time: 1000, window: 150 },
    { key: 'j', time: 2000, window: 150 },
    { key: 'd', time: 3000, window: 150 },
  ];
  const judge = new BeatClockJudge(
    new StaticBeatMap(notes),
    { difficulty: 'easy', windows: TIGHT },
    { onComboBreak: (prev) => { breaks.push(prev); } },
  );
  const startTime = performance.now();
  judge.setStartTime(startTime);

  // Stale with zero combo → no break event (nothing to break).
  judge.tick(1500);
  assertEqual(breaks.length, 0, 'No onComboBreak when combo was 0');

  // Fresh: hit note 0 for a combo of 1, then let note 1 go stale.
  const judge2 = new BeatClockJudge(
    new StaticBeatMap(notes),
    { difficulty: 'easy', windows: TIGHT },
    { onComboBreak: (prev) => { breaks.push(prev); } },
  );
  const start2 = performance.now();
  judge2.setStartTime(start2);
  press(judge2, start2, 'f', 1000); // perfect → combo 1
  judge2.tick(2500); // note 1 (j@2000) stale → break with prev=1
  assertEqual(breaks.length, 1, 'One onComboBreak after real combo');
  assertEqual(breaks[0], 1, 'onComboBreak reports previous combo of 1');

  judge2.tick(99999); // note 2 (d@3000) stale with combo 0 → no break
  assertEqual(breaks.length, 1, 'Still one break — stale at combo 0 is silent');
}

// ─────────────────────────────────────────────────────────────────────────────
// [6] reset() clears song-complete state
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[6] reset() allows a replay to fire onSongComplete again');
{
  let completions = 0;
  const { judge, startTime } = twoNoteJudge({
    onSongComplete: () => { completions++; },
  });

  press(judge, startTime, 'f', 1000);
  press(judge, startTime, 'j', 2000);
  assertEqual(completions, 1, 'First run completes');

  judge.reset();
  press(judge, startTime, 'f', 1000);
  press(judge, startTime, 'j', 2000);
  assertEqual(completions, 2, 'Replay completes again after reset');
  assertEqual(judge.judgmentCounts.perfect, 2, 'Counts reset, not accumulated');
}

// ─────────────────────────────────────────────────────────────────────────────
// [7] judgmentCounts accessor
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[7] judgmentCounts tracks hits and misses');
{
  const { judge, startTime } = twoNoteJudge({});
  press(judge, startTime, 'f', 1000); // perfect
  press(judge, startTime, 'j', 5000); // correct key, way outside window → miss
  const c = judge.judgmentCounts;
  assertEqual(c.perfect, 1, 'perfect = 1');
  assertEqual(c.miss, 1, 'miss = 1');
  assertEqual(c.great, 0, 'great = 0');
}

// ─────────────────────────────────────────────────────────────────────────────
// [8] LEAD_IN_MS single-sourced between generator and session
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[8] LEAD_IN_MS — single source of truth');
{
  assertEqual(SESSION_LEAD_IN.easy, LEAD_IN_MS.easy, 'session re-export matches generator');
  const notes = new BeatMapGenerator().generate('ab', { bpm: 60, difficulty: 'hard' });
  assertEqual(notes[0].time, LEAD_IN_MS.hard, 'First note time = lead-in');
  assertEqual(notes[1].time, LEAD_IN_MS.hard + 1000, 'Second note one beat later');
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n============================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('============================================================\n');
if (failed > 0) process.exit(1);
