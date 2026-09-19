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
import { ThemeDescriptor, Note, Judgment, FeedbackLayer as FeedbackLayerInterface, BeatNote } from './types.js';
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
    private approachRingCanvas;
    private keyboard;
    private particles;
    private approachRings;
    private liveRegion;
    private comboDisplay;
    private width;
    private height;
    private statsDisplay;
    private stats;
    private expectedKeyIndicator;
    private expectedKeyLabel;
    private judge;
    private maxComboReached;
    private nudgeKeys;
    private lastStreakThreshold;
    private highContrast;
    private reducedMotion;
    private nudgeEnabled;
    private gameActive;
    constructor(options: FeedbackLayerOptions);
    /** Increment and render the judgment stats (top-left) */
    private updateStatsDisplay;
    /** Reset judgment stats (called at game start) */
    resetStats(): void;
    renderHit(judgment: Judgment, key: string, _delta: number): void;
    renderMiss(key: string, _expectedKey: string): void;
    renderStale(_note: Note): void;
    renderCombo(count: number, _multiplier: number): void;
    pulseKey(key: string, _bpm: number): void;
    setTheme(theme: ThemeDescriptor): void;
    /** Set approach ring preempt time (ms before hit when rings appear) */
    setPreemptTime(ms: number): void;
    /** Mark a note's approach ring as judged so it collapses on the hit frame */
    markNoteJudged(note: BeatNote, judgment: 'perfect' | 'great' | 'good' | 'miss'): void;
    /** Set how many upcoming notes to show approach rings for */
    setNoteCount(count: number): void;
    /**
     * Provide a reference to the judge so the feedback layer can query the current
     * expected note and render a persistent expected-key indicator.
     */
    setJudge(judge: {
        getCurrentNote: () => BeatNote | undefined;
        getNextNotes: (count: number) => Array<{
            note: BeatNote;
            timeUntilHit: number;
        }>;
        getSongTime: () => number;
        getNotes: () => readonly BeatNote[];
    }): void;
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
    private createExpectedKeyIndicator;
    /**
    * Updates the expected-key indicator each frame: reads the judge's current note,
    * positions the floating keycap above the target key, and adjusts glow intensity
    * based on how close the note is to its hit time.
    */
    private updateExpectedKeyIndicator;
    private getKeyScreenBounds;
    getKeyboardElement(): SVGSVGElement;
    getCanvasOverlay(): HTMLCanvasElement;
    getContainer(): HTMLElement;
    getLiveRegion(): HTMLElement;
    reset(): void;
    /** Get accuracy as 0-1 based on judgment windows */
    getAccuracy(): number;
    /** Get letter ranking based on accuracy */
    getRanking(): string;
    /** Play celebration animation (confetti burst) */
    playCelebration(): void;
    resize(width: number, height: number): void;
    start(): void;
    stop(): void;
    private startNudgeLoop;
}
//# sourceMappingURL=feedback-layer.d.ts.map