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

import {
  ThemeDescriptor,
  DEFAULT_THEME,
  Note,
  Judgment,
  FeedbackLayer as FeedbackLayerInterface,
  BeatNote,
} from './types.js';
import { SVGKeyboardRenderer } from './svg-keyboard.js';
import { ParticleSystem } from './particle-system.js';
import { ApproachRingSystem } from './approach-ring-system.js';
import { normalizeKey } from './keyboard-layout.js';

export interface FeedbackLayerOptions {
  container: HTMLElement;
  theme?: ThemeDescriptor;
  width?: number;
  height?: number;
}

export class FeedbackLayer implements FeedbackLayerInterface {
  private container: HTMLElement;
  private theme: ThemeDescriptor;
  private keyboardContainer: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private keyboard: SVGKeyboardRenderer;
  private particles: ParticleSystem;
  private approachRings: ApproachRingSystem;
  private liveRegion: HTMLElement;
  private comboDisplay: HTMLElement;
  private width: number;
  private height: number;

  // Judge reference (for expected-key indicator)
  private judge: { getCurrentNote: () => BeatNote | undefined; getNextNote: (ms?: number) => BeatNote | undefined } | null = null;

  // Expected-key indicator elements
  private expectedKeyIndicator: HTMLElement | null = null;
  private expectedKeyLabel: HTMLElement | null = null;

  // Approach ring canvas
  private approachRingCanvas: HTMLCanvasElement;

  // State
  private maxComboReached: number = 0;
  private nudgeKeys: Map<string, { note: Note; startTime: number }> = new Map();
  private lastStreakThreshold: number = 0;
  private highContrast: boolean = false;
  private reducedMotion: boolean = false;
  private nudgeEnabled: boolean = true;
  private gameActive: boolean = false;

  constructor(options: FeedbackLayerOptions) {
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

    // Approach ring canvas (in front of particles, behind combo display)
    this.approachRingCanvas = document.createElement('canvas');
    this.approachRingCanvas.style.position = 'absolute';
    this.approachRingCanvas.style.top = '0';
    this.approachRingCanvas.style.left = '0';
    this.approachRingCanvas.style.width = '100%';
    this.approachRingCanvas.style.height = '100%';
    this.approachRingCanvas.style.zIndex = '3';
    this.approachRingCanvas.style.pointerEvents = 'none';
    this.container.appendChild(this.approachRingCanvas);

    // Approach ring system
    this.approachRings = new ApproachRingSystem(this.approachRingCanvas);
    this.approachRings.resize(this.width, this.height);
    this.approachRings.setPreemptTime(1500); // Default to easy
    this.approachRings.setNoteCount(3);

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
    this.comboDisplay.style.textShadow = 'none';
    this.comboDisplay.style.willChange = 'transform';
    this.comboDisplay.style.opacity = '0';
    this.comboDisplay.style.transition = 'opacity 200ms ease, transform 200ms ease';
    this.container.appendChild(this.comboDisplay);

    // Apply initial theme
    this.keyboard.applyTheme(this.theme, this.highContrast);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Plugin Event Handlers
  // ─────────────────────────────────────────────────────────────────────────

  renderHit(judgment: Judgment, key: string, _delta: number): void {
    const normalizedKey = normalizeKey(key);
    const keyBounds = this.getKeyScreenBounds(normalizedKey);
    const cx = keyBounds.x + keyBounds.width / 2;
    const cy = keyBounds.y + keyBounds.height / 2;

    // Depress the key with spring physics
    this.keyboard.depressKey(normalizedKey);

    // Emit ripple emanating across the keyboard surface
    this.particles.emitRipple(cx, cy, judgment);

    // Apply theme-based visual feedback per channel
    switch (judgment) {
      case 'perfect':
        // Full particle burst + key depression + screen-edge glow + specular sweep + confetti
        this.keyboard.setKeyHighlight(normalizedKey, this.theme.colors.primary, 0.7);
        this.particles.emitBurst(cx, cy, 'perfect', this.theme.particleStyle, this.theme.particleDensity);
        this.particles.emitBurst(cx, cy, 'perfect', 'confetti', this.theme.particleDensity * 0.5);
        this.particles.addEdgeGlow(this.theme.colors.primary, this.theme.intensity, 300);
        this.particles.addShake(this.theme.shakeIntensity * 0.5, 150);
        this.particles.emitSpecularSweep();
        break;

      case 'great':
        // Moderate burst + key depression
        this.keyboard.setKeyHighlight(normalizedKey, this.theme.colors.secondary, 0.5);
        this.particles.emitBurst(cx, cy, 'great', this.theme.particleStyle, this.theme.particleDensity * 0.7);
        this.particles.addEdgeGlow(this.theme.colors.secondary, this.theme.intensity * 0.5, 200);
        break;

      case 'good':
        // Muted flash + small key depression
        this.keyboard.setKeyHighlight(normalizedKey, this.theme.colors.tertiary, 0.4);
        this.particles.emitMutedFlash(cx, cy);
        break;
    }

    // Clear key highlight after a moment
    window.setTimeout(() => {
      this.keyboard.clearKeyHighlight(normalizedKey);
    }, 200);
  }

  renderMiss(key: string, _expectedKey: string): void {
    const normalizedKey = normalizeKey(key);
    const keyBounds = this.getKeyScreenBounds(normalizedKey);

    // Wrong key: muted red flash + small shake + tiny ripple (deliberately underwhelming)
    this.keyboard.shakeKey(normalizedKey);
    this.keyboard.setKeyHighlight(normalizedKey, this.theme.colors.danger, 0.3);
    this.particles.emitWrongKeyBurst(
      keyBounds.x + keyBounds.width / 2,
      keyBounds.y + keyBounds.height / 2
    );
    this.particles.emitRipple(
      keyBounds.x + keyBounds.width / 2,
      keyBounds.y + keyBounds.height / 2,
      'wrong'
    );
    // No screen shake for wrong keys — keep it gentle
    // No edge glow for wrong keys — not punishing

    window.setTimeout(() => {
      this.keyboard.clearKeyHighlight(normalizedKey);
    }, 200);
  }

  renderStale(note: Note): void {
    // Don't add nudge for stale notes — the cursor has already advanced past them.
    // Nudges are only for the current expected key (handled in updateNudges).
  }

  renderCombo(count: number, _multiplier: number): void {
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
    } else {
      this.comboDisplay.style.opacity = '0';
    }
  }

  pulseKey(key: string, _bpm: number): void {
    if (this.theme.beatPulseEnabled && !this.reducedMotion) {
      this.keyboard.pulseKey(key, _bpm);
    }
  }

  setTheme(theme: ThemeDescriptor): void {
    this.theme = theme;
    this.keyboard.applyTheme(theme, this.highContrast);
    this.particles.setTheme(theme);
    this.comboDisplay.style.color = theme.colors.primary;
    this.comboDisplay.style.textShadow = 'none';
  }

  /** Set approach ring preempt time (ms before hit when rings appear) */
  setPreemptTime(ms: number): void {
    this.approachRings.setPreemptTime(ms);
  }

  /** Set how many upcoming notes to show approach rings for */
  setNoteCount(count: number): void {
    this.approachRings.setNoteCount(count);
  }

  /**
   * Provide a reference to the judge so the feedback layer can query the current
   * expected note and render a persistent expected-key indicator.
   */
  setJudge(judge: { getCurrentNote: () => BeatNote | undefined; getNextNotes: (count: number) => Array<{ note: BeatNote; timeUntilHit: number }>; getSongTime: () => number; beatMap: { notes: BeatNote[] } }): void {
    this.judge = judge;
    this.createExpectedKeyIndicator();
    this.approachRings.judge = judge;
    this.approachRings.keyboard = this.keyboard as unknown as { getKeyElement: (keyId: string) => SVGElement | null };
    this.approachRings.container = this.container;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Accessibility
  // ─────────────────────────────────────────────────────────────────────────

  setHighContrast(enabled: boolean): void {
    this.highContrast = enabled;
    this.keyboard.applyTheme(this.theme, enabled);
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    this.particles.setReducedMotion(enabled);
  }

  setNudgeEnabled(enabled: boolean): void {
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
  announce(message: string): void {
    this.liveRegion.textContent = '';
    // Force re-announce by clearing and setting
    requestAnimationFrame(() => {
      this.liveRegion.textContent = message;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Combo Escalation
  // ─────────────────────────────────────────────────────────────────────────

  private applyComboEscalation(count: number): void {
    const thresholds = this.theme.comboThresholds;

    // Streak threshold announcement
    if (count >= thresholds.intense && this.lastStreakThreshold < thresholds.intense) {
      this.lastStreakThreshold = thresholds.intense;
      this.announce(`${count} combo! Full light show!`);
      this.triggerIntenseEffect();
    } else if (count >= thresholds.moderate && this.lastStreakThreshold < thresholds.moderate) {
      this.lastStreakThreshold = thresholds.moderate;
      this.announce(`${count} combo! Keep going!`);
      this.triggerModerateEffect();
    } else if (count >= thresholds.subtle && this.lastStreakThreshold < thresholds.subtle) {
      this.lastStreakThreshold = thresholds.subtle;
      this.announce(`${count} combo!`);
      this.triggerSubtleEffect();
    }
  }

  private triggerSubtleEffect(): void {
    // 10x = subtle keyboard aura
    this.particles.addEdgeGlow(this.theme.colors.comboGlow, 0.2, 500);
  }

  private triggerModerateEffect(): void {
    // 25x = scene shifts in intensity
    this.particles.addEdgeGlow(this.theme.colors.comboGlow, 0.5, 600);
    this.particles.addShake(this.theme.shakeIntensity * 0.3, 200);
  }

  private triggerIntenseEffect(): void {
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

  updateNudges(): void {
    if (!this.nudgeEnabled) return;
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
    // Expected-Key Indicator
    // ─────────────────────────────────────────────────────────────────────────

    private createExpectedKeyIndicator(): void {
    // The floating keycap that hovers above the keyboard
    this.expectedKeyIndicator = document.createElement('div');
    this.expectedKeyIndicator.setAttribute('aria-hidden', 'true');
    this.expectedKeyIndicator.style.position = 'absolute';
    this.expectedKeyIndicator.style.top = '0';
    this.expectedKeyIndicator.style.left = '50%';
    this.expectedKeyIndicator.style.transform = 'translateX(-50%) translateY(20px)';
    this.expectedKeyIndicator.style.width = '44px';
    this.expectedKeyIndicator.style.height = '44px';
    this.expectedKeyIndicator.style.borderRadius = '6px';
    this.expectedKeyIndicator.style.background = 'rgba(255, 145, 0, 0.15)';
    this.expectedKeyIndicator.style.border = '2px solid rgba(255, 145, 0, 0.6)';
    this.expectedKeyIndicator.style.display = 'flex';
    this.expectedKeyIndicator.style.alignItems = 'center';
    this.expectedKeyIndicator.style.justifyContent = 'center';
    this.expectedKeyIndicator.style.fontFamily = 'system-ui, sans-serif';
    this.expectedKeyIndicator.style.fontWeight = '700';
    this.expectedKeyIndicator.style.fontSize = '16px';
    this.expectedKeyIndicator.style.color = '#ff9100';
    this.expectedKeyIndicator.style.zIndex = '4';
    this.expectedKeyIndicator.style.pointerEvents = 'none';
    this.expectedKeyIndicator.style.opacity = '0';
    this.expectedKeyIndicator.style.transition = 'opacity 200ms ease, transform 100ms ease';
    this.expectedKeyIndicator.style.boxShadow = '0 0 12px rgba(255, 145, 0, 0.3)';
    this.container.appendChild(this.expectedKeyIndicator);

    this.expectedKeyLabel = document.createElement('span');
    this.expectedKeyLabel.textContent = '';
    this.expectedKeyIndicator.appendChild(this.expectedKeyLabel);
    }

    /**
    * Updates the expected-key indicator each frame: reads the judge's current note,
    * positions the floating keycap above the target key, and adjusts glow intensity
    * based on how close the note is to its hit time.
    */
    private updateExpectedKeyIndicator(): void {
    if (!this.judge || !this.expectedKeyIndicator) return;

    const note = this.judge.getCurrentNote();
    if (!note) {
      this.expectedKeyIndicator.style.opacity = '0';
      return;
    }

    // Show the indicator
    this.expectedKeyIndicator.style.opacity = '1';
    this.expectedKeyLabel.textContent = note.key.toUpperCase();

    // Find the target key's position
    const targetKeyEl = this.keyboard.getKeyElement(note.key);
    if (!targetKeyEl) return;

    const keyRect = targetKeyEl.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    const keyCenterX = keyRect.left - containerRect.left + keyRect.width / 2;

    // Position above the target key
    this.expectedKeyIndicator.style.left = `${keyCenterX}px`;
    this.expectedKeyIndicator.style.transform = 'translateX(-50%) translateY(0)';
    }

  private getKeyScreenBounds(keyId: string): DOMRect {
    const keyEl = this.keyboard.getKeyElement(keyId);
    if (keyEl) {
      // The SVG element's bounding box is relative to the SVG viewBox
      // We need to convert to screen coordinates
      const keyRect = keyEl.getBoundingClientRect();

      // Use the key's actual screen position relative to the container
      const containerRect = this.container.getBoundingClientRect();
      return new DOMRect(
        keyRect.left - containerRect.left,
        keyRect.top - containerRect.top,
        keyRect.width,
        keyRect.height
      );
    }
    // Fallback: return center of keyboard area
    return new DOMRect(
      this.width / 2 - 20,
      this.height * 0.7,
      40,
      40
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  getKeyboardElement(): SVGSVGElement {
    return this.keyboard.getElement();
  }

  getCanvasOverlay(): HTMLCanvasElement {
    return this.canvas;
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  getLiveRegion(): HTMLElement {
    return this.liveRegion;
  }

  reset(): void {
    this.maxComboReached = 0;
    this.lastStreakThreshold = 0;
    this.keyboard.reset();
    this.particles.clear();
    this.approachRings.clear();
    this.comboDisplay.style.opacity = '0';
    this.comboDisplay.textContent = '';
    this.nudgeKeys.clear();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.container.style.width = `${width}px`;
    this.container.style.height = `${height}px`;
    this.particles.resize(width, height);
    this.approachRings.resize(width, height);
  }

  start(): void {
    this.gameActive = true;
    this.particles.start();
    this.approachRings.start();
    this.startNudgeLoop();
  }

  stop(): void {
    this.gameActive = false;
    this.particles.stop();
    this.approachRings.stop();
  }

  private startNudgeLoop(): void {
    const loop = () => {
      if (!this.gameActive) return;
      this.updateNudges();
      this.updateExpectedKeyIndicator();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
