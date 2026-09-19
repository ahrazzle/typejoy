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
export declare class ParticleSystem {
    private canvas;
    private ctx;
    private particles;
    private shoves;
    private edgeGlows;
    private ripples;
    private specularSweeps;
    private animationId;
    private theme;
    private reducedMotion;
    private width;
    private height;
    private lastTime;
    constructor(canvas: HTMLCanvasElement);
    /** Set theme for particle colors */
    setTheme(theme: ThemeDescriptor): void;
    /** Enable/disable reduced motion */
    setReducedMotion(reduced: boolean): void;
    /** Resize the canvas */
    resize(width: number, height: number): void;
    /**
     * Emit a ripple that expands outward from a keypress position.
     * Larger and more vivid for perfect hits, smaller for good hits.
     */
    emitRipple(x: number, y: number, judgment: Judgment | 'wrong'): void;
    /** Trigger a specular highlight sweep — only on perfect hits */
    emitSpecularSweep(): void;
    /** Emit a particle burst at a position */
    emitBurst(x: number, y: number, judgment: Judgment, style: ParticleStyle, density?: number): void;
    /** Emit a small muted flash for bad timing */
    emitMutedFlash(x: number, y: number): void;
    /** Emit a small burst for wrong key */
    emitWrongKeyBurst(x: number, y: number): void;
    /** Add screen shake */
    addShake(intensity: number, duration?: number): void;
    /** Add screen-edge glow */
    addEdgeGlow(color: string, intensity: number, duration?: number): void;
    /** Get total shake offset */
    getShakeOffset(): {
        x: number;
        y: number;
    };
    /** Start the animation loop */
    start(): void;
    /** Stop the animation loop */
    stop(): void;
    /** Update all effects */
    private update;
    /** Render all particles and effects */
    private render;
    private renderRipples;
    private renderSpecularSweeps;
    private renderSpark;
    private renderRing;
    private renderStar;
    private renderConfetti;
    private renderEdgeGlows;
    private getJudgmentColors;
    private getParticleCount;
    private hexToRgba;
    private easeOutQuad;
    /** Clear all particles and effects */
    clear(): void;
}
//# sourceMappingURL=particle-system.d.ts.map