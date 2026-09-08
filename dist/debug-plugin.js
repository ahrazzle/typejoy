// ============================================================================
// DebugPlugin — Minimal contract validator
// ============================================================================
// The first plugin built on the framework. Its purpose is NOT entertainment —
// it's to prove the plugin contract works end-to-end by exercising every hook
// with the simplest possible visual output.
//
// Visual design: a circle that scales with combo, a progress bar that fills
// with each hit (color-coded by judgment), and a judgment log line.
//
// Once this works with a real beat-map flowing through the bus to the feedback
// layer, the framework is validated. Then we design the real game.
export class DebugPlugin {
    name = 'debug-validator';
    feedbackLayer = null;
    canvas = null;
    // Visual state
    combo = 0;
    maxCombo = 0;
    progress = 0;
    totalNotes = 0;
    judgmentCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
    lastJudgment = null;
    judgmentLog = [];
    animationId = null;
    // DOM elements (created in getCanvasContext if not already)
    container = null;
    circleEl = null;
    progressBarEl = null;
    logEl = null;
    // ---- GamePlugin Interface Implementation -------------------------------
    onGameStart(config) {
        this.combo = 0;
        this.maxCombo = 0;
        this.progress = 0;
        this.totalNotes = config.notes.length;
        this.judgmentCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
        this.lastJudgment = null;
        this.judgmentLog = [];
        this.createUI();
        this.startRenderLoop();
    }
    onGameEnd(results) {
        this.log(`Game Over — Score: ${results.score}  Accuracy: ${(results.accuracy * 100).toFixed(1)}%  Max Combo: ${results.maxCombo}`);
    }
    onHit(judgment, key, delta) {
        this.combo++;
        if (this.combo > this.maxCombo)
            this.maxCombo = this.combo;
        this.judgmentCounts[judgment]++;
        this.lastJudgment = judgment;
        this.progress++;
        this.log(`${judgment.toUpperCase()}  "${key}"  delta=${delta.toFixed(0)}ms  combo=${this.combo}`);
    }
    onMiss(key, expectedKey) {
        this.judgmentCounts.miss++;
        this.lastJudgment = 'miss';
        this.log(`MISS  pressed="${key}" expected="${expectedKey}"`);
    }
    onNoteStale(note) {
        this.judgmentCounts.miss++;
        this.log(`STALE  expected="${note.key}" at ${note.time}ms`);
    }
    onCombo(count, multiplier) {
        this.combo = count;
        if (count > this.maxCombo)
            this.maxCombo = count;
        if (count >= 10 && count % 10 === 0) {
            this.log(`COMBO ${count}x (${multiplier}x multiplier)`);
        }
    }
    onStreakThreshold(count) {
        this.log(`STREAK THRESHOLD ${count}!`);
    }
    onSongComplete(results) {
        this.log(`SONG COMPLETE!  Score: ${results.score}  Accuracy: ${(results.accuracy * 100).toFixed(1)}%`);
    }
    getCanvasContext() {
        return this.canvas;
    }
    getFeedbackLayer() {
        if (!this.feedbackLayer) {
            throw new Error('FeedbackLayer not set — call setFeedbackLayer() before starting');
        }
        return this.feedbackLayer;
    }
    // ---- Framework Integration Helpers ------------------------------------
    setFeedbackLayer(layer) {
        this.feedbackLayer = layer;
    }
    // ---- UI Construction ---------------------------------------------------
    createUI() {
        // Create a container for the debug plugin's UI
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none';
        this.container.style.zIndex = '5';
        // Combo circle
        this.circleEl = document.createElement('div');
        this.circleEl.style.position = 'absolute';
        this.circleEl.style.top = '50%';
        this.circleEl.style.left = '50%';
        this.circleEl.style.transform = 'translate(-50%, -50%)';
        this.circleEl.style.width = '60px';
        this.circleEl.style.height = '60px';
        this.circleEl.style.borderRadius = '50%';
        this.circleEl.style.background = 'radial-gradient(circle, rgba(0,229,255,0.3), transparent)';
        this.circleEl.style.border = '2px solid rgba(0,229,255,0.5)';
        this.circleEl.style.transition = 'transform 100ms ease-out';
        this.circleEl.style.display = 'flex';
        this.circleEl.style.alignItems = 'center';
        this.circleEl.style.justifyContent = 'center';
        this.circleEl.style.fontFamily = 'system-ui, sans-serif';
        this.circleEl.style.fontWeight = '700';
        this.circleEl.style.fontSize = '18px';
        this.circleEl.style.color = '#00e5ff';
        this.container.appendChild(this.circleEl);
        // Progress bar container
        const progressContainer = document.createElement('div');
        progressContainer.style.position = 'absolute';
        progressContainer.style.bottom = '12px';
        progressContainer.style.left = '50%';
        progressContainer.style.transform = 'translateX(-50%)';
        progressContainer.style.width = '200px';
        progressContainer.style.height = '8px';
        progressContainer.style.background = 'rgba(255,255,255,0.1)';
        progressContainer.style.borderRadius = '4px';
        progressContainer.style.overflow = 'hidden';
        this.progressBarEl = document.createElement('div');
        this.progressBarEl.style.height = '100%';
        this.progressBarEl.style.width = '0%';
        this.progressBarEl.style.background = 'linear-gradient(90deg, #00e5ff, #76ff03)';
        this.progressBarEl.style.borderRadius = '4px';
        this.progressBarEl.style.transition = 'width 150ms ease';
        progressContainer.appendChild(this.progressBarEl);
        this.container.appendChild(progressContainer);
        // Judgment log (bottom-left)
        this.logEl = document.createElement('div');
        this.logEl.style.position = 'absolute';
        this.logEl.style.bottom = '30px';
        this.logEl.style.left = '12px';
        this.logEl.style.fontFamily = 'monospace';
        this.logEl.style.fontSize = '11px';
        this.logEl.style.color = 'rgba(255,255,255,0.6)';
        this.logEl.style.maxHeight = '100px';
        this.logEl.style.overflow = 'hidden';
        this.logEl.style.lineHeight = '1.4';
        this.container.appendChild(this.logEl);
        // Judgment counts (top-left)
        const countsEl = document.createElement('div');
        countsEl.style.position = 'absolute';
        countsEl.style.top = '12px';
        countsEl.style.left = '12px';
        countsEl.style.fontFamily = 'system-ui, sans-serif';
        countsEl.style.fontSize = '12px';
        countsEl.style.color = 'rgba(255,255,255,0.5)';
        countsEl.style.lineHeight = '1.5';
        countsEl.setAttribute('data-role', 'counts');
        this.container.appendChild(countsEl);
        // Judgment indicator (center-top)
        const judgmentEl = document.createElement('div');
        judgmentEl.style.position = 'absolute';
        judgmentEl.style.top = '40px';
        judgmentEl.style.left = '50%';
        judgmentEl.style.transform = 'translateX(-50%)';
        judgmentEl.style.fontFamily = 'system-ui, sans-serif';
        judgmentEl.style.fontWeight = '700';
        judgmentEl.style.fontSize = '14px';
        judgmentEl.style.textTransform = 'uppercase';
        judgmentEl.style.letterSpacing = '2px';
        judgmentEl.style.opacity = '0';
        judgmentEl.style.transition = 'opacity 100ms ease';
        judgmentEl.setAttribute('data-role', 'judgment');
        this.container.appendChild(judgmentEl);
        // Mount in the feedback layer's container
        const feedbackContainer = this.feedbackLayer?.getContainer();
        if (feedbackContainer) {
            feedbackContainer.appendChild(this.container);
        }
    }
    // ---- Render Loop ------------------------------------------------------
    startRenderLoop() {
        const loop = () => {
            this.render();
            this.animationId = requestAnimationFrame(loop);
        };
        this.animationId = requestAnimationFrame(loop);
    }
    render() {
        if (!this.container)
            return;
        // Combo circle scale
        if (this.circleEl) {
            const scale = 1 + Math.min(this.combo * 0.02, 0.5);
            this.circleEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
            this.circleEl.textContent = this.combo > 0 ? `${this.combo}` : '';
            // Color by last judgment
            const colors = {
                perfect: 'rgba(0,229,255,0.5)',
                great: 'rgba(118,255,3,0.5)',
                good: 'rgba(255,234,0,0.5)',
                miss: 'rgba(255,23,68,0.5)',
            };
            const color = this.lastJudgment ? colors[this.lastJudgment] || 'rgba(0,229,255,0.3)' : 'rgba(0,229,255,0.3)';
            this.circleEl.style.borderColor = color;
        }
        // Progress bar
        if (this.progressBarEl && this.totalNotes > 0) {
            const pct = (this.progress / this.totalNotes) * 100;
            this.progressBarEl.style.width = `${pct}%`;
        }
        // Counts
        const countsEl = this.container.querySelector('[data-role="counts"]');
        if (countsEl) {
            countsEl.innerHTML = `
        <span style="color:#00e5ff">Perfect: ${this.judgmentCounts.perfect}</span>
        <span style="color:#76ff03;margin-left:8px">Great: ${this.judgmentCounts.great}</span>
        <span style="color:#ffea00;margin-left:8px">Good: ${this.judgmentCounts.good}</span>
        <span style="color:#ff1744;margin-left:8px">Miss: ${this.judgmentCounts.miss}</span>
      `;
        }
        // Judgment indicator
        const judgmentEl = this.container.querySelector('[data-role="judgment"]');
        if (judgmentEl && this.lastJudgment) {
            const colors = {
                perfect: '#00e5ff',
                great: '#76ff03',
                good: '#ffea00',
                miss: '#ff1744',
            };
            judgmentEl.textContent = this.lastJudgment;
            judgmentEl.style.color = colors[this.lastJudgment] || '#fff';
            judgmentEl.style.opacity = '1';
            setTimeout(() => { judgmentEl.style.opacity = '0'; }, 300);
        }
    }
    // ---- Logging ----------------------------------------------------------
    log(msg) {
        this.judgmentLog.push(msg);
        if (this.judgmentLog.length > 6)
            this.judgmentLog.shift();
        if (this.logEl) {
            this.logEl.innerHTML = this.judgmentLog.map(l => `<div>${l}</div>`).join('');
        }
        console.log(`[DebugPlugin] ${msg}`);
    }
    // ---- Cleanup ----------------------------------------------------------
    destroy() {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.container?.remove();
        this.container = null;
        this.circleEl = null;
        this.progressBarEl = null;
        this.logEl = null;
    }
}
//# sourceMappingURL=debug-plugin.js.map