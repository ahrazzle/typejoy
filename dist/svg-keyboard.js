/**
 * Typejoy Framework — SVG Keyboard Renderer
 *
 * Renders a crisp SVG keyboard with ARIA labels on every key.
 * Supports hardware-accelerated CSS transitions and high-contrast mode.
 */
import { QWERTY_LAYOUT, buildKeyMap } from './keyboard-layout';
const SVG_NS = 'http://www.w3.org/2000/svg';
export class SVGKeyboardRenderer {
    svg;
    layout;
    renderedKeys = new Map();
    unitSize;
    keyGap;
    borderRadius;
    theme = null;
    /** Track depressed keys for CSS animation */
    depressedKeys = new Set();
    /** Track beat-pulse state */
    pulseStates = new Map();
    /** Track nudge hints */
    nudgeKeys = new Map();
    /** Track wrong key shake state */
    shakeKeys = new Map();
    constructor(container, options = {}) {
        this.layout = options.layout ?? QWERTY_LAYOUT;
        buildKeyMap(this.layout);
        this.unitSize = options.unitSize ?? 48;
        this.keyGap = options.keyGap ?? 4;
        this.borderRadius = options.borderRadius ?? 4;
        // Create SVG element
        this.svg = document.createElementNS(SVG_NS, 'svg');
        this.svg.setAttribute('class', 'typejoy-keyboard');
        this.svg.setAttribute('role', 'group');
        this.svg.setAttribute('aria-label', 'Typejoy keyboard — press the highlighted keys to the rhythm');
        this.svg.style.display = 'block';
        this.svg.style.width = '100%';
        this.svg.style.height = '100%';
        this.svg.style.overflow = 'visible';
        // Define CSS for hardware-accelerated transitions
        const style = document.createElementNS(SVG_NS, 'style');
        style.textContent = `
      .typejoy-key {
        transition: transform 60ms cubic-bezier(0.2, 0.8, 0.3, 1.2),
                    filter 100ms ease-out,
                    opacity 150ms ease;
        transform-box: fill-box;
        transform-origin: center;
        will-change: transform, filter;
      }
      .typejoy-key:hover {
        filter: brightness(1.1);
      }
      .typejoy-keycap {
        transition: fill 100ms ease-out, stroke 100ms ease-out;
      }
      .typejoy-keycap-bg {
        transition: opacity 100ms ease-out;
      }
      .typejoy-key-depressed {
        transform: translateY(2px) scale(0.96);
        filter: brightness(0.85);
      }
      .typejoy-key-shake {
        animation: typejoy-shake 200ms ease-out;
      }
      .typejoy-key-pulse {
        animation: typejoy-beat-pulse 200ms ease-out;
      }
      @keyframes typejoy-shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-2px); }
        40% { transform: translateX(2px); }
        60% { transform: translateX(-1px); }
        80% { transform: translateX(1px); }
      }
      @keyframes typejoy-beat-pulse {
        0% { filter: brightness(1); }
        50% { filter: brightness(1.3); }
        100% { filter: brightness(1); }
      }
    `;
        this.svg.appendChild(style);
        // Build the keyboard
        this.buildKeyboard();
        container.appendChild(this.svg);
    }
    buildKeyboard() {
        const totalW = this.layout.totalWidth * this.unitSize;
        const totalH = this.layout.totalHeight * (this.unitSize + this.keyGap);
        this.svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
        // Background rect
        const bg = document.createElementNS(SVG_NS, 'rect');
        bg.setAttribute('x', '0');
        bg.setAttribute('y', '0');
        bg.setAttribute('width', String(totalW));
        bg.setAttribute('height', String(totalH));
        bg.setAttribute('rx', String(this.borderRadius * 2));
        bg.setAttribute('class', 'typejoy-keyboard-bg');
        bg.setAttribute('fill', this.theme?.colors.surface ?? '#1a1a2e');
        this.svg.appendChild(bg);
        // Render each key
        for (const row of this.layout.rows) {
            for (const keyDef of row) {
                const x = keyDef.col * this.unitSize + this.keyGap;
                const y = keyDef.row * (this.unitSize + this.keyGap) + this.keyGap;
                const w = keyDef.width * this.unitSize - this.keyGap * 2;
                const h = this.unitSize - this.keyGap * 2;
                const rendered = this.renderKey(keyDef, x, y, w, h);
                this.renderedKeys.set(keyDef.id, rendered);
            }
        }
    }
    renderKey(keyDef, x, y, w, h) {
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'typejoy-key');
        g.setAttribute('data-key', keyDef.id);
        g.setAttribute('role', 'button');
        g.setAttribute('tabindex', '-1');
        g.setAttribute('aria-label', this.getAriaLabel(keyDef));
        // Keycap background (for glow/highlight)
        const bg = document.createElementNS(SVG_NS, 'rect');
        bg.setAttribute('x', String(x));
        bg.setAttribute('y', String(y));
        bg.setAttribute('width', String(w));
        bg.setAttribute('height', String(h));
        bg.setAttribute('rx', String(this.borderRadius));
        bg.setAttribute('class', 'typejoy-keycap-bg');
        bg.setAttribute('fill', this.theme?.colors.keycap ?? '#2d2d44');
        bg.setAttribute('opacity', '0');
        // Keycap
        const keycap = document.createElementNS(SVG_NS, 'rect');
        keycap.setAttribute('x', String(x));
        keycap.setAttribute('y', String(y));
        keycap.setAttribute('width', String(w));
        keycap.setAttribute('height', String(h));
        keycap.setAttribute('rx', String(this.borderRadius));
        keycap.setAttribute('class', 'typejoy-keycap');
        keycap.setAttribute('fill', this.theme?.colors.keycap ?? '#2d2d44');
        keycap.setAttribute('stroke', this.theme?.colors.keycapBorder ?? '#3d3d5c');
        keycap.setAttribute('stroke-width', '1');
        // Home row indicator (small dot or bar)
        if (keyDef.isHomeRow) {
            const indicator = document.createElementNS(SVG_NS, 'rect');
            indicator.setAttribute('x', String(x + w / 2 - 3));
            indicator.setAttribute('y', String(y + h - 6));
            indicator.setAttribute('width', '6');
            indicator.setAttribute('height', '2');
            indicator.setAttribute('rx', '1');
            indicator.setAttribute('fill', this.theme?.colors.keycapBorder ?? '#3d3d5c');
            indicator.setAttribute('opacity', '0.5');
            g.appendChild(indicator);
        }
        // Key label
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', String(x + w / 2));
        text.setAttribute('y', String(y + h / 2 + 1));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('class', 'typejoy-keycap-text');
        text.setAttribute('fill', this.theme?.colors.keycapText ?? '#e0e0e0');
        text.setAttribute('font-size', String(this.unitSize * 0.28));
        text.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
        text.setAttribute('font-weight', '500');
        text.setAttribute('pointer-events', 'none');
        text.textContent = keyDef.label;
        g.appendChild(bg);
        g.appendChild(keycap);
        g.appendChild(text);
        this.svg.appendChild(g);
        return { defs: keyDef, element: g, x, y, width: w, height: h };
    }
    getAriaLabel(keyDef) {
        const label = keyDef.label || keyDef.id;
        const homeHint = keyDef.isHomeRow ? ' (home row)' : '';
        const fingerHint = keyDef.finger ? `, ${keyDef.finger.replace('-', ' ')} finger` : '';
        return `Key ${label}${homeHint}${fingerHint}`;
    }
    /** Get the SVG element for a specific key */
    getKeyElement(keyId) {
        return this.renderedKeys.get(keyId)?.element;
    }
    /** Depress a key (visual feedback for press) */
    depressKey(keyId, duration = 80) {
        const rendered = this.renderedKeys.get(keyId);
        if (!rendered)
            return;
        rendered.element.classList.add('typejoy-key-depressed');
        this.depressedKeys.add(keyId);
        window.setTimeout(() => {
            rendered.element.classList.remove('typejoy-key-depressed');
            this.depressedKeys.delete(keyId);
        }, duration);
    }
    /** Pulse a key (beat sync) */
    pulseKey(keyId, bpm) {
        const rendered = this.renderedKeys.get(keyId);
        if (!rendered)
            return;
        const duration = Math.min(60000 / bpm / 2, 200);
        this.pulseStates.set(keyId, { startTime: performance.now(), intensity: 1.0 });
        rendered.element.classList.add('typejoy-key-pulse');
        window.setTimeout(() => {
            rendered.element.classList.remove('typejoy-key-pulse');
            this.pulseStates.delete(keyId);
        }, duration);
    }
    /** Shake a key (wrong key feedback) */
    shakeKey(keyId) {
        const rendered = this.renderedKeys.get(keyId);
        if (!rendered)
            return;
        this.shakeKeys.set(keyId, { startTime: performance.now() });
        rendered.element.classList.add('typejoy-key-shake');
        window.setTimeout(() => {
            rendered.element.classList.remove('typejoy-key-shake');
            this.shakeKeys.delete(keyId);
        }, 200);
    }
    /** Set glow on a key (nudge hint) */
    setNudgeGlow(keyId, intensity) {
        const rendered = this.renderedKeys.get(keyId);
        if (!rendered)
            return;
        const bg = rendered.element.querySelector('.typejoy-keycap-bg');
        if (bg) {
            bg.setAttribute('opacity', String(intensity * 0.5));
            bg.setAttribute('fill', this.theme?.colors.nudgeGlow ?? '#ff9100');
        }
    }
    /** Clear nudge glow from a key */
    clearNudgeGlow(keyId) {
        const rendered = this.renderedKeys.get(keyId);
        if (!rendered)
            return;
        const bg = rendered.element.querySelector('.typejoy-keycap-bg');
        if (bg) {
            bg.setAttribute('opacity', '0');
        }
    }
    /** Set key highlight color (for visual feedback) */
    setKeyHighlight(keyId, color, opacity = 0.6) {
        const rendered = this.renderedKeys.get(keyId);
        if (!rendered)
            return;
        const bg = rendered.element.querySelector('.typejoy-keycap-bg');
        if (bg) {
            bg.setAttribute('opacity', String(opacity));
            bg.setAttribute('fill', color);
        }
        const keycap = rendered.element.querySelector('.typejoy-keycap');
        if (keycap) {
            keycap.setAttribute('stroke', color);
            keycap.setAttribute('stroke-width', '2');
        }
    }
    /** Clear key highlight */
    clearKeyHighlight(keyId) {
        const rendered = this.renderedKeys.get(keyId);
        if (!rendered)
            return;
        const bg = rendered.element.querySelector('.typejoy-keycap-bg');
        if (bg) {
            bg.setAttribute('opacity', '0');
            bg.setAttribute('fill', this.theme?.colors.keycap ?? '#2d2d44');
        }
        const keycap = rendered.element.querySelector('.typejoy-keycap');
        if (keycap) {
            keycap.setAttribute('stroke', this.theme?.colors.keycapBorder ?? '#3d3d5c');
            keycap.setAttribute('stroke-width', '1');
        }
    }
    /** Apply theme colors to the keyboard */
    applyTheme(theme, highContrast = false) {
        this.theme = theme;
        const colors = highContrast && theme.colors.highContrast
            ? { ...theme.colors, ...theme.colors.highContrast }
            : theme.colors;
        // Update background
        const bg = this.svg.querySelector('.typejoy-keyboard-bg');
        if (bg)
            bg.setAttribute('fill', colors.surface);
        // Update all keys
        for (const [, rendered] of this.renderedKeys) {
            const keycap = rendered.element.querySelector('.typejoy-keycap');
            const text = rendered.element.querySelector('.typejoy-keycap-text');
            if (keycap) {
                keycap.setAttribute('fill', colors.keycap);
                keycap.setAttribute('stroke', colors.keycapBorder);
            }
            if (text) {
                text.setAttribute('fill', colors.keycapText);
            }
        }
    }
    /** Get the SVG element */
    getElement() {
        return this.svg;
    }
    /** Reset all visual state */
    reset() {
        for (const [keyId] of this.renderedKeys) {
            this.clearKeyHighlight(keyId);
            this.clearNudgeGlow(keyId);
        }
        this.depressedKeys.clear();
        this.pulseStates.clear();
        this.nudgeKeys.clear();
        this.shakeKeys.clear();
    }
}
//# sourceMappingURL=svg-keyboard.js.map