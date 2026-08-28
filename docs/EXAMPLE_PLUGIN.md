# Example Plugin: "Particle Pop"

A complete, playable Typejoy plugin in ~60 lines. It consumes the framework's judged events and renders its own scene on top — no framework internals, no re-wiring. If you can run this, you can build any wrapper game.

## Prereqs

You've already run the quickstart from the README:

```bash
npm install
npx esbuild src/index.ts --bundle --outfile=dist/game.js --format=esm
```

## The whole plugin

```typescript
import { createSession, GamePlugin } from './dist/game.js';

// 1. Your plugin — implement the hooks you care about.
//    Each hook receives the same events the framework already judged.
const particlePop: GamePlugin = {
  // A pop grows with every correct hit, colored by judgment.
  onHit(judgment, _key, _delta) {
    const colors = { perfect: '#00e5ff', great: '#76ff03', good: '#ffea00' };
    spawnPop(colors[judgment] ?? '#fff');
  },
  // A red flash for a wrong key.
  onMiss(_key, _expectedKey) {
    spawnPop('#ff1744');
  },
  // The scene pulses as your streak grows.
  onCombo(count, multiplier) {
    document.body.style.background = `rgba(0, 229, 255, ${Math.min(count / 50, 0.3)})`;
    console.log(`combo ${count} (${multiplier}x)`);
  },
};

// 2. One call wires the entire pipeline in the safe order.
//    The keyboard, approach rings, particles, and stats come for free.
const session = createSession({
  container: document.getElementById('stage')!,
  content: 'hello world',     // or any string a player typed
  bpm: 60,
  difficulty: 'easy',         // 'easy' | 'medium' | 'hard' | 'expert'
  hooks: particlePop,         // <-- your plugin
});

// 3. Tear it down cleanly when the round ends.
function onRoundEnd() {
  session.destroy();          // stops buses, detaches judge, clears the DOM
}
```

## The minimal DOM it needs

```html
<div id="stage" style="width:900px; height:320px;"></div>
<script type="module" src="./your-plugin.ts"></script>
```

That's it. The framework owns everything below your plugin — beat-map timing, keystroke capture, judgment, approach rings, and end-of-round stats.

## The renderer hooks you get for free

`createSession` returns `session.feedback` (a `FeedbackLayer`) and `session.judge`. You don't have to touch them, but when you want to draw your own game scene, this is what's available:

| Object | Useful members |
|---|---|
| `session.judge` | `getSongTime()`, `state.maxCombo`, `state.cursor` |
| `session.feedback` | `getCanvasOverlay()` — draw your game on this canvas |
| `session.songTime()` | ms since the round started (same clock as judgments) |

Your plugin's own visuals (characters, vehicles, monsters) go on `getCanvasOverlay()`; the keyboard and its effects stay beneath it, already rendered by the framework.

## Contract summary

| Hook | Signature | Fires when |
|---|---|---|
| `onGameStart` | `(config: GameConfig) => void` | Round begins |
| `onHit` | `(judgment, key, delta) => void` | Correct key inside a window |
| `onMiss` | `(key, expectedKey) => void` | Correct key, wrong time |
| `onWrongKey` | `(key, expectedKey) => void` | Wrong key pressed |
| `onNoteStale` | `(note) => void` | Note passed without being hit |
| `onCombo` | `(count, multiplier) => void` | Combo updated |
| `onComboBreak` | `(previousCount) => void` | Combo reset |
| `onStreakThreshold` | `(count) => void` | Combo crosses 10/25/50 |
| `onSongComplete` | `(results) => void` | All notes resolved |
| `onGameEnd` | `(results) => void` | Round ended |

**Pitfall that used to bite:** never call `feedback.start()` yourself before `createSession` — it runs the animation loop before judge state exists. `createSession` handles the order internally, so you can't hit it.

## Build + run

```bash
npx esbuild src/your-plugin.ts --bundle --outfile=dist/your-plugin.js --format=esm
# open an HTML page that loads dist/your-plugin.js and contains #stage
```

If you see keys depress, rings shrink, and pops spawn as you type — your plugin works. Swap the `hooks` visuals for a character, a car, or a monster and you have a wrapper game.
