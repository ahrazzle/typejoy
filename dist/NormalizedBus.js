// ============================================================================
// NormalizedBus — Normalizes raw key events into clean character events
// ============================================================================
// Accounts for shift, caps lock, and keyboard layout. Consumes RawKeyEvent
// objects and emits NormalizedEvent objects.
// US QWERTY layout mapping: unshifted and shifted characters per code.
// This is intentionally minimal — a full layout engine is out of scope.
const US_QWERTY = {
    // Number row
    Backquote: { base: '`', shifted: '~' },
    Digit1: { base: '1', shifted: '!' },
    Digit2: { base: '2', shifted: '@' },
    Digit3: { base: '3', shifted: '#' },
    Digit4: { base: '4', shifted: '$' },
    Digit5: { base: '5', shifted: '%' },
    Digit6: { base: '6', shifted: '^' },
    Digit7: { base: '7', shifted: '&' },
    Digit8: { base: '8', shifted: '*' },
    Digit9: { base: '9', shifted: '(' },
    Digit0: { base: '0', shifted: ')' },
    Minus: { base: '-', shifted: '_' },
    Equal: { base: '=', shifted: '+' },
    // Top row
    KeyQ: { base: 'q', shifted: 'Q' },
    KeyW: { base: 'w', shifted: 'W' },
    KeyE: { base: 'e', shifted: 'E' },
    KeyR: { base: 'r', shifted: 'R' },
    KeyT: { base: 't', shifted: 'T' },
    KeyY: { base: 'y', shifted: 'Y' },
    KeyU: { base: 'u', shifted: 'U' },
    KeyI: { base: 'i', shifted: 'I' },
    KeyO: { base: 'o', shifted: 'O' },
    KeyP: { base: 'p', shifted: 'P' },
    BracketLeft: { base: '[', shifted: '{' },
    BracketRight: { base: ']', shifted: '}' },
    Backslash: { base: '\\', shifted: '|' },
    // Home row
    KeyA: { base: 'a', shifted: 'A' },
    KeyS: { base: 's', shifted: 'S' },
    KeyD: { base: 'd', shifted: 'D' },
    KeyF: { base: 'f', shifted: 'F' },
    KeyG: { base: 'g', shifted: 'G' },
    KeyH: { base: 'h', shifted: 'H' },
    KeyJ: { base: 'j', shifted: 'J' },
    KeyK: { base: 'k', shifted: 'K' },
    KeyL: { base: 'l', shifted: 'L' },
    Semicolon: { base: ';', shifted: ':' },
    Quote: { base: "'", shifted: '"' },
    // Bottom row
    KeyZ: { base: 'z', shifted: 'Z' },
    KeyX: { base: 'x', shifted: 'X' },
    KeyC: { base: 'c', shifted: 'C' },
    KeyV: { base: 'v', shifted: 'V' },
    KeyB: { base: 'b', shifted: 'B' },
    KeyN: { base: 'n', shifted: 'N' },
    KeyM: { base: 'm', shifted: 'M' },
    Comma: { base: ',', shifted: '<' },
    Period: { base: '.', shifted: '>' },
    Slash: { base: '/', shifted: '?' },
};
/**
 * Normalize a raw key event into a character.
 *
 * Rules:
 *  - Letters: base is lowercase, shifted state (shift XOR caps lock) makes uppercase.
 *  - Non-letters (numbers, symbols, etc.): shifted maps to the shifted glyph.
 *  - Space is returned as-is.
 *  - Layouts not in US_QWERTY fall back to e.key (best effort).
 */
export function normalizeKey(raw) {
    // Space and other single-char keys pass through.
    if (raw.code === 'Space')
        return ' ';
    const mapping = US_QWERTY[raw.code];
    if (!mapping) {
        // Unknown code — fall back to whatever e.key is.
        return raw.key.length === 1 ? raw.key : '';
    }
    // Determine effective shift for letters:
    //   uppercase = shift XOR capsLock
    const isLetter = /^[a-z]$/.test(mapping.base);
    const isShifted = isLetter
        ? (raw.modifiers.shift !== raw.modifiers.capsLock) // XOR
        : raw.modifiers.shift;
    return isShifted ? mapping.shifted : mapping.base;
}
/**
 * Consumes raw events and produces normalized character events.
 *
 * Only keydown events produce `press` normalized events. Keyup events produce
 * `release` normalized events (useful for hold-note extensions).
 *
 * Key-repeat events are filtered out — only genuine new presses are emitted.
 */
export class NormalizedBus {
    rawBus;
    listeners = new Set();
    unsub = null;
    /**
     * @param rawBus  Any object with `onEvent(fn)` that returns an unsubscribe
     *                function. Decoupled from RawBus via structural typing so
     *                tests can inject a mock.
     */
    constructor(rawBus) {
        this.rawBus = rawBus;
    }
    start() {
        if (this.unsub)
            return;
        this.unsub = this.rawBus.onEvent((raw) => this.handleRaw(raw));
    }
    stop() {
        this.unsub?.();
        this.unsub = null;
    }
    /** Subscribe to normalized events. Returns unsubscribe function. */
    onChar(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
    /** Inject a raw event directly (for testing). */
    injectRaw(raw) {
        this.handleRaw(raw);
    }
    handleRaw(raw) {
        // Filter out key repeats — they are auto-repeats, not new presses.
        if (raw.repeat)
            return;
        const char = normalizeKey(raw);
        if (!char)
            return;
        const phase = raw.type === 'keydown' ? 'press' : 'release';
        const evt = { char, raw, phase };
        for (const fn of this.listeners)
            fn(evt);
    }
}
//# sourceMappingURL=NormalizedBus.js.map