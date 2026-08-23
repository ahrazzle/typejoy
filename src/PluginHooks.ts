// ============================================================================
// PluginHooks — Registry and dispatcher
// ============================================================================
// A lightweight registry for plugin hook implementations. Plugins register
// and the judge dispatches events to all registered plugins.

import type { PluginHooks, JudgmentEvent, BeatNote } from './types.js';

/**
 * A plugin registry that fans out events to all registered plugins.
 */
export class PluginRegistry {
  private readonly plugins: PluginHooks[] = [];

  /**
   * Register a plugin. Returns an unregister function.
   */
  register(plugin: PluginHooks): () => void {
    this.plugins.push(plugin);
    return () => {
      const idx = this.plugins.indexOf(plugin);
      if (idx !== -1) this.plugins.splice(idx, 1);
    };
  }

  /** Number of registered plugins. */
  get count(): number {
    return this.plugins.length;
  }

  // ---- Dispatch methods (called by the judge) -----------------------------

  onHit(event: JudgmentEvent): void {
    for (const p of this.plugins) p.onHit?.(event);
  }

  onMiss(key: string, expectedKey: string, delta: number): void {
    for (const p of this.plugins) p.onMiss?.(key, expectedKey, delta);
  }

  onNoteStale(note: BeatNote): void {
    for (const p of this.plugins) p.onNoteStale?.(note);
  }

  onCombo(count: number, multiplier: number): void {
    for (const p of this.plugins) p.onCombo?.(count, multiplier);
  }

  onComboBreak(previousCount: number): void {
    for (const p of this.plugins) p.onComboBreak?.(previousCount);
  }
}

// ============================================================================
// Built-in plugins (examples / debugging utilities)
// ============================================================================

/**
 * A no-op plugin that logs all events to console. Useful for debugging.
 */
export class DebugPlugin implements PluginHooks {
  readonly name: string;
  private readonly log: (msg: string) => void;

  constructor(name = 'debug', log: (msg: string) => void = console.log) {
    this.name = name;
    this.log = log;
  }

  onHit(event: JudgmentEvent): void {
    this.log(`[${this.name}] HIT  ${event.judgment.padEnd(8)} key="${event.key}" delta=${event.delta.toFixed(1)}ms`);
  }

  onMiss(key: string, expectedKey: string, delta: number): void {
    this.log(`[${this.name}] MISS key="${key}" expected="${expectedKey}" delta=${delta.toFixed(1)}ms`);
  }

  onNoteStale(note: BeatNote): void {
    this.log(`[${this.name}] STALE note key="${note.key}" time=${note.time}ms`);
  }

  onCombo(count: number, multiplier: number): void {
    this.log(`[${this.name}] COMBO ${count}x (mult=${multiplier}x)`);
  }

  onComboBreak(previousCount: number): void {
    this.log(`[${this.name}] COMBO BREAK (was ${previousCount})`);
  }
}