/**
 * Synthesizer Component
 * Monophonic synthesizer with ADSR envelope, filter, LFO, and effects
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ICONS } from '../../constants';
import { SYNTH_KEYS, WAVEFORMS, EnvelopeState, makeDistortionCurve } from './labTypes';

const DEFAULT_ENVELOPE: EnvelopeState = {
  attack: 0.05,
  decay: 0.2,
  sustain: 0.5,
  release: 0.3
};

interface SynthesizerProps {
  // Optional: pass external analyser for visualization
  externalAnalyser?: AnalyserNode | null;
}

const Synthesizer: React.FC<SynthesizerProps> = ({ externalAnalyser }) => {
  // Audio context and nodes
  const synthCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const subOscRef = useRef<OscillatorNode | null>(null);
  const synthGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const feedbackNodeRef = useRef<GainNode | null>(null);
  const delayWetRef = useRef<GainNode | null>(null);
  const distortionRef = useRef<WaveShaperNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Synth state
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [oscType, setOscType] = useState<OscillatorType>('sawtooth');
  const [envelope, setEnvelope] = useState<EnvelopeState>(DEFAULT_ENVELOPE);
  const [filterCutoff, setFilterCutoff] = useState(2000);
  const [filterRes, setFilterRes] = useState(1);
  const [delayTime, setDelayTime] = useState(0.3);
  const [delayFeedback, setDelayFeedback] = useState(0.3);
  const [delayMix, setDelayMix] = useState(0);
  const [distortionAmount, setDistortionAmount] = useState(0);
  const [lfoRate, setLfoRate] = useState(0);
  const [lfoDepth, setLfoDepth] = useState(0);
  const [subOscEnabled, setSubOscEnabled] = useState(false);
  const [glideTime, setGlideTime] = useState(0.05);

  // Ref for params to avoid stale closures
  const paramsRef = useRef({
    envelope, filterCutoff, filterRes, delayTime, delayFeedback, 
    delayMix, oscType, subOscEnabled, distortionAmount, lfoRate, lfoDepth, glideTime
  });

  // Update params ref and audio nodes when state changes
  useEffect(() => {
    paramsRef.current = { 
      envelope, filterCutoff, filterRes, delayTime, delayFeedback, 
      delayMix, oscType, subOscEnabled, distortionAmount, lfoRate, lfoDepth, glideTime 
    };
    
    const now = synthCtxRef.current?.currentTime || 0;

    if (filterRef.current) {
      filterRef.current.frequency.setTargetAtTime(filterCutoff, now, 0.1);
      filterRef.current.Q.setTargetAtTime(filterRes, now, 0.1);
    }
    if (delayNodeRef.current) delayNodeRef.current.delayTime.setTargetAtTime(delayTime, now, 0.1);
    if (feedbackNodeRef.current) feedbackNodeRef.current.gain.setTargetAtTime(delayFeedback, now, 0.1);
    if (delayWetRef.current) delayWetRef.current.gain.setTargetAtTime(delayMix, now, 0.1);
    if (distortionRef.current) distortionRef.current.curve = makeDistortionCurve(distortionAmount);
    if (lfoRef.current) lfoRef.current.frequency.setTargetAtTime(lfoRate, now, 0.1);
    if (lfoGainRef.current) lfoGainRef.current.gain.setTargetAtTime(lfoDepth, now, 0.1);
  }, [envelope, filterCutoff, filterRes, delayTime, delayFeedback, delayMix, 
      oscType, subOscEnabled, distortionAmount, lfoRate, lfoDepth, glideTime]);

  // Synth presets
  const applySynthPreset = (type: 'BASS' | 'LEAD' | 'PLUCK' | 'WOBBLE') => {
    const presets = {
      BASS: {
        oscType: 'sawtooth' as OscillatorType, subOscEnabled: true,
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.2 },
        filterCutoff: 600, filterRes: 5, distortionAmount: 20, 
        delayMix: 0, lfoDepth: 0, lfoRate: 0, glideTime: 0.05
      },
      LEAD: {
        oscType: 'square' as OscillatorType, subOscEnabled: false,
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.3 },
        filterCutoff: 3000, filterRes: 2, distortionAmount: 5,
        delayMix: 0.4, lfoDepth: 200, lfoRate: 6, glideTime: 0.1
      },
      PLUCK: {
        oscType: 'triangle' as OscillatorType, subOscEnabled: false,
        envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 },
        filterCutoff: 1200, filterRes: 0, distortionAmount: 0,
        delayMix: 0.3, lfoDepth: 0, lfoRate: 0, glideTime: 0
      },
      WOBBLE: {
        oscType: 'sawtooth' as OscillatorType, subOscEnabled: true,
        envelope: { attack: 0.1, decay: 0.5, sustain: 0.5, release: 0.3 },
        filterCutoff: 1000, filterRes: 8, distortionAmount: 40,
        delayMix: 0.1, lfoRate: 8, lfoDepth: 800, glideTime: 0.2
      }
    };
    
    const p = presets[type];
    setOscType(p.oscType);
    setSubOscEnabled(p.subOscEnabled);
    setEnvelope(p.envelope);
    setFilterCutoff(p.filterCutoff);
    setFilterRes(p.filterRes);
    setDistortionAmount(p.distortionAmount);
    setDelayMix(p.delayMix);
    setLfoDepth(p.lfoDepth);
    setLfoRate(p.lfoRate);
    setGlideTime(p.glideTime);
  };

  const randomizePatch = () => {
    setOscType(WAVEFORMS[Math.floor(Math.random() * WAVEFORMS.length)]);
    setSubOscEnabled(Math.random() > 0.5);
    setEnvelope({
      attack: Math.random() * 0.5,
      decay: Math.random() * 0.5,
      sustain: Math.random(),
      release: Math.random() * 1.0
    });
    setFilterCutoff(200 + Math.random() * 4000);
    setFilterRes(Math.random() * 10);
    setDistortionAmount(Math.random() * 50);
    setDelayMix(Math.random() * 0.5);
    setLfoRate(Math.random() * 10);
    setLfoDepth(Math.random() * 500);
    setGlideTime(Math.random() * 0.2);
  };

  const initSynthCtx = () => {
    if (!synthCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      synthCtxRef.current = ctx;

      const gain = ctx.createGain(); 
      gain.gain.value = 0; 
      synthGainRef.current = gain;
      
      const dist = ctx.createWaveShaper(); 
      dist.curve = makeDistortionCurve(distortionAmount); 
      distortionRef.current = dist;
      
      const filter = ctx.createBiquadFilter(); 
      filter.type = 'lowpass'; 
      filter.frequency.value = filterCutoff; 
      filter.Q.value = filterRes; 
      filterRef.current = filter;
      
      // LFO
      const lfo = ctx.createOscillator(); 
      lfo.frequency.value = lfoRate; 
      lfo.start(); 
      lfoRef.current = lfo;
      
      const lfoGain = ctx.createGain(); 
      lfoGain.gain.value = lfoDepth; 
      lfoGainRef.current = lfoGain;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      // Delay
      const delay = ctx.createDelay(2.0); 
      delay.delayTime.value = delayTime; 
      delayNodeRef.current = delay;
      
      const feedback = ctx.createGain(); 
      feedback.gain.value = delayFeedback; 
      feedbackNodeRef.current = feedback;
      
      const wetGain = ctx.createGain(); 
      wetGain.gain.value = delayMix; 
      delayWetRef.current = wetGain;
      
      delay.connect(feedback); 
      feedback.connect(delay); 
      delay.connect(wetGain);
      
      const analyser = ctx.createAnalyser(); 
      analyser.fftSize = 2048; 
      analyserRef.current = analyser;

      // Audio graph
      gain.connect(dist);
      dist.connect(filter);
      filter.connect(analyser);
      filter.connect(delay);
      wetGain.connect(analyser);
      analyser.connect(ctx.destination);

      drawVisualizer();
    }
    if (synthCtxRef.current.state === 'suspended') synthCtxRef.current.resume();
    return synthCtxRef.current;
  };

  const triggerAttack = useCallback((freq: number, note: string) => {
    const ctx = initSynthCtx();
    const now = ctx.currentTime;
    const p = paramsRef.current;

    if (oscRef.current) {
      try {
        if (p.glideTime > 0) {
          oscRef.current.frequency.setTargetAtTime(freq, now, p.glideTime);
          if (subOscRef.current) subOscRef.current.frequency.setTargetAtTime(freq/2, now, p.glideTime);
          setActiveNote(note);
          return;
        }
        
        const oldGain = synthGainRef.current;
        oldGain?.gain.cancelScheduledValues(now);
        oldGain?.gain.setValueAtTime(oldGain.gain.value, now);
        oldGain?.gain.linearRampToValueAtTime(0, now + 0.01);
        oscRef.current.stop(now + 0.01);
        subOscRef.current?.stop(now + 0.01);
      } catch (e) {}
    }

    const osc = ctx.createOscillator();
    osc.type = p.oscType;
    osc.frequency.setValueAtTime(freq, now);

    let subOsc = null;
    if (p.subOscEnabled) {
      subOsc = ctx.createOscillator();
      subOsc.type = 'square';
      subOsc.frequency.setValueAtTime(freq / 2, now);
    }

    const gain = synthGainRef.current;
    if (gain) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
      const peak = 0.3;
      gain.gain.linearRampToValueAtTime(peak, now + p.envelope.attack);
      gain.gain.linearRampToValueAtTime(p.envelope.sustain * peak, now + p.envelope.attack + p.envelope.decay);
      
      osc.connect(gain);
      if (subOsc) subOsc.connect(gain);
    }

    osc.start(now);
    if (subOsc) subOsc.start(now);
    
    oscRef.current = osc;
    subOscRef.current = subOsc;
    setActiveNote(note);
  }, []);

  const triggerRelease = useCallback(() => {
    const ctx = synthCtxRef.current;
    if (!ctx || !synthGainRef.current) {
      setActiveNote(null);
      return;
    }
    const now = ctx.currentTime;
    const p = paramsRef.current;
    const gain = synthGainRef.current;

    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + p.envelope.release);
    
    if (oscRef.current) oscRef.current.stop(now + p.envelope.release + 0.1);
    if (subOscRef.current) subOscRef.current.stop(now + p.envelope.release + 0.1);
    
    setActiveNote(null);
  }, []);

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      analyserRef.current!.getByteTimeDomainData(dataArray);
      
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Grid
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(let i=0; i<canvas.width; i+=40) { ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); }
      for(let i=0; i<canvas.height; i+=40) { ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); }
      ctx.stroke();

      // Waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00f3ff';
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#00f3ff';
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for(let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height/2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    render();
  };

  // Keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const keyMap = SYNTH_KEYS.find(k => k.char === e.key.toLowerCase());
      if (keyMap) triggerAttack(keyMap.freq, keyMap.note);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const keyMap = SYNTH_KEYS.find(k => k.char === e.key.toLowerCase());
      if (keyMap) triggerRelease();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [triggerAttack, triggerRelease]);

  return (
    <div className="bg-[#111] border-2 border-black p-6 shadow-retro flex flex-col items-center animate-in slide-in-from-right-4 select-none text-gray-300">
      
      {/* Header & Presets */}
      <div className="w-full flex flex-col md:flex-row justify-between items-center mb-6 border-b border-gray-800 pb-4 gap-4">
        <h3 className="text-xl font-bold font-mono text-white tracking-widest flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          MONO_SYNTH_V2
        </h3>
        <div className="flex gap-2 items-center">
          <button onClick={randomizePatch} className="p-2 border border-gray-600 hover:text-yellow-400 hover:border-yellow-400 transition-colors" title="Randomize Patch">
            <ICONS.Zap size={16} />
          </button>
          <div className="w-px h-4 bg-gray-700 mx-2"></div>
          {(['BASS', 'LEAD', 'PLUCK', 'WOBBLE'] as const).map((p) => (
            <button 
              key={p} 
              onClick={() => applySynthPreset(p)}
              className="bg-gray-800 border border-gray-600 hover:border-cyan-400 hover:text-cyan-400 px-3 py-1 text-[10px] font-bold font-mono uppercase transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN RACK: Visualizer & Oscillators */}
      <div className="w-full flex flex-col lg:flex-row gap-6 mb-6">
        {/* Left: Oscilloscope */}
        <div className="lg:w-1/3 bg-black border-2 border-gray-700 rounded-lg p-4 relative shadow-[inset_0_0_30px_rgba(0,0,0,1)]">
          <canvas ref={canvasRef} width={300} height={150} className="w-full h-full opacity-90" />
          <div className="absolute top-2 left-3 text-[10px] font-mono text-cyan-500 uppercase tracking-widest border border-cyan-900 px-1 bg-black/50">SIGNAL_OUT</div>
          <div className="absolute top-2 right-3 text-xl font-bold font-mono text-orange-500">{activeNote || '--'}</div>
        </div>

        {/* Middle: VCO */}
        <div className="flex-1 bg-[#1a1a1a] border border-gray-700 p-4 rounded-lg flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-gray-400 uppercase border-b border-l border-gray-700">VCO</div>
          <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
            <h4 className="text-xs font-bold font-mono uppercase text-gray-400">Waveform</h4>
            <div className="flex gap-1">
              {WAVEFORMS.map(wave => (
                <button 
                  key={wave} 
                  onClick={() => setOscType(wave)} 
                  className={`w-8 h-8 flex items-center justify-center border rounded transition-all ${oscType === wave ? 'bg-cyan-900 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'bg-gray-800 border-gray-600 text-gray-500 hover:border-gray-400'}`}
                  title={wave}
                >
                  <ICONS.Activity size={14} className={wave === 'sawtooth' ? 'rotate-45' : ''} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-500">GLIDE</span>
              <input 
                type="range" min="0" max="0.5" step="0.01" 
                value={glideTime} onChange={e => setGlideTime(parseFloat(e.target.value))} 
                className="w-16 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-mono text-gray-400">SUB OSC</label>
              <button 
                onClick={() => setSubOscEnabled(!subOscEnabled)}
                className={`w-8 h-4 rounded-full transition-colors relative ${subOscEnabled ? 'bg-cyan-600' : 'bg-gray-700'}`}
              >
                <div className={`absolute top-0.5 bottom-0.5 w-3 bg-white rounded-full transition-all shadow-sm ${subOscEnabled ? 'left-4.5' : 'left-0.5'}`}></div>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Envelope */}
        <div className="flex-1 bg-[#1a1a1a] border border-gray-700 p-4 rounded-lg relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-gray-400 uppercase border-b border-l border-gray-700">ENV</div>
          <div className="flex justify-between gap-2 h-24 mt-2">
            {Object.entries(envelope).map(([key, val]) => (
              <div key={key} className="flex flex-col items-center flex-1 group">
                <div className="flex-1 w-full bg-black relative rounded-sm overflow-hidden mb-2 border border-gray-700 group-hover:border-gray-500 shadow-inner">
                  <div 
                    className="absolute bottom-0 w-full bg-orange-600 transition-all duration-75 opacity-80"
                    style={{ height: `${((val as number) / (key === 'sustain' ? 1 : 2)) * 100}%` }}
                  ></div>
                  <input 
                    type="range" 
                    min="0.01" 
                    max={key === 'sustain' ? "1" : "2"} 
                    step="0.01" 
                    value={val as number} 
                    onChange={(e) => setEnvelope(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    {...({ orient: "vertical" } as any)}
                  />
                </div>
                <span className="text-[9px] font-bold font-mono uppercase text-gray-500">{key.slice(0,1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM RACK: Filter, LFO, FX */}
      <div className="w-full flex flex-col md:flex-row gap-6 mb-8">
        {/* VCF + LFO */}
        <div className="flex-[1.5] bg-[#1a1a1a] border border-gray-700 p-4 rounded-lg relative overflow-hidden shadow-lg flex gap-6">
          <div className="absolute top-0 right-0 bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-gray-400 uppercase border-b border-l border-gray-700">VCF / LFO</div>
          
          {/* Filter */}
          <div className="flex-1 flex gap-4 justify-center border-r border-gray-700 pr-4">
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-14 h-14 rounded-full border-2 border-gray-600 bg-black flex items-center justify-center shadow-lg">
                <div className="absolute w-1 h-3 bg-white bottom-1/2 origin-bottom transition-transform" style={{ transform: `rotate(${(filterCutoff/10000)*270 - 135}deg)` }}></div>
                <input type="range" min="100" max="10000" step="10" value={filterCutoff} onChange={e => setFilterCutoff(parseFloat(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
              <span className="text-[9px] font-mono uppercase text-gray-400">CUTOFF</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-14 h-14 rounded-full border-2 border-gray-600 bg-black flex items-center justify-center shadow-lg">
                <div className="absolute w-1 h-3 bg-white bottom-1/2 origin-bottom transition-transform" style={{ transform: `rotate(${(filterRes/20)*270 - 135}deg)` }}></div>
                <input type="range" min="0" max="20" step="0.1" value={filterRes} onChange={e => setFilterRes(parseFloat(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
              <span className="text-[9px] font-mono uppercase text-gray-400">RES</span>
            </div>
          </div>

          {/* LFO */}
          <div className="flex-1 flex gap-4 justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-14 h-14 rounded-full border-2 border-gray-600 bg-black flex items-center justify-center shadow-lg">
                <div className="absolute w-1 h-3 bg-yellow-400 bottom-1/2 origin-bottom transition-transform" style={{ transform: `rotate(${(lfoRate/20)*270 - 135}deg)` }}></div>
                <input type="range" min="0" max="20" step="0.1" value={lfoRate} onChange={e => setLfoRate(parseFloat(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
              <span className="text-[9px] font-mono uppercase text-gray-400">LFO RATE</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-14 h-14 rounded-full border-2 border-gray-600 bg-black flex items-center justify-center shadow-lg">
                <div className="absolute w-1 h-3 bg-yellow-400 bottom-1/2 origin-bottom transition-transform" style={{ transform: `rotate(${(lfoDepth/1000)*270 - 135}deg)` }}></div>
                <input type="range" min="0" max="1000" step="10" value={lfoDepth} onChange={e => setLfoDepth(parseFloat(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
              <span className="text-[9px] font-mono uppercase text-gray-400">LFO AMT</span>
            </div>
          </div>
        </div>

        {/* FX */}
        <div className="flex-1 bg-[#1a1a1a] border border-gray-700 p-4 rounded-lg relative overflow-hidden shadow-lg flex gap-4 justify-center">
          <div className="absolute top-0 right-0 bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-gray-400 uppercase border-b border-l border-gray-700">FX CHAIN</div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-14 h-14 rounded-full border-2 border-red-900 bg-black flex items-center justify-center shadow-lg shadow-red-900/20">
              <div className="absolute w-1 h-3 bg-red-500 bottom-1/2 origin-bottom transition-transform" style={{ transform: `rotate(${(distortionAmount/100)*270 - 135}deg)` }}></div>
              <input type="range" min="0" max="100" step="1" value={distortionAmount} onChange={e => setDistortionAmount(parseFloat(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <span className="text-[9px] font-mono uppercase text-red-400 font-bold">DRIVE</span>
          </div>

          <div className="w-px bg-gray-700 h-16 self-center"></div>

          <div className="flex flex-col items-center gap-2">
            <div className="relative w-14 h-14 rounded-full border-2 border-blue-900 bg-black flex items-center justify-center shadow-lg shadow-blue-900/20">
              <div className="absolute w-1 h-3 bg-blue-400 bottom-1/2 origin-bottom transition-transform" style={{ transform: `rotate(${delayMix * 270 - 135}deg)` }}></div>
              <input type="range" min="0" max="1" step="0.01" value={delayMix} onChange={e => setDelayMix(parseFloat(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <span className="text-[9px] font-mono uppercase text-blue-400 font-bold">ECHO</span>
          </div>
        </div>
      </div>

      {/* KEYBOARD */}
      <div className="relative h-48 w-full max-w-4xl bg-gray-900 border-t-8 border-gray-800 rounded-b-xl shadow-2xl flex justify-center items-end pb-2 overflow-x-auto">
        <div className="relative flex shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
          {SYNTH_KEYS.map((k) => {
            const isBlack = k.type === 'black';
            const isActive = activeNote === k.note;
            
            if (isBlack) return (
              <div key={k.note} className="absolute z-20 pointer-events-none" style={{ left: (Number(k.offset) * 60) + 38 }}>
                <button 
                  onMouseDown={() => triggerAttack(k.freq, k.note)} 
                  onMouseUp={triggerRelease} 
                  onMouseLeave={() => isActive && triggerRelease()} 
                  className={`pointer-events-auto w-10 h-28 border-2 border-black border-t-0 rounded-b-md transition-all duration-75 origin-top ${isActive ? 'bg-gradient-to-b from-orange-600 to-orange-500 scale-y-95 shadow-[0_0_25px_rgba(234,88,12,0.8)] mt-1 border-orange-900 z-30' : 'bg-black shadow-lg hover:bg-gray-800'}`}
                ></button>
              </div>
            );
            
            return (
              <button 
                key={k.note} 
                onMouseDown={() => triggerAttack(k.freq, k.note)} 
                onMouseUp={triggerRelease} 
                onMouseLeave={() => isActive && triggerRelease()} 
                className={`relative w-[60px] h-40 border-2 border-black border-t-0 rounded-b-md -ml-[2px] first:ml-0 z-10 transition-all duration-75 origin-top flex flex-col justify-end pb-4 items-center overflow-hidden ${isActive ? 'bg-orange-100 scale-y-[0.98] shadow-[inset_0_-20px_30px_rgba(251,146,60,0.4)] border-b-4 border-b-orange-500' : 'bg-white shadow-md hover:bg-gray-100'}`}
              >
                <span className={`font-bold font-mono text-[10px] pointer-events-none transition-colors relative z-10 ${isActive ? 'text-orange-600 scale-125' : 'text-gray-300'}`}>
                  {k.note}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Synthesizer;
