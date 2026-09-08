/**
 * Typejoy Framework — Multi-Note Approach Ring System
 *
 * osu!/Stepmania-style approach rings that show multiple upcoming notes
 * simultaneously, creating the "reading" skill that makes rhythm games
 * addictive. Each key shows its own approach ring at different shrink stages.
 *
 * Features:
 * - Multiple simultaneous rings on different keys
 * - Difficulty-based preempt time scaling
 * - Color ramp by proximity (white → cyan → green → yellow)
 * - Opacity by distance (faint far notes, bright near notes)
 * - Rings shrink toward target key as note approaches
 * - Hit/miss animations with expanding rings
 */

import { BeatNote } from './types.js';

interface ApproachRing {
  note: BeatNote;
  keyX: number;
  keyY: number;
  keyWidth: number;
  keyHeight: number;
  hitTime: number;       // Song time when ring matches key size
  judged: boolean;       // Whether this note has been resolved
  judgment: 'perfect' | 'great' | 'good' | 'miss' | null;
  spawnTime: number;     // When this ring was created
}

export class ApproachRingSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rings: ApproachRing[] = [];
  private animationId: number | null = null;
  private width: number = 0;
  private height: number = 0;

  // Configuration
  private preemptTime: number = 1500;  // ms before hit when ring starts
  private maxScale: number = 4.0;      // Ring starts at 4x key size
  private noteCount: number = 3;       // How many upcoming notes to show

  // Colors for proximity ramp
  private farColor: string = '#ffffff';     // White for far notes
  private midColor: string = '#00e5ff';     // Cyan for medium notes
  private nearColor: string = '#76ff03';    // Green for near notes
  private urgentColor: string = '#ffea00';  // Yellow for urgent notes

  // Judgment colors
  private perfectColor: string = '#00e5ff';
  private greatColor: string = '#76ff03';
  private goodColor: string = '#ffea00';
  private missColor: string = '#ff1744';

  // External references (set by feedback layer)
  judge: { getSongTime: () => number; getNotes: () => readonly BeatNote[]; getNextNotes: (count: number) => Array<{ note: BeatNote; timeUntilHit: number }> } | null = null;
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

  /** Set preempt time based on difficulty */
  setPreemptTime(ms: number): void {
    this.preemptTime = ms;
  }

  /** Set how many upcoming notes to show */
  setNoteCount(count: number): void {
    this.noteCount = count;
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

    // Convert " " (space key from beat-map) to "space" (keyboard layout id),
    // and lowercase letters so uppercase content still maps to keyboard keys.
    const lookupKey = keyId === ' ' ? 'space' : keyId.toLowerCase();
    const keyEl = this.keyboard.getKeyElement(lookupKey);
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
    const upcomingNotes = this.judge.getNextNotes(this.noteCount + 2); // +2 for buffer

    for (const { note, timeUntilHit } of upcomingNotes) {
      // Skip if ring already exists for this note
      if (this.rings.some(r => r.note === note)) continue;

      // Skip if note is too far in the future
      if (timeUntilHit > this.preemptTime) continue;

      // Skip if note is too far in the past
      if (timeUntilHit < -300) continue;

      // Get key position
      const pos = this.getKeyPosition(note.key);
      if (!pos) continue;

      this.rings.push({
        note,
        keyX: pos.x,
        keyY: pos.y,
        keyWidth: pos.width,
        keyHeight: pos.height,
        hitTime: songTime + timeUntilHit,
        judged: false,
        judgment: null,
        spawnTime: songTime,
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
      const progress = 1 - (timeUntilHit / this.preemptTime); // 0 → 1

      if (ring.judged) {
        this.renderJudgedRing(ctx, ring, songTime);
        continue;
      }

      // Calculate ring size (shrinks from maxScale to 1.0)
      const scale = this.maxScale + (1 - this.maxScale) * Math.min(1, Math.max(0, progress));
      const radiusX = (ring.keyWidth / 2) * scale;
      const radiusY = (ring.keyHeight / 2) * scale;

      // Color based on proximity (progress)
      const color = this.getRingColor(progress);

      // Opacity based on proximity (faint far, bright near)
      const alpha = this.getRingAlpha(progress);

      // Draw the approach ring
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = progress > 0.7 ? 3 : 2; // Thicker when close
      ctx.beginPath();
      ctx.ellipse(ring.keyX, ring.keyY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Inner glow for close notes
      if (progress > 0.5) {
        const glowAlpha = (progress - 0.5) * 0.4;
        ctx.globalAlpha = glowAlpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(ring.keyX, ring.keyY, radiusX * 0.7, radiusY * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw a "lane line" connecting ring to key (Stepmania-style)
      if (progress > 0.2) {
        ctx.globalAlpha = alpha * 0.3;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ring.keyX, ring.keyY - radiusY);
        ctx.lineTo(ring.keyX, ring.keyY - ring.keyHeight / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  private renderJudgedRing(ctx: CanvasRenderingContext2D, ring: ApproachRing, songTime: number): void {
    // Animate from judgment time — for early hits, clamp so the ring
    // collapses on the hit frame instead of waiting for note.time.
    const timeSinceHit = Math.max(0, songTime - ring.hitTime);
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
    const expandScale = ring.judgment === 'perfect' ? 2.5 : ring.judgment === 'great' ? 2.0 : 1.5;
    const radiusX = (ring.keyWidth / 2) * (1 + fadeProgress * expandScale);
    const radiusY = (ring.keyHeight / 2) * (1 + fadeProgress * expandScale);

    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * (1 - fadeProgress);
    ctx.beginPath();
    ctx.ellipse(ring.keyX, ring.keyY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner flash for perfect/great
    if (ring.judgment === 'perfect' || ring.judgment === 'great') {
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(ring.keyX, ring.keyY, ring.keyWidth * 0.6, ring.keyHeight * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Get ring color based on proximity (progress 0→1) */
  private getRingColor(progress: number): string {
    if (progress < 0.25) return this.farColor;
    if (progress < 0.5) return this.midColor;
    if (progress < 0.75) return this.nearColor;
    return this.urgentColor;
  }

  /** Get ring alpha based on proximity (faint far, bright near) */
  private getRingAlpha(progress: number): number {
    // Far notes: 60% opacity, near notes: 100% opacity
    // Higher minimum so the first ring is clearly visible at game start
    return 0.6 + progress * 0.4;
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
