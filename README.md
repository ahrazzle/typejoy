# Typejoy — Rhythm-Typing Game Framework

A framework for building rhythm-typing games for kids. Players type to the beat — keystrokes land on timing windows (Perfect/Great/Good/Miss) with satisfying particle effects and an animated reactive keyboard. Build your own game on top with a simple plugin API.

**Live demo:** https://typejoy.askaconsult.com

---

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

## Quickstart (5 minutes)

### 1. Get the code

```bash
git clone https://github.com/ahrazzle/typejoy.git
cd typejoy
npm install
```

### 2. Build the bundle

```bash
npx esbuild src/index.ts --bundle --outfile=dist/game.js --format=esm
```

### 3. Create your first game session

```html
<div id="stage" style="width:900px;height:320px"></div>
<script type="module">
  import { createSession } from './dist/game.js';

  const session = createSession({
    container: document.getElementById('stage'),
    content: 'hello world',
    bpm: 60,
    difficulty: 'easy',
  });

  // That's it. The keyboard renders, approach rings appear,
  // keypresses are judged, particles fly. Everything is wired.
</script>
```

That's the entire bootstrap. `createSession()` wires the full pipeline (`RawBus → NormalizedBus → BeatClockJudge → FeedbackLayer`) in the safe order — judge wired into feedback before animation starts, timing baseline set before any key can arrive.

### 4. React to gameplay

```typescript
const session = createSession({
  container: stage,
  content: 'hello world',
  hooks: {
    onHit: (event) => {
      console.log(`${event.judgment} on "${event.key}" (delta ${event.delta}ms)`);
      // Draw your game scene here
    },
    onCombo: (count, multiplier) => {
      console.log(`Combo ${count}x (${multiplier}x)`);
    },
    onSongComplete: (results) => {
      console.log(`Accuracy: ${results.accuracy}, Rank: ${results.ranking}`);
    },
  },
});
```

### 5. Clean up

```typescript
session.destroy(); // stops buses, stops animation, removes keyboard DOM
```

---

## Architecture

```
┌─────────────┐   ┌──────────────┐   ┌────────────────┐   ┌─────────────────┐
│   RawBus    │ → │ NormalizedBus│ → │ BeatClockJudge │ → │  FeedbackLayer  │
│  (keydown)  │   │  (chars)     │   │  (judgments)   │   │ (keyboard+fx)   │
└─────────────┘   └──────────────┘   └────────────────┘   └─────────────────┘
                                          ↓ hooks
                                     your plugin
```

**Three layers:**
- **Input** — `RawBus` captures keydown/keyup with high-res timestamps. `NormalizedBus` produces clean character events (handles shift/caps, filters repeats).
- **Judge** — `BeatClockJudge` compares keystrokes against the beat-map's expected notes, classifies timing into Perfect/Great/Good/Miss, tracks combo/multiplier, and emits hook events.
- **Feedback** — `FeedbackLayer` renders the SVG keyboard, canvas particles, approach rings, combo display, and judgment stats. This is where the "feel" lives.

---

## Key Concepts

### Timing windows

| Difficulty | Perfect | Great | Good | Lead-in (first ring) |
|---|---|---|---|---|
| easy | ±500ms | ±700ms | ±1000ms | 1500ms |
| medium | ±300ms | ±500ms | ±700ms | 1000ms |
| hard | ±150ms | ±300ms | ±500ms | 600ms |
| expert | ±80ms | ±150ms | ±250ms | 350ms |

The lead-in matches the approach-ring preempt time, so the first ring is visible the moment the session starts.

### Input model — "Correct Key + Timing Window"

- **Wrong key** → `onWrongKey` hook fires (gentle feedback), cursor doesn't advance, combo doesn't break
- **Correct key, on time** → judged Perfect/Great/Good, cursor advances, combo builds
- **Correct key, too early/late** → ignored during lead-in; miss after the window closes
- **Note passes without being hit** → `onNoteStale`, cursor advances

### Case sensitivity

All comparisons are case-insensitive (`toLowerCase()` on both sides). Kids with caps lock on, or who capitalize the first letter, hit the note normally.

---

## Docs

- [Plugin Development Guide](docs/PLUGIN_GUIDE.md) — build a custom game on the framework
- [API Reference](docs/API_REFERENCE.md) — every exported class, method, and type
- [Example Plugin Walkthrough](docs/EXAMPLE_PLUGIN.md) — step-by-step game built from scratch
- [Contributing](CONTRIBUTING.md) — dev setup, tests, conventions, and how to open a PR

## Community & Governance

- **Issues & feature requests** — open a GitHub issue; label it `enhancement` for a feature.
- **Security** — see [SECURITY.md](SECURITY.md) for the private reporting process and trust model.
- **Code of Conduct** — participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- **Changelog** — see [CHANGELOG.md](CHANGELOG.md) for a version history.

## Testing

```bash
npm test          # 46 event-bus tests + 48 generator tests
npm run typecheck # TypeScript strict check
npm run docs      # verify docs imports match the built bundle
```

## License

MIT — see [LICENSE](LICENSE).
