import type { PluginHooks, JudgmentEvent, BeatNote } from './types.js';
/**
 * A plugin registry that fans out events to all registered plugins.
 */
export declare class PluginRegistry {
    private readonly plugins;
    /**
     * Register a plugin. Returns an unregister function.
     */
    register(plugin: PluginHooks): () => void;
    /** Number of registered plugins. */
    get count(): number;
    onHit(event: JudgmentEvent): void;
    onMiss(key: string, expectedKey: string, delta: number): void;
    onNoteStale(note: BeatNote): void;
    onCombo(count: number, multiplier: number): void;
    onComboBreak(previousCount: number): void;
}
/**
 * A no-op plugin that logs all events to console. Useful for debugging.
 */
export declare class DebugPlugin implements PluginHooks {
    readonly name: string;
    private readonly log;
    constructor(name?: string, log?: (msg: string) => void);
    onHit(event: JudgmentEvent): void;
    onMiss(key: string, expectedKey: string, delta: number): void;
    onNoteStale(note: BeatNote): void;
    onCombo(count: number, multiplier: number): void;
    onComboBreak(previousCount: number): void;
}
//# sourceMappingURL=PluginHooks.d.ts.map