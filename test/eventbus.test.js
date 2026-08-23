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
// ─────────────────────────────────────────────────────────────────────────────
// Test Utilities
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`  ✓ ${message}`);
    }
    else {
        failed++;
        console.log(`  ✗ ${message}`);
    }
}
function assertEqual(actual, expected, message) {
    if (actual === expected) {
        passed++;
        console.log(`  ✓ ${message}`);
    }
    else {
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
    let capturedEvent = null;
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
    let capturedChar = null;
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
    const notes = [
        { key: 'f', time: 1000, window: 150 },
        { key: 'j', time: 2000, window: 150 },
        { key: 'd', time: 3000, window: 150 },
    ];
    const beatMap = new StaticBeatMap(notes);
    const windows = { perfect: 40, great: 80, good: 150 };
    const judgments = [];
    const hooks = {
        onHit: (event) => {
            judgments.push({ judgment: event.judgment, key: event.key, delta: event.delta });
        },
        onMiss: (key, _expectedKey, delta) => {
            judgments.push({ judgment: 'miss', key, delta });
        },
        onNoteStale: () => { },
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
    const notes = [
        { key: 'f', time: 1000, window: 150 },
    ];
    const beatMap = new StaticBeatMap(notes);
    const windows = { perfect: 40, great: 80, good: 150 };
    const judgments = [];
    const hooks = {
        onHit: (event) => {
            judgments.push(event);
        },
        onMiss: () => { },
        onNoteStale: () => { },
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
    const notes = [
        { key: 'f', time: 1000, window: 150 },
    ];
    const beatMap = new StaticBeatMap(notes);
    const windows = { perfect: 40, great: 80, good: 150 };
    let staleFired = false;
    const hooks = {
        onHit: () => { },
        onMiss: () => { },
        onNoteStale: () => {
            staleFired = true;
        },
    };
    const judge = new BeatClockJudge(beatMap, { difficulty: 'easy', windows }, hooks);
    // Tick past the note's window (1000 + 150 = 1150ms)
    judge.tick(1200);
    assert(staleFired, 'onNoteStale fired when note passes window');
    assertEqual(judge.state.cursor, 1, 'Cursor advanced past stale note');
}
// ─────────────────────────────────────────────────────────────────────────────
// Test: Combo multiplier progression
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[6] BeatClockJudge — Combo multiplier');
{
    const notes = Array.from({ length: 10 }, (_, i) => ({
        key: ['f', 'j', 'd', 'k', 's', 'l', 'a', ';', 'g', 'h'][i],
        time: (i + 1) * 1000,
        window: 150,
    }));
    const beatMap = new StaticBeatMap(notes);
    const windows = { perfect: 40, great: 80, good: 150 };
    const combos = [];
    const hooks = {
        onHit: () => { },
        onMiss: () => { },
        onNoteStale: () => { },
        onCombo: (count, multiplier) => {
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
    const plugin1 = {
        onHit: () => { plugin1Hits++; },
        onMiss: () => { },
        onNoteStale: () => { },
        onCombo: () => { },
    };
    const plugin2 = {
        onHit: () => { plugin2Hits++; },
        onMiss: () => { },
        onNoteStale: () => { },
        onCombo: () => { },
    };
    registry.register(plugin1);
    registry.register(plugin2);
    const notes = [
        { key: 'f', time: 1000, window: 150 },
    ];
    const beatMap = new StaticBeatMap(notes);
    const windows = { perfect: 40, great: 80, good: 150 };
    const judge = new BeatClockJudge(beatMap, { difficulty: 'easy', windows }, {
        onHit: (event) => registry.onHit(event),
        onMiss: () => { },
        onNoteStale: () => { },
        onCombo: () => { },
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
// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) {
    process.exit(1);
}
//# sourceMappingURL=eventbus.test.js.map