import type { BeatMap, BeatNote } from './types.js';
/**
 * A read-only beat-map. Constructed from an array of notes; that array is
 * copied defensively so external mutation cannot corrupt the map.
 */
export declare class StaticBeatMap implements BeatMap {
    readonly notes: readonly BeatNote[];
    readonly length: number;
    constructor(notes: BeatNote[]);
    /**
     * Accessor: get the note at a given index. Read-only.
     */
    getNote(index: number): BeatNote | undefined;
    /**
     * Get all notes within a time window [startMs, endMs].
     */
    getNotesInRange(startMs: number, endMs: number): BeatNote[];
}
//# sourceMappingURL=BeatMap.d.ts.map