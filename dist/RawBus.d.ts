import type { RawKeyEvent, Listener } from './types.js';
type RawListener = Listener<RawKeyEvent>;
/**
 * RawBus captures keydown/keyup from a DOM target (default: window).
 *
 * It stamps each event with `performance.now()` *inside* the DOM handler
 * itself — not in a downstream callback — so the timestamp reflects the
 * actual input time as closely as the browser allows.
 */
export declare class RawBus {
    private readonly target;
    private readonly emitter;
    private _isListening;
    private readonly boundKeyDown;
    private readonly boundKeyUp;
    constructor(target?: GlobalEventHandlers & EventTarget);
    /**
     * Subscribe to raw key events. Returns an unsubscribe function.
     */
    onKeyDown(fn: RawListener): () => void;
    /**
     * Subscribe to *all* raw key events (both down and up). Returns an
     * unsubscribe function.
     */
    onEvent(fn: RawListener): () => void;
    start(): void;
    stop(): void;
    get isListening(): boolean;
    /**
     * Inject a raw key event directly. Useful in unit tests and headless
     * environments where no DOM exists. The timestamp is captured at call
     * time so callers can pre-stamp if they need a specific time.
     */
    inject(key: string, code: string, type: 'keydown' | 'keyup', timestamp?: number): void;
    private handleKey;
}
export {};
//# sourceMappingURL=RawBus.d.ts.map