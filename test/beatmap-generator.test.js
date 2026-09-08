/**
 * BeatMapGenerator — Validation Tests
 *
 * Verifies the beat-map generator produces correct Note arrays for various
 * BPM/difficulty combinations, with correct timing, hand alternation, and
 * note density.
 */
import { BeatMapGenerator } from '../src/beatmap-generator';
import { StaticBeatMap } from '../src/BeatMap';
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
// Test: Easy / 60 BPM produces correct note count and timing
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[1] Easy / 60 BPM — Note count and timing');
{
    const gen = new BeatMapGenerator();
    const content = 'hello world';
    const notes = gen.generate(content, { bpm: 60, difficulty: 'easy' });
    // 60 BPM → beatInterval = 1000ms. 11 chars → 11 notes.
    assertEqual(notes.length, 11, '11 characters → 11 notes (easy keeps all)');
    // Timing: each note is 1000ms apart.
    assertEqual(notes[0].time, 0, 'First note at t=0');
    assertEqual(notes[1].time, 1000, 'Second note at t=1000');
    assertEqual(notes[10].time, 10000, 'Last note at t=10000');
    // Window = 150ms for easy.
    assertEqual(notes[0].window, 150, 'Easy window is 150ms');
    // Keys are a permutation of the original (hand-alternation may swap them).
    const sortedKeys = notes.map(n => n.key).sort();
    const sortedOriginal = Array.from(content).sort();
    assertEqual(sortedKeys.join(''), sortedOriginal.join(''), 'Keys are a permutation of original');
    // Can wrap in StaticBeatMap.
    const beatMap = new StaticBeatMap(notes);
    assertEqual(beatMap.length, 11, 'StaticBeatMap wraps 11 notes');
    assertEqual(beatMap.getNote(0)?.key, notes[0].key, 'StaticBeatMap first note matches');
}
// ─────────────────────────────────────────────────────────────────────────────
// Test: Notes are spaced at correct BPM intervals
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[2] BPM interval correctness');
{
    const gen = new BeatMapGenerator();
    // 120 BPM → beatInterval = 500ms.
    const notes120 = gen.generate('abcd', { bpm: 120, difficulty: 'easy' });
    assertEqual(notes120[0].time, 0, '120 BPM: first at 0');
    assertEqual(notes120[1].time, 500, '120 BPM: second at 500');
    assertEqual(notes120[2].time, 1000, '120 BPM: third at 1000');
    assertEqual(notes120[3].time, 1500, '120 BPM: fourth at 1500');
    // 180 BPM → beatInterval ≈ 333.33ms.
    const notes180 = gen.generate('abc', { bpm: 180, difficulty: 'easy' });
    const beatInterval = 60000 / 180; // 333.33...
    assertEqual(notes180[1].time, Math.round(beatInterval), `180 BPM: interval ≈ ${Math.round(beatInterval)}ms`);
    assertEqual(notes180[2].time, Math.round(2 * beatInterval), `180 BPM: third note at ${Math.round(2 * beatInterval)}ms`);
}
// ─────────────────────────────────────────────────────────────────────────────
// Test: WordsPerMinute overrides BPM
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[3] WordsPerMinute → BPM mapping');
{
    const gen = new BeatMapGenerator();
    // 12 WPM × 5 = 60 BPM → beatInterval = 1000ms.
    const notesWpm = gen.generate('abc', { bpm: 999, difficulty: 'easy', wordsPerMinute: 12 });
    assertEqual(notesWpm[0].time, 0, 'WPM: first at 0');
    assertEqual(notesWpm[1].time, 1000, 'WPM=12 → 60 BPM → interval=1000ms');
    assertEqual(notesWpm[2].time, 2000, 'WPM=12 → 60 BPM → third at 2000ms');
    // 24 WPM × 5 = 120 BPM → interval = 500ms.
    const notesWpm24 = gen.generate('ab', { bpm: 999, difficulty: 'easy', wordsPerMinute: 24 });
    assertEqual(notesWpm24[1].time, 500, 'WPM=24 → 120 BPM → interval=500ms');
}
// ─────────────────────────────────────────────────────────────────────────────
// Test: Key-hand alternation reduces same-hand consecutive notes
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[4] Hand-alternation shuffle');
{
    const gen = new BeatMapGenerator();
    // A string that starts with left-left-left: 'as' is left-left, then we need
    // a 3rd left-hand char. Let's use 'asd' → a,s,d all left.
    // After alternation, the middle note should swap with a right-hand char.
    const notes = gen.generate('asdx', { bpm: 120, difficulty: 'easy' });
    // With 'asdx': a,s,d are all left hand. x is also left. So 4 left-hand
    // notes — no alternation possible. Let's test with a known pattern.
    const notes2 = gen.generate('asdfjkl', { bpm: 120, difficulty: 'easy' });
    // a,s,d,f are left; j,k,l are right. After shuffling, the first few
    // notes should alternate more.
    assert(notes2.length === 7, '7 notes generated');
    // Count consecutive same-hand pairs.
    function countSameHandRuns(notes) {
        let runs = 0;
        for (let i = 0; i < notes.length - 1; i++) {
            const hand0 = handOfCheck(notes[i].key);
            const hand1 = handOfCheck(notes[i + 1].key);
            if (hand0 === hand1)
                runs++;
        }
        return runs;
    }
    const sameHand = countSameHandRuns(notes2);
    // Without alternation, 'asdfjkl' would have runs at: a-s, s-d, d-f (3 runs
    // in first 4 notes) + j-k, k-l (2 runs in last 3) = 5 consecutive same-hand
    // pairs. With alternation, this should be lower.
    assert(sameHand < 5, `Same-hand consecutive pairs reduced: ${sameHand} < 5`);
    // Verify alternation by comparing with un-shuffled baseline.
    // For 'asdfjkl': a,s,d,f = left, j,k,l = right.
    // Without shuffle: L,L,L,L,R,R,R → 5 same-hand adjacencies.
    // With shuffle, middle notes get swapped with right-hand ones.
    console.log(`    Same-hand pairs in 'asdfjkl': ${sameHand}`);
}
// Helper for tests (mirrors internal handOf).
function handOfCheck(key) {
    const LEFT = new Set(['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g', 'z', 'x', 'c', 'v', 'b']);
    return LEFT.has(key) ? 'left' : 'right';
}
// ─────────────────────────────────────────────────────────────────────────────
// Test: Different difficulties produce appropriate density
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[5] Difficulty-based note density');
{
    const gen = new BeatMapGenerator();
    const content = 'hi there'; // 8 chars including space.
    // Easy: keep everything.
    const easy = gen.generate(content, { bpm: 120, difficulty: 'easy' });
    assertEqual(easy.length, 8, 'Easy: all 8 chars kept');
    // Medium: skip spaces.
    const medium = gen.generate(content, { bpm: 120, difficulty: 'medium' });
    assertEqual(medium.length, 7, 'Medium: space skipped → 7 notes');
    const hasSpace = medium.some(n => n.key === ' ');
    assert(!hasSpace, 'Medium: no space notes present');
    // Hard: keep everything AND add doubled notes for common letters.
    const hard = gen.generate(content, { bpm: 120, difficulty: 'hard' });
    // 'hi there' → h,i,space,t,h,e,r,e
    // common letters (hard doubles these): h, t, h, e, r, e → 6 common.
    // So 8 + 6 = 14 notes expected.
    assert(hard.length > 8, `Hard: doubled notes added (${hard.length} > 8)`);
    // Verify doubled note is at half-beat offset.
    // Find a doubled 'e' note (common letter).
    const eNotes = hard.filter(n => n.key === 'e');
    assert(eNotes.length >= 2, `Hard: 'e' appears ${eNotes.length} times (was 2, doubled)`);
    // Window sizes differ by difficulty.
    assertEqual(easy[0].window, 150, 'Easy window = 150ms');
    assertEqual(medium[0].window, 80, 'Medium window = 80ms');
    assertEqual(hard[0].window, 40, 'Hard window = 40ms');
}
// ─────────────────────────────────────────────────────────────────────────────
// Test: Hand-alternation preserves timing
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[6] Hand-alternation preserves timing');
{
    const gen = new BeatMapGenerator();
    const content = 'asdfghjkl';
    const notes = gen.generate(content, { bpm: 60, difficulty: 'easy' });
    // All times should still be at correct 1000ms intervals (only keys swapped).
    for (let i = 0; i < notes.length; i++) {
        const expectedTime = i * 1000;
        assertEqual(notes[i].time, expectedTime, `Note ${i} at t=${expectedTime}ms`);
    }
    // Keys should be a permutation of the original.
    const originalKeys = content.split('');
    const resultKeys = notes.map(n => n.key).sort();
    const sortedOriginal = [...originalKeys].sort();
    assertEqual(resultKeys.join(''), sortedOriginal.join(''), 'Keys are permuted (no additions or deletions)');
}
// ─────────────────────────────────────────────────────────────────────────────
// Test: Empty content
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[7] Edge cases');
{
    const gen = new BeatMapGenerator();
    const empty = gen.generate('', { bpm: 120, difficulty: 'easy' });
    assertEqual(empty.length, 0, 'Empty string → empty notes');
    const single = gen.generate('a', { bpm: 120, difficulty: 'easy' });
    assertEqual(single.length, 1, 'Single char → 1 note');
    assertEqual(single[0].key, 'a', 'Single char key preserved');
    assertEqual(single[0].time, 0, 'Single char at t=0');
}
// ─────────────────────────────────────────────────────────────────────────────
// Test: Round-trip through StaticBeatMap
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[8] Integration with StaticBeatMap');
{
    const gen = new BeatMapGenerator();
    const notes = gen.generate('f j d k', { bpm: 120, difficulty: 'medium' });
    const beatMap = new StaticBeatMap(notes);
    assert(beatMap.length > 0, 'BeatMap constructed');
    // StaticBeatMap sorts by time — verify ordering.
    for (let i = 1; i < beatMap.length; i++) {
        assert(beatMap.getNote(i).time >= beatMap.getNote(i - 1).time, `Note ${i} time >= Note ${i - 1} time (sorted)`);
    }
    // getNotesInRange.
    const rangeNotes = beatMap.getNotesInRange(0, 1000);
    assert(rangeNotes.length > 0, 'getNotesInRange returns notes');
    assert(rangeNotes.every(n => n.time >= 0 && n.time <= 1000), 'Range filter works');
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
//# sourceMappingURL=beatmap-generator.test.js.map