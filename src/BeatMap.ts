// ============================================================================
// BeatMap — Read-only infrastructure
// ============================================================================
// The beat-map is immutable infrastructure. It holds the notes. It does NOT
// track cursor position, combo, or any judgment state — that's the judge's
// job. The judge advances a cursor *over* the beat-map.

import type { BeatMap, BeatNote } from './types.js';

/**
 * A read-only beat-map. Constructed from an array of notes; that array is
 * copied defensively so external mutation cannot corrupt the map.
 */
export class StaticBeatMap implements BeatMap {
  readonly notes: readonly BeatNote[];
  readonly length: number;

  constructor(notes: BeatNote[]) {
    // Defensive copy + sort by time for cursor logic.
    this.notes = Object.freeze([...notes].sort((a, b) => a.time - b.time));
    this.length = this.notes.length;
  }

  /**
   * Accessor: get the note at a given index. Read-only.
   */
  getNote(index: number): BeatNote | undefined {
    return this.notes[index];
  }

  /**
   * Get all notes within a time window [startMs, endMs].
   */
  getNotesInRange(startMs: number, endMs: number): BeatNote[] {
    return this.notes.filter((n) => n.time >= startMs && n.time <= endMs);
  }
}