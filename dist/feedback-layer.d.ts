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
import { ThemeDescriptor, Note, Judgment, FeedbackLayer as FeedbackLayerInterface } from './types';
export interface FeedbackLayerOptions {
    container: HTMLElement;
    theme?: ThemeDescriptor;
    width?: number;
    height?: number;
}
export declare class FeedbackLayer implements FeedbackLayerInterface {
    private container;
    private theme;
    private keyboardContainer;
    private canvas;
    private keyboard;
    private particles;
    private liveRegion;
    private comboDisplay;
    private width;
    private height;
    private maxComboReached;
    private nudgeKeys;
    private lastStreakThreshold;
    private highContrast;
    private reducedMotion;
    private nudgeEnabled;
    private gameActive;
    constructor(options: FeedbackLayerOptions);
    renderHit(judgment: Judgment, key: string, _delta: number): void;
    renderMiss(key: string, _expectedKey: string): void;
    renderStale(note: Note): void;
    renderCombo(count: number, _multiplier: number): void;
    pulseKey(key: string, _bpm: number): void;
    setTheme(theme: ThemeDescriptor): void;
    setHighContrast(enabled: boolean): void;
    setReducedMotion(enabled: boolean): void;
    setNudgeEnabled(enabled: boolean): void;
    /** Announce a message via ARIA live region */
    announce(message: string): void;
    private applyComboEscalation;
    private triggerSubtleEffect;
    private triggerModerateEffect;
    private triggerIntenseEffect;
    updateNudges(): void;
    private getKeyScreenBounds;
    getKeyboardElement(): SVGSVGElement;
    getCanvasOverlay(): HTMLCanvasElement;
    getContainer(): HTMLElement;
    getLiveRegion(): HTMLElement;
    reset(): void;
    resize(width: number, height: number): void;
    start(): void;
    stop(): void;
    private startNudgeLoop;
}
//# sourceMappingURL=feedback-layer.d.ts.map