/**
 * Typejoy Framework — FeedbackLayer
 *
 * The shared infrastructure where game "feel" lives. Plugins emit judgments
 * to this layer, which renders them through SVG keycaps + canvas particle effects.
 *
 * Hybrid rendering:
 * - SVG layer for the keyboard (crisp keycaps, ARIA labels, hardware-accelerated CSS)
 * - Canvas overlay on top for particles, screen shake, RGB glow
 * - Stacked with pointer-events: none so keystrokes reach the input layer
 */
import { DEFAULT_THEME, } from './types';
import { SVGKeyboardRenderer } from './svg-keyboard';
import { ParticleSystem } from './particle-system';
import { normalizeKey } from './keyboard-layout';
export class FeedbackLayer {
    container;
    theme;
    keyboardContainer;
    canvas;
    keyboard;
    particles;
    liveRegion;
    comboDisplay;
    width;
    height;
    // State
    maxComboReached = 0;
    nudgeKeys = new Map();
    lastStreakThreshold = 0;
    highContrast = false;
    reducedMotion = false;
    nudgeEnabled = true;
    gameActive = false;
    constructor(options) {
        this.container = options.container;
        this.theme = options.theme ?? DEFAULT_THEME;
        this.width = options.width ?? 900;
        this.height = options.height ?? 300;
        // Main container styling
        this.container.style.position = 'relative';
        this.container.style.width = `${this.width}px`;
        this.container.style.height = `${this.height}px`;
        this.container.style.overflow = 'hidden';
        this.container.style.borderRadius = '8px';
        // Keyboard container (SVG layer)
        this.keyboardContainer = document.createElement('div');
        this.keyboardContainer.style.position = 'absolute';
        this.keyboardContainer.style.bottom = '0';
        this.keyboardContainer.style.left = '0';
        this.keyboardContainer.style.right = '0';
        this.keyboardContainer.style.height = '55%';
        this.keyboardContainer.style.zIndex = '1';
        this.container.appendChild(this.keyboardContainer);
        // SVG keyboard renderer
        this.keyboard = new SVGKeyboardRenderer(this.keyboardContainer, {
            unitSize: 40,
            keyGap: 3,
            borderRadius: 4,
        });
        // Canvas overlay for particles and effects
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '2';
        this.canvas.style.pointerEvents = 'none'; // Critical: keystrokes pass through
        this.container.appendChild(this.canvas);
        // Particle system
        this.particles = new ParticleSystem(this.canvas);
        this.particles.setTheme(this.theme);
        this.particles.resize(this.width, this.height);
        // ARIA live region (accessible announcements)
        this.liveRegion = document.createElement('div');
        this.liveRegion.setAttribute('role', 'status');
        this.liveRegion.setAttribute('aria-live', 'polite');
        this.liveRegion.setAttribute('aria-atomic', 'true');
        this.liveRegion.style.position = 'absolute';
        this.liveRegion.style.width = '1px';
        this.liveRegion.style.height = '1px';
        this.liveRegion.style.overflow = 'hidden';
        this.liveRegion.style.clip = 'rect(0, 0, 0, 0)';
        this.liveRegion.style.whiteSpace = 'nowrap';
        this.liveRegion.style.border = '0';
        this.liveRegion.style.margin = '-1px';
        this.liveRegion.style.padding = '0';
        this.liveRegion.style.zIndex = '10';
        this.container.appendChild(this.liveRegion);
        // Combo display (visual)
        this.comboDisplay = document.createElement('div');
        this.comboDisplay.setAttribute('aria-hidden', 'true');
        this.comboDisplay.style.position = 'absolute';
        this.comboDisplay.style.top = '16px';
        this.comboDisplay.style.right = '16px';
        this.comboDisplay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        this.comboDisplay.style.fontSize = '24px';
        this.comboDisplay.style.fontWeight = '700';
        this.comboDisplay.style.color = this.theme.colors.primary;
        this.comboDisplay.style.zIndex = '3';
        this.comboDisplay.style.pointerEvents = 'none';
        this.comboDisplay.style.textShadow = `0 0 10px ${this.theme.colors.primary}`;
        this.comboDisplay.style.opacity = '0';
        this.comboDisplay.style.transition = 'opacity 200ms ease, transform 200ms ease';
        this.container.appendChild(this.comboDisplay);
        // Apply initial theme
        this.keyboard.applyTheme(this.theme, this.highContrast);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Plugin Event Handlers
    // ─────────────────────────────────────────────────────────────────────────
    renderHit(judgment, key, _delta) {
        const normalizedKey = normalizeKey(key);
        const keyBounds = this.getKeyScreenBounds(normalizedKey);
        // Depress the key
        this.keyboard.depressKey(normalizedKey, judgment === 'perfect' ? 100 : 70);
        // Apply theme-based visual feedback per channel
        switch (judgment) {
            case 'perfect':
                // Full particle burst + key depression + screen-edge glow
                this.keyboard.setKeyHighlight(normalizedKey, this.theme.colors.primary, 0.7);
                this.particles.emitBurst(keyBounds.x + keyBounds.width / 2, keyBounds.y + keyBounds.height / 2, 'perfect', this.theme.particleStyle, this.theme.particleDensity);
                this.particles.addEdgeGlow(this.theme.colors.primary, this.theme.intensity, 300);
                this.particles.addShake(this.theme.shakeIntensity * 0.5, 150);
                break;
            case 'great':
                // Moderate burst + key depression
                this.keyboard.setKeyHighlight(normalizedKey, this.theme.colors.secondary, 0.5);
                this.particles.emitBurst(keyBounds.x + keyBounds.width / 2, keyBounds.y + keyBounds.height / 2, 'great', this.theme.particleStyle, this.theme.particleDensity * 0.7);
                this.particles.addEdgeGlow(this.theme.colors.secondary, this.theme.intensity * 0.5, 200);
                break;
            case 'good':
                // Muted flash + small key depression
                this.keyboard.setKeyHighlight(normalizedKey, this.theme.colors.tertiary, 0.4);
                this.particles.emitMutedFlash(keyBounds.x + keyBounds.width / 2, keyBounds.y + keyBounds.height / 2);
                break;
        }
        // Clear key highlight after a moment
        window.setTimeout(() => {
            this.keyboard.clearKeyHighlight(normalizedKey);
        }, 200);
    }
    renderMiss(key, _expectedKey) {
        const normalizedKey = normalizeKey(key);
        const keyBounds = this.getKeyScreenBounds(normalizedKey);
        // Wrong key: muted red flash + small shake (deliberately underwhelming, not punishing)
        this.keyboard.shakeKey(normalizedKey);
        this.keyboard.setKeyHighlight(normalizedKey, this.theme.colors.danger, 0.3);
        this.particles.emitWrongKeyBurst(keyBounds.x + keyBounds.width / 2, keyBounds.y + keyBounds.height / 2);
        // No screen shake for wrong keys — keep it gentle
        // No edge glow for wrong keys — not punishing
        window.setTimeout(() => {
            this.keyboard.clearKeyHighlight(normalizedKey);
        }, 200);
    }
    renderStale(note) {
        if (!this.nudgeEnabled)
            return;
        // Start nudge hint on the expected key
        this.nudgeKeys.set(note.key, { note, startTime: performance.now() });
    }
    renderCombo(count, _multiplier) {
        if (count > this.maxComboReached) {
            this.maxComboReached = count;
        }
        // Update combo display
        if (count >= 2) {
            this.comboDisplay.textContent = `${count}x`;
            this.comboDisplay.style.opacity = '1';
            this.comboDisplay.style.transform = 'scale(1.1)';
            window.setTimeout(() => {
                this.comboDisplay.style.transform = 'scale(1)';
            }, 100);
            // Apply combo-based visual escalation
            this.applyComboEscalation(count);
        }
        else {
            this.comboDisplay.style.opacity = '0';
        }
    }
    pulseKey(key, _bpm) {
        if (this.theme.beatPulseEnabled && !this.reducedMotion) {
            this.keyboard.pulseKey(key, _bpm);
        }
    }
    setTheme(theme) {
        this.theme = theme;
        this.keyboard.applyTheme(theme, this.highContrast);
        this.particles.setTheme(theme);
        this.comboDisplay.style.color = theme.colors.primary;
        this.comboDisplay.style.textShadow = `0 0 10px ${theme.colors.primary}`;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Accessibility
    // ─────────────────────────────────────────────────────────────────────────
    setHighContrast(enabled) {
        this.highContrast = enabled;
        this.keyboard.applyTheme(this.theme, enabled);
    }
    setReducedMotion(enabled) {
        this.reducedMotion = enabled;
        this.particles.setReducedMotion(enabled);
    }
    setNudgeEnabled(enabled) {
        this.nudgeEnabled = enabled;
        if (!enabled) {
            // Clear existing nudges
            for (const [keyId] of this.nudgeKeys) {
                this.keyboard.clearNudgeGlow(keyId);
            }
            this.nudgeKeys.clear();
        }
    }
    /** Announce a message via ARIA live region */
    announce(message) {
        this.liveRegion.textContent = '';
        // Force re-announce by clearing and setting
        requestAnimationFrame(() => {
            this.liveRegion.textContent = message;
        });
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Combo Escalation
    // ─────────────────────────────────────────────────────────────────────────
    applyComboEscalation(count) {
        const thresholds = this.theme.comboThresholds;
        // Streak threshold announcement
        if (count >= thresholds.intense && this.lastStreakThreshold < thresholds.intense) {
            this.lastStreakThreshold = thresholds.intense;
            this.announce(`${count} combo! Full light show!`);
            this.triggerIntenseEffect();
        }
        else if (count >= thresholds.moderate && this.lastStreakThreshold < thresholds.moderate) {
            this.lastStreakThreshold = thresholds.moderate;
            this.announce(`${count} combo! Keep going!`);
            this.triggerModerateEffect();
        }
        else if (count >= thresholds.subtle && this.lastStreakThreshold < thresholds.subtle) {
            this.lastStreakThreshold = thresholds.subtle;
            this.announce(`${count} combo!`);
            this.triggerSubtleEffect();
        }
    }
    triggerSubtleEffect() {
        // 10x = subtle keyboard aura
        this.particles.addEdgeGlow(this.theme.colors.comboGlow, 0.2, 500);
    }
    triggerModerateEffect() {
        // 25x = scene shifts in intensity
        this.particles.addEdgeGlow(this.theme.colors.comboGlow, 0.5, 600);
        this.particles.addShake(this.theme.shakeIntensity * 0.3, 200);
    }
    triggerIntenseEffect() {
        // 50x = full light show
        this.particles.addEdgeGlow(this.theme.colors.comboGlow, 0.8, 800);
        this.particles.addShake(this.theme.shakeIntensity * 0.8, 300);
        // Burst particles across the screen
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            this.particles.emitBurst(x, y, 'perfect', this.theme.particleStyle, 0.5);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Nudge Update Loop
    // ─────────────────────────────────────────────────────────────────────────
    updateNudges() {
        if (!this.nudgeEnabled)
            return;
        const now = performance.now();
        for (const [keyId, nudge] of this.nudgeKeys) {
            const elapsed = now - nudge.startTime;
            const intensity = Math.min(1.0, elapsed / 5000); // Ramp up over 5 seconds
            this.keyboard.setNudgeGlow(keyId, intensity);
            // Remove after 8 seconds
            if (elapsed > 8000) {
                this.keyboard.clearNudgeGlow(keyId);
                this.nudgeKeys.delete(keyId);
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Utility
    // ─────────────────────────────────────────────────────────────────────────
    getKeyScreenBounds(keyId) {
        const keyEl = this.keyboard.getKeyElement(keyId);
        if (keyEl) {
            // The SVG element's bounding box is relative to the SVG viewBox
            // We need to convert to screen coordinates
            const keyRect = keyEl.getBoundingClientRect();
            // Use the key's actual screen position relative to the container
            const containerRect = this.container.getBoundingClientRect();
            return new DOMRect(keyRect.left - containerRect.left, keyRect.top - containerRect.top, keyRect.width, keyRect.height);
        }
        // Fallback: return center of keyboard area
        return new DOMRect(this.width / 2 - 20, this.height * 0.7, 40, 40);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────
    getKeyboardElement() {
        return this.keyboard.getElement();
    }
    getCanvasOverlay() {
        return this.canvas;
    }
    getContainer() {
        return this.container;
    }
    getLiveRegion() {
        return this.liveRegion;
    }
    reset() {
        this.maxComboReached = 0;
        this.lastStreakThreshold = 0;
        this.keyboard.reset();
        this.particles.clear();
        this.comboDisplay.style.opacity = '0';
        this.comboDisplay.textContent = '';
        this.nudgeKeys.clear();
    }
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.container.style.width = `${width}px`;
        this.container.style.height = `${height}px`;
        this.particles.resize(width, height);
    }
    start() {
        this.gameActive = true;
        this.particles.start();
        this.startNudgeLoop();
    }
    stop() {
        this.gameActive = false;
        this.particles.stop();
    }
    startNudgeLoop() {
        const loop = () => {
            if (!this.gameActive)
                return;
            this.updateNudges();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}
//# sourceMappingURL=feedback-layer.js.map