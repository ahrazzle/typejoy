/**
 * Typejoy Framework — Keyboard Layout Definitions
 *
 * Defines the physical keyboard layout for SVG rendering.
 * Each key has a normalized id (what the game sees) and display properties.
 */
export interface KeyDef {
    /** Normalized key id used by the game (e.g., 'a', 'space', 'arrowup') */
    id: string;
    /** Display label on the keycap */
    label: string;
    /** Width in units (1 unit = standard key width) */
    width: number;
    /** Row position (0 = top function row, 4 = bottom) */
    row: number;
    /** Column position within row */
    col: number;
    /** Whether this is a "finger rest" key (home row) */
    isHomeRow?: boolean;
    /** Finger hint for one-handed mode display */
    finger?: 'pinky-left' | 'ring-left' | 'middle-left' | 'index-left' | 'thumb' | 'index-right' | 'middle-right' | 'ring-right' | 'pinky-right';
}
export interface KeyboardLayout {
    name: string;
    rows: KeyDef[][];
    totalWidth: number;
    totalHeight: number;
}
/** Standard QWERTY layout — 5 rows */
export declare const QWERTY_LAYOUT: KeyboardLayout;
/** Map of key id → KeyDef for fast lookup */
export declare function buildKeyMap(layout: KeyboardLayout): Map<string, KeyDef>;
/** Get the display label for a key event's key property */
export declare function normalizeKey(key: string): string;
//# sourceMappingURL=keyboard-layout.d.ts.map