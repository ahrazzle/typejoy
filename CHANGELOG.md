# Changelog

All notable changes to Typejoy are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Plugin guide, API reference, and example-plugin walkthrough under `docs/`.
- `createSession()` facade — a single call that wires the full pipeline in the
  safe order (judge → feedback → start), so consumers can't misorder bootstrap.

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
