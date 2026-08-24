/**
 * Typejoy Framework — Approach Ring System
 *
 * osu!/Stepmania-style approach rings that shrink toward the target key,
 * giving players anticipation and timing feedback. This is the core
 * rhythm-game DNA that makes "press the key as the ring closes in"
 * addictive.
 *
 * Each note gets a ring that:
 * - Starts large (~3x key width) at approach time
 * - Shrinks linearly toward the key
 * - Matches the key size at the exact hit moment
 * - Changes color as it gets closer (white → cyan → judgment color)
 */

import { BeatNote } from './types.js';

interface ApproachRing {
  note: BeatNote;
  keyX: number;
  keyY: number;
  keyWidth: number;
  keyHeight: number;
  startTime: number;     // Song time when ring starts appearing
  hitTime: number;       // Song time when ring matches key size
  judged: boolean;       // Whether this note has been resolved
  judgment: 'perfect' | 'great' | 'good' | 'miss' | null;
}

export class ApproachRingSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rings: ApproachRing[] = [];
  private animationId: number | null = null;
  private width: number = 0;
  private height: number = 0;

  // Configuration
  private approachTime: number = 1500;  // ms before hit when ring starts
  private maxScale: number = 3.0;       // Ring starts at 3x key size

  // Colors
  private ringColor: string = '#ffffff';
  private perfectColor: string = '#00e5ff';
  private greatColor: string = '#76ff03';
  private goodColor: string = '#ffea00';
  private missColor: string = '#ff1744';

  // External references (set by feedback layer)
  judge: { getSongTime: () => number; beatMap: { notes: BeatNote[] } } | null = null;
  keyboard: { getKeyElement: (keyId: string) => SVGElement | null } | null = null;
  container: HTMLElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context from canvas');
    this.ctx = ctx;
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  /** Resize the canvas */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  /** Clear all rings */
  clear(): void {
    this.rings = [];
  }

  /** Mark a ring as judged so it can animate out */
  markJudged(note: BeatNote, judgment: 'perfect' | 'great' | 'good' | 'miss'): void {
    for (const ring of this.rings) {
      if (ring.note === note) {
        ring.judged = true;
        ring.judgment = judgment;
        break;
      }
    }
  }

  /** Get the screen position for a key */
  private getKeyPosition(keyId: string): { x: number; y: number; width: number; height: number } | null {
    if (!this.keyboard || !this.container) return null;

    const keyEl = this.keyboard.getKeyElement(keyId);
    if (!keyEl) return null;

    const keyRect = keyEl.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    return {
      x: keyRect.left - containerRect.left + keyRect.width / 2,
      y: keyRect.top - containerRect.top + keyRect.height / 2,
      width: keyRect.width,
      height: keyRect.height,
    };
  }

  /** Update ring positions and spawn new rings for upcoming notes */
  update(): void {
    if (!this.judge) return;

    const songTime = this.judge.getSongTime();

    // Find notes that should now be visible (within approach window)
    for (const note of this.judge.beatMap.notes) {
      // Skip if ring already exists
      if (this.rings.some(r => r.note === note)) continue;

      // Skip if note is too far in the future
      if (note.time - songTime > this.approachTime) continue;

      // Skip if note is too far in the past
      if (songTime > note.time + 300) continue;

      // Get key position
      const pos = this.getKeyPosition(note.key);
      if (!pos) continue;

      this.rings.push({
        note,
        keyX: pos.x,
        keyY: pos.y,
        keyWidth: pos.width,
        keyHeight: pos.height,
        startTime: note.time - this.approachTime,
        hitTime: note.time,
        judged: false,
        judgment: null,
      });
    }

    // Remove old rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      if (ring.judged && songTime > ring.hitTime + 200) {
        this.rings.splice(i, 1);
      } else if (!ring.judged && songTime > ring.hitTime + 400) {
        // Missed note — animate as miss
        ring.judged = true;
        ring.judgment = 'miss';
      }
    }
  }

  /** Render all active rings */
  render(): void {
    if (!this.judge) return;

    const songTime = this.judge.getSongTime();
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.width, this.height);

    for (const ring of this.rings) {
      const timeUntilHit = ring.hitTime - songTime;
      const progress = 1 - (timeUntilHit / this.approachTime); // 0 → 1

      if (ring.judged) {
        this.renderJudgedRing(ctx, ring, songTime);
        continue;
      }

      // Calculate ring size (shrinks from maxScale to 1.0)
      const scale = this.maxScale + (1 - this.maxScale) * progress;
      const radiusX = (ring.keyWidth / 2) * scale;
      const radiusY = (ring.keyHeight / 2) * scale;

      // Color transitions from white to judgment color as it gets closer
      const color = this.getRingColor(progress);

      // Opacity fades in as it approaches
      const alpha = Math.min(1, progress * 2);

      // Draw the approach ring
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ring.keyX, ring.keyY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Draw a subtle inner glow
      if (progress > 0.5) {
        const glowAlpha = (progress - 0.5) * 0.3;
        ctx.globalAlpha = glowAlpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(ring.keyX, ring.keyY, radiusX * 0.8, radiusY * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderJudgedRing(ctx: CanvasRenderingContext2D, ring: ApproachRing, songTime: number): void {
    const timeSinceHit = songTime - ring.hitTime;
    const fadeProgress = Math.min(1, timeSinceHit / 200);

    if (fadeProgress >= 1) return;

    const alpha = 1 - fadeProgress;
    const colors: Record<string, string> = {
      perfect: this.perfectColor,
      great: this.greatColor,
      good: this.goodColor,
      miss: this.missColor,
    };
    const color = colors[ring.judgment || 'miss'];

    // Expanding ring on hit
    const expandScale = ring.judgment === 'perfect' ? 2.0 : 1.5;
    const radiusX = (ring.keyWidth / 2) * (1 + fadeProgress * expandScale);
    const radiusY = (ring.keyHeight / 2) * (1 + fadeProgress * expandScale);

    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * (1 - fadeProgress);
    ctx.beginPath();
    ctx.ellipse(ring.keyX, ring.keyY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner flash for perfect/great
    if (ring.judgment === 'perfect' || ring.judgment === 'great') {
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(ring.keyX, ring.keyY, ring.keyWidth * 0.6, ring.keyHeight * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private getRingColor(progress: number): string {
    if (progress < 0.3) return this.ringColor;
    if (progress < 0.6) return this.perfectColor;
    return this.greatColor;
  }

  /** Start the animation loop */
  start(): void {
    const loop = () => {
      this.update();
      this.render();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  /** Stop the animation loop */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
