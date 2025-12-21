/**
 * AmbientMixer Component
 * Ambient sound mixer for layering nature and environment sounds
 */

import React, { useState, useRef } from 'react';
import { ICONS } from '../../constants';
import { SOUNDS, AMBIENT_PRESETS as PRESETS, createReverbImpulse } from './labTypes';

interface TrackNode {
  source: AudioBufferSourceNode | null;
  gain: GainNode | null;
  panner: StereoPannerNode | null;
  buffer: AudioBuffer | null;
}

interface AmbientMixerProps {
  masterReverb?: number;
}

const AmbientMixer: React.FC<AmbientMixerProps> = ({ masterReverb = 0.2 }) => {
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [mixerReady, setMixerReady] = useState(false);
  const [isLoadingSounds, setIsLoadingSounds] = useState(false);
  const [failedSounds, setFailedSounds] = useState<string[]>([]);

  const mixerCtxRef = useRef<AudioContext | null>(null);
  const trackNodesRef = useRef<Map<string, TrackNode>>(new Map());

  const initMixer = async () => {
    if (mixerReady || isLoadingSounds) return;
    setIsLoadingSounds(true);
    setFailedSounds([]);

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ latencyHint: 'interactive' });
      mixerCtxRef.current = ctx;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -15;
      compressor.connect(ctx.destination);

      const masterGain = ctx.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(compressor);

      const reverb = ctx.createConvolver();
      reverb.buffer = createReverbImpulse(ctx, 3.0, 3.0);
      const reverbGain = ctx.createGain();
      reverbGain.gain.value = masterReverb;
      
      reverb.connect(reverbGain);
      reverbGain.connect(masterGain);

      // Load each sound independently
      await Promise.all(SOUNDS.map(async (sound) => {
        try {
          const response = await fetch(sound.url);
          if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          
          const gainNode = ctx.createGain();
          gainNode.gain.value = 0; 
          
          const pannerNode = ctx.createStereoPanner();
          pannerNode.pan.value = 0;

          gainNode.connect(pannerNode);
          pannerNode.connect(masterGain);
          gainNode.connect(reverb);

          trackNodesRef.current.set(sound.id, { 
            source: null, 
            gain: gainNode, 
            panner: pannerNode,
            buffer: audioBuffer 
          });
        } catch (e) {
          console.warn(`Failed to load sound: ${sound.label}`, e);
          setFailedSounds(prev => [...prev, sound.id]);
        }
      }));

      // Start playing loaded sounds (muted by default)
      trackNodesRef.current.forEach((node) => {
        if (node.buffer && mixerCtxRef.current) {
          const source = mixerCtxRef.current.createBufferSource();
          source.buffer = node.buffer;
          source.loop = true;
          if (node.gain) source.connect(node.gain);
          source.start(0);
          node.source = source;
        }
      });

      setMixerReady(true);
    } catch (e) {
      console.error("Mixer Critical Failure", e);
    } finally {
      setIsLoadingSounds(false);
    }
  };

  const toggleMixerPower = () => {
    if (!mixerCtxRef.current) {
      initMixer();
    } else {
      if (mixerCtxRef.current.state === 'suspended') {
        mixerCtxRef.current.resume();
      } else {
        mixerCtxRef.current.suspend();
      }
    }
  };

  const applyPreset = (mix: Record<string, number>) => {
    if (!mixerCtxRef.current) initMixer();
    else if (mixerCtxRef.current.state === 'suspended') mixerCtxRef.current.resume();

    const newVols: Record<string, number> = {};
    SOUNDS.forEach(s => {
      const target = mix[s.id] || 0;
      newVols[s.id] = target;
      const node = trackNodesRef.current.get(s.id);
      if (node && node.gain) {
        node.gain.gain.setTargetAtTime(target, mixerCtxRef.current?.currentTime || 0, 1.5);
      }
    });
    setVolumes(newVols);
  };

  const stopAll = () => applyPreset({});

  const handleMixerVolume = (id: string, val: number) => {
    setVolumes(prev => ({ ...prev, [id]: val }));
    const node = trackNodesRef.current.get(id);
    if (node && node.gain) {
      node.gain.gain.setTargetAtTime(val, mixerCtxRef.current?.currentTime || 0, 0.1);
    }
    if (mixerCtxRef.current && mixerCtxRef.current.state === 'suspended' && val > 0) {
      mixerCtxRef.current.resume();
    }
  };

  return (
    <div className="animate-in slide-in-from-bottom-4">
      {/* Controls */}
      <div className="bg-[#1a1a1a] text-white p-6 mb-6 shadow-retro border-2 border-black flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleMixerPower}
            className={`w-14 h-14 rounded-full border-2 border-gray-600 flex items-center justify-center transition-all ${mixerReady ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.6)] border-green-400' : 'bg-gray-800 text-gray-500'}`}
          >
            <ICONS.Power size={24} />
          </button>
          <div>
            <h3 className="font-bold font-mono uppercase text-sm text-gray-200">Engine Status</h3>
            <p className="text-[10px] text-gray-400 font-mono">
              {isLoadingSounds ? "LOADING_RESOURCES..." : mixerReady ? "ACTIVE // 48kHz" : "STANDBY MODE"}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-3">
          {PRESETS.map(p => (
            <button 
              key={p.id} 
              onClick={() => applyPreset(p.mix)} 
              className="px-4 py-2 border border-gray-600 bg-gray-800 hover:bg-gray-700 hover:border-gray-400 text-xs font-mono font-bold uppercase transition-all"
            >
              {p.label}
            </button>
          ))}
          <button onClick={stopAll} className="px-4 py-2 border border-red-900 bg-red-900/20 text-red-500 hover:bg-red-900/40 text-xs font-mono font-bold uppercase transition-all">
            Mute All
          </button>
        </div>
      </div>

      {/* Channels */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {SOUNDS.map(sound => {
          const vol = volumes[sound.id] || 0;
          const isFailed = failedSounds.includes(sound.id);
          
          return (
            <div key={sound.id} className={`bg-white border-2 border-black p-2 py-4 shadow-retro-sm flex flex-col items-center text-center transition-all hover:translate-y-[-2px] ${!mixerReady ? 'opacity-50 pointer-events-none' : 'opacity-100'} ${isFailed ? 'opacity-60' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-transform duration-300 ${vol > 0 ? 'scale-110 shadow-lg' : ''} ${sound.bg} ${sound.color}`}>
                {isFailed ? <ICONS.Close size={20} className="text-red-500"/> : <sound.icon size={20} className={vol > 0 ? 'animate-pulse' : ''} />}
              </div>
              <h3 className="font-bold font-mono uppercase text-[9px] mb-4 truncate w-full px-1 tracking-wider">{sound.label}</h3>
              
              <div className="flex-1 w-full flex flex-col items-center justify-between gap-4">
                <div className="h-32 relative flex items-center justify-center w-full group">
                  {/* Fader Track */}
                  <div className="relative w-2 bg-gray-200 h-full rounded-full overflow-hidden">
                    <div 
                      className={`absolute bottom-0 w-full transition-all duration-100 ${vol > 0 ? 'bg-black' : 'bg-transparent'}`} 
                      style={{ height: `${vol * 100}%` }}
                    ></div>
                  </div>
                  
                  {/* Fader Handle */}
                  <div 
                    className="absolute w-8 h-4 bg-white border-2 border-black shadow-sm pointer-events-none transition-all duration-100 rounded-sm flex items-center justify-center"
                    style={{ bottom: `calc(${vol * 100}% - 8px)` }}
                  >
                    <div className="w-4 h-[1px] bg-black"></div>
                  </div>

                  <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={vol} 
                    disabled={isFailed}
                    onChange={(e) => handleMixerVolume(sound.id, parseFloat(e.target.value))} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none z-10 disabled:cursor-not-allowed" 
                    {...({ orient: "vertical" } as any)} 
                  />
                </div>
                <span className="text-[10px] font-mono font-bold">{isFailed ? 'ERR' : `${Math.round(vol * 100)}%`}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AmbientMixer;
