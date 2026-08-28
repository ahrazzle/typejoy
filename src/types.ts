/**
 * Typejoy Framework — Core Types & Plugin Contract
 * 
 * This module defines the shared types and the GamePlugin interface that all
 * rhythm-typing game plugins implement. The FeedbackLayer is the shared
 * infrastructure where game "feel" lives.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Game Types
// ─────────────────────────────────────────────────────────────────────────────

export type Judgment = 'perfect' | 'great' | 'good';

export interface Note {
  /** The expected key (e.g., 'a', 'space', 'arrowup') */
  key: string;
  /** Time in ms from song start when this note should be hit */
  time: number;
  /** Timing window in ms — how early/late you can be */
  window: number;
  /** Lane or column hint for visual display */
  lane?: number;
  /** Whether this note has been resolved (hit or missed) */
  resolved?: boolean;
}

export interface GameConfig {
  /** Song title */
  title: string;
  /** Artist / author */
  artist: string;
  /** Beats per minute */
  bpm: number;
  /** Difficulty tier */
  difficulty: Difficulty;
  /** Ordered list of notes to hit */
  notes: Note[];
  /** Timing windows per judgment in ms */
  timingWindows: TimingWindows;
  /** Whether nudge hints are enabled (disabled at higher difficulties) */
  nudgeEnabled: boolean;
  /** Accessibility options */
  accessibility: AccessibilityConfig;
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface TimingWindows {
  perfect: number;
  great: number;
  good: number;
}

export interface AccessibilityConfig {
  highContrast: boolean;
  oneHandedMode: boolean;
  /** Multiplier applied to timing windows (1.0 = default, >1.0 = more forgiving) */
  timingWindowScale: number;
  /** Whether to announce combo milestones via ARIA live regions */
  announceCombos: boolean;
  /** Whether to announce song progress */
  announceProgress: boolean;
  /** Reduced motion — disables screen shake and heavy particles */
  reducedMotion: boolean;
}

export interface GameResults {
  title: string;
  artist: string;
  score: number;
  maxCombo: number;
  totalNotes: number;
  judgments: {
    perfect: number;
    great: number;
    good: number;
    miss: number;
  };
  accuracy: number;
  passed: boolean;
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

export type Listener<T> = (payload: T) => void;

export interface RawKeyEvent {
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  timestamp: number;
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
    capsLock: boolean;
  };
  repeat: boolean;
  nativeEvent?: KeyboardEvent;
}

export interface NormalizedEvent {
  char: string;
  raw: RawKeyEvent;
  phase: 'press' | 'release';
}

// ─────────────────────────────────────────────────────────────────────────────
// Beat-Map Types
// ─────────────────────────────────────────────────────────────────────────────

export type BeatNote = Note;

export interface BeatMap {
  notes: readonly BeatNote[];
  length: number;
  getNote(index: number): BeatNote | undefined;
  getNotesInRange(startMs: number, endMs: number): BeatNote[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Judgment Types
// ─────────────────────────────────────────────────────────────────────────────

export interface JudgmentEvent {
  judgment: Judgment | 'miss';
  key: string;
  delta: number;
  note: BeatNote;
  timestamp: number;
}

export const TIMING_WINDOWS: Record<Difficulty, TimingWindows> = {
  easy: { perfect: 500, great: 700, good: 1000 },
  medium: { perfect: 300, great: 500, good: 700 },
  hard: { perfect: 150, great: 300, good: 500 },
  expert: { perfect: 80, great: 150, good: 250 }
};

// ─────────────────────────────────────────────────────────────────────────────
// Plugin Hooks Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface PluginHooks {
  onHit?(event: JudgmentEvent): void;
  onMiss?(key: string, expectedKey: string, delta: number, note?: BeatNote): void;
  onWrongKey?(key: string, expectedKey: string): void;
  onNoteStale?(note: BeatNote): void;
  onCombo?(count: number, multiplier: number): void;
  onComboBreak?(previousCount: number): void;
  onStreakThreshold?(count: number): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme Descriptor
// ─────────────────────────────────────────────────────────────────────────────

export type ParticleStyle = 'spark' | 'ring' | 'star' | 'confetti' | 'none';
export type GlowStyle = 'soft' | 'neon' | 'pulse' | 'none';

export interface ColorPalette {
  /** Primary accent color for perfect hits */
  primary: string;
  /** Secondary color for great hits */
  secondary: string;
  /** Tertiary color for good hits */
  tertiary: string;
  /** Color for misses / wrong keys */
  danger: string;
  /** Background color for the keyboard surface */
  surface: string;
  /** Keycap base color */
  keycap: string;
  /** Keycap text color */
  keycapText: string;
  /** Keycap border color */
  keycapBorder: string;
  /** Glow color for combo milestones */
  comboGlow: string;
  /** Color for nudge hints */
  nudgeGlow: string;
  /** High-contrast override colors */
  highContrast?: {
    primary: string;
    secondary: string;
    danger: string;
    surface: string;
    keycap: string;
    keycapText: string;
  };
}

export interface ThemeDescriptor {
  name: string;
  colors: ColorPalette;
  /** Visual particle style for hit feedback */
  particleStyle: ParticleStyle;
  /** Glow rendering style */
  glowStyle: GlowStyle;
  /** Overall animation intensity 0.0 → 1.0 */
  intensity: number;
  /** Screen shake intensity 0.0 → 1.0 */
  shakeIntensity: number;
  /** Particle count multiplier */
  particleDensity: number;
  /** Whether beat-pulsing on keys is enabled */
  beatPulseEnabled: boolean;
  /** Combo milestone thresholds */
  comboThresholds: {
    subtle: number;   // e.g., 10
    moderate: number; // e.g., 25
    intense: number;  // e.g., 50
  };
}

export const DEFAULT_THEME: ThemeDescriptor = {
  name: 'typejoy-default',
  colors: {
    primary: '#00e5ff',
    secondary: '#76ff03',
    tertiary: '#ffea00',
    danger: '#ff1744',
    surface: '#1a1a2e',
    keycap: '#2d2d44',
    keycapText: '#e0e0e0',
    keycapBorder: '#3d3d5c',
    comboGlow: '#e040fb',
    nudgeGlow: '#ff9100',
    highContrast: {
      primary: '#00e5ff',
      secondary: '#76ff03',
      danger: '#ff1744',
      surface: '#000000',
      keycap: '#ffffff',
      keycapText: '#000000',
    },
  },
  particleStyle: 'spark',
  glowStyle: 'neon',
  intensity: 0.8,
  shakeIntensity: 0.5,
  particleDensity: 1.0,
  beatPulseEnabled: true,
  comboThresholds: {
    subtle: 10,
    moderate: 25,
    intense: 50,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GamePlugin Interface — The Plugin Contract
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The contract every Typejoy game plugin implements. Plugins emit judgments
 * to the FeedbackLayer, which renders them. Plugins never touch the DOM or
 * canvas directly — they only emit events through this interface.
 */
export interface GamePlugin {
  /** Called once when a game session begins */
  onGameStart(config: GameConfig): void;
  /** Called when the game session ends (quit, timeout, etc.) */
  onGameEnd(results: GameResults): void;
  /** Called when the player hits the right key within a timing window */
  onHit(judgment: Judgment, key: string, delta: number): void;
  /** Called when the player presses the wrong key */
  onMiss(key: string, expectedKey: string): void;
  /** Called when a note passes its window without being hit */
  onNoteStale(note: Note): void;
  /** Called when the combo counter updates */
  onCombo(count: number, multiplier: number): void;
  /** Called when the combo crosses a milestone threshold */
  onStreakThreshold(count: number): void;
  /** Called when all notes have been resolved */
  onSongComplete(results: GameResults): void;
  /** Returns the canvas element for the plugin's visual output (if any) */
  getCanvasContext(): HTMLCanvasElement | null;
  /** Returns the FeedbackLayer this plugin renders feedback through */
  getFeedbackLayer(): FeedbackLayer;
}

// ─────────────────────────────────────────────────────────────────────────────
// FeedbackLayer — Forward declaration (defined in feedback-layer.ts)
// ─────────────────────────────────────────────────────────────────────────────

export interface FeedbackLayer {
  /** Render a hit judgment for a key */
  renderHit(judgment: Judgment, key: string, delta: number): void;
  /** Render a miss (wrong key pressed) */
  renderMiss(key: string, expectedKey: string): void;
  /** Render a stale note (nudge hint) */
  renderStale(note: Note): void;
  /** Update combo display */
  renderCombo(count: number, multiplier: number): void;
  /** Pulse a key on the beat */
  pulseKey(key: string, bpm: number): void;
  /** Set the current theme */
  setTheme(theme: ThemeDescriptor): void;
  /** Get the SVG keyboard element */
  getKeyboardElement(): SVGSVGElement;
  /** Get the canvas overlay element */
  getCanvasOverlay(): HTMLCanvasElement;
  /** Get the container element where the feedback layer is mounted */
  getContainer(): HTMLElement;
  /** Get the ARIA live region for announcements */
  getLiveRegion(): HTMLElement;
  /** Reset all visual state */
  reset(): void;
  /** Resize internal canvas to match container */
  resize(width: number, height: number): void;
  /** Start the animation loop */
  start(): void;
  /** Stop the animation loop */
  stop(): void;
  /** Connect the judge for expected-key indicator and approach rings */
  setJudge(judge: { getCurrentNote: () => BeatNote | undefined; getNextNotes: (count: number) => Array<{ note: BeatNote; timeUntilHit: number }>; getSongTime: () => number; getNotes: () => readonly BeatNote[] }): void;
  /** Set approach ring preempt time (ms before hit when rings appear) */
  setPreemptTime(ms: number): void;
  /** Set how many upcoming notes to show approach rings for */
  setNoteCount(count: number): void;
  /** Calculate accuracy as a weighted average (0.0 to 1.0) */
  getAccuracy(): number;
  /** Get letter ranking based on accuracy (S/A/B/C/D/F) */
  getRanking(): string;
  /** Play celebration animation on song completion */
  playCelebration(): void;
}
