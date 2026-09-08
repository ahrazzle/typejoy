/**
 * Typejoy Event Bus — Validation Tests
 * 
 * Verifies: RawBus → NormalizedBus → BeatClockJudge → PluginHooks
 * 
 * Run: npm test
 */

import { RawBus } from '../src/RawBus';
import { NormalizedBus } from '../src/NormalizedBus';
import { BeatClockJudge } from '../src/BeatClockJudge';
import { StaticBeatMap } from '../src/BeatMap';
import { PluginRegistry } from '../src/PluginHooks';
import { BeatMapGenerator } from '../src/beatmap-generator';
import type { 
  BeatNote, 
  JudgmentEvent, 
  TimingWindows,
  PluginHooks as PluginHooksInterface,
  RawKeyEvent,
} from '../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// Test Utilities
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
// Test: RawBus captures key events with performance.now() timestamps
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[1] RawBus — Key event capture');
{
  const rawBus = new RawBus();
  let capturedEvent: RawKeyEvent | null = null;
  
  rawBus.onKeyDown((evt) => {
    capturedEvent = evt;
  });
  
  rawBus.inject('f', 'KeyF', 'keydown', 1000);
  
  assert(capturedEvent !== null, 'Event captured');
  assertEqual(capturedEvent?.key, 'f', 'Key is "f"');
  assertEqual(capturedEvent?.code, 'KeyF', 'Code is "KeyF"');
  assertEqual(capturedEvent?.timestamp, 1000, 'Timestamp is 1000');
  assertEqual(capturedEvent?.type, 'keydown', 'Type is "keydown"');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test: NormalizedBus normalizes raw events correctly
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[2] NormalizedBus — Key normalization');
{
  const rawBus = new RawBus();
  const normBus = new NormalizedBus(rawBus);
  
  let capturedChar: string | null = null;
  normBus.onChar((evt) => {
    capturedChar = evt.char;
  });
  
  // Start the normalized bus to subscribe to raw events
  normBus.start();
  
  // Inject a lowercase 'f' — should normalize to 'f'
  rawBus.inject('f', 'KeyF', 'keydown', 1000);
  assertEqual(capturedChar, 'f', 'Lowercase f normalizes to "f"');
  
  // Test space
  capturedChar = null;
  rawBus.inject(' ', 'Space', 'keydown', 3000);
  assertEqual(capturedChar, ' ', 'Space normalizes to " "');
  
  normBus.stop();
}

// ─────────────────────────────────────────────────────────────────────────────
// Test: BeatClockJudge — Perfect/Great/Good/Miss judgments
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[3] BeatClockJudge — Timing judgments');
{
  const notes: BeatNote[] = [
    { key: 'f', time: 1000, window: 150 },
    { key: 'j', time: 2000, window: 150 },
    { key: 'd', time: 3000, window: 150 },
  ];
  
  const beatMap = new StaticBeatMap(notes);
  const windows: TimingWindows = { perfect: 40, great: 80, good: 150 };
  
  const judgments: Array<{ judgment: string; key: string; delta: number }> = [];
  
  const hooks: Partial<PluginHooksInterface> = {
    onHit: (event: JudgmentEvent) => {
      judgments.push({ judgment: event.judgment, key: event.key, delta: event.delta });
    },
    onMiss: (key: string, _expectedKey: string, delta: number) => {
      judgments.push({ judgment: 'miss', key, delta });
    },
    onNoteStale: () => {},
  };
  
  const judge = new BeatClockJudge(beatMap, { difficulty: 'easy', windows }, hooks);
  
  const rawBus = new RawBus();
  const normBus = new NormalizedBus(rawBus);
  normBus.start();
  judge.attach(normBus);
  
  // Test Perfect hit (delta = 0)
  rawBus.inject('f', 'KeyF', 'keydown', 1000);
  assertEqual(judgments.length, 1, 'One judgment after first keypress');
  assertEqual(judgments[0].judgment, 'perfect', 'Delta=0 → Perfect');
  assertEqual(judgments[0].key, 'f', 'Key is "f"');
  assertEqual(judgments[0].delta, 0, 'Delta is 0');
  
  // Test Great hit (delta = 60ms, within great window of 80ms)
  judgments.length = 0;
  rawBus.inject('j', 'KeyJ', 'keydown', 2060);
  assertEqual(judgments[0].judgment, 'great', 'Delta=60 → Great');
  assertEqual(judgments[0].delta, 60, 'Delta is 60');
  
  // Test Good hit (delta = 120ms, within good window of 150ms)
  judgments.length = 0;
  rawBus.inject('d', 'KeyD', 'keydown', 3120);
  assertEqual(judgments[0].judgment, 'good', 'Delta=120 → Good');
  assertEqual(judgments[0].delta, 120, 'Delta is 120');
  
  normBus.stop();
}

// ─────────────────────────────────────────────────────────────────────────────
// Test: BeatClockJudge — Wrong keys are silently ignored
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[4] BeatClockJudge — Wrong keys silently ignored');
{
  const notes: BeatNote[] = [
    { key: 'f', time: 1000, window: 150 },
  ];
  
  const beatMap = new StaticBeatMap(notes);
  const windows: TimingWindows = { perfect: 40, great: 80, good: 150 };
  
  const judgments: JudgmentEvent[] = [];
  
  const hooks: Partial<PluginHooksInterface> = {
    onHit: (event: JudgmentEvent) => {
      judgments.push(event);
    },
    onMiss: () => {},
    onNoteStale: () => {},
  };
  
  const judge = new BeatClockJudge(beatMap, { difficulty: 'easy', windows }, hooks);
  
  const rawBus = new RawBus();
  const normBus = new NormalizedBus(rawBus);
  normBus.start();
  judge.attach(normBus);
  
  // Press WRONG key (expected 'f', pressed 'g')
  rawBus.inject('g', 'KeyG', 'keydown', 1000);
  assertEqual(judgments.length, 0, 'No judgment for wrong key');
  assertEqual(judge.state.cursor, 0, 'Cursor not advanced on wrong key');
  
  // Press correct key — should now judge
  rawBus.inject('f', 'KeyF', 'keydown', 1000);
  assertEqual(judgments.length, 1, 'Judgment after correct key');
  assertEqual(judgments[0].judgment, 'perfect', 'Correct key after wrong → Perfect');
  
  normBus.stop();
}

// ─────────────────────────────────────────────────────────────────────────────
// Test: BeatClockJudge — Note staleness detection
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[5] BeatClockJudge — Note staleness');
{
  const notes: BeatNote[] = [
    { key: 'f', time: 1000, window: 150 },
  ];
  
  const beatMap = new StaticBeatMap(notes);
  const windows: TimingWindows = { perfect: 40, great: 80, good: 150 };
  
  let staleFired = false;
  
  const hooks: Partial<PluginHooksInterface> = {
    onHit: () => {},
    onMiss: () => {},
    onNoteStale: () => {
      staleFired = true;
    },
  };
  
  const judge = new BeatClockJudge(beatMap, { difficulty: 'easy', windows }, hooks);

  // Set start time 1200ms in the past so getSongTime() returns ~1200ms
  judge.setStartTime(performance.now() - 1200);
  judge.tick();
  assert(staleFired, 'onNoteStale fired when note passes window');
  assertEqual(judge.state.cursor, 1, 'Cursor advanced past stale note');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test: Combo multiplier progression
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[6] BeatClockJudge — Combo multiplier');
{
  const notes: BeatNote[] = Array.from({ length: 10 }, (_, i) => ({
    key: ['f', 'j', 'd', 'k', 's', 'l', 'a', ';', 'g', 'h'][i],
    time: (i + 1) * 1000,
    window: 150,
  }));
  
  const beatMap = new StaticBeatMap(notes);
  const windows: TimingWindows = { perfect: 40, great: 80, good: 150 };
  
  const combos: Array<{ count: number; multiplier: number }> = [];
  
  const hooks: Partial<PluginHooksInterface> = {
    onHit: () => {},
    onMiss: () => {},
    onNoteStale: () => {},
    onCombo: (count: number, multiplier: number) => {
      combos.push({ count, multiplier });
    },
  };
  
  const judge = new BeatClockJudge(beatMap, { difficulty: 'easy', windows }, hooks);
  
  const rawBus = new RawBus();
  const normBus = new NormalizedBus(rawBus);
  normBus.start();
  judge.attach(normBus);
  
  // Hit 10 notes perfectly
  const keys = ['f', 'j', 'd', 'k', 's', 'l', 'a', ';', 'g', 'h'];
  for (let i = 0; i < keys.length; i++) {
    rawBus.inject(keys[i], 'Key' + keys[i].toUpperCase(), 'keydown', (i + 1) * 1000);
  }
  
  assertEqual(combos.length, 10, '10 combo events fired');
  assertEqual(combos[0].multiplier, 1, 'First hit → 1x multiplier');
  assertEqual(combos[8].multiplier, 1, '9th hit → still 1x');
  assertEqual(combos[9].multiplier, 2, '10th hit → 2x multiplier');
  assertEqual(judge.state.combo, 10, 'Combo count is 10');
  assertEqual(judge.state.maxCombo, 10, 'Max combo is 10');
  
  normBus.stop();
}

// ─────────────────────────────────────────────────────────────────────────────
// Test: PluginRegistry fans out to multiple plugins
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[7] PluginRegistry — Multi-plugin dispatch');
{
  const registry = new PluginRegistry();
  
  let plugin1Hits = 0;
  let plugin2Hits = 0;
  
  const plugin1: PluginHooksInterface = {
    onHit: () => { plugin1Hits++; },
    onMiss: () => {},
    onNoteStale: () => {},
    onCombo: () => {},
  };
  
  const plugin2: PluginHooksInterface = {
    onHit: () => { plugin2Hits++; },
    onMiss: () => {},
    onNoteStale: () => {},
    onCombo: () => {},
  };
  
  registry.register(plugin1);
  registry.register(plugin2);
  
  const notes: BeatNote[] = [
    { key: 'f', time: 1000, window: 150 },
  ];
  
  const beatMap = new StaticBeatMap(notes);
  const windows: TimingWindows = { perfect: 40, great: 80, good: 150 };
  
  const judge = new BeatClockJudge(beatMap, { difficulty: 'easy', windows }, {
    onHit: (event) => registry.onHit(event),
    onMiss: () => {},
    onNoteStale: () => {},
    onCombo: () => {},
  });
  
  const rawBus = new RawBus();
  const normBus = new NormalizedBus(rawBus);
  normBus.start();
  judge.attach(normBus);
  
  rawBus.inject('f', 'KeyF', 'keydown', 1000);
  
  assertEqual(plugin1Hits, 1, 'Plugin 1 received hit');
  assertEqual(plugin2Hits, 1, 'Plugin 2 received hit');
  
  normBus.stop();
}

// Test: onStreakThreshold emitted at combo thresholds
console.log('\\n[8] BeatClockJudge — onStreakThreshold emission');
{
  const notes: BeatNote[] = Array.from({ length: 15 }, (_, i) => ({
    key: ['f', 'j', 'd', 'k', 's', 'l', 'a', ';', 'g', 'h', 'r', 'u', 'e', 'i', 'w'][i],
    time: (i + 1) * 1000,
    window: 150,
  }));

  const beatMap = new StaticBeatMap(notes);
  const windows: TimingWindows = { perfect: 40, great: 80, good: 150 };

  const thresholds: number[] = [];

  const hooks: Partial<PluginHooksInterface> = {
    onHit: () => {},
    onMiss: () => {},
    onNoteStale: () => {},
    onCombo: () => {},
    onStreakThreshold: (count: number) => {
      thresholds.push(count);
    },
  };

  const judge = new BeatClockJudge(beatMap, { difficulty: 'easy', windows }, hooks);

  const rawBus = new RawBus();
  const normBus = new NormalizedBus(rawBus);
  normBus.start();
  judge.attach(normBus);

  // Hit 12 notes perfectly — should trigger threshold at 10
  const keys = ['f', 'j', 'd', 'k', 's', 'l', 'a', ';', 'g', 'h', 'r', 'u'];
  for (let i = 0; i < keys.length; i++) {
    rawBus.inject(keys[i], 'Key' + keys[i].toUpperCase(), 'keydown', (i + 1) * 1000);
  }

  assertEqual(thresholds.length, 1, 'One threshold fired at 10 combo');
  assertEqual(thresholds[0], 10, 'Threshold is 10');

  normBus.stop();
}

// Test: getCurrentNote and getNextNote accessors
console.log('\\n[9] BeatClockJudge — Note accessors');
{
  const notes: BeatNote[] = [
    { key: 'f', time: 1000, window: 150 },
    { key: 'j', time: 2000, window: 150 },
    { key: 'd', time: 3000, window: 150 },
  ];

  const beatMap = new StaticBeatMap(notes);
  const windows: TimingWindows = { perfect: 40, great: 80, good: 150 };

  const judge = new BeatClockJudge(beatMap, { difficulty: 'easy', windows });

  // getCurrentNote returns the first note initially
  const current = judge.getCurrentNote();
  assertEqual(current?.key, 'f', 'getCurrentNote returns first note');

  // getNextNotes returns upcoming notes
  const upcoming = judge.getNextNotes(2);
  assertEqual(upcoming.length, 2, 'getNextNotes returns 2 notes');
  assertEqual(upcoming[0].note.key, 'f', 'First upcoming note is "f"');
  assertEqual(upcoming[1].note.key, 'j', 'Second upcoming note is "j"');

  // After advancing cursor, getCurrentNote updates
  const rawBus = new RawBus();
  const normBus = new NormalizedBus(rawBus);
  normBus.start();
  judge.attach(normBus);

  rawBus.inject('f', 'KeyF', 'keydown', 1000);

  const current2 = judge.getCurrentNote();
  assertEqual(current2?.key, 'j', 'getCurrentNote advances with cursor');

  normBus.stop();
}

// Test: onWrongKey hook fires when wrong key is pressed
console.log('\\n[10] BeatClockJudge — onWrongKey hook');
{
  const notes: BeatNote[] = [
    { key: 'f', time: 1000, window: 150 },
  ];

  const beatMap = new StaticBeatMap(notes);
  const windows: TimingWindows = { perfect: 40, great: 80, good: 150 };

  const wrongKeys: Array<{ key: string; expectedKey: string }> = [];

  const hooks: Partial<PluginHooksInterface> = {
    onHit: () => {},
    onMiss: () => {},
    onNoteStale: () => {},
    onWrongKey: (key: string, expectedKey: string) => {
      wrongKeys.push({ key, expectedKey });
    },
  };

  const judge = new BeatClockJudge(beatMap, { difficulty: 'easy', windows }, hooks);

  const rawBus = new RawBus();
  const normBus = new NormalizedBus(rawBus);
  normBus.start();
  judge.attach(normBus);

  // Press WRONG key
  rawBus.inject('g', 'KeyG', 'keydown', 1000);
  assertEqual(wrongKeys.length, 1, 'onWrongKey fired for wrong key');
  assertEqual(wrongKeys[0].key, 'g', 'Wrong key is "g"');
  assertEqual(wrongKeys[0].expectedKey, 'f', 'Expected key is "f"');

  // Press correct key
  rawBus.inject('f', 'KeyF', 'keydown', 1000);
  assertEqual(wrongKeys.length, 1, 'onWrongKey not fired for correct key');

  normBus.stop();
}

// Test: Character order is preserved (no hand-alternation shuffle)
console.log('\\n[11] BeatMapGenerator — Character order preserved');
{
  const gen = new BeatMapGenerator();
  const content = 'abcdef123456';
  const notes = gen.generate(content, { bpm: 60, difficulty: 'easy' });

  const result = notes.map(n => n.key).join('');
  assertEqual(result, content, 'Character order matches input exactly');
}

// Test: getNextNotes returns upcoming notes with timeUntilHit
console.log('\\n[12] BeatClockJudge — getNextNotes');
{
  const notes: BeatNote[] = [
    { key: 'f', time: 1000, window: 150 },
    { key: 'j', time: 2000, window: 150 },
    { key: 'd', time: 3000, window: 150 },
    { key: 'k', time: 4000, window: 150 },
  ];

  const beatMap = new StaticBeatMap(notes);
  const windows: TimingWindows = { perfect: 40, great: 80, good: 150 };

  const judge = new BeatClockJudge(beatMap, { difficulty: 'easy', windows });
  judge.setStartTime(performance.now() - 500); // 500ms into song

  const upcoming = judge.getNextNotes(3);
  assertEqual(upcoming.length, 3, 'Returns 3 upcoming notes');
  assertEqual(upcoming[0].note.key, 'f', 'First note is "f"');
  assertEqual(upcoming[1].note.key, 'j', 'Second note is "j"');
  assertEqual(upcoming[2].note.key, 'd', 'Second note is "d"');

  // timeUntilHit should be approximately note.time - 500
  const tolerance = 50;
  assert(Math.abs(upcoming[0].timeUntilHit - 500) < tolerance, 'First note timeUntilHit ~500ms');
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
