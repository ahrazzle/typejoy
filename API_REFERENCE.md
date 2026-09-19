# Typejoy API Reference

Every public class, function, and the plugin contract, with signatures as they
appear in `src/`. This file is machine-checked by `npm run docs` — each
signature listed under a class heading must exist in that class's source file.

---

## `RawBus` — raw key capture

Captures `keydown`/`keyup` from a DOM target with `performance.now()`
timestamps stamped inside the DOM handler. See `src/RawBus.ts`.

constructor(target?)
onKeyDown(fn)
onEvent(fn)
start()
stop()
inject(key, code, type, timestamp?)
isListening()

- `onKeyDown` fires for keydown events only. `onEvent` fires for both.
- `inject` bypasses the DOM (tests / headless use); the timestamp is captured
  at call time unless one is passed explicitly.
- `target` defaults to `window`; inject a mock for tests or SSR.

## `NormalizedBus` — key normalization

Converts raw events to clean character events (shift/caps handling, key-repeat
filtering). See `src/NormalizedBus.ts`.

constructor(rawBus)
start()
stop()
onChar(fn)
injectRaw(raw)
normalizeKey(raw)

- Only keydown produces `press` events; keyup produces `release` events.
  Repeats are dropped.
- `normalizeKey` maps a raw event to a character using a US-QWERTY table,
  falling back to `e.key` for unknown codes. Letters use shift-XOR-caps;
  `Space` normalizes to `' '`.
- Note: `keyboard-layout.ts` also exports a `normalizeKey`, which maps key
  *names* to layout ids — a different function for a different job.

## `StaticBeatMap` — immutable note storage

Read-only note array. Holds notes only — no cursor, no combo. See `src/BeatMap.ts`.

constructor(notes)
getNote(index)
getNotesInRange(startMs, endMs)

- The constructor defensively copies and sorts notes by time.

## `BeatMapGenerator` — text → rhythmic notes

Converts typing content into a note array spaced by BPM. See
`src/beatmap-generator.ts`.

generate(content, options)
effectiveBpm(options)

- `options`: `{ bpm, difficulty, wordsPerMinute? }`. WPM overrides BPM via
  `bpm = wpm × 5`.
- Each character becomes one note, in order — order is sacred, nothing is
  skipped or shuffled. Note `i` lands at
  `LEAD_IN_MS[difficulty] + i × (60000 / bpm)`.
- Each note's `window` is stamped with the difficulty's *perfect* window;
  the judge applies its own full window set at judgment time.
- `LEAD_IN_MS` (per-difficulty ms before the first note) is exported and
  re-exported by `session.ts` — the single source for ring preempt times.

## `BeatClockJudge` — timing judge

Compares normalized presses against the beat-map cursor and classifies
Perfect/Great/Good/Miss. Tracks combo, multiplier, judgment counts, and
fires plugin hooks. See `src/BeatClockJudge.ts`.

constructor(beatMap, config, hooks?)
attach(normalizedBus)
detach()
setStartTime(time)
getSongTime()
onChar(evt)
onJudgment(fn)
tick(currentSongTime?)
reset()
getCurrentPosition()
getExpectedNote()
getCurrentNote()
getNoteAt(beatPosition)
getNotes()
getNextNotes(count?)
combo()
maxCombo()
state()
judgmentCounts()

- Judgment rules: correct key within the good window → Perfect/Great/Good by
  sub-window; correct key outside all windows → miss (combo breaks, cursor
  advances); wrong key → `onWrongKey` fires but the cursor does not advance
  and the combo does not break; presses before a note's window opens are
  ignored. Comparison is case-insensitive.
- `tick(songTime)` marks notes stale once `songTime > note.time + good
  window`, firing `onNoteStale` per note. Defaults to the live song clock.
- `onComboBreak` fires only when there was a combo to break (combo > 0).
- `onSongComplete(results)` fires exactly once when the last note resolves
  (hit, miss, or stale). `results` carries `score`, `maxCombo`, `totalNotes`,
  `judgments { perfect, great, good, miss }`, `accuracy`, `passed`, and
  `duration`. Scoring: perfect = 300, great = 200, good = 100.
- `config`: `{ difficulty, windows?, comboThresholds? }`.
  `hooks`: `Partial<PluginHooks>` — see `types` below.

## `PluginRegistry` — hook fan-out

Registry that dispatches judge events to every registered plugin.
See `src/PluginHooks.ts`.

register(plugin)
count()
onHit(event)
onMiss(key, expectedKey, delta)
onNoteStale(note)
onCombo(count, multiplier)
onComboBreak(previousCount)

## `DebugPlugin` — contract validator

Minimal `GamePlugin` implementation proving the plugin contract end to end.
See `src/debug-plugin.ts`.

onGameStart(config)
onGameEnd(results)
onHit(judgment, key, delta)
onMiss(key, expectedKey)
onNoteStale(note)
onCombo(count, multiplier)
onStreakThreshold(count)
onSongComplete(results)
getCanvasContext()
getFeedbackLayer()
setFeedbackLayer(layer)
destroy()

- Also exported from the package root for quick smoke tests.

## `FeedbackLayer` — shared game feel

Renders judgments through an SVG keyboard, a canvas particle overlay, and
approach rings; exposes ARIA announcements, combo display, stats, and
accuracy. See `src/feedback-layer.ts`.

constructor(options)
renderHit(judgment, key, delta)
renderMiss(key, expectedKey)
renderStale(note)
renderCombo(count, multiplier)
pulseKey(key, bpm)
setTheme(theme)
setHighContrast(enabled)
setReducedMotion(enabled)
setNudgeEnabled(enabled)
setJudge(judge)
setPreemptTime(ms)
setNoteCount(count)
markNoteJudged(note, judgment)
announce(message)
reset()
resetStats()
getAccuracy()
getRanking()
playCelebration()
resize(width, height)
start()
stop()
updateNudges()
getKeyboardElement()
getCanvasOverlay()
getContainer()
getLiveRegion()

- `options`: `{ container, theme?, width?, height? }` (default 900×300).
- `setJudge` must be called before `start()` so rings and the expected-key
  indicator exist when animation begins.
- `getAccuracy()` weights perfect = 1, great = 0.75, good = 0.5, miss = 0;
  `getRanking()` maps it to S/A/B/C/D/F.

## `SVGKeyboardRenderer` — crisp SVG keyboard

Renders the QWERTY keycap grid with ARIA labels, spring-depression, pulse,
shake, and highlight effects. See `src/svg-keyboard.ts`.

constructor(container, options?)
getKeyElement(keyId)
depressKey(keyId)
pulseKey(keyId, bpm)
shakeKey(keyId)
setNudgeGlow(keyId, intensity)
clearNudgeGlow(keyId)
setKeyHighlight(keyId, color, opacity?)
clearKeyHighlight(keyId)
applyTheme(theme, highContrast?)
getElement()
reset()

- `options`: `{ layout?, unitSize?, keyGap?, borderRadius? }`.
- Key ids are layout ids (`'a'`, `'space'`, `'semicolon'`, …); use
  `normalizeKey` from `keyboard-layout.ts` to map key names to ids.

## `ParticleSystem` — canvas effects

Particles, ripples, specular sweeps, screen shake, and edge glow on a
pointer-events-none canvas overlay. See `src/particle-system.ts`.

constructor(canvas)
setTheme(theme)
setReducedMotion(reduced)
resize(width, height)
emitRipple(x, y, judgment)
emitSpecularSweep()
emitBurst(x, y, judgment, style, density?)
emitMutedFlash(x, y)
emitWrongKeyBurst(x, y)
addShake(intensity, duration?)
addEdgeGlow(color, intensity, duration?)
getShakeOffset()
start()
stop()
clear()

- Reduced motion suppresses everything except perfect-hit effects.

## `ApproachRingSystem` — osu!-style rings

Shrinking rings over upcoming notes, color-ramped by proximity.
See `src/approach-ring-system.ts`.

constructor(canvas)
setPreemptTime(ms)
setNoteCount(count)
resize(width, height)
clear()
markJudged(note, judgment)
update()
render()
start()
stop()

- The feedback layer sets the public `judge`, `keyboard`, and `container`
  references via `FeedbackLayer.setJudge`.

## `createSession` — safe one-call bootstrap

Wires the full pipeline (RawBus → NormalizedBus → BeatClockJudge →
FeedbackLayer) in the safe order, with judge events automatically routed
into the feedback layer. See `src/session.ts`.

createSession(options)

- `options`: `{ container, content, bpm?, difficulty?, hooks?, feedback? }`.
- The session wraps your `hooks`: judgment visuals (hit/miss flashes, ring
  collapse, combo display, song-complete celebration) render automatically,
  and your hooks are still called with the same events.
- A 100ms interval drives `judge.tick()` for stale-note detection; it is
  cleared by `destroy()`, which also stops the buses and animation and
  removes the keyboard DOM (idempotent).
- Returns `{ judge, feedback, beatMap, rawBus, normBus, songTime(), destroy() }`.

## `types` — shared types and plugin contract

Core types, the `PluginHooks` interface the judge dispatches to, and the
`GamePlugin` contract. See `src/types.ts`.

- `Judgment` = `'perfect' | 'great' | 'good'`; `JudgmentEvent` carries
  `judgment: Judgment | 'miss'`, `key`, `delta`, `note`, `timestamp`.
- `PluginHooks`: `onHit`, `onMiss`, `onWrongKey`, `onNoteStale`, `onCombo`,
  `onComboBreak`, `onStreakThreshold`, `onSongComplete`.
- `GamePlugin`: `onGameStart`, `onGameEnd`, `onHit`, `onMiss`,
  `onNoteStale`, `onCombo`, `onStreakThreshold`, `onSongComplete`,
  `getCanvasContext`, `getFeedbackLayer`.
- `TIMING_WINDOWS`: canonical per-difficulty `{ perfect, great, good }`.
  The judge's `windows` config option overrides per instance.
- `DEFAULT_THEME`, `ThemeDescriptor`, `ColorPalette`, `GameConfig`,
  `GameResults`, `Note`/`BeatNote`, `Difficulty`, `AccessibilityConfig`.
- `GameResults` carries `ranking` — the letter rank (`S`/`A`/`B`/`C`/`D`/`F`)
  computed from accuracy. `accuracyToRanking(accuracy)` applies the same scale
  `FeedbackLayer.getRanking()` uses, so the HUD and the final results agree.
