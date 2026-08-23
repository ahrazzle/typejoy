// ============================================================================
// PluginHooks — Registry and dispatcher
// ============================================================================
// A lightweight registry for plugin hook implementations. Plugins register
// and the judge dispatches events to all registered plugins.
/**
 * A plugin registry that fans out events to all registered plugins.
 */
export class PluginRegistry {
    plugins = [];
    /**
     * Register a plugin. Returns an unregister function.
     */
    register(plugin) {
        this.plugins.push(plugin);
        return () => {
            const idx = this.plugins.indexOf(plugin);
            if (idx !== -1)
                this.plugins.splice(idx, 1);
        };
    }
    /** Number of registered plugins. */
    get count() {
        return this.plugins.length;
    }
    // ---- Dispatch methods (called by the judge) -----------------------------
    onHit(event) {
        for (const p of this.plugins)
            p.onHit?.(event);
    }
    onMiss(key, expectedKey, delta) {
        for (const p of this.plugins)
            p.onMiss?.(key, expectedKey, delta);
    }
    onNoteStale(note) {
        for (const p of this.plugins)
            p.onNoteStale?.(note);
    }
    onCombo(count, multiplier) {
        for (const p of this.plugins)
            p.onCombo?.(count, multiplier);
    }
    onComboBreak(previousCount) {
        for (const p of this.plugins)
            p.onComboBreak?.(previousCount);
    }
}
// ============================================================================
// Built-in plugins (examples / debugging utilities)
// ============================================================================
/**
 * A no-op plugin that logs all events to console. Useful for debugging.
 */
export class DebugPlugin {
    name;
    log;
    constructor(name = 'debug', log = console.log) {
        this.name = name;
        this.log = log;
    }
    onHit(event) {
        this.log(`[${this.name}] HIT  ${event.judgment.padEnd(8)} key="${event.key}" delta=${event.delta.toFixed(1)}ms`);
    }
    onMiss(key, expectedKey, delta) {
        this.log(`[${this.name}] MISS key="${key}" expected="${expectedKey}" delta=${delta.toFixed(1)}ms`);
    }
    onNoteStale(note) {
        this.log(`[${this.name}] STALE note key="${note.key}" time=${note.time}ms`);
    }
    onCombo(count, multiplier) {
        this.log(`[${this.name}] COMBO ${count}x (mult=${multiplier}x)`);
    }
    onComboBreak(previousCount) {
        this.log(`[${this.name}] COMBO BREAK (was ${previousCount})`);
    }
}
//# sourceMappingURL=PluginHooks.js.map