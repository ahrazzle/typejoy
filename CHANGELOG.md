# Changelog

All notable changes to Typejoy are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `onSongComplete(results)` hook — fires exactly once when the last note
  resolves (hit, miss, or stale), carrying score, judgment counts, accuracy,
  and pass/fail. `BeatClockJudge.judgmentCounts` exposes the running counts.
- `API_REFERENCE.md` — full public API reference, machine-checked by
  `npm run docs` (which now passes; it was failing on the missing file).
- `LEAD_IN_MS` and `TIMING_WINDOWS` exported from the package root
  (single-sourced from the beat-map generator / types).

### Fixed
- `createSession()` now wires judge events into the feedback layer
  automatically — hit/miss flashes, approach-ring collapse, combo display,
  and a song-complete celebration render with zero manual wiring, and a
  stale-note tick loop runs so unplayed notes resolve. Previously the
  quickstart session judged keypresses but rendered nothing for them.
- `BeatClockJudge.tick()` honors its `currentSongTime` parameter instead of
  silently ignoring it (falls back to the live song clock when omitted).
- `RawBus.onKeyDown` no longer fires for keyup events.
- `onComboBreak` no longer fires when the combo was already 0.
- Stats display follows the active theme instead of hardcoded colors.
- `npm test` runs all four suites (134 tests); the integration suite's
  hardcoded note times were stale and now target the generated notes.
- Removed dead code: the generator's never-skipping `shouldSkip` filter and
  its duplicate `TIMING_WINDOWS` table, the session's duplicate `LEAD_IN_MS`
  table, and unused keyboard-renderer state.

### Changed
- `npm run build` now emits both `dist/game.js` (demo) and `dist/bundle.js`
  from the same source; README updated to match.
- Plugin guide, API reference, and example-plugin walkthrough under `docs/`.

## [0.1.0] — 2026-08-28

### Added
- **Input layer**: `RawBus` captures `keydown`/`keyup` with high-resolution
  timestamps at the source; `NormalizedBus` produces clean character events
  (shift/caps handling, repeat filtering).
- **Timing judge**: `BeatClockJudge` compares keystrokes to a beat-map,
  classifies Perfect/Great/Good/Miss, tracks combo & multiplier, and emits
  hook events. Timing captured at `performance.now()` in the raw listener for
  ±25ms precision.
- **Feedback layer**: `FeedbackLayer` renders an SVG keyboard (ARIA-labeled,
  home-row indicators), canvas particle system (ripples, bursts, confetti,
  screen shake, edge glow), approach rings (osu!/Stepmania style), combo
  display, and judgment stats.
- **Plugin API**: `GamePlugin` lifecycle hooks — `onGameStart`, `onHit`,
  `onMiss`, `onNoteStale`, `onCombo`, `onStreakThreshold`, `onSongComplete`,
  `onGameEnd`.
- **Beat-map generator**: converts arbitrary text into rhythmic notes;
  `LEAD_IN_MS` per difficulty so the first approach ring is visible at start.
- **Demo**: `demo.html` — the framework validated end-to-end.
- **Tests**: event-bus suite + generator suite (94 tests green at release).

### Fixed
- Character order is preserved (removed hand-alternation shuffle — order is
  sacred in typing).
- Case-insensitive judge comparison — a capitalized letter or caps lock no
  longer registers as a miss.
- Approach rings collapse on judgment (hit, miss, or stale), keeping them
  synced with the on-screen feed.
- Timing-window, lead-in, and start-order bugs that caused correct keypresses
  to register as misses on early builds.
