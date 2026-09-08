/**
 * Typejoy Framework — SVG Keyboard Renderer
 *
 * Renders a crisp SVG keyboard with ARIA labels on every key.
 * Supports hardware-accelerated CSS transitions and high-contrast mode.
 */
import { KeyDef, KeyboardLayout } from './keyboard-layout';
import { ThemeDescriptor } from './types';
export interface RenderedKey {
    defs: KeyDef;
    element: SVGElement;
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface KeyboardRendererOptions {
    layout?: KeyboardLayout;
    unitSize?: number;
    keyGap?: number;
    borderRadius?: number;
}
export declare class SVGKeyboardRenderer {
    private svg;
    private layout;
    private renderedKeys;
    private unitSize;
    private keyGap;
    private borderRadius;
    private theme;
    /** Track depressed keys for CSS animation */
    private depressedKeys;
    /** Track beat-pulse state */
    private pulseStates;
    /** Track nudge hints */
    private nudgeKeys;
    /** Track wrong key shake state */
    private shakeKeys;
    constructor(container: HTMLElement, options?: KeyboardRendererOptions);
    private buildKeyboard;
    private renderKey;
    private getAriaLabel;
    /** Get the SVG element for a specific key */
    getKeyElement(keyId: string): SVGElement | undefined;
    /** Depress a key (visual feedback for press) */
    depressKey(keyId: string, duration?: number): void;
    /** Pulse a key (beat sync) */
    pulseKey(keyId: string, bpm: number): void;
    /** Shake a key (wrong key feedback) */
    shakeKey(keyId: string): void;
    /** Set glow on a key (nudge hint) */
    setNudgeGlow(keyId: string, intensity: number): void;
    /** Clear nudge glow from a key */
    clearNudgeGlow(keyId: string): void;
    /** Set key highlight color (for visual feedback) */
    setKeyHighlight(keyId: string, color: string, opacity?: number): void;
    /** Clear key highlight */
    clearKeyHighlight(keyId: string): void;
    /** Apply theme colors to the keyboard */
    applyTheme(theme: ThemeDescriptor, highContrast?: boolean): void;
    /** Get the SVG element */
    getElement(): SVGSVGElement;
    /** Reset all visual state */
    reset(): void;
}
//# sourceMappingURL=svg-keyboard.d.ts.map