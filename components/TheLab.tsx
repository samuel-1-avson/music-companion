/**
 * TheLab Component
 * 
 * This file has been refactored! The 933-line monolith has been split into:
 * - components/lab/index.ts        - Main container + exports
 * - components/lab/AmbientMixer.tsx - Mixer tab
 * - components/lab/Synthesizer.tsx  - Synth tab
 * - components/lab/MasterEQ.tsx     - EQ tab
 * - components/lab/constants.ts     - Shared constants
 * - components/lab/audioUtils.ts    - Audio utility functions
 * 
 * This file re-exports from the modular structure for backwards compatibility.
 */

export { default } from './lab';
export type { TheLabProps } from './lab';
export { AmbientMixer, Synthesizer, MasterEQ } from './lab';
