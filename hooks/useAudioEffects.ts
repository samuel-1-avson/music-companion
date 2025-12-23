/**
 * useAudioEffects - Hook for advanced audio effects using Web Audio API
 * 
 * Features:
 * - Reverb (ConvolverNode)
 * - Bass Boost (BiquadFilter)
 * - 3D Audio / Spatial (PannerNode)
 * - Volume Normalization (DynamicsCompressorNode)
 */
import { useRef, useCallback, useState, useEffect } from 'react';

export interface AudioEffectsState {
  reverbEnabled: boolean;
  reverbAmount: number; // 0-100
  bassBoostEnabled: boolean;
  bassBoostAmount: number; // 0-100
  spatialEnabled: boolean;
  spatialPosition: { x: number; y: number; z: number }; // -1 to 1
  normalizationEnabled: boolean;
}

export interface AudioEffectsResult {
  state: AudioEffectsState;
  connectAudioElement: (audioElement: HTMLAudioElement) => void;
  disconnect: () => void;
  setReverb: (enabled: boolean, amount?: number) => void;
  setBassBoost: (enabled: boolean, amount?: number) => void;
  setSpatial: (enabled: boolean, position?: { x: number; y: number; z: number }) => void;
  setNormalization: (enabled: boolean) => void;
  presets: typeof EFFECT_PRESETS;
  applyPreset: (presetId: string) => void;
}

// Effect presets
export const EFFECT_PRESETS = [
  { id: 'none', name: 'None', reverb: 0, bass: 0, spatial: false, normalize: false },
  { id: 'concert', name: '🎤 Concert Hall', reverb: 70, bass: 30, spatial: false, normalize: true },
  { id: 'studio', name: '🎧 Studio', reverb: 20, bass: 50, spatial: false, normalize: true },
  { id: 'club', name: '🪩 Club', reverb: 40, bass: 80, spatial: false, normalize: true },
  { id: 'spatial', name: '🎭 3D Surround', reverb: 30, bass: 40, spatial: true, normalize: true },
  { id: 'bass', name: '🔊 Bass Boost', reverb: 0, bass: 100, spatial: false, normalize: true },
  { id: 'vocal', name: '🎤 Vocal Focus', reverb: 10, bass: -20, spatial: false, normalize: true },
] as const;

const DEFAULT_STATE: AudioEffectsState = {
  reverbEnabled: false,
  reverbAmount: 50,
  bassBoostEnabled: false,
  bassBoostAmount: 50,
  spatialEnabled: false,
  spatialPosition: { x: 0, y: 0, z: 0 },
  normalizationEnabled: false,
};

/**
 * Hook for managing advanced audio effects
 */
export function useAudioEffects(): AudioEffectsResult {
  const [state, setState] = useState<AudioEffectsState>(DEFAULT_STATE);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const convolverNodeRef = useRef<ConvolverNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const pannerNodeRef = useRef<PannerNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  
  /**
   * Generate impulse response for reverb
   */
  const generateImpulseResponse = useCallback((duration: number, decay: number): AudioBuffer => {
    const ctx = audioContextRef.current!;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    
    return impulse;
  }, []);

  /**
   * Connect an audio element to the effects chain
   */
  const connectAudioElement = useCallback((audioElement: HTMLAudioElement) => {
    // Prevent reconnecting same element
    if (sourceNodeRef.current?.mediaElement === audioElement) return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      // Create nodes
      const source = ctx.createMediaElementSource(audioElement);
      const gain = ctx.createGain();
      const convolver = ctx.createConvolver();
      const bassFilter = ctx.createBiquadFilter();
      const panner = ctx.createPanner();
      const compressor = ctx.createDynamicsCompressor();
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      
      // Configure bass filter
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 200;
      bassFilter.gain.value = 0;
      
      // Configure panner
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1;
      panner.maxDistance = 10000;
      panner.rolloffFactor = 1;
      
      // Configure compressor for normalization
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      
      // Generate impulse response for reverb
      convolver.buffer = generateImpulseResponse(2, 2);
      
      // Store refs
      sourceNodeRef.current = source;
      gainNodeRef.current = gain;
      convolverNodeRef.current = convolver;
      bassFilterRef.current = bassFilter;
      pannerNodeRef.current = panner;
      compressorRef.current = compressor;
      dryGainRef.current = dryGain;
      wetGainRef.current = wetGain;
      
      // Initial connection (dry path)
      source
        .connect(bassFilter)
        .connect(gain)
        .connect(ctx.destination);
      
      console.log('[AudioEffects] Connected to audio element');
    } catch (e) {
      console.error('[AudioEffects] Failed to connect:', e);
    }
  }, [generateImpulseResponse]);

  /**
   * Disconnect and cleanup
   */
  const disconnect = useCallback(() => {
    try {
      sourceNodeRef.current?.disconnect();
      gainNodeRef.current?.disconnect();
      convolverNodeRef.current?.disconnect();
      bassFilterRef.current?.disconnect();
      pannerNodeRef.current?.disconnect();
      compressorRef.current?.disconnect();
      dryGainRef.current?.disconnect();
      wetGainRef.current?.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
    
    sourceNodeRef.current = null;
    console.log('[AudioEffects] Disconnected');
  }, []);

  /**
   * Rebuild audio chain based on current state
   */
  const rebuildChain = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx || !sourceNodeRef.current) return;
    
    const source = sourceNodeRef.current;
    const gain = gainNodeRef.current;
    const convolver = convolverNodeRef.current;
    const bassFilter = bassFilterRef.current;
    const panner = pannerNodeRef.current;
    const compressor = compressorRef.current;
    const dryGain = dryGainRef.current;
    const wetGain = wetGainRef.current;
    
    if (!gain || !convolver || !bassFilter || !panner || !compressor || !dryGain || !wetGain) return;
    
    try {
      // Disconnect everything
      source.disconnect();
      bassFilter.disconnect();
      gain.disconnect();
      convolver.disconnect();
      panner.disconnect();
      compressor.disconnect();
      dryGain.disconnect();
      wetGain.disconnect();
      
      // Start building chain
      let currentNode: AudioNode = source;
      
      // Bass filter
      if (state.bassBoostEnabled) {
        bassFilter.gain.value = (state.bassBoostAmount / 100) * 15; // Max 15dB boost
        currentNode.connect(bassFilter);
        currentNode = bassFilter;
      }
      
      // Reverb (dry/wet mix)
      if (state.reverbEnabled) {
        const wetAmount = state.reverbAmount / 100;
        dryGain.gain.value = 1 - wetAmount * 0.5;
        wetGain.gain.value = wetAmount;
        
        currentNode.connect(dryGain);
        currentNode.connect(convolver).connect(wetGain);
        
        dryGain.connect(gain);
        wetGain.connect(gain);
        currentNode = gain;
      } else {
        currentNode.connect(gain);
        currentNode = gain;
      }
      
      // Spatial audio
      if (state.spatialEnabled) {
        panner.positionX.value = state.spatialPosition.x;
        panner.positionY.value = state.spatialPosition.y;
        panner.positionZ.value = state.spatialPosition.z;
        currentNode.connect(panner);
        currentNode = panner;
      }
      
      // Normalization
      if (state.normalizationEnabled) {
        currentNode.connect(compressor);
        currentNode = compressor;
      }
      
      // Final output
      currentNode.connect(ctx.destination);
      
    } catch (e) {
      console.error('[AudioEffects] Failed to rebuild chain:', e);
    }
  }, [state]);

  // Rebuild chain when state changes
  useEffect(() => {
    rebuildChain();
  }, [state, rebuildChain]);

  const setReverb = useCallback((enabled: boolean, amount?: number) => {
    setState(prev => ({
      ...prev,
      reverbEnabled: enabled,
      reverbAmount: amount ?? prev.reverbAmount,
    }));
  }, []);

  const setBassBoost = useCallback((enabled: boolean, amount?: number) => {
    setState(prev => ({
      ...prev,
      bassBoostEnabled: enabled,
      bassBoostAmount: amount ?? prev.bassBoostAmount,
    }));
  }, []);

  const setSpatial = useCallback((enabled: boolean, position?: { x: number; y: number; z: number }) => {
    setState(prev => ({
      ...prev,
      spatialEnabled: enabled,
      spatialPosition: position ?? prev.spatialPosition,
    }));
  }, []);

  const setNormalization = useCallback((enabled: boolean) => {
    setState(prev => ({
      ...prev,
      normalizationEnabled: enabled,
    }));
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = EFFECT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    
    setState({
      reverbEnabled: preset.reverb > 0,
      reverbAmount: Math.abs(preset.reverb),
      bassBoostEnabled: preset.bass !== 0,
      bassBoostAmount: Math.abs(preset.bass),
      spatialEnabled: preset.spatial,
      spatialPosition: { x: 0, y: 0, z: 0 },
      normalizationEnabled: preset.normalize,
    });
  }, []);

  return {
    state,
    connectAudioElement,
    disconnect,
    setReverb,
    setBassBoost,
    setSpatial,
    setNormalization,
    presets: EFFECT_PRESETS,
    applyPreset,
  };
}

export default useAudioEffects;
