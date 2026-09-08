import type { RawKeyEvent, NormalizedEvent, Listener } from './types.js';
type NormalizedListener = Listener<NormalizedEvent>;
/**
 * Normalize a raw key event into a character.
 *
 * Rules:
 *  - Letters: base is lowercase, shifted state (shift XOR caps lock) makes uppercase.
 *  - Non-letters (numbers, symbols, etc.): shifted maps to the shifted glyph.
 *  - Space is returned as-is.
 *  - Layouts not in US_QWERTY fall back to e.key (best effort).
 */
export declare function normalizeKey(raw: RawKeyEvent): string;
/**
 * Consumes raw events and produces normalized character events.
 *
 * Only keydown events produce `press` normalized events. Keyup events produce
 * `release` normalized events (useful for hold-note extensions).
 *
 * Key-repeat events are filtered out — only genuine new presses are emitted.
 */
export declare class NormalizedBus {
    private readonly rawBus;
    private readonly listeners;
    private unsub;
    /**
     * @param rawBus  Any object with `onEvent(fn)` that returns an unsubscribe
     *                function. Decoupled from RawBus via structural typing so
     *                tests can inject a mock.
     */
    constructor(rawBus: {
        onEvent: (fn: Listener<RawKeyEvent>) => () => void;
    });
    start(): void;
    stop(): void;
    /** Subscribe to normalized events. Returns unsubscribe function. */
    onChar(fn: NormalizedListener): () => void;
    /** Inject a raw event directly (for testing). */
    injectRaw(raw: RawKeyEvent): void;
    private handleRaw;
}
export {};
//# sourceMappingURL=NormalizedBus.d.ts.map