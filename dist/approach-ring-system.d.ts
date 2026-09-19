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
export declare class ApproachRingSystem {
    private canvas;
    private ctx;
    private rings;
    private animationId;
    private width;
    private height;
    private preemptTime;
    private maxScale;
    private noteCount;
    private farColor;
    private midColor;
    private nearColor;
    private urgentColor;
    private perfectColor;
    private greatColor;
    private goodColor;
    private missColor;
    judge: {
        getSongTime: () => number;
        getNotes: () => readonly BeatNote[];
        getNextNotes: (count: number) => Array<{
            note: BeatNote;
            timeUntilHit: number;
        }>;
    } | null;
    keyboard: {
        getKeyElement: (keyId: string) => SVGElement | null;
    } | null;
    container: HTMLElement | null;
    constructor(canvas: HTMLCanvasElement);
    /** Set preempt time based on difficulty */
    setPreemptTime(ms: number): void;
    /** Set how many upcoming notes to show */
    setNoteCount(count: number): void;
    /** Resize the canvas */
    resize(width: number, height: number): void;
    /** Clear all rings */
    clear(): void;
    /** Mark a ring as judged so it can animate out */
    markJudged(note: BeatNote, judgment: 'perfect' | 'great' | 'good' | 'miss'): void;
    /** Get the screen position for a key */
    private getKeyPosition;
    /** Update ring positions and spawn new rings for upcoming notes */
    update(): void;
    /** Render all active rings */
    render(): void;
    private renderJudgedRing;
    /** Get ring color based on proximity (progress 0→1) */
    private getRingColor;
    /** Get ring alpha based on proximity (faint far, bright near) */
    private getRingAlpha;
    /** Start the animation loop */
    start(): void;
    /** Stop the animation loop */
    stop(): void;
}
//# sourceMappingURL=approach-ring-system.d.ts.map