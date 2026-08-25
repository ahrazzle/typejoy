/**
 * Typejoy Framework — Canvas Particle System
 *
 * Manages particle effects, screen shake, RGB glow, screen-edge glow,
 * RIPPLE effects, and SPECULAR HIGHLIGHT sweeps on a stacked canvas overlay.
 * All effects are rendered with `pointer-events: none` so keystrokes reach the input layer.
 *
 * Satisfying animations inspired by ThreeUI:
 * - Spring-based key depression (overshoot + bounce)
 * - Ripple emanation spreading across the keyboard surface
 * - Specular highlight sweep on perfect hits
 */

import { ThemeDescriptor, ParticleStyle, Judgment } from './types.js';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  style: ParticleStyle;
  rotation: number;
  rotationSpeed: number;
  gravity: number;
  opacity: number;
}

interface ScreenShake {
  intensity: number;
  duration: number;
  startTime: number;
  decay: number;
}

interface EdgeGlow {
  color: string;
  intensity: number;
  duration: number;
  startTime: number;
}

/** A ripple expanding outward across the keyboard surface */
interface Ripple {
  x: number;
  y: number;
  startTime: number;
  duration: number;
  maxRadius: number;
  color: string;
  opacity: number;
  judgment: Judgment | 'wrong';
}

/** A specular highlight that sweeps across the keyboard */
interface SpecularSweep {
  startTime: number;
  duration: number;
  color: string;
  angle: number;
}

export class ParticleSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private shoves: ScreenShake[] = [];
  private edgeGlows: EdgeGlow[] = [];
  private ripples: Ripple[] = [];
  private specularSweeps: SpecularSweep[] = [];
  private animationId: number | null = null;
  private theme: ThemeDescriptor | null = null;
  private reducedMotion: boolean = false;
  private width: number = 0;
  private height: number = 0;
  private lastTime: number = 0;

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

  /** Set theme for particle colors */
  setTheme(theme: ThemeDescriptor): void {
    this.theme = theme;
  }

  /** Enable/disable reduced motion */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
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

  // ─────────────────────────────────────────────────────────────────────────
  // Ripple Effects — The "dopamine hit" emanating across the keyboard
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Emit a ripple that expands outward from a keypress position.
   * Larger and more vivid for perfect hits, smaller for good hits.
   */
  emitRipple(x: number, y: number, judgment: Judgment | 'wrong'): void {
    if (this.reducedMotion && judgment !== 'perfect') return;

    const colors: Record<string, string> = {
      perfect: '#00e5ff',
      great: '#76ff03',
      good: '#ffea00',
      wrong: '#ff1744',
    };
    const sizes: Record<string, number> = {
      perfect: 180,
      great: 120,
      good: 80,
      wrong: 50,
    };
    const durations: Record<string, number> = {
      perfect: 600,
      great: 500,
      good: 400,
      wrong: 300,
    };

    this.ripples.push({
      x,
      y,
      startTime: performance.now(),
      duration: durations[judgment] || 400,
      maxRadius: sizes[judgment] || 80,
      color: colors[judgment] || '#ffffff',
      opacity: judgment === 'perfect' ? 0.6 : 0.35,
      judgment,
    });

    // Perfect hits get a second, larger ripple for extra satisfaction
    if (judgment === 'perfect') {
      this.ripples.push({
        x,
        y,
        startTime: performance.now() + 80,
        duration: 700,
        maxRadius: 250,
        color: '#ffffff',
        opacity: 0.2,
        judgment,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Specular Highlight Sweep — Light sweeping across the surface
  // ─────────────────────────────────────────────────────────────────────────

  /** Trigger a specular highlight sweep — only on perfect hits */
  emitSpecularSweep(): void {
    if (this.reducedMotion) return;
    this.specularSweeps.push({
      startTime: performance.now(),
      duration: 400,
      color: '#ffffff',
      angle: Math.random() * Math.PI * 2,
    });
  }

  /** Emit a particle burst at a position */
  emitBurst(x: number, y: number, judgment: Judgment, style: ParticleStyle, density: number = 1.0): void {
    if (this.reducedMotion && judgment !== 'perfect') return;
    if (style === 'none') return;

    const colors = this.getJudgmentColors(judgment);
    const count = this.getParticleCount(judgment) * density;
    const intensity = this.theme?.intensity ?? 0.8;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = (2 + Math.random() * 4) * intensity;
      const life = 300 + Math.random() * 400;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life,
        maxLife: life,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        style,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        gravity: 0.02,
        opacity: 1,
      });
    }
  }

  /** Emit a small muted flash for bad timing */
  emitMutedFlash(x: number, y: number): void {
    if (this.reducedMotion) return;
    const colors = this.getJudgmentColors('good');
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 1.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 200,
        maxLife: 200,
        size: 1.5,
        color: colors[0],
        style: 'spark',
        rotation: 0,
        rotationSpeed: 0,
        gravity: 0.01,
        opacity: 0.6,
      });
    }
  }

  /** Emit a small burst for wrong key */
  emitWrongKeyBurst(x: number, y: number): void {
    if (this.reducedMotion) return;
    const color = this.theme?.colors.danger ?? '#ff1744';
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 150,
        maxLife: 150,
        size: 1.5,
        color,
        style: 'spark',
        rotation: 0,
        rotationSpeed: 0,
        gravity: 0,
        opacity: 0.5,
      });
    }
  }

  /** Add screen shake */
  addShake(intensity: number, duration: number = 200): void {
    if (this.reducedMotion) return;
    this.shoves.push({
      intensity,
      duration,
      startTime: performance.now(),
      decay: 0.02,
    });
  }

  /** Add screen-edge glow */
  addEdgeGlow(color: string, intensity: number, duration: number = 300): void {
    if (this.reducedMotion) return;
    this.edgeGlows.push({
      color,
      intensity,
      duration,
      startTime: performance.now(),
    });
  }

  /** Get total shake offset */
  getShakeOffset(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    const now = performance.now();
    for (let i = this.shoves.length - 1; i >= 0; i--) {
      const s = this.shoves[i];
      const elapsed = now - s.startTime;
      if (elapsed > s.duration) {
        this.shoves.splice(i, 1);
        continue;
      }
      const progress = elapsed / s.duration;
      const decay = 1 - progress;
      x += (Math.random() - 0.5) * s.intensity * decay * 2;
      y += (Math.random() - 0.5) * s.intensity * decay * 2;
    }
    return { x, y };
  }

  /** Start the animation loop */
  start(): void {
    this.lastTime = performance.now();
    const loop = (time: number) => {
      const dt = time - this.lastTime;
      this.lastTime = time;
      this.update(dt);
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

  /** Update all effects */
  private update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= dt;
      p.rotation += p.rotationSpeed;
      p.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /** Render all particles and effects */
  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Apply screen shake
    const shake = this.getShakeOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);

    // Render edge glows
    this.renderEdgeGlows(ctx);

    // Render ripples (behind particles)
    this.renderRipples(ctx);

    // Render particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      switch (p.style) {
        case 'spark':
          this.renderSpark(ctx, p);
          break;
        case 'ring':
          this.renderRing(ctx, p);
          break;
        case 'star':
          this.renderStar(ctx, p);
          break;
        case 'confetti':
          this.renderConfetti(ctx, p);
          break;
      }
      ctx.restore();
    }

    // Render specular sweeps (in front of everything)
    this.renderSpecularSweeps(ctx);

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ripple Rendering — Expanding concentric circles with glow
  // ─────────────────────────────────────────────────────────────────────────

  private renderRipples(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      // Clamp elapsed to 0 to avoid negative radius from future-starting ripples
      const elapsed = Math.max(0, now - r.startTime);
      if (elapsed > r.duration) {
        this.ripples.splice(i, 1);
        continue;
      }

      const progress = Math.min(1, elapsed / r.duration);
      const radius = r.maxRadius * this.easeOutQuad(progress);
      const alpha = r.opacity * (1 - progress);

      // Multiple concentric rings for richer effect
      for (let ring = 0; ring < 3; ring++) {
        const ringProgress = Math.min(1, Math.max(0, progress + ring * 0.1));
        const ringRadius = r.maxRadius * this.easeOutQuad(Math.min(1, ringProgress));
        const ringAlpha = alpha * (1 - ring * 0.3);

        ctx.beginPath();
        ctx.arc(r.x, r.y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = this.hexToRgba(r.color, ringAlpha);
        ctx.lineWidth = 2 - ring * 0.5;
        ctx.stroke();
      }

      // Inner glow fill
      const gradient = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, radius);
      gradient.addColorStop(0, this.hexToRgba(r.color, alpha * 0.3));
      gradient.addColorStop(1, this.hexToRgba(r.color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Specular Sweep Rendering — Brief "shininess" across the surface
  // ─────────────────────────────────────────────────────────────────────────

  private renderSpecularSweeps(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();

    for (let i = this.specularSweeps.length - 1; i >= 0; i--) {
      const s = this.specularSweeps[i];
      const elapsed = now - s.startTime;
      if (elapsed > s.duration) {
        this.specularSweeps.splice(i, 1);
        continue;
      }

      const progress = elapsed / s.duration;
      const alpha = 0.4 * (1 - progress);

      // A streak of light that sweeps diagonally
      const streakWidth = this.width * 0.3;
      const startX = -this.width + (this.width * 2.5 * progress);
      const gradient = ctx.createLinearGradient(
        startX, 0,
        startX + streakWidth, this.height
      );
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  private renderSpark(ctx: CanvasRenderingContext2D, p: Particle): void {
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderRing(ctx: CanvasRenderingContext2D, p: Particle): void {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  private renderStar(ctx: CanvasRenderingContext2D, p: Particle): void {
    const spikes = 5;
    const outerRadius = p.size * 2;
    const innerRadius = p.size;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI * i) / spikes;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  private renderConfetti(ctx: CanvasRenderingContext2D, p: Particle): void {
    ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
  }

  private renderEdgeGlows(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();
    for (let i = this.edgeGlows.length - 1; i >= 0; i--) {
      const g = this.edgeGlows[i];
      const elapsed = now - g.startTime;
      if (elapsed > g.duration) {
        this.edgeGlows.splice(i, 1);
        continue;
      }
      const progress = elapsed / g.duration;
      const alpha = g.intensity * (1 - progress);

      // Create gradient from edges
      const gradient = ctx.createRadialGradient(
        this.width / 2, this.height / 2, this.width * 0.3,
        this.width / 2, this.height / 2, this.width * 0.7
      );
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(1, this.hexToRgba(g.color, alpha * 0.3));

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  private getJudgmentColors(judgment: Judgment): string[] {
    const c = this.theme?.colors ?? {
      primary: '#00e5ff',
      secondary: '#76ff03',
      tertiary: '#ffea00',
      danger: '#ff1744',
    };
    switch (judgment) {
      case 'perfect': return [c.primary, '#ffffff', c.primary];
      case 'great': return [c.secondary, '#ffffff'];
      case 'good': return [c.tertiary];
    }
  }

  private getParticleCount(judgment: Judgment): number {
    const base = this.theme?.particleDensity ?? 1.0;
    switch (judgment) {
      case 'perfect': return Math.floor(20 * base);
      case 'great': return Math.floor(12 * base);
      case 'good': return Math.floor(6 * base);
    }
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  /** Clear all particles and effects */
  clear(): void {
    this.particles = [];
    this.shoves = [];
    this.edgeGlows = [];
    this.ripples = [];
    this.specularSweeps = [];
  }
}
