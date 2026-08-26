import { RawBus } from '../src/RawBus.ts';
import { NormalizedBus } from '../src/NormalizedBus.ts';
import { BeatClockJudge } from '../src/BeatClockJudge.ts';
import { BeatMapGenerator } from '../src/beatmap-generator.ts';
import { StaticBeatMap } from '../src/BeatMap.ts';
import type { JudgmentEvent, BeatNote, NormalizedEvent } from '../src/types.ts';

let passCount = 0;
let failCount = 0;
function assert(condition: boolean, msg: string) {
  if (condition) { passCount++; console.log('  PASS:', msg); }
  else { failCount++; console.log('  FAIL:', msg); }
}

console.log('\n=== Integration Test: Full Pipeline ===\n');

const generator = new BeatMapGenerator();
const notes = generator.generate('hi', { bpm: 40, difficulty: 'easy' });
console.log('Beat-map:');
notes.forEach((n, i) => console.log(`  [${i}] key="${n.key}" time=${n.time}ms window=${n.window}ms`));

const beatMap = new StaticBeatMap(notes);

const judgments: Array<{judgment: string; key: string; delta: number}> = [];
const judge = new BeatClockJudge(
  beatMap,
  { difficulty: 'easy' },
  {
    onHit: (e: JudgmentEvent) => {
      judgments.push({ judgment: e.judgment, key: e.key, delta: e.delta });
      console.log(`  HIT: ${e.judgment} key="${e.key}" delta=${e.delta.toFixed(0)}ms combo=${judge.combo}`);
    },
    onMiss: (k: string, ek: string, d?: number) => {
      judgments.push({ judgment: 'miss', key: k, delta: d ?? 0 });
      console.log(`  MISS: key="${k}" expected="${ek}" delta=${d?.toFixed(0)}ms`);
    },
    onNoteStale: (n: BeatNote) => {
      console.log(`  STALE: key="${n.key}" at ${n.time}ms`);
    },
  }
);

const rawBus = new RawBus();
const normBus = new NormalizedBus(rawBus);
normBus.onChar((evt: NormalizedEvent) => judge.onChar(evt));

normBus.start();
rawBus.start();
const startTime = performance.now();
judge.setStartTime(startTime);

async function waitAndPress(key: string, code: string, targetSongTime: number) {
  const now = performance.now();
  const currentSongTime = now - startTime;
  const waitTime = targetSongTime - currentSongTime;
  if (waitTime > 0) {
    await new Promise(r => setTimeout(r, waitTime));
  }
  const pressTime = performance.now();
  const songTime = pressTime - startTime;
  console.log(`  [Injecting "${key}" at songTime=${songTime.toFixed(0)}ms (target: ${targetSongTime}ms)]`);
  rawBus.inject(key, code, 'keydown', pressTime);
  await new Promise(r => setTimeout(r, 50));
}

console.log('\nTest 1: Press "h" at exact note time (3000ms)');
await waitAndPress('h', 'KeyH', 3000);
assert(judgments.some(j => j.key === 'h' && j.judgment === 'perfect'), `Expected perfect for "h", got ${JSON.stringify(judgments)}`);

console.log('\nTest 2: Press "i" at exact note time (4500ms)');
await waitAndPress('i', 'KeyI', 4500);
assert(judgments.some(j => j.key === 'i' && j.judgment === 'perfect'), `Expected perfect for "i", got ${JSON.stringify(judgments)}`);

console.log(`\n=== Results: ${passCount} passed, ${failCount} failed ===`);

if (failCount > 0) {
  console.log('\nFAILED - integration test revealed bugs');
  throw new Error(`${failCount} assertions failed`);
} else {
  console.log('\nPASSED - full pipeline working correctly');
}
