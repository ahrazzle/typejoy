# Typejoy — Example Plugin Walkthrough

Build a complete, playable plugin game from scratch: **"Particle Pop"** — every Perfect hit spawns a burst of colored rings on a canvas; combo streaks tint the background. This exercises the full plugin contract with ~60 lines of real code.

---

## Setup

```bash
git clone https://github.com/ahrazzle/typejoy.git
cd typejoy
npm install
npx esbuild src/index.ts --bundle --outfile=dist/bundle.js --format=esm
```

## The HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>Particle Pop</title>
  <style>
    body { background: #0d0d1a; margin: 0; }
    #stage { width: 900px; height: 320px; margin: 40px auto; }
  </style>
</head>
<body>
  <div id="stage"></div>
  <script type="module" src="game.js"></script>
</body>
</html>
```

## The game (game.js)

```javascript
import { createSession } from './dist/bundle.js';

const stage = document.getElementById('stage');

// ── Plugin state ──────────────────────────────────────────────
let ctx = null;            // canvas 2d context (ours)
let score = 0;
let bestCombo = 0;
let bgFlash = 0;           // background flash intensity 0..1

// ── Our overlay canvas ────────────────────────────────────────
function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;z-index:6;pointer-events:none;';
  canvas.width = 900; canvas.height = 320;
  stage.appendChild(canvas);
  return canvas.getContext('2d');
}

// ── The plugin ────────────────────────────────────────────────
const pop = {
  onGameStart(config) {
    score = 0; bestCombo = 0; bgFlash = 0;
    ctx = makeCanvas();
    // Draw a hint in the top-right
    ctx.font = '16px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText('Type the letters to pop them!', 640, 30);
  },

  onHit(judgment, key, delta) {
    // Find where this key is on screen via the feedback layer
    const fb = session.feedback;
    const keyEl = fb.getKeyboardElement().querySelector(`[data-key="${key}"]`);
    let x = 450, y = 200;
    if (keyEl) {
      const r = keyEl.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      x = r.left - s.left + r.width / 2;
      y = r.top - s.top + r.height / 2;
    }

    // Draw judgment-colored rings
    const colors = { perfect: '#00e5ff', great: '#76ff03', good: '#ffea00' };
    ctx.beginPath();
    ctx.arc(x, y, judgment === 'perfect' ? 24 : 16, 0, Math.PI * 2);
    ctx.strokeStyle = colors[judgment];
    ctx.lineWidth = 3;
    ctx.stroke();

    // Perfect hits flash the background
    if (judgment === 'perfect') bgFlash = 1;
  },

  onMiss(key, expectedKey) {
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#ff1744';
    ctx.fillText('miss', 20, 60);
  },

  onCombo(count, multiplier) {
    bestCombo = Math.max(bestCombo, count);
    ctx.font = '20px system-ui';
    ctx.fillStyle = '#fff';
    ctx.clearRect(700, 40, 180, 40);
    ctx.fillText(`${count}x (${multiplier}x)`, 700, 70);
  },

  onSongComplete(results) {
    ctx.clearRect(0, 0, 900, 320);
    ctx.font = '32px system-ui';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${score}  Accuracy: ${(results.accuracy * 100).toFixed(0)}%`,
      450, 140);
    ctx.fillText(`Max Combo: ${bestCombo}`, 450, 180);
    ctx.textAlign = 'left';
  },

  getCanvasContext() { return null; }, // we manage our own canvas
  getFeedbackLayer() { return session.feedback; },
};

// ── Boot ──────────────────────────────────────────────────────
const session = createSession({
  container: stage,
  content: 'pop goes the letters',
  bpm: 80,
  difficulty: 'easy',
  hooks: pop,
});

// Background flash loop
function loop() {
  if (bgFlash > 0) {
    ctx.fillStyle = `rgba(0,229,255,${bgFlash * 0.15})`;
    ctx.fillRect(0, 0, 900, 320);
    bgFlash *= 0.9;
    if (bgFlash < 0.01) bgFlash = 0;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

## What this exercises

| Hook | Used for |
|---|---|
| `onGameStart` | Canvas setup, state reset |
| `onHit` | Judgment-colored rings at the key position |
| `onMiss` | Miss feedback text |
| `onCombo` | Combo counter drawing |
| `onSongComplete` | Final score screen |
| `getFeedbackLayer` | Accessing the keyboard element for positions |

## Running it

```bash
python3 -m http.server 8000
# open http://localhost:8000/your-folder/
```

Type "pop goes the letters" — each correct key pops a colored ring; Perfect hits flash the background cyan. The framework handles the keyboard, approach rings, timing, and stats — your plugin only draws its own scene.

---

## Extending the idea

- Add a score increment in `onHit` (Perfect=100 × multiplier, Great=75, Good=50)
- Use `onStreakThreshold` to trigger a full-screen particle wave at 10/25/50 combo
- Use `onWrongKey` to spawn a red "shrink" effect at the wrong key
- Swap the theme: `session.feedback.setTheme(customTheme)` for a different palette
