/**
 * Typejoy Framework — Feedback Layer & Plugin Contract
 *
 * This module exports the core types, plugin contract, and FeedbackLayer
 * for the Typejoy rhythm-typing game framework.
 *
 * @module typejoy/feedback
 */
export { Judgment, Note, GameConfig, AccessibilityConfig, GameResults, ParticleStyle, GlowStyle, ColorPalette, ThemeDescriptor, DEFAULT_THEME, GamePlugin, FeedbackLayer as FeedbackLayerInterface, } from './types';
export { FeedbackLayer, FeedbackLayerOptions } from './feedback-layer';
export { SVGKeyboardRenderer, KeyboardRendererOptions, RenderedKey } from './svg-keyboard';
export { ParticleSystem } from './particle-system';
export { QWERTY_LAYOUT, KeyDef, KeyboardLayout, buildKeyMap, normalizeKey } from './keyboard-layout';
export { DebugPlugin } from './debug-plugin.js';
//# sourceMappingURL=index.d.ts.map