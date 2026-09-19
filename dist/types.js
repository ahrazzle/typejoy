/**
 * Typejoy Framework — Core Types & Plugin Contract
 *
 * This module defines the shared types and the GamePlugin interface that all
 * rhythm-typing game plugins implement. The FeedbackLayer is the shared
 * infrastructure where game "feel" lives.
 */
export const TIMING_WINDOWS = {
    easy: { perfect: 500, great: 700, good: 1000 },
    medium: { perfect: 300, great: 500, good: 700 },
    hard: { perfect: 150, great: 300, good: 500 },
    expert: { perfect: 80, great: 150, good: 250 },
    impossible: { perfect: 40, great: 80, good: 150 }
};
export const DEFAULT_THEME = {
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
//# sourceMappingURL=types.js.map