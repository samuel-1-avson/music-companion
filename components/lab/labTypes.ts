/**
 * Shared types and constants for TheLab components
 */
import { ICONS } from '../../constants';

// --- TYPES ---

export interface SynthKeyData {
  char: string;
  note: string;
  freq: number;
  type: 'white' | 'black';
  offset: number;
}

export interface SoundConfig {
  id: string;
  label: string;
  icon: any;
  color: string;
  bg: string;
  url: string;
}

export interface AmbientPreset {
  id: string;
  label: string;
  mix: Record<string, number>;
}

export interface EnvelopeState {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

// --- CONSTANTS ---

export const SOUNDS: SoundConfig[] = [
  // Using free CC0 audio from SoundBible and other reliable sources
  { id: 'rain', label: 'Heavy Rain', icon: ICONS.Rain, color: 'text-blue-400', bg: 'bg-blue-900/20', url: 'https://soundbible.com/mp3/rain_thunder-GoodListener-1253005915.mp3' },
  { id: 'ocean', label: 'Ocean Waves', icon: ICONS.Waves, color: 'text-cyan-400', bg: 'bg-cyan-900/20', url: 'https://soundbible.com/mp3/ocean_waves_1-Mike_Koenig-980635527.mp3' },
  { id: 'forest', label: 'Forest Life', icon: ICONS.Trees, color: 'text-green-400', bg: 'bg-green-900/20', url: 'https://soundbible.com/mp3/Rainforest_Ambience-Glitch-1792.mp3' },
  { id: 'fire', label: 'Fireplace', icon: ICONS.Flame, color: 'text-orange-400', bg: 'bg-orange-900/20', url: 'https://soundbible.com/mp3/Crackling_Fireplace-EverythingAudio-SoundBible.com-870852653.mp3' },
  { id: 'night', label: 'Night Crickets', icon: ICONS.Moon, color: 'text-indigo-400', bg: 'bg-indigo-900/20', url: 'https://soundbible.com/mp3/Cricket_Song-Yanniss-12259.mp3' },
  { id: 'keyboard', label: 'Mech Keys', icon: ICONS.Code, color: 'text-gray-400', bg: 'bg-gray-800/20', url: 'https://soundbible.com/mp3/computer_keyboard_typing-Mike_Koenig-673078135.mp3' },
  { id: 'coffee', label: 'Coffee Shop', icon: ICONS.Coffee, color: 'text-amber-600', bg: 'bg-amber-900/20', url: 'https://soundbible.com/mp3/Restaurant%20Crowd-SoundBible.com-1664537599.mp3' },
  { id: 'vinyl', label: 'Vinyl Crackle', icon: ICONS.Disc, color: 'text-neutral-500', bg: 'bg-neutral-800/20', url: 'https://soundbible.com/mp3/Crowd_Chatting-SoundBible.com-1895724.mp3' }
];

export const AMBIENT_PRESETS: AmbientPreset[] = [
  { id: 'FOCUS', label: 'Deep Focus', mix: { rain: 0.4, fire: 0.2, vinyl: 0.1 } },
  { id: 'NATURE', label: 'Zen Garden', mix: { forest: 0.5, ocean: 0.3, night: 0.1 } },
  { id: 'WORK', label: 'Late Night', mix: { coffee: 0.3, rain: 0.2, keyboard: 0.1 } },
  { id: 'SLEEP', label: 'Dream State', mix: { ocean: 0.4, vinyl: 0.2, night: 0.2 } },
];

export const SYNTH_KEYS: SynthKeyData[] = [
  { char: 'a', note: 'C', freq: 261.63, type: 'white', offset: 0 },
  { char: 'w', note: 'C#', freq: 277.18, type: 'black', offset: 1 },
  { char: 's', note: 'D', freq: 293.66, type: 'white', offset: 1 },
  { char: 'e', note: 'D#', freq: 311.13, type: 'black', offset: 2 },
  { char: 'd', note: 'E', freq: 329.63, type: 'white', offset: 2 },
  { char: 'f', note: 'F', freq: 349.23, type: 'white', offset: 3 },
  { char: 't', note: 'F#', freq: 369.99, type: 'black', offset: 4 },
  { char: 'g', note: 'G', freq: 392.00, type: 'white', offset: 4 },
  { char: 'y', note: 'G#', freq: 415.30, type: 'black', offset: 5 },
  { char: 'h', note: 'A', freq: 440.00, type: 'white', offset: 5 },
  { char: 'u', note: 'A#', freq: 466.16, type: 'black', offset: 6 },
  { char: 'j', note: 'B', freq: 493.88, type: 'white', offset: 6 },
  { char: 'k', note: 'C2', freq: 523.25, type: 'white', offset: 7 },
];

export const WAVEFORMS: OscillatorType[] = ['sawtooth', 'square', 'sine', 'triangle'];

export const EQ_FREQUENCIES = ['60Hz', '310Hz', '1kHz', '3kHz', '12kHz'];

// --- AUDIO UTILITIES ---

export const createReverbImpulse = (ctx: AudioContext, duration: number = 3.0, decay: number = 4.0): AudioBuffer => {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const impulse = ctx.createBuffer(2, length, rate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = i / length;
    const e = Math.pow(1 - n, decay);
    left[i] = (Math.random() * 2 - 1) * e;
    right[i] = (Math.random() * 2 - 1) * e;
  }
  return impulse;
};

export const makeDistortionCurve = (amount: number): Float32Array => {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
  }
  return curve;
};
