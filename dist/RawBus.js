// ============================================================================
// RawBus — Captures raw key events with high-resolution timestamps
// ============================================================================
// Timestamps are captured at the moment the event fires, *before* any
// normalization or processing. This preserves the most accurate hardware
// timing for downstream judgment.
/**
 * Minimal synchronous pub/sub emitter.
 */
class Emitter {
    listeners = new Set();
    on(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
    emit(payload) {
        for (const fn of this.listeners)
            fn(payload);
    }
    clear() {
        this.listeners.clear();
    }
}
/**
 * RawBus captures keydown/keyup from a DOM target (default: window).
 *
 * It stamps each event with `performance.now()` *inside* the DOM handler
 * itself — not in a downstream callback — so the timestamp reflects the
 * actual input time as closely as the browser allows.
 */
export class RawBus {
    target;
    emitter = new Emitter();
    _isListening = false;
    // Bound handlers stored so we can remove them on stop()
    boundKeyDown;
    boundKeyUp;
    constructor(target) {
        // Default to window, but allow injection for testing / SSR.
        this.target = target ?? (typeof window !== 'undefined' ? window : createNoopTarget());
        this.boundKeyDown = (e) => this.handleKey(e, 'keydown');
        this.boundKeyUp = (e) => this.handleKey(e, 'keyup');
    }
    // ---- Subscription -------------------------------------------------------
    /**
     * Subscribe to raw key events. Returns an unsubscribe function.
     */
    onKeyDown(fn) {
        return this.emitter.on(fn);
    }
    /**
     * Subscribe to *all* raw key events (both down and up). Returns an
     * unsubscribe function.
     */
    onEvent(fn) {
        return this.emitter.on(fn);
    }
    // ---- Lifecycle ----------------------------------------------------------
    start() {
        if (this._isListening)
            return;
        this.target.addEventListener('keydown', this.boundKeyDown, { capture: true });
        this.target.addEventListener('keyup', this.boundKeyUp, { capture: true });
        this._isListening = true;
    }
    stop() {
        if (!this._isListening)
            return;
        this.target.removeEventListener('keydown', this.boundKeyDown, { capture: true });
        this.target.removeEventListener('keyup', this.boundKeyUp, { capture: true });
        this._isListening = false;
    }
    get isListening() {
        return this._isListening;
    }
    // ---- Direct injection (for testing / headless use) ----------------------
    /**
     * Inject a raw key event directly. Useful in unit tests and headless
     * environments where no DOM exists. The timestamp is captured at call
     * time so callers can pre-stamp if they need a specific time.
     */
    inject(key, code, type, timestamp) {
        const now = timestamp ?? performance.now();
        const evt = {
            type,
            key,
            code,
            timestamp: now,
            modifiers: {
                shift: false,
                ctrl: false,
                alt: false,
                meta: false,
                capsLock: false,
            },
            repeat: false,
        };
        this.emitter.emit(evt);
    }
    // ---- Internal -----------------------------------------------------------
    handleKey(e, type) {
        // Capture the timestamp IMMEDIATELY — this is the single most important
        // timing guarantee in the framework.
        const timestamp = performance.now();
        const evt = {
            type,
            key: e.key,
            code: e.code,
            timestamp,
            modifiers: {
                shift: e.shiftKey,
                ctrl: e.ctrlKey,
                alt: e.altKey,
                meta: e.metaKey,
                capsLock: e.getModifierState('CapsLock'),
            },
            repeat: e.repeat,
            nativeEvent: e,
        };
        this.emitter.emit(evt);
    }
}
// ============================================================================
// Fallback for non-DOM environments: a no-op target that supports the
// addEventListener/removeEventListener surface used by RawBus.
// ============================================================================
function createNoopTarget() {
    const listeners = new Map();
    return {
        addEventListener: (type, listener) => {
            if (!listeners.has(type))
                listeners.set(type, new Set());
            listeners.get(type).add(listener);
        },
        removeEventListener: (type, listener) => {
            listeners.get(type)?.delete(listener);
        },
        dispatchEvent: () => true,
    };
}
//# sourceMappingURL=RawBus.js.map