/**
 * Typejoy Framework — Canvas Particle System
 *
 * Manages particle effects, screen shake, RGB glow, and screen-edge glow
 * on a stacked canvas overlay. All effects are rendered with `pointer-events: none`
 * so keystrokes always reach the input layer.
 */
import { ThemeDescriptor, ParticleStyle, Judgment } from './types';
export declare class ParticleSystem {
    private canvas;
    private ctx;
    private particles;
    private shoves;
    private edgeGlows;
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
    /** Update particles */
    private update;
    /** Render all particles and effects */
    private render;
    private renderSpark;
    private renderRing;
    private renderStar;
    private renderConfetti;
    private renderEdgeGlows;
    private getJudgmentColors;
    private getParticleCount;
    private hexToRgba;
    /** Clear all particles and effects */
    clear(): void;
}
//# sourceMappingURL=particle-system.d.ts.map