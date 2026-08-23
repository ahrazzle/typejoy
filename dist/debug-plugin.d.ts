import type { GamePlugin, GameConfig, GameResults, FeedbackLayer, Judgment, Note } from './types.js';
export declare class DebugPlugin implements GamePlugin {
    readonly name = "debug-validator";
    private feedbackLayer;
    private canvas;
    private combo;
    private maxCombo;
    private progress;
    private totalNotes;
    private judgmentCounts;
    private lastJudgment;
    private judgmentLog;
    private animationId;
    private container;
    private circleEl;
    private progressBarEl;
    private logEl;
    onGameStart(config: GameConfig): void;
    onGameEnd(results: GameResults): void;
    onHit(judgment: Judgment, key: string, delta: number): void;
    onMiss(key: string, expectedKey: string): void;
    onNoteStale(note: Note): void;
    onCombo(count: number, multiplier: number): void;
    onStreakThreshold(count: number): void;
    onSongComplete(results: GameResults): void;
    getCanvasContext(): HTMLCanvasElement | null;
    getFeedbackLayer(): FeedbackLayer;
    setFeedbackLayer(layer: FeedbackLayer): void;
    private createUI;
    private startRenderLoop;
    private render;
    private log;
    destroy(): void;
}
//# sourceMappingURL=debug-plugin.d.ts.map