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
export const QWERTY_LAYOUT: KeyboardLayout = {
  name: 'QWERTY',
  totalWidth: 15,
  totalHeight: 5,
  rows: [
    // Row 0: Number row
    [
      { id: 'backquote', label: '`', width: 1, row: 0, col: 0 },
      { id: '1', label: '1', width: 1, row: 0, col: 1 },
      { id: '2', label: '2', width: 1, row: 0, col: 2 },
      { id: '3', label: '3', width: 1, row: 0, col: 3 },
      { id: '4', label: '4', width: 1, row: 0, col: 4 },
      { id: '5', label: '5', width: 1, row: 0, col: 5 },
      { id: '6', label: '6', width: 1, row: 0, col: 6 },
      { id: '7', label: '7', width: 1, row: 0, col: 7 },
      { id: '8', label: '8', width: 1, row: 0, col: 8 },
      { id: '9', label: '9', width: 1, row: 0, col: 9 },
      { id: '0', label: '0', width: 1, row: 0, col: 10 },
      { id: 'minus', label: '-', width: 1, row: 0, col: 11 },
      { id: 'equal', label: '=', width: 1, row: 0, col: 12 },
      { id: 'backspace', label: '⌫', width: 2, row: 0, col: 13 },
    ],
    // Row 1: QWERTY row
    [
      { id: 'tab', label: 'Tab', width: 1.5, row: 1, col: 0 },
      { id: 'q', label: 'Q', width: 1, row: 1, col: 1.5, finger: 'pinky-left' },
      { id: 'w', label: 'W', width: 1, row: 1, col: 2.5, finger: 'ring-left' },
      { id: 'e', label: 'E', width: 1, row: 1, col: 3.5, finger: 'middle-left' },
      { id: 'r', label: 'R', width: 1, row: 1, col: 4.5, finger: 'index-left' },
      { id: 't', label: 'T', width: 1, row: 1, col: 5.5, finger: 'index-left' },
      { id: 'y', label: 'Y', width: 1, row: 1, col: 6.5, finger: 'index-right' },
      { id: 'u', label: 'U', width: 1, row: 1, col: 7.5, finger: 'index-right' },
      { id: 'i', label: 'I', width: 1, row: 1, col: 8.5, finger: 'middle-right' },
      { id: 'o', label: 'O', width: 1, row: 1, col: 9.5, finger: 'ring-right' },
      { id: 'p', label: 'P', width: 1, row: 1, col: 10.5, finger: 'pinky-right' },
      { id: 'bracket-left', label: '[', width: 1, row: 1, col: 11.5 },
      { id: 'bracket-right', label: ']', width: 1, row: 1, col: 12.5 },
      { id: 'backslash', label: '\\', width: 1.5, row: 1, col: 13.5 },
    ],
    // Row 2: Home row
    [
      { id: 'caps', label: 'Caps', width: 1.75, row: 2, col: 0 },
      { id: 'a', label: 'A', width: 1, row: 2, col: 1.75, isHomeRow: true, finger: 'pinky-left' },
      { id: 's', label: 'S', width: 1, row: 2, col: 2.75, isHomeRow: true, finger: 'ring-left' },
      { id: 'd', label: 'D', width: 1, row: 2, col: 3.75, isHomeRow: true, finger: 'middle-left' },
      { id: 'f', label: 'F', width: 1, row: 2, col: 4.75, isHomeRow: true, finger: 'index-left' },
      { id: 'g', label: 'G', width: 1, row: 2, col: 5.75, isHomeRow: true, finger: 'index-left' },
      { id: 'h', label: 'H', width: 1, row: 2, col: 6.75, isHomeRow: true, finger: 'index-right' },
      { id: 'j', label: 'J', width: 1, row: 2, col: 7.75, isHomeRow: true, finger: 'index-right' },
      { id: 'k', label: 'K', width: 1, row: 2, col: 8.75, isHomeRow: true, finger: 'middle-right' },
      { id: 'l', label: 'L', width: 1, row: 2, col: 9.75, isHomeRow: true, finger: 'ring-right' },
      { id: 'semicolon', label: ';', width: 1, row: 2, col: 10.75, isHomeRow: true, finger: 'pinky-right' },
      { id: 'quote', label: "'", width: 1, row: 2, col: 11.75 },
      { id: 'enter', label: 'Enter', width: 2.25, row: 2, col: 12.75 },
    ],
    // Row 3: Bottom letter row
    [
      { id: 'shift-left', label: 'Shift', width: 2.25, row: 3, col: 0 },
      { id: 'z', label: 'Z', width: 1, row: 3, col: 2.25, finger: 'pinky-left' },
      { id: 'x', label: 'X', width: 1, row: 3, col: 3.25, finger: 'ring-left' },
      { id: 'c', label: 'C', width: 1, row: 3, col: 4.25, finger: 'middle-left' },
      { id: 'v', label: 'V', width: 1, row: 3, col: 5.25, finger: 'index-left' },
      { id: 'b', label: 'B', width: 1, row: 3, col: 6.25, finger: 'index-left' },
      { id: 'n', label: 'N', width: 1, row: 3, col: 7.25, finger: 'index-right' },
      { id: 'm', label: 'M', width: 1, row: 3, col: 8.25, finger: 'index-right' },
      { id: 'comma', label: ',', width: 1, row: 3, col: 9.25, finger: 'middle-right' },
      { id: 'period', label: '.', width: 1, row: 3, col: 10.25, finger: 'ring-right' },
      { id: 'slash', label: '/', width: 1, row: 3, col: 11.25, finger: 'pinky-right' },
      { id: 'shift-right', label: 'Shift', width: 2.75, row: 3, col: 12.25 },
    ],
    // Row 4: Bottom row with space
    [
      { id: 'ctrl-left', label: 'Ctrl', width: 1.5, row: 4, col: 0 },
      { id: 'meta-left', label: '⌘', width: 1.25, row: 4, col: 1.5 },
      { id: 'alt-left', label: 'Alt', width: 1.25, row: 4, col: 2.75 },
      { id: 'space', label: '', width: 6.25, row: 4, col: 4, finger: 'thumb' },
      { id: 'alt-right', label: 'Alt', width: 1.25, row: 4, col: 10.25 },
      { id: 'meta-right', label: '⌘', width: 1.25, row: 4, col: 11.5 },
      { id: 'ctrl-right', label: 'Ctrl', width: 1.5, row: 4, col: 12.75 },
    ],
  ],
};

/** Map of key id → KeyDef for fast lookup */
export function buildKeyMap(layout: KeyboardLayout): Map<string, KeyDef> {
  const map = new Map<string, KeyDef>();
  for (const row of layout.rows) {
    for (const key of row) {
      map.set(key.id, key);
    }
  }
  return map;
}

/** Get the display label for a key event's key property */
export function normalizeKey(key: string): string {
  const lower = key.toLowerCase();
  // Map common aliases
  const aliases: Record<string, string> = {
    ' ': 'space',
    'arrowup': 'arrow-up',
    'arrowdown': 'arrow-down',
    'arrowleft': 'arrow-left',
    'arrowright': 'arrow-right',
    'escape': 'esc',
    'return': 'enter',
    'control': 'ctrl-left',
    'meta': 'meta-left',
    ';': 'semicolon',
    "'": 'quote',
    '[': 'bracket-left',
    ']': 'bracket-right',
    '\\': 'backslash',
    '/': 'slash',
    '.': 'period',
    ',': 'comma',
    '-': 'minus',
    '=': 'equal',
    '`': 'backquote',
  };
  return aliases[lower] || lower;
}