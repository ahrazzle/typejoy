// src/RawBus.ts
var Emitter = class {
  listeners = /* @__PURE__ */ new Set();
  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(payload) {
    for (const fn of this.listeners) fn(payload);
  }
  clear() {
    this.listeners.clear();
  }
};
var RawBus = class {
  target;
  emitter = new Emitter();
  _isListening = false;
  // Bound handlers stored so we can remove them on stop()
  boundKeyDown;
  boundKeyUp;
  constructor(target) {
    this.target = target ?? (typeof window !== "undefined" ? window : createNoopTarget());
    this.boundKeyDown = (e) => this.handleKey(e, "keydown");
    this.boundKeyUp = (e) => this.handleKey(e, "keyup");
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
    if (this._isListening) return;
    this.target.addEventListener("keydown", this.boundKeyDown, { capture: true });
    this.target.addEventListener("keyup", this.boundKeyUp, { capture: true });
    this._isListening = true;
  }
  stop() {
    if (!this._isListening) return;
    this.target.removeEventListener("keydown", this.boundKeyDown, { capture: true });
    this.target.removeEventListener("keyup", this.boundKeyUp, { capture: true });
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
        capsLock: false
      },
      repeat: false
    };
    this.emitter.emit(evt);
  }
  // ---- Internal -----------------------------------------------------------
  handleKey(e, type) {
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
        capsLock: e.getModifierState("CapsLock")
      },
      repeat: e.repeat,
      nativeEvent: e
    };
    this.emitter.emit(evt);
  }
};
function createNoopTarget() {
  const listeners = /* @__PURE__ */ new Map();
  return {
    addEventListener: (type, listener) => {
      if (!listeners.has(type)) listeners.set(type, /* @__PURE__ */ new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent: () => true
  };
}

// src/NormalizedBus.ts
var US_QWERTY = {
  // Number row
  Backquote: { base: "`", shifted: "~" },
  Digit1: { base: "1", shifted: "!" },
  Digit2: { base: "2", shifted: "@" },
  Digit3: { base: "3", shifted: "#" },
  Digit4: { base: "4", shifted: "$" },
  Digit5: { base: "5", shifted: "%" },
  Digit6: { base: "6", shifted: "^" },
  Digit7: { base: "7", shifted: "&" },
  Digit8: { base: "8", shifted: "*" },
  Digit9: { base: "9", shifted: "(" },
  Digit0: { base: "0", shifted: ")" },
  Minus: { base: "-", shifted: "_" },
  Equal: { base: "=", shifted: "+" },
  // Top row
  KeyQ: { base: "q", shifted: "Q" },
  KeyW: { base: "w", shifted: "W" },
  KeyE: { base: "e", shifted: "E" },
  KeyR: { base: "r", shifted: "R" },
  KeyT: { base: "t", shifted: "T" },
  KeyY: { base: "y", shifted: "Y" },
  KeyU: { base: "u", shifted: "U" },
  KeyI: { base: "i", shifted: "I" },
  KeyO: { base: "o", shifted: "O" },
  KeyP: { base: "p", shifted: "P" },
  BracketLeft: { base: "[", shifted: "{" },
  BracketRight: { base: "]", shifted: "}" },
  Backslash: { base: "\\", shifted: "|" },
  // Home row
  KeyA: { base: "a", shifted: "A" },
  KeyS: { base: "s", shifted: "S" },
  KeyD: { base: "d", shifted: "D" },
  KeyF: { base: "f", shifted: "F" },
  KeyG: { base: "g", shifted: "G" },
  KeyH: { base: "h", shifted: "H" },
  KeyJ: { base: "j", shifted: "J" },
  KeyK: { base: "k", shifted: "K" },
  KeyL: { base: "l", shifted: "L" },
  Semicolon: { base: ";", shifted: ":" },
  Quote: { base: "'", shifted: '"' },
  // Bottom row
  KeyZ: { base: "z", shifted: "Z" },
  KeyX: { base: "x", shifted: "X" },
  KeyC: { base: "c", shifted: "C" },
  KeyV: { base: "v", shifted: "V" },
  KeyB: { base: "b", shifted: "B" },
  KeyN: { base: "n", shifted: "N" },
  KeyM: { base: "m", shifted: "M" },
  Comma: { base: ",", shifted: "<" },
  Period: { base: ".", shifted: ">" },
  Slash: { base: "/", shifted: "?" }
};
function normalizeKey(raw) {
  if (raw.code === "Space") return " ";
  const mapping = US_QWERTY[raw.code];
  if (!mapping) {
    return raw.key.length === 1 ? raw.key : "";
  }
  const isLetter = /^[a-z]$/.test(mapping.base);
  const isShifted = isLetter ? raw.modifiers.shift !== raw.modifiers.capsLock : raw.modifiers.shift;
  return isShifted ? mapping.shifted : mapping.base;
}
var NormalizedBus = class {
  rawBus;
  listeners = /* @__PURE__ */ new Set();
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
    if (this.unsub) return;
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
    if (raw.repeat) return;
    const char = normalizeKey(raw);
    if (!char) return;
    const phase = raw.type === "keydown" ? "press" : "release";
    const evt = { char, raw, phase };
    for (const fn of this.listeners) fn(evt);
  }
};

// src/types.ts
var TIMING_WINDOWS = {
  easy: { perfect: 150, great: 200, good: 300 },
  medium: { perfect: 80, great: 120, good: 200 },
  hard: { perfect: 40, great: 80, good: 150 },
  expert: { perfect: 25, great: 50, good: 100 }
};
var DEFAULT_THEME = {
  name: "typejoy-default",
  colors: {
    primary: "#00e5ff",
    secondary: "#76ff03",
    tertiary: "#ffea00",
    danger: "#ff1744",
    surface: "#1a1a2e",
    keycap: "#2d2d44",
    keycapText: "#e0e0e0",
    keycapBorder: "#3d3d5c",
    comboGlow: "#e040fb",
    nudgeGlow: "#ff9100",
    highContrast: {
      primary: "#00e5ff",
      secondary: "#76ff03",
      danger: "#ff1744",
      surface: "#000000",
      keycap: "#ffffff",
      keycapText: "#000000"
    }
  },
  particleStyle: "spark",
  glowStyle: "neon",
  intensity: 0.8,
  shakeIntensity: 0.5,
  particleDensity: 1,
  beatPulseEnabled: true,
  comboThresholds: {
    subtle: 10,
    moderate: 25,
    intense: 50
  }
};

// src/BeatClockJudge.ts
var BeatClockJudge = class {
  beatMap;
  windows;
  hooks;
  comboThresholds;
  _combo = 0;
  _maxCombo = 0;
  _cursor = 0;
  _lastThreshold = 0;
  // Subscribers to judgment events (for feedback layer, logging, etc.)
  judgmentListeners = /* @__PURE__ */ new Set();
  // The normalized bus subscription handle (for start/stop)
  unsubChar = null;
  constructor(beatMap, config, hooks = {}) {
    this.beatMap = beatMap;
    const base = TIMING_WINDOWS[config.difficulty];
    this.windows = {
      perfect: config.windows?.perfect ?? base.perfect,
      great: config.windows?.great ?? base.great,
      good: config.windows?.good ?? base.good
    };
    this.comboThresholds = config.comboThresholds ?? { subtle: 10, moderate: 25, intense: 50 };
    this.hooks = hooks;
  }
  // ---- Cursor / state access ----------------------------------------------
  /**
   * Read-only accessor for the current beat-map cursor position.
   * Exposed so the feedback layer can query the current note independently.
   */
  getCurrentPosition() {
    return this._cursor;
  }
  /**
   * Read-only accessor for the note at a given beat position.
   * Both the judge and the feedback layer can query this independently.
   */
  getNoteAt(beatPosition) {
    return this.beatMap.notes[beatPosition];
  }
  /**
   * Get the current *expected* note (the note the cursor is pointing at).
   */
  getExpectedNote() {
    return this.beatMap.notes[this._cursor];
  }
  /**
   * Get the note at the current cursor position (the note the player should hit now).
   * Consumed by the feedback layer to render the expected-key indicator.
   */
  getCurrentNote() {
    return this.beatMap.notes[this._cursor];
  }
  /**
   * Get the note that will next require attention within lookaheadMs.
   * Consumed by the feedback layer to pre-load visual cues.
   * @param lookaheadMs  Time window in ms (default: 2000)
   */
  getNextNote(lookaheadMs = 2e3) {
    if (this._cursor >= this.beatMap.length) return void 0;
    const now = this.beatMap.notes[this._cursor].time;
    for (let i = this._cursor + 1; i < this.beatMap.length; i++) {
      const note = this.beatMap.notes[i];
      if (note.time - now <= lookaheadMs) {
        return note;
      }
    }
    return void 0;
  }
  /**
   * Subscribe to judgment events (for the feedback layer, stats, etc.).
   */
  onJudgment(fn) {
    this.judgmentListeners.add(fn);
    return () => this.judgmentListeners.delete(fn);
  }
  // ---- Subscription -------------------------------------------------------
  /**
   * Subscribe to the NormalizedBus. Only `press` events are judged.
   */
  attach(normalizedBus) {
    if (this.unsubChar) return;
    this.unsubChar = normalizedBus.onChar((evt) => this.onChar(evt));
  }
  detach() {
    this.unsubChar?.();
    this.unsubChar = null;
  }
  // ---- State accessors ----------------------------------------------------
  get state() {
    return {
      combo: this._combo,
      maxCombo: this._maxCombo,
      multiplier: this.computeMultiplier(this._combo),
      cursor: this._cursor,
      isComplete: this._cursor >= this.beatMap.length
    };
  }
  get combo() {
    return this._combo;
  }
  get maxCombo() {
    return this._maxCombo;
  }
  // ---- Core judging logic -------------------------------------------------
  /**
   * Handle a normalized character press.
   *
   * Algorithm:
   *   1. Get expected note from cursor.
   *   2. If no more notes → ignore (song is complete).
   *   3. If key === expected key:
   *        - delta = pressedTime - expectedTime
   *        - if |delta| <= good window → judge (perfect/great/good)
   *        - if |delta| > good window → onMiss (correct key, wrong time)
   *        - advance cursor in both cases
   *   4. If key !== expected key → SILENT IGNORE.
   */
  onChar(evt) {
    if (evt.phase !== "press") return;
    const expected = this.getExpectedNote();
    if (!expected) {
      return;
    }
    if (evt.char !== expected.key) {
      return;
    }
    const delta = evt.raw.timestamp - expected.time;
    const absDelta = Math.abs(delta);
    let judgment;
    if (absDelta <= this.windows.perfect) {
      judgment = "perfect";
    } else if (absDelta <= this.windows.great) {
      judgment = "great";
    } else if (absDelta <= this.windows.good) {
      judgment = "good";
    } else {
      this.handleMiss(evt, expected, delta);
      return;
    }
    this.handleHit(judgment, evt, expected, delta);
  }
  // ---- Hit / miss handlers ------------------------------------------------
  handleHit(judgment, evt, note, delta) {
    this._combo++;
    if (this._combo > this._maxCombo) this._maxCombo = this._combo;
    this.checkStreakThreshold();
    this._cursor++;
    const multiplier = this.computeMultiplier(this._combo);
    const event = {
      judgment,
      key: evt.char,
      delta,
      note,
      timestamp: evt.raw.timestamp
    };
    for (const fn of this.judgmentListeners) fn(event);
    this.hooks.onHit?.(event);
    this.hooks.onCombo?.(this._combo, multiplier);
  }
  handleMiss(evt, expected, delta) {
    const previousCombo = this._combo;
    this._combo = 0;
    this._cursor++;
    const event = {
      judgment: "miss",
      key: evt.char,
      delta,
      note: expected,
      timestamp: evt.raw.timestamp
    };
    for (const fn of this.judgmentListeners) fn(event);
    this.hooks.onMiss?.(evt.char, expected.key, delta);
    this.hooks.onComboBreak?.(previousCombo);
    this.hooks.onCombo?.(0, 1);
  }
  // ---- Stale note detection -----------------------------------------------
  /**
   * Call this on every frame (or tick) with the current song time.
   * Detects notes whose windows have fully passed without a correct press
   * and fires onNoteStale for each. Advances the cursor past them.
   *
   * @param currentSongTime  Current song time in ms (same clock as note.time)
   */
  tick(currentSongTime) {
    while (this._cursor < this.beatMap.length) {
      const note = this.beatMap.notes[this._cursor];
      if (currentSongTime > note.time + this.windows.good) {
        this._cursor++;
        const previousCombo = this._combo;
        this._combo = 0;
        this.hooks.onNoteStale?.(note);
        this.hooks.onComboBreak?.(previousCombo);
        this.hooks.onCombo?.(0, 1);
      } else {
        break;
      }
    }
  }
  // ---- Helpers ------------------------------------------------------------
  /**
   * Combo multiplier mapping (osu!-style):
   *   0-9   → 1x
   *   10-24 → 2x
   *   25-49 → 4x
   *   50+   → 8x
   */
  computeMultiplier(combo) {
    if (combo >= 50) return 8;
    if (combo >= 25) return 4;
    if (combo >= 10) return 2;
    return 1;
  }
  /**
   * Checks if the current combo has crossed a threshold since the last emission.
   * Called after every successful hit. Fires onStreakThreshold once per threshold.
   */
  checkStreakThreshold() {
    const { subtle, moderate, intense } = this.comboThresholds;
    if (this._combo >= intense && this._lastThreshold < intense) {
      this._lastThreshold = intense;
      this.hooks.onStreakThreshold?.(intense);
    } else if (this._combo >= moderate && this._lastThreshold < moderate) {
      this._lastThreshold = moderate;
      this.hooks.onStreakThreshold?.(moderate);
    } else if (this._combo >= subtle && this._lastThreshold < subtle) {
      this._lastThreshold = subtle;
      this.hooks.onStreakThreshold?.(subtle);
    }
  }
  /** Reset judge state (for replays / retries). */
  reset() {
    this._combo = 0;
    this._maxCombo = 0;
    this._cursor = 0;
    this._lastThreshold = 0;
  }
};

// src/BeatMap.ts
var StaticBeatMap = class {
  notes;
  length;
  constructor(notes) {
    this.notes = Object.freeze([...notes].sort((a, b) => a.time - b.time));
    this.length = this.notes.length;
  }
  /**
   * Accessor: get the note at a given index. Read-only.
   */
  getNote(index) {
    return this.notes[index];
  }
  /**
   * Get all notes within a time window [startMs, endMs].
   */
  getNotesInRange(startMs, endMs) {
    return this.notes.filter((n) => n.time >= startMs && n.time <= endMs);
  }
};

// src/beatmap-generator.ts
var TIMING_WINDOWS2 = {
  easy: 150,
  medium: 80,
  hard: 40,
  expert: 25
};
var LEFT_HAND_KEYS = /* @__PURE__ */ new Set([
  "q",
  "w",
  "e",
  "r",
  "t",
  "a",
  "s",
  "d",
  "f",
  "g",
  "z",
  "x",
  "c",
  "v",
  "b"
]);
var COMMON_LETTERS = /* @__PURE__ */ new Set(["e", "t", "a", "o", "i", "n", "s", "r"]);
function handOf(key) {
  if (LEFT_HAND_KEYS.has(key)) return "left";
  return "right";
}
function effectiveBpm(options) {
  if (options.wordsPerMinute != null && options.wordsPerMinute > 0) {
    return options.wordsPerMinute * 5;
  }
  return options.bpm;
}
var BeatMapGenerator = class {
  /**
   * Generate a rhythmic note array from typing content.
   *
   * @param content  The text to convert (each character becomes a note).
   * @param options  Tempo, difficulty, and optional WPM target.
   * @returns An ordered array of notes ready to wrap in a StaticBeatMap.
   */
  generate(content, options) {
    const bpm = effectiveBpm(options);
    const beatInterval = 6e4 / bpm;
    const window2 = TIMING_WINDOWS2[options.difficulty];
    const chars = Array.from(content);
    const notes = [];
    for (let i = 0; i < chars.length; i++) {
      const key = chars[i];
      if (shouldSkip(key, options.difficulty, i)) {
        continue;
      }
      notes.push({
        key,
        time: Math.round(i * beatInterval),
        window: window2
      });
    }
    if (options.difficulty === "hard") {
      injectDoubledNotes(notes, beatInterval);
    }
    applyHandAlternation(notes);
    return notes;
  }
};
function shouldSkip(key, difficulty, _index) {
  switch (difficulty) {
    case "easy":
    case "hard":
    case "expert":
      return false;
    case "medium":
      return key === " ";
    default:
      return false;
  }
}
function injectDoubledNotes(notes, beatInterval) {
  const halfBeat = Math.round(beatInterval / 2);
  let inserted = 0;
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (COMMON_LETTERS.has(note.key)) {
      const doubled = {
        key: note.key,
        time: note.time + halfBeat,
        window: note.window
      };
      notes.splice(i + inserted + 1, 0, doubled);
      inserted++;
      i++;
    }
  }
}
function applyHandAlternation(notes) {
  if (notes.length < 3) return;
  for (let i = 0; i < notes.length - 2; i++) {
    const hand0 = handOf(notes[i].key);
    const hand1 = handOf(notes[i + 1].key);
    const hand2 = handOf(notes[i + 2].key);
    if (hand0 === hand1 && hand1 === hand2) {
      const oppositeHand = hand0 === "left" ? "right" : "left";
      const swapIdx = findOppositeHandNote(notes, i + 3, oppositeHand);
      if (swapIdx !== -1) {
        const tmpKey = notes[i + 1].key;
        notes[i + 1].key = notes[swapIdx].key;
        notes[swapIdx].key = tmpKey;
      }
    }
  }
}
function findOppositeHandNote(notes, from, hand) {
  for (let i = from; i < notes.length; i++) {
    if (handOf(notes[i].key) === hand) {
      return i;
    }
  }
  return -1;
}

// src/keyboard-layout.ts
var QWERTY_LAYOUT = {
  name: "QWERTY",
  totalWidth: 15,
  totalHeight: 5,
  rows: [
    // Row 0: Number row
    [
      { id: "backquote", label: "`", width: 1, row: 0, col: 0 },
      { id: "1", label: "1", width: 1, row: 0, col: 1 },
      { id: "2", label: "2", width: 1, row: 0, col: 2 },
      { id: "3", label: "3", width: 1, row: 0, col: 3 },
      { id: "4", label: "4", width: 1, row: 0, col: 4 },
      { id: "5", label: "5", width: 1, row: 0, col: 5 },
      { id: "6", label: "6", width: 1, row: 0, col: 6 },
      { id: "7", label: "7", width: 1, row: 0, col: 7 },
      { id: "8", label: "8", width: 1, row: 0, col: 8 },
      { id: "9", label: "9", width: 1, row: 0, col: 9 },
      { id: "0", label: "0", width: 1, row: 0, col: 10 },
      { id: "minus", label: "-", width: 1, row: 0, col: 11 },
      { id: "equal", label: "=", width: 1, row: 0, col: 12 },
      { id: "backspace", label: "\u232B", width: 2, row: 0, col: 13 }
    ],
    // Row 1: QWERTY row
    [
      { id: "tab", label: "Tab", width: 1.5, row: 1, col: 0 },
      { id: "q", label: "Q", width: 1, row: 1, col: 1.5, finger: "pinky-left" },
      { id: "w", label: "W", width: 1, row: 1, col: 2.5, finger: "ring-left" },
      { id: "e", label: "E", width: 1, row: 1, col: 3.5, finger: "middle-left" },
      { id: "r", label: "R", width: 1, row: 1, col: 4.5, finger: "index-left" },
      { id: "t", label: "T", width: 1, row: 1, col: 5.5, finger: "index-left" },
      { id: "y", label: "Y", width: 1, row: 1, col: 6.5, finger: "index-right" },
      { id: "u", label: "U", width: 1, row: 1, col: 7.5, finger: "index-right" },
      { id: "i", label: "I", width: 1, row: 1, col: 8.5, finger: "middle-right" },
      { id: "o", label: "O", width: 1, row: 1, col: 9.5, finger: "ring-right" },
      { id: "p", label: "P", width: 1, row: 1, col: 10.5, finger: "pinky-right" },
      { id: "bracket-left", label: "[", width: 1, row: 1, col: 11.5 },
      { id: "bracket-right", label: "]", width: 1, row: 1, col: 12.5 },
      { id: "backslash", label: "\\", width: 1.5, row: 1, col: 13.5 }
    ],
    // Row 2: Home row
    [
      { id: "caps", label: "Caps", width: 1.75, row: 2, col: 0 },
      { id: "a", label: "A", width: 1, row: 2, col: 1.75, isHomeRow: true, finger: "pinky-left" },
      { id: "s", label: "S", width: 1, row: 2, col: 2.75, isHomeRow: true, finger: "ring-left" },
      { id: "d", label: "D", width: 1, row: 2, col: 3.75, isHomeRow: true, finger: "middle-left" },
      { id: "f", label: "F", width: 1, row: 2, col: 4.75, isHomeRow: true, finger: "index-left" },
      { id: "g", label: "G", width: 1, row: 2, col: 5.75, isHomeRow: true, finger: "index-left" },
      { id: "h", label: "H", width: 1, row: 2, col: 6.75, isHomeRow: true, finger: "index-right" },
      { id: "j", label: "J", width: 1, row: 2, col: 7.75, isHomeRow: true, finger: "index-right" },
      { id: "k", label: "K", width: 1, row: 2, col: 8.75, isHomeRow: true, finger: "middle-right" },
      { id: "l", label: "L", width: 1, row: 2, col: 9.75, isHomeRow: true, finger: "ring-right" },
      { id: "semicolon", label: ";", width: 1, row: 2, col: 10.75, isHomeRow: true, finger: "pinky-right" },
      { id: "quote", label: "'", width: 1, row: 2, col: 11.75 },
      { id: "enter", label: "Enter", width: 2.25, row: 2, col: 12.75 }
    ],
    // Row 3: Bottom letter row
    [
      { id: "shift-left", label: "Shift", width: 2.25, row: 3, col: 0 },
      { id: "z", label: "Z", width: 1, row: 3, col: 2.25, finger: "pinky-left" },
      { id: "x", label: "X", width: 1, row: 3, col: 3.25, finger: "ring-left" },
      { id: "c", label: "C", width: 1, row: 3, col: 4.25, finger: "middle-left" },
      { id: "v", label: "V", width: 1, row: 3, col: 5.25, finger: "index-left" },
      { id: "b", label: "B", width: 1, row: 3, col: 6.25, finger: "index-left" },
      { id: "n", label: "N", width: 1, row: 3, col: 7.25, finger: "index-right" },
      { id: "m", label: "M", width: 1, row: 3, col: 8.25, finger: "index-right" },
      { id: "comma", label: ",", width: 1, row: 3, col: 9.25, finger: "middle-right" },
      { id: "period", label: ".", width: 1, row: 3, col: 10.25, finger: "ring-right" },
      { id: "slash", label: "/", width: 1, row: 3, col: 11.25, finger: "pinky-right" },
      { id: "shift-right", label: "Shift", width: 2.75, row: 3, col: 12.25 }
    ],
    // Row 4: Bottom row with space
    [
      { id: "ctrl-left", label: "Ctrl", width: 1.5, row: 4, col: 0 },
      { id: "meta-left", label: "\u2318", width: 1.25, row: 4, col: 1.5 },
      { id: "alt-left", label: "Alt", width: 1.25, row: 4, col: 2.75 },
      { id: "space", label: "", width: 6.25, row: 4, col: 4, finger: "thumb" },
      { id: "alt-right", label: "Alt", width: 1.25, row: 4, col: 10.25 },
      { id: "meta-right", label: "\u2318", width: 1.25, row: 4, col: 11.5 },
      { id: "ctrl-right", label: "Ctrl", width: 1.5, row: 4, col: 12.75 }
    ]
  ]
};
function buildKeyMap(layout) {
  const map = /* @__PURE__ */ new Map();
  for (const row of layout.rows) {
    for (const key of row) {
      map.set(key.id, key);
    }
  }
  return map;
}
function normalizeKey2(key) {
  const lower = key.toLowerCase();
  const aliases = {
    " ": "space",
    "arrowup": "arrow-up",
    "arrowdown": "arrow-down",
    "arrowleft": "arrow-left",
    "arrowright": "arrow-right",
    "escape": "esc",
    "return": "enter",
    "control": "ctrl-left",
    "meta": "meta-left",
    ";": "semicolon",
    "'": "quote",
    "[": "bracket-left",
    "]": "bracket-right",
    "\\": "backslash",
    "/": "slash",
    ".": "period",
    ",": "comma",
    "-": "minus",
    "=": "equal",
    "`": "backquote"
  };
  return aliases[lower] || lower;
}

// src/svg-keyboard.ts
var SVG_NS = "http://www.w3.org/2000/svg";
var SVGKeyboardRenderer = class {
  svg;
  layout;
  renderedKeys = /* @__PURE__ */ new Map();
  unitSize;
  keyGap;
  borderRadius;
  theme = null;
  /** Track depressed keys for CSS animation */
  depressedKeys = /* @__PURE__ */ new Set();
  /** Track beat-pulse state */
  pulseStates = /* @__PURE__ */ new Map();
  /** Track nudge hints */
  nudgeKeys = /* @__PURE__ */ new Map();
  /** Track wrong key shake state */
  shakeKeys = /* @__PURE__ */ new Map();
  constructor(container, options = {}) {
    this.layout = options.layout ?? QWERTY_LAYOUT;
    buildKeyMap(this.layout);
    this.unitSize = options.unitSize ?? 48;
    this.keyGap = options.keyGap ?? 4;
    this.borderRadius = options.borderRadius ?? 4;
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("class", "typejoy-keyboard");
    this.svg.setAttribute("role", "group");
    this.svg.setAttribute("aria-label", "Typejoy keyboard \u2014 press the highlighted keys to the rhythm");
    this.svg.style.display = "block";
    this.svg.style.width = "100%";
    this.svg.style.height = "100%";
    this.svg.style.overflow = "visible";
    const style = document.createElementNS(SVG_NS, "style");
    style.textContent = `
      .typejoy-key {
        transition: filter 100ms ease-out,
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
      .typejoy-key-shake {
        animation: typejoy-shake 200ms ease-out;
      }
      .typejoy-key-pulse {
        animation: typejoy-beat-pulse 200ms ease-out;
      }
      /* Spring-based depression with overshoot \u2014 like a mechanical switch */
      .typejoy-key-spring {
        animation: typejoy-spring 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
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
      /* Key depression: goes down past target, bounces back \u2014 spring overshoot */
      @keyframes typejoy-spring {
        0% { transform: translateY(0) scale(1); filter: brightness(1); }
        30% { transform: translateY(4px) scale(0.95); filter: brightness(0.85); }
        60% { transform: translateY(2px) scale(0.97); filter: brightness(0.9); }
        80% { transform: translateY(3px) scale(0.96); filter: brightness(0.88); }
        100% { transform: translateY(2px) scale(0.96); filter: brightness(0.88); }
      }
    `;
    this.svg.appendChild(style);
    this.buildKeyboard();
    container.appendChild(this.svg);
  }
  buildKeyboard() {
    const totalW = this.layout.totalWidth * this.unitSize;
    const totalH = this.layout.totalHeight * (this.unitSize + this.keyGap);
    this.svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", String(totalW));
    bg.setAttribute("height", String(totalH));
    bg.setAttribute("rx", String(this.borderRadius * 2));
    bg.setAttribute("class", "typejoy-keyboard-bg");
    bg.setAttribute("fill", this.theme?.colors.surface ?? "#1a1a2e");
    this.svg.appendChild(bg);
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
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "typejoy-key");
    g.setAttribute("data-key", keyDef.id);
    g.setAttribute("role", "button");
    g.setAttribute("tabindex", "-1");
    g.setAttribute("aria-label", this.getAriaLabel(keyDef));
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x", String(x));
    bg.setAttribute("y", String(y));
    bg.setAttribute("width", String(w));
    bg.setAttribute("height", String(h));
    bg.setAttribute("rx", String(this.borderRadius));
    bg.setAttribute("class", "typejoy-keycap-bg");
    bg.setAttribute("fill", this.theme?.colors.keycap ?? "#2d2d44");
    bg.setAttribute("opacity", "0");
    const keycap = document.createElementNS(SVG_NS, "rect");
    keycap.setAttribute("x", String(x));
    keycap.setAttribute("y", String(y));
    keycap.setAttribute("width", String(w));
    keycap.setAttribute("height", String(h));
    keycap.setAttribute("rx", String(this.borderRadius));
    keycap.setAttribute("class", "typejoy-keycap");
    keycap.setAttribute("fill", this.theme?.colors.keycap ?? "#2d2d44");
    keycap.setAttribute("stroke", this.theme?.colors.keycapBorder ?? "#3d3d5c");
    keycap.setAttribute("stroke-width", "1");
    if (keyDef.isHomeRow) {
      const indicator = document.createElementNS(SVG_NS, "rect");
      indicator.setAttribute("x", String(x + w / 2 - 3));
      indicator.setAttribute("y", String(y + h - 6));
      indicator.setAttribute("width", "6");
      indicator.setAttribute("height", "2");
      indicator.setAttribute("rx", "1");
      indicator.setAttribute("fill", this.theme?.colors.keycapBorder ?? "#3d3d5c");
      indicator.setAttribute("opacity", "0.5");
      g.appendChild(indicator);
    }
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(x + w / 2));
    text.setAttribute("y", String(y + h / 2 + 1));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("class", "typejoy-keycap-text");
    text.setAttribute("fill", this.theme?.colors.keycapText ?? "#e0e0e0");
    text.setAttribute("font-size", String(this.unitSize * 0.28));
    text.setAttribute("font-family", "system-ui, -apple-system, sans-serif");
    text.setAttribute("font-weight", "500");
    text.setAttribute("pointer-events", "none");
    text.textContent = keyDef.label;
    g.appendChild(bg);
    g.appendChild(keycap);
    g.appendChild(text);
    this.svg.appendChild(g);
    return { defs: keyDef, element: g, x, y, width: w, height: h };
  }
  getAriaLabel(keyDef) {
    const label = keyDef.label || keyDef.id;
    const homeHint = keyDef.isHomeRow ? " (home row)" : "";
    const fingerHint = keyDef.finger ? `, ${keyDef.finger.replace("-", " ")} finger` : "";
    return `Key ${label}${homeHint}${fingerHint}`;
  }
  /** Get the SVG element for a specific key */
  getKeyElement(keyId) {
    return this.renderedKeys.get(keyId)?.element;
  }
  /** Depress a key with spring-physics feedback (overshoot + bounce) */
  depressKey(keyId) {
    const rendered = this.renderedKeys.get(keyId);
    if (!rendered) return;
    rendered.element.classList.remove("typejoy-key-spring");
    void rendered.element.getBoundingClientRect();
    rendered.element.classList.add("typejoy-key-spring");
    window.setTimeout(() => {
      rendered.element.classList.remove("typejoy-key-spring");
    }, 350);
  }
  /** Pulse a key (beat sync) */
  pulseKey(keyId, bpm) {
    const rendered = this.renderedKeys.get(keyId);
    if (!rendered) return;
    const duration = Math.min(6e4 / bpm / 2, 200);
    this.pulseStates.set(keyId, { startTime: performance.now(), intensity: 1 });
    rendered.element.classList.add("typejoy-key-pulse");
    window.setTimeout(() => {
      rendered.element.classList.remove("typejoy-key-pulse");
      this.pulseStates.delete(keyId);
    }, duration);
  }
  /** Shake a key (wrong key feedback) */
  shakeKey(keyId) {
    const rendered = this.renderedKeys.get(keyId);
    if (!rendered) return;
    this.shakeKeys.set(keyId, { startTime: performance.now() });
    rendered.element.classList.add("typejoy-key-shake");
    window.setTimeout(() => {
      rendered.element.classList.remove("typejoy-key-shake");
      this.shakeKeys.delete(keyId);
    }, 200);
  }
  /** Set glow on a key (nudge hint) */
  setNudgeGlow(keyId, intensity) {
    const rendered = this.renderedKeys.get(keyId);
    if (!rendered) return;
    const bg = rendered.element.querySelector(".typejoy-keycap-bg");
    if (bg) {
      bg.setAttribute("opacity", String(intensity * 0.5));
      bg.setAttribute("fill", this.theme?.colors.nudgeGlow ?? "#ff9100");
    }
  }
  /** Clear nudge glow from a key */
  clearNudgeGlow(keyId) {
    const rendered = this.renderedKeys.get(keyId);
    if (!rendered) return;
    const bg = rendered.element.querySelector(".typejoy-keycap-bg");
    if (bg) {
      bg.setAttribute("opacity", "0");
    }
  }
  /** Set key highlight color (for visual feedback) */
  setKeyHighlight(keyId, color, opacity = 0.6) {
    const rendered = this.renderedKeys.get(keyId);
    if (!rendered) return;
    const bg = rendered.element.querySelector(".typejoy-keycap-bg");
    if (bg) {
      bg.setAttribute("opacity", String(opacity));
      bg.setAttribute("fill", color);
    }
    const keycap = rendered.element.querySelector(".typejoy-keycap");
    if (keycap) {
      keycap.setAttribute("stroke", color);
      keycap.setAttribute("stroke-width", "2");
    }
  }
  /** Clear key highlight */
  clearKeyHighlight(keyId) {
    const rendered = this.renderedKeys.get(keyId);
    if (!rendered) return;
    const bg = rendered.element.querySelector(".typejoy-keycap-bg");
    if (bg) {
      bg.setAttribute("opacity", "0");
      bg.setAttribute("fill", this.theme?.colors.keycap ?? "#2d2d44");
    }
    const keycap = rendered.element.querySelector(".typejoy-keycap");
    if (keycap) {
      keycap.setAttribute("stroke", this.theme?.colors.keycapBorder ?? "#3d3d5c");
      keycap.setAttribute("stroke-width", "1");
    }
  }
  /** Apply theme colors to the keyboard */
  applyTheme(theme, highContrast = false) {
    this.theme = theme;
    const colors = highContrast && theme.colors.highContrast ? { ...theme.colors, ...theme.colors.highContrast } : theme.colors;
    const bg = this.svg.querySelector(".typejoy-keyboard-bg");
    if (bg) bg.setAttribute("fill", colors.surface);
    for (const [, rendered] of this.renderedKeys) {
      const keycap = rendered.element.querySelector(".typejoy-keycap");
      const text = rendered.element.querySelector(".typejoy-keycap-text");
      if (keycap) {
        keycap.setAttribute("fill", colors.keycap);
        keycap.setAttribute("stroke", colors.keycapBorder);
      }
      if (text) {
        text.setAttribute("fill", colors.keycapText);
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
};

// src/particle-system.ts
var ParticleSystem = class {
  canvas;
  ctx;
  particles = [];
  shoves = [];
  edgeGlows = [];
  ripples = [];
  specularSweeps = [];
  animationId = null;
  theme = null;
  reducedMotion = false;
  width = 0;
  height = 0;
  lastTime = 0;
  constructor(canvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context from canvas");
    this.ctx = ctx;
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
  }
  /** Set theme for particle colors */
  setTheme(theme) {
    this.theme = theme;
  }
  /** Enable/disable reduced motion */
  setReducedMotion(reduced) {
    this.reducedMotion = reduced;
  }
  /** Resize the canvas */
  resize(width, height) {
    this.width = width;
    this.height = height;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Ripple Effects — The "dopamine hit" emanating across the keyboard
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Emit a ripple that expands outward from a keypress position.
   * Larger and more vivid for perfect hits, smaller for good hits.
   */
  emitRipple(x, y, judgment) {
    if (this.reducedMotion && judgment !== "perfect") return;
    const colors = {
      perfect: "#00e5ff",
      great: "#76ff03",
      good: "#ffea00",
      wrong: "#ff1744"
    };
    const sizes = {
      perfect: 180,
      great: 120,
      good: 80,
      wrong: 50
    };
    const durations = {
      perfect: 600,
      great: 500,
      good: 400,
      wrong: 300
    };
    this.ripples.push({
      x,
      y,
      startTime: performance.now(),
      duration: durations[judgment] || 400,
      maxRadius: sizes[judgment] || 80,
      color: colors[judgment] || "#ffffff",
      opacity: judgment === "perfect" ? 0.6 : 0.35,
      judgment
    });
    if (judgment === "perfect") {
      this.ripples.push({
        x,
        y,
        startTime: performance.now() + 80,
        duration: 700,
        maxRadius: 250,
        color: "#ffffff",
        opacity: 0.2,
        judgment
      });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Specular Highlight Sweep — Light sweeping across the surface
  // ─────────────────────────────────────────────────────────────────────────
  /** Trigger a specular highlight sweep — only on perfect hits */
  emitSpecularSweep() {
    if (this.reducedMotion) return;
    this.specularSweeps.push({
      startTime: performance.now(),
      duration: 400,
      color: "#ffffff",
      angle: Math.random() * Math.PI * 2
    });
  }
  /** Emit a particle burst at a position */
  emitBurst(x, y, judgment, style, density = 1) {
    if (this.reducedMotion && judgment !== "perfect") return;
    if (style === "none") return;
    const colors = this.getJudgmentColors(judgment);
    const count = this.getParticleCount(judgment) * density;
    const intensity = this.theme?.intensity ?? 0.8;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 2 * i / count + (Math.random() - 0.5) * 0.5;
      const speed = (2 + Math.random() * 4) * intensity;
      const life = 300 + Math.random() * 400;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life,
        maxLife: life,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        style,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        gravity: 0.02,
        opacity: 1
      });
    }
  }
  /** Emit a small muted flash for bad timing */
  emitMutedFlash(x, y) {
    if (this.reducedMotion) return;
    const colors = this.getJudgmentColors("good");
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 1.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 200,
        maxLife: 200,
        size: 1.5,
        color: colors[0],
        style: "spark",
        rotation: 0,
        rotationSpeed: 0,
        gravity: 0.01,
        opacity: 0.6
      });
    }
  }
  /** Emit a small burst for wrong key */
  emitWrongKeyBurst(x, y) {
    if (this.reducedMotion) return;
    const color = this.theme?.colors.danger ?? "#ff1744";
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 150,
        maxLife: 150,
        size: 1.5,
        color,
        style: "spark",
        rotation: 0,
        rotationSpeed: 0,
        gravity: 0,
        opacity: 0.5
      });
    }
  }
  /** Add screen shake */
  addShake(intensity, duration = 200) {
    if (this.reducedMotion) return;
    this.shoves.push({
      intensity,
      duration,
      startTime: performance.now(),
      decay: 0.02
    });
  }
  /** Add screen-edge glow */
  addEdgeGlow(color, intensity, duration = 300) {
    if (this.reducedMotion) return;
    this.edgeGlows.push({
      color,
      intensity,
      duration,
      startTime: performance.now()
    });
  }
  /** Get total shake offset */
  getShakeOffset() {
    let x = 0;
    let y = 0;
    const now = performance.now();
    for (let i = this.shoves.length - 1; i >= 0; i--) {
      const s = this.shoves[i];
      const elapsed = now - s.startTime;
      if (elapsed > s.duration) {
        this.shoves.splice(i, 1);
        continue;
      }
      const progress = elapsed / s.duration;
      const decay = 1 - progress;
      x += (Math.random() - 0.5) * s.intensity * decay * 2;
      y += (Math.random() - 0.5) * s.intensity * decay * 2;
    }
    return { x, y };
  }
  /** Start the animation loop */
  start() {
    this.lastTime = performance.now();
    const loop = (time) => {
      const dt = time - this.lastTime;
      this.lastTime = time;
      this.update(dt);
      this.render();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }
  /** Stop the animation loop */
  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  /** Update all effects */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= dt;
      p.rotation += p.rotationSpeed;
      p.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }
  /** Render all particles and effects */
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    const shake = this.getShakeOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);
    this.renderEdgeGlows(ctx);
    this.renderRipples(ctx);
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      switch (p.style) {
        case "spark":
          this.renderSpark(ctx, p);
          break;
        case "ring":
          this.renderRing(ctx, p);
          break;
        case "star":
          this.renderStar(ctx, p);
          break;
        case "confetti":
          this.renderConfetti(ctx, p);
          break;
      }
      ctx.restore();
    }
    this.renderSpecularSweeps(ctx);
    ctx.restore();
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Ripple Rendering — Expanding concentric circles with glow
  // ─────────────────────────────────────────────────────────────────────────
  renderRipples(ctx) {
    const now = performance.now();
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      const elapsed = now - r.startTime;
      if (elapsed > r.duration) {
        this.ripples.splice(i, 1);
        continue;
      }
      const progress = elapsed / r.duration;
      const radius = r.maxRadius * this.easeOutQuad(progress);
      const alpha = r.opacity * (1 - progress);
      for (let ring = 0; ring < 3; ring++) {
        const ringProgress = Math.min(1, progress + ring * 0.1);
        const ringRadius = r.maxRadius * this.easeOutQuad(Math.min(1, ringProgress));
        const ringAlpha = alpha * (1 - ring * 0.3);
        ctx.beginPath();
        ctx.arc(r.x, r.y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = this.hexToRgba(r.color, ringAlpha);
        ctx.lineWidth = 2 - ring * 0.5;
        ctx.stroke();
      }
      const gradient = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, radius);
      gradient.addColorStop(0, this.hexToRgba(r.color, alpha * 0.3));
      gradient.addColorStop(1, this.hexToRgba(r.color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Specular Sweep Rendering — Brief "shininess" across the surface
  // ─────────────────────────────────────────────────────────────────────────
  renderSpecularSweeps(ctx) {
    const now = performance.now();
    for (let i = this.specularSweeps.length - 1; i >= 0; i--) {
      const s = this.specularSweeps[i];
      const elapsed = now - s.startTime;
      if (elapsed > s.duration) {
        this.specularSweeps.splice(i, 1);
        continue;
      }
      const progress = elapsed / s.duration;
      const alpha = 0.4 * (1 - progress);
      const streakWidth = this.width * 0.3;
      const startX = -this.width + this.width * 2.5 * progress;
      const gradient = ctx.createLinearGradient(
        startX,
        0,
        startX + streakWidth,
        this.height
      );
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }
  renderSpark(ctx, p) {
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  renderRing(ctx, p) {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  renderStar(ctx, p) {
    const spikes = 5;
    const outerRadius = p.size * 2;
    const innerRadius = p.size;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = Math.PI * i / spikes;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  renderConfetti(ctx, p) {
    ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
  }
  renderEdgeGlows(ctx) {
    const now = performance.now();
    for (let i = this.edgeGlows.length - 1; i >= 0; i--) {
      const g = this.edgeGlows[i];
      const elapsed = now - g.startTime;
      if (elapsed > g.duration) {
        this.edgeGlows.splice(i, 1);
        continue;
      }
      const progress = elapsed / g.duration;
      const alpha = g.intensity * (1 - progress);
      const gradient = ctx.createRadialGradient(
        this.width / 2,
        this.height / 2,
        this.width * 0.3,
        this.width / 2,
        this.height / 2,
        this.width * 0.7
      );
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(1, this.hexToRgba(g.color, alpha * 0.3));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }
  getJudgmentColors(judgment) {
    const c = this.theme?.colors ?? {
      primary: "#00e5ff",
      secondary: "#76ff03",
      tertiary: "#ffea00",
      danger: "#ff1744"
    };
    switch (judgment) {
      case "perfect":
        return [c.primary, "#ffffff", c.primary];
      case "great":
        return [c.secondary, "#ffffff"];
      case "good":
        return [c.tertiary];
    }
  }
  getParticleCount(judgment) {
    const base = this.theme?.particleDensity ?? 1;
    switch (judgment) {
      case "perfect":
        return Math.floor(20 * base);
      case "great":
        return Math.floor(12 * base);
      case "good":
        return Math.floor(6 * base);
    }
  }
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  easeOutQuad(t) {
    return t * (2 - t);
  }
  /** Clear all particles and effects */
  clear() {
    this.particles = [];
    this.shoves = [];
    this.edgeGlows = [];
    this.ripples = [];
    this.specularSweeps = [];
  }
};

// src/feedback-layer.ts
var FeedbackLayer = class {
  container;
  theme;
  keyboardContainer;
  canvas;
  keyboard;
  particles;
  liveRegion;
  comboDisplay;
  width;
  height;
  // Judge reference (for expected-key indicator)
  judge = null;
  // Expected-key indicator elements
  expectedKeyIndicator = null;
  expectedKeyLabel = null;
  // State
  maxComboReached = 0;
  nudgeKeys = /* @__PURE__ */ new Map();
  lastStreakThreshold = 0;
  highContrast = false;
  reducedMotion = false;
  nudgeEnabled = true;
  gameActive = false;
  constructor(options) {
    this.container = options.container;
    this.theme = options.theme ?? DEFAULT_THEME;
    this.width = options.width ?? 900;
    this.height = options.height ?? 300;
    this.container.style.position = "relative";
    this.container.style.width = `${this.width}px`;
    this.container.style.height = `${this.height}px`;
    this.container.style.overflow = "hidden";
    this.container.style.borderRadius = "8px";
    this.keyboardContainer = document.createElement("div");
    this.keyboardContainer.style.position = "absolute";
    this.keyboardContainer.style.bottom = "0";
    this.keyboardContainer.style.left = "0";
    this.keyboardContainer.style.right = "0";
    this.keyboardContainer.style.height = "55%";
    this.keyboardContainer.style.zIndex = "1";
    this.container.appendChild(this.keyboardContainer);
    this.keyboard = new SVGKeyboardRenderer(this.keyboardContainer, {
      unitSize: 40,
      keyGap: 3,
      borderRadius: 4
    });
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.zIndex = "2";
    this.canvas.style.pointerEvents = "none";
    this.container.appendChild(this.canvas);
    this.particles = new ParticleSystem(this.canvas);
    this.particles.setTheme(this.theme);
    this.particles.resize(this.width, this.height);
    this.liveRegion = document.createElement("div");
    this.liveRegion.setAttribute("role", "status");
    this.liveRegion.setAttribute("aria-live", "polite");
    this.liveRegion.setAttribute("aria-atomic", "true");
    this.liveRegion.style.position = "absolute";
    this.liveRegion.style.width = "1px";
    this.liveRegion.style.height = "1px";
    this.liveRegion.style.overflow = "hidden";
    this.liveRegion.style.clip = "rect(0, 0, 0, 0)";
    this.liveRegion.style.whiteSpace = "nowrap";
    this.liveRegion.style.border = "0";
    this.liveRegion.style.margin = "-1px";
    this.liveRegion.style.padding = "0";
    this.liveRegion.style.zIndex = "10";
    this.container.appendChild(this.liveRegion);
    this.comboDisplay = document.createElement("div");
    this.comboDisplay.setAttribute("aria-hidden", "true");
    this.comboDisplay.style.position = "absolute";
    this.comboDisplay.style.top = "16px";
    this.comboDisplay.style.right = "16px";
    this.comboDisplay.style.fontFamily = "system-ui, -apple-system, sans-serif";
    this.comboDisplay.style.fontSize = "24px";
    this.comboDisplay.style.fontWeight = "700";
    this.comboDisplay.style.color = this.theme.colors.primary;
    this.comboDisplay.style.zIndex = "3";
    this.comboDisplay.style.pointerEvents = "none";
    this.comboDisplay.style.textShadow = `0 0 10px ${this.theme.colors.primary}`;
    this.comboDisplay.style.opacity = "0";
    this.comboDisplay.style.transition = "opacity 200ms ease, transform 200ms ease";
    this.container.appendChild(this.comboDisplay);
    this.keyboard.applyTheme(this.theme, this.highContrast);
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Plugin Event Handlers
  // ─────────────────────────────────────────────────────────────────────────
  renderHit(judgment, key, _delta) {
    const normalizedKey = normalizeKey2(key);
    const keyBounds = this.getKeyScreenBounds(normalizedKey);
    const cx = keyBounds.x + keyBounds.width / 2;
    const cy = keyBounds.y + keyBounds.height / 2;
    this.keyboard.depressKey(normalizedKey);
    this.particles.emitRipple(cx, cy, judgment);
    switch (judgment) {
      case "perfect":
        this.keyboard.setKeyHighlight(normalizedKey, this.theme.colors.primary, 0.7);
        this.particles.emitBurst(cx, cy, "perfect", this.theme.particleStyle, this.theme.particleDensity);
        this.particles.emitBurst(cx, cy, "perfect", "confetti", this.theme.particleDensity * 0.5);
        this.particles.addEdgeGlow(this.theme.colors.primary, this.theme.intensity, 300);
        this.particles.addShake(this.theme.shakeIntensity * 0.5, 150);
        this.particles.emitSpecularSweep();
        break;
      case "great":
        this.keyboard.setKeyHighlight(normalizedKey, this.theme.colors.secondary, 0.5);
        this.particles.emitBurst(cx, cy, "great", this.theme.particleStyle, this.theme.particleDensity * 0.7);
        this.particles.addEdgeGlow(this.theme.colors.secondary, this.theme.intensity * 0.5, 200);
        break;
      case "good":
        this.keyboard.setKeyHighlight(normalizedKey, this.theme.colors.tertiary, 0.4);
        this.particles.emitMutedFlash(cx, cy);
        break;
    }
    window.setTimeout(() => {
      this.keyboard.clearKeyHighlight(normalizedKey);
    }, 200);
  }
  renderMiss(key, _expectedKey) {
    const normalizedKey = normalizeKey2(key);
    const keyBounds = this.getKeyScreenBounds(normalizedKey);
    this.keyboard.shakeKey(normalizedKey);
    this.keyboard.setKeyHighlight(normalizedKey, this.theme.colors.danger, 0.3);
    this.particles.emitWrongKeyBurst(
      keyBounds.x + keyBounds.width / 2,
      keyBounds.y + keyBounds.height / 2
    );
    this.particles.emitRipple(
      keyBounds.x + keyBounds.width / 2,
      keyBounds.y + keyBounds.height / 2,
      "wrong"
    );
    window.setTimeout(() => {
      this.keyboard.clearKeyHighlight(normalizedKey);
    }, 200);
  }
  renderStale(note) {
    if (!this.nudgeEnabled) return;
    this.nudgeKeys.set(note.key, { note, startTime: performance.now() });
  }
  renderCombo(count, _multiplier) {
    if (count > this.maxComboReached) {
      this.maxComboReached = count;
    }
    if (count >= 2) {
      this.comboDisplay.textContent = `${count}x`;
      this.comboDisplay.style.opacity = "1";
      this.comboDisplay.style.transform = "scale(1.1)";
      window.setTimeout(() => {
        this.comboDisplay.style.transform = "scale(1)";
      }, 100);
      this.applyComboEscalation(count);
    } else {
      this.comboDisplay.style.opacity = "0";
    }
  }
  pulseKey(key, _bpm) {
    if (this.theme.beatPulseEnabled && !this.reducedMotion) {
      this.keyboard.pulseKey(key, _bpm);
    }
  }
  setTheme(theme) {
    this.theme = theme;
    this.keyboard.applyTheme(theme, this.highContrast);
    this.particles.setTheme(theme);
    this.comboDisplay.style.color = theme.colors.primary;
    this.comboDisplay.style.textShadow = `0 0 10px ${this.theme.colors.primary}`;
  }
  /**
   * Provide a reference to the judge so the feedback layer can query the current
   * expected note and render a persistent expected-key indicator.
   */
  setJudge(judge) {
    this.judge = judge;
    this.createExpectedKeyIndicator();
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Accessibility
  // ─────────────────────────────────────────────────────────────────────────
  setHighContrast(enabled) {
    this.highContrast = enabled;
    this.keyboard.applyTheme(this.theme, enabled);
  }
  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
    this.particles.setReducedMotion(enabled);
  }
  setNudgeEnabled(enabled) {
    this.nudgeEnabled = enabled;
    if (!enabled) {
      for (const [keyId] of this.nudgeKeys) {
        this.keyboard.clearNudgeGlow(keyId);
      }
      this.nudgeKeys.clear();
    }
  }
  /** Announce a message via ARIA live region */
  announce(message) {
    this.liveRegion.textContent = "";
    requestAnimationFrame(() => {
      this.liveRegion.textContent = message;
    });
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Combo Escalation
  // ─────────────────────────────────────────────────────────────────────────
  applyComboEscalation(count) {
    const thresholds = this.theme.comboThresholds;
    if (count >= thresholds.intense && this.lastStreakThreshold < thresholds.intense) {
      this.lastStreakThreshold = thresholds.intense;
      this.announce(`${count} combo! Full light show!`);
      this.triggerIntenseEffect();
    } else if (count >= thresholds.moderate && this.lastStreakThreshold < thresholds.moderate) {
      this.lastStreakThreshold = thresholds.moderate;
      this.announce(`${count} combo! Keep going!`);
      this.triggerModerateEffect();
    } else if (count >= thresholds.subtle && this.lastStreakThreshold < thresholds.subtle) {
      this.lastStreakThreshold = thresholds.subtle;
      this.announce(`${count} combo!`);
      this.triggerSubtleEffect();
    }
  }
  triggerSubtleEffect() {
    this.particles.addEdgeGlow(this.theme.colors.comboGlow, 0.2, 500);
  }
  triggerModerateEffect() {
    this.particles.addEdgeGlow(this.theme.colors.comboGlow, 0.5, 600);
    this.particles.addShake(this.theme.shakeIntensity * 0.3, 200);
  }
  triggerIntenseEffect() {
    this.particles.addEdgeGlow(this.theme.colors.comboGlow, 0.8, 800);
    this.particles.addShake(this.theme.shakeIntensity * 0.8, 300);
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      this.particles.emitBurst(x, y, "perfect", this.theme.particleStyle, 0.5);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Nudge Update Loop
  // ─────────────────────────────────────────────────────────────────────────
  updateNudges() {
    if (!this.nudgeEnabled) return;
    const now = performance.now();
    for (const [keyId, nudge] of this.nudgeKeys) {
      const elapsed = now - nudge.startTime;
      const intensity = Math.min(1, elapsed / 5e3);
      this.keyboard.setNudgeGlow(keyId, intensity);
      if (elapsed > 8e3) {
        this.keyboard.clearNudgeGlow(keyId);
        this.nudgeKeys.delete(keyId);
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Expected-Key Indicator
  // ─────────────────────────────────────────────────────────────────────────
  createExpectedKeyIndicator() {
    this.expectedKeyIndicator = document.createElement("div");
    this.expectedKeyIndicator.setAttribute("aria-hidden", "true");
    this.expectedKeyIndicator.style.position = "absolute";
    this.expectedKeyIndicator.style.top = "0";
    this.expectedKeyIndicator.style.left = "50%";
    this.expectedKeyIndicator.style.transform = "translateX(-50%) translateY(20px)";
    this.expectedKeyIndicator.style.width = "44px";
    this.expectedKeyIndicator.style.height = "44px";
    this.expectedKeyIndicator.style.borderRadius = "6px";
    this.expectedKeyIndicator.style.background = "rgba(255, 145, 0, 0.15)";
    this.expectedKeyIndicator.style.border = "2px solid rgba(255, 145, 0, 0.6)";
    this.expectedKeyIndicator.style.display = "flex";
    this.expectedKeyIndicator.style.alignItems = "center";
    this.expectedKeyIndicator.style.justifyContent = "center";
    this.expectedKeyIndicator.style.fontFamily = "system-ui, sans-serif";
    this.expectedKeyIndicator.style.fontWeight = "700";
    this.expectedKeyIndicator.style.fontSize = "16px";
    this.expectedKeyIndicator.style.color = "#ff9100";
    this.expectedKeyIndicator.style.zIndex = "4";
    this.expectedKeyIndicator.style.pointerEvents = "none";
    this.expectedKeyIndicator.style.opacity = "0";
    this.expectedKeyIndicator.style.transition = "opacity 200ms ease, transform 100ms ease";
    this.expectedKeyIndicator.style.boxShadow = "0 0 12px rgba(255, 145, 0, 0.3)";
    this.container.appendChild(this.expectedKeyIndicator);
    this.expectedKeyLabel = document.createElement("span");
    this.expectedKeyLabel.textContent = "";
    this.expectedKeyIndicator.appendChild(this.expectedKeyLabel);
  }
  /**
  * Updates the expected-key indicator each frame: reads the judge's current note,
  * positions the floating keycap above the target key, and adjusts glow intensity
  * based on how close the note is to its hit time.
  */
  updateExpectedKeyIndicator() {
    if (!this.judge || !this.expectedKeyIndicator) return;
    const note = this.judge.getCurrentNote();
    if (!note) {
      this.expectedKeyIndicator.style.opacity = "0";
      return;
    }
    this.expectedKeyIndicator.style.opacity = "1";
    this.expectedKeyLabel.textContent = note.key.toUpperCase();
    const targetKeyEl = this.keyboard.getKeyElement(note.key);
    if (!targetKeyEl) return;
    const keyRect = targetKeyEl.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    const keyCenterX = keyRect.left - containerRect.left + keyRect.width / 2;
    this.expectedKeyIndicator.style.left = `${keyCenterX}px`;
    this.expectedKeyIndicator.style.transform = "translateX(-50%) translateY(0)";
  }
  getKeyScreenBounds(keyId) {
    const keyEl = this.keyboard.getKeyElement(keyId);
    if (keyEl) {
      const keyRect = keyEl.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();
      return new DOMRect(
        keyRect.left - containerRect.left,
        keyRect.top - containerRect.top,
        keyRect.width,
        keyRect.height
      );
    }
    return new DOMRect(
      this.width / 2 - 20,
      this.height * 0.7,
      40,
      40
    );
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  getKeyboardElement() {
    return this.keyboard.getElement();
  }
  getCanvasOverlay() {
    return this.canvas;
  }
  getContainer() {
    return this.container;
  }
  getLiveRegion() {
    return this.liveRegion;
  }
  reset() {
    this.maxComboReached = 0;
    this.lastStreakThreshold = 0;
    this.keyboard.reset();
    this.particles.clear();
    this.comboDisplay.style.opacity = "0";
    this.comboDisplay.textContent = "";
    this.nudgeKeys.clear();
  }
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.container.style.width = `${width}px`;
    this.container.style.height = `${height}px`;
    this.particles.resize(width, height);
  }
  start() {
    this.gameActive = true;
    this.particles.start();
    this.startNudgeLoop();
  }
  stop() {
    this.gameActive = false;
    this.particles.stop();
  }
  startNudgeLoop() {
    const loop = () => {
      if (!this.gameActive) return;
      this.updateNudges();
      this.updateExpectedKeyIndicator();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
};

// src/debug-plugin.ts
var DebugPlugin = class {
  name = "debug-validator";
  feedbackLayer = null;
  canvas = null;
  // Visual state
  combo = 0;
  maxCombo = 0;
  progress = 0;
  totalNotes = 0;
  judgmentCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
  lastJudgment = null;
  judgmentLog = [];
  animationId = null;
  // DOM elements (created in getCanvasContext if not already)
  container = null;
  circleEl = null;
  progressBarEl = null;
  logEl = null;
  // ---- GamePlugin Interface Implementation -------------------------------
  onGameStart(config) {
    this.combo = 0;
    this.maxCombo = 0;
    this.progress = 0;
    this.totalNotes = config.notes.length;
    this.judgmentCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.lastJudgment = null;
    this.judgmentLog = [];
    this.createUI();
    this.startRenderLoop();
  }
  onGameEnd(results) {
    this.log(`Game Over \u2014 Score: ${results.score}  Accuracy: ${(results.accuracy * 100).toFixed(1)}%  Max Combo: ${results.maxCombo}`);
  }
  onHit(judgment, key, delta) {
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.judgmentCounts[judgment]++;
    this.lastJudgment = judgment;
    this.progress++;
    this.log(`${judgment.toUpperCase()}  "${key}"  delta=${delta.toFixed(0)}ms  combo=${this.combo}`);
  }
  onMiss(key, expectedKey) {
    this.judgmentCounts.miss++;
    this.lastJudgment = "miss";
    this.log(`MISS  pressed="${key}" expected="${expectedKey}"`);
  }
  onNoteStale(note) {
    this.judgmentCounts.miss++;
    this.log(`STALE  expected="${note.key}" at ${note.time}ms`);
  }
  onCombo(count, multiplier) {
    this.combo = count;
    if (count > this.maxCombo) this.maxCombo = count;
    if (count >= 10 && count % 10 === 0) {
      this.log(`COMBO ${count}x (${multiplier}x multiplier)`);
    }
  }
  onStreakThreshold(count) {
    this.log(`STREAK THRESHOLD ${count}!`);
  }
  onSongComplete(results) {
    this.log(`SONG COMPLETE!  Score: ${results.score}  Accuracy: ${(results.accuracy * 100).toFixed(1)}%`);
  }
  getCanvasContext() {
    return this.canvas;
  }
  getFeedbackLayer() {
    if (!this.feedbackLayer) {
      throw new Error("FeedbackLayer not set \u2014 call setFeedbackLayer() before starting");
    }
    return this.feedbackLayer;
  }
  // ---- Framework Integration Helpers ------------------------------------
  setFeedbackLayer(layer) {
    this.feedbackLayer = layer;
  }
  // ---- UI Construction ---------------------------------------------------
  createUI() {
    this.container = document.createElement("div");
    this.container.style.position = "absolute";
    this.container.style.top = "0";
    this.container.style.left = "0";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.pointerEvents = "none";
    this.container.style.zIndex = "5";
    this.circleEl = document.createElement("div");
    this.circleEl.style.position = "absolute";
    this.circleEl.style.top = "50%";
    this.circleEl.style.left = "50%";
    this.circleEl.style.transform = "translate(-50%, -50%)";
    this.circleEl.style.width = "60px";
    this.circleEl.style.height = "60px";
    this.circleEl.style.borderRadius = "50%";
    this.circleEl.style.background = "radial-gradient(circle, rgba(0,229,255,0.3), transparent)";
    this.circleEl.style.border = "2px solid rgba(0,229,255,0.5)";
    this.circleEl.style.transition = "transform 100ms ease-out";
    this.circleEl.style.display = "flex";
    this.circleEl.style.alignItems = "center";
    this.circleEl.style.justifyContent = "center";
    this.circleEl.style.fontFamily = "system-ui, sans-serif";
    this.circleEl.style.fontWeight = "700";
    this.circleEl.style.fontSize = "18px";
    this.circleEl.style.color = "#00e5ff";
    this.container.appendChild(this.circleEl);
    const progressContainer = document.createElement("div");
    progressContainer.style.position = "absolute";
    progressContainer.style.bottom = "12px";
    progressContainer.style.left = "50%";
    progressContainer.style.transform = "translateX(-50%)";
    progressContainer.style.width = "200px";
    progressContainer.style.height = "8px";
    progressContainer.style.background = "rgba(255,255,255,0.1)";
    progressContainer.style.borderRadius = "4px";
    progressContainer.style.overflow = "hidden";
    this.progressBarEl = document.createElement("div");
    this.progressBarEl.style.height = "100%";
    this.progressBarEl.style.width = "0%";
    this.progressBarEl.style.background = "linear-gradient(90deg, #00e5ff, #76ff03)";
    this.progressBarEl.style.borderRadius = "4px";
    this.progressBarEl.style.transition = "width 150ms ease";
    progressContainer.appendChild(this.progressBarEl);
    this.container.appendChild(progressContainer);
    this.logEl = document.createElement("div");
    this.logEl.style.position = "absolute";
    this.logEl.style.bottom = "30px";
    this.logEl.style.left = "12px";
    this.logEl.style.fontFamily = "monospace";
    this.logEl.style.fontSize = "11px";
    this.logEl.style.color = "rgba(255,255,255,0.6)";
    this.logEl.style.maxHeight = "100px";
    this.logEl.style.overflow = "hidden";
    this.logEl.style.lineHeight = "1.4";
    this.container.appendChild(this.logEl);
    const countsEl = document.createElement("div");
    countsEl.style.position = "absolute";
    countsEl.style.top = "12px";
    countsEl.style.left = "12px";
    countsEl.style.fontFamily = "system-ui, sans-serif";
    countsEl.style.fontSize = "12px";
    countsEl.style.color = "rgba(255,255,255,0.5)";
    countsEl.style.lineHeight = "1.5";
    countsEl.setAttribute("data-role", "counts");
    this.container.appendChild(countsEl);
    const judgmentEl = document.createElement("div");
    judgmentEl.style.position = "absolute";
    judgmentEl.style.top = "40px";
    judgmentEl.style.left = "50%";
    judgmentEl.style.transform = "translateX(-50%)";
    judgmentEl.style.fontFamily = "system-ui, sans-serif";
    judgmentEl.style.fontWeight = "700";
    judgmentEl.style.fontSize = "14px";
    judgmentEl.style.textTransform = "uppercase";
    judgmentEl.style.letterSpacing = "2px";
    judgmentEl.style.opacity = "0";
    judgmentEl.style.transition = "opacity 100ms ease";
    judgmentEl.setAttribute("data-role", "judgment");
    this.container.appendChild(judgmentEl);
    const feedbackContainer = this.feedbackLayer?.getContainer();
    if (feedbackContainer) {
      feedbackContainer.appendChild(this.container);
    }
  }
  // ---- Render Loop ------------------------------------------------------
  startRenderLoop() {
    const loop = () => {
      this.render();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }
  render() {
    if (!this.container) return;
    if (this.circleEl) {
      const scale = 1 + Math.min(this.combo * 0.02, 0.5);
      this.circleEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
      this.circleEl.textContent = this.combo > 0 ? `${this.combo}` : "";
      const colors = {
        perfect: "rgba(0,229,255,0.5)",
        great: "rgba(118,255,3,0.5)",
        good: "rgba(255,234,0,0.5)",
        miss: "rgba(255,23,68,0.5)"
      };
      const color = this.lastJudgment ? colors[this.lastJudgment] || "rgba(0,229,255,0.3)" : "rgba(0,229,255,0.3)";
      this.circleEl.style.borderColor = color;
    }
    if (this.progressBarEl && this.totalNotes > 0) {
      const pct = this.progress / this.totalNotes * 100;
      this.progressBarEl.style.width = `${pct}%`;
    }
    const countsEl = this.container.querySelector('[data-role="counts"]');
    if (countsEl) {
      countsEl.innerHTML = `
        <span style="color:#00e5ff">Perfect: ${this.judgmentCounts.perfect}</span>
        <span style="color:#76ff03;margin-left:8px">Great: ${this.judgmentCounts.great}</span>
        <span style="color:#ffea00;margin-left:8px">Good: ${this.judgmentCounts.good}</span>
        <span style="color:#ff1744;margin-left:8px">Miss: ${this.judgmentCounts.miss}</span>
      `;
    }
    const judgmentEl = this.container.querySelector('[data-role="judgment"]');
    if (judgmentEl && this.lastJudgment) {
      const colors = {
        perfect: "#00e5ff",
        great: "#76ff03",
        good: "#ffea00",
        miss: "#ff1744"
      };
      judgmentEl.textContent = this.lastJudgment;
      judgmentEl.style.color = colors[this.lastJudgment] || "#fff";
      judgmentEl.style.opacity = "1";
      setTimeout(() => {
        judgmentEl.style.opacity = "0";
      }, 300);
    }
  }
  // ---- Logging ----------------------------------------------------------
  log(msg) {
    this.judgmentLog.push(msg);
    if (this.judgmentLog.length > 6) this.judgmentLog.shift();
    if (this.logEl) {
      this.logEl.innerHTML = this.judgmentLog.map((l) => `<div>${l}</div>`).join("");
    }
    console.log(`[DebugPlugin] ${msg}`);
  }
  // ---- Cleanup ----------------------------------------------------------
  destroy() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.container?.remove();
    this.container = null;
    this.circleEl = null;
    this.progressBarEl = null;
    this.logEl = null;
  }
};
export {
  BeatClockJudge,
  BeatMapGenerator,
  DEFAULT_THEME,
  DebugPlugin,
  FeedbackLayer,
  NormalizedBus,
  ParticleSystem,
  QWERTY_LAYOUT,
  RawBus,
  SVGKeyboardRenderer,
  StaticBeatMap,
  buildKeyMap,
  normalizeKey2 as normalizeKey
};
