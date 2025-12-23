/**
 * AudioEffectsPanel - UI for controlling advanced audio effects
 */
import React from 'react';
import { ICONS } from '../constants';
import { useAudioEffects, EFFECT_PRESETS } from '../hooks/useAudioEffects';

interface AudioEffectsPanelProps {
  onClose?: () => void;
}

const AudioEffectsPanel: React.FC<AudioEffectsPanelProps> = ({ onClose }) => {
  const {
    state,
    setReverb,
    setBassBoost,
    setSpatial,
    setNormalization,
    applyPreset,
  } = useAudioEffects();

  return (
    <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro">
      {/* Header */}
      <div className="p-4 border-b-2 border-theme bg-[var(--bg-hover)] flex justify-between items-center">
        <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2">
          🔊 Audio Effects
        </h2>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-main)] rounded">
            <ICONS.Close size={16} />
          </button>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* Presets */}
        <div>
          <label className="text-xs font-mono text-[var(--text-muted)] uppercase block mb-2">
            Quick Presets
          </label>
          <div className="grid grid-cols-2 gap-2">
            {EFFECT_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className="p-2 border-2 border-theme font-mono text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Reverb */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-mono font-bold flex items-center gap-2">
              🎤 Reverb
            </label>
            <button
              onClick={() => setReverb(!state.reverbEnabled)}
              className={`w-12 h-6 rounded-full relative transition-colors ${
                state.reverbEnabled ? 'bg-[var(--primary)]' : 'bg-gray-400'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                state.reverbEnabled ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>
          {state.reverbEnabled && (
            <input
              type="range"
              min="0"
              max="100"
              value={state.reverbAmount}
              onChange={e => setReverb(true, Number(e.target.value))}
              className="w-full"
            />
          )}
        </div>

        {/* Bass Boost */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-mono font-bold flex items-center gap-2">
              🔊 Bass Boost
            </label>
            <button
              onClick={() => setBassBoost(!state.bassBoostEnabled)}
              className={`w-12 h-6 rounded-full relative transition-colors ${
                state.bassBoostEnabled ? 'bg-[var(--primary)]' : 'bg-gray-400'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                state.bassBoostEnabled ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>
          {state.bassBoostEnabled && (
            <input
              type="range"
              min="0"
              max="100"
              value={state.bassBoostAmount}
              onChange={e => setBassBoost(true, Number(e.target.value))}
              className="w-full"
            />
          )}
        </div>

        {/* 3D Audio */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-mono font-bold flex items-center gap-2">
              🎭 3D Spatial Audio
            </label>
            <button
              onClick={() => setSpatial(!state.spatialEnabled)}
              className={`w-12 h-6 rounded-full relative transition-colors ${
                state.spatialEnabled ? 'bg-[var(--primary)]' : 'bg-gray-400'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                state.spatialEnabled ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>
          {state.spatialEnabled && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-[var(--text-muted)]">X</label>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={state.spatialPosition.x}
                  onChange={e => setSpatial(true, { ...state.spatialPosition, x: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Y</label>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={state.spatialPosition.y}
                  onChange={e => setSpatial(true, { ...state.spatialPosition, y: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Z</label>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={state.spatialPosition.z}
                  onChange={e => setSpatial(true, { ...state.spatialPosition, z: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Normalization */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-mono font-bold flex items-center gap-2">
              📊 Volume Normalization
            </label>
            <button
              onClick={() => setNormalization(!state.normalizationEnabled)}
              className={`w-12 h-6 rounded-full relative transition-colors ${
                state.normalizationEnabled ? 'bg-[var(--primary)]' : 'bg-gray-400'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                state.normalizationEnabled ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)] font-mono">
            Automatically levels out volume differences between tracks
          </p>
        </div>
      </div>
    </div>
  );
};

export default AudioEffectsPanel;
