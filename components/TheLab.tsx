
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ICONS } from '../constants';

interface TheLabProps {
  setEQBand?: (index: number, value: number) => void;
  eqValues?: number[];
  analyser?: AnalyserNode | null;
}

interface SynthKeyData {
  char: string;
  note: string;
  freq: number;
  type: string;
  offset: number;
}

const SOUNDS = [
  { id: 'rain', label: 'Heavy Rain', icon: ICONS.Rain, color: 'text-blue-400', bg: 'bg-blue-900/20', url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_34235e160a.mp3?filename=rain-thunder-heavy-weather-17154.mp3' },
  { id: 'ocean', label: 'Ocean Waves', icon: ICONS.Waves, color: 'text-cyan-400', bg: 'bg-cyan-900/20', url: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_03e047372d.mp3' },
  { id: 'forest', label: 'Forest Life', icon: ICONS.Trees, color: 'text-green-400', bg: 'bg-green-900/20', url: 'https://cdn.pixabay.com/download/audio/2022/02/07/audio_658359218c.mp3' },
  { id: 'fire', label: 'Fireplace', icon: ICONS.Flame, color: 'text-orange-400', bg: 'bg-orange-900/20', url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3' },
  { id: 'night', label: 'Night Crickets', icon: ICONS.Moon, color: 'text-indigo-400', bg: 'bg-indigo-900/20', url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_73d2a012a6.mp3' },
  { id: 'keyboard', label: 'Mech Keys', icon: ICONS.Code, color: 'text-gray-400', bg: 'bg-gray-800/20', url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_5174092d6e.mp3?filename=keyboard-typing-13865.mp3' },
  { id: 'coffee', label: 'Coffee Shop', icon: ICONS.Coffee, color: 'text-amber-600', bg: 'bg-amber-900/20', url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_3a936a715f.mp3?filename=cafe-ambience-6379.mp3' },
  { id: 'vinyl', label: 'Vinyl Crackle', icon: ICONS.Disc, color: 'text-neutral-500', bg: 'bg-neutral-800/20', url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=vinyl-crackle-40995.mp3' }
];

const PRESETS = [
    { id: 'FOCUS', label: 'Deep Focus', mix: { rain: 0.4, fire: 0.2, vinyl: 0.1 } },
    { id: 'NATURE', label: 'Zen Garden', mix: { forest: 0.5, ocean: 0.3, night: 0.1 } },
    { id: 'WORK', label: 'Late Night', mix: { coffee: 0.3, rain: 0.2, keyboard: 0.1 } },
    { id: 'SLEEP', label: 'Dream State', mix: { ocean: 0.4, vinyl: 0.2, night: 0.2 } },
];

const SYNTH_KEYS: SynthKeyData[] = [
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

const WAVEFORMS: OscillatorType[] = ['sawtooth', 'square', 'sine', 'triangle'];

// --- AUDIO UTILS ---

const createReverbImpulse = (ctx: AudioContext, duration: number = 3.0, decay: number = 4.0) => {
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

const makeDistortionCurve = (amount: number) => {
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

const TheLab: React.FC<TheLabProps> = ({ setEQBand, eqValues = [0,0,0,0,0], analyser: masterAnalyser }) => {
  const [activeTab, setActiveTab] = useState<'MIXER' | 'SYNTH' | 'EQ'>('MIXER');
  
  // --- MIXER STATE ---
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [mixerReady, setMixerReady] = useState(false);
  const [isLoadingSounds, setIsLoadingSounds] = useState(false);
  const [masterReverb, setMasterReverb] = useState(0.2);
  const [failedSounds, setFailedSounds] = useState<string[]>([]);

  const mixerCtxRef = useRef<AudioContext | null>(null);
  const trackNodesRef = useRef<Map<string, { 
      source: AudioBufferSourceNode | null, 
      gain: GainNode | null, 
      panner: StereoPannerNode | null,
      buffer: AudioBuffer | null 
  }>>(new Map());

  // --- SYNTH STATE ---
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
  
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [oscType, setOscType] = useState<OscillatorType>('sawtooth');
  const [envelope, setEnvelope] = useState({ attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.3 });
  
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eqCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Refs for audio processing
  const paramsRef = useRef({
      envelope, filterCutoff, filterRes, delayTime, delayFeedback, delayMix, oscType, subOscEnabled, distortionAmount, lfoRate, lfoDepth, glideTime
  });

  useEffect(() => {
      paramsRef.current = { envelope, filterCutoff, filterRes, delayTime, delayFeedback, delayMix, oscType, subOscEnabled, distortionAmount, lfoRate, lfoDepth, glideTime };
      
      const now = synthCtxRef.current?.currentTime || 0;

      if (filterRef.current) {
          filterRef.current.frequency.setTargetAtTime(filterCutoff, now, 0.1);
          filterRef.current.Q.setTargetAtTime(filterRes, now, 0.1);
      }
      if (delayNodeRef.current) delayNodeRef.current.delayTime.setTargetAtTime(delayTime, now, 0.1);
      if (feedbackNodeRef.current) feedbackNodeRef.current.gain.setTargetAtTime(delayFeedback, now, 0.1);
      if (delayWetRef.current) delayWetRef.current.gain.setTargetAtTime(delayMix, now, 0.1);
      
      if (distortionRef.current) {
          distortionRef.current.curve = makeDistortionCurve(distortionAmount);
      }
      if (lfoRef.current) lfoRef.current.frequency.setTargetAtTime(lfoRate, now, 0.1);
      if (lfoGainRef.current) lfoGainRef.current.gain.setTargetAtTime(lfoDepth, now, 0.1);

  }, [envelope, filterCutoff, filterRes, delayTime, delayFeedback, delayMix, oscType, subOscEnabled, distortionAmount, lfoRate, lfoDepth, glideTime]);

  // --- MIXER LOGIC ---
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

        // Robust Sound Loading - Load each sound independently
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
      if (mixerCtxRef.current && mixerCtxRef.current.state === 'suspended' && val > 0) mixerCtxRef.current.resume();
  };

  // --- SYNTH LOGIC ---
  const applySynthPreset = (type: 'BASS' | 'LEAD' | 'PLUCK' | 'WOBBLE') => {
      if (type === 'BASS') {
          setOscType('sawtooth'); setSubOscEnabled(true);
          setEnvelope({attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.2});
          setFilterCutoff(600); setFilterRes(5);
          setDistortionAmount(20); setDelayMix(0);
          setLfoDepth(0); setGlideTime(0.05);
      } else if (type === 'LEAD') {
          setOscType('square'); setSubOscEnabled(false);
          setEnvelope({attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.3});
          setFilterCutoff(3000); setFilterRes(2);
          setDistortionAmount(5); setDelayMix(0.4);
          setLfoDepth(200); setLfoRate(6); setGlideTime(0.1);
      } else if (type === 'PLUCK') {
          setOscType('triangle'); setSubOscEnabled(false);
          setEnvelope({attack: 0.01, decay: 0.2, sustain: 0, release: 0.2});
          setFilterCutoff(1200); setFilterRes(0);
          setDistortionAmount(0); setDelayMix(0.3);
          setLfoDepth(0); setGlideTime(0);
      } else if (type === 'WOBBLE') {
          setOscType('sawtooth'); setSubOscEnabled(true);
          setEnvelope({attack: 0.1, decay: 0.5, sustain: 0.5, release: 0.3});
          setFilterCutoff(1000); setFilterRes(8);
          setDistortionAmount(40); setDelayMix(0.1);
          setLfoRate(8); setLfoDepth(800); setGlideTime(0.2);
      }
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

          // Nodes
          const gain = ctx.createGain(); gain.gain.value = 0; synthGainRef.current = gain;
          const dist = ctx.createWaveShaper(); dist.curve = makeDistortionCurve(distortionAmount); distortionRef.current = dist;
          const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = filterCutoff; filter.Q.value = filterRes; filterRef.current = filter;
          
          // LFO
          const lfo = ctx.createOscillator(); lfo.frequency.value = lfoRate; lfo.start(); lfoRef.current = lfo;
          const lfoGain = ctx.createGain(); lfoGain.gain.value = lfoDepth; lfoGainRef.current = lfoGain;
          lfo.connect(lfoGain);
          lfoGain.connect(filter.frequency); // Modulate cutoff

          // Delay
          const delay = ctx.createDelay(2.0); delay.delayTime.value = delayTime; delayNodeRef.current = delay;
          const feedback = ctx.createGain(); feedback.gain.value = delayFeedback; feedbackNodeRef.current = feedback;
          const wetGain = ctx.createGain(); wetGain.gain.value = delayMix; delayWetRef.current = wetGain;
          
          delay.connect(feedback); feedback.connect(delay); delay.connect(wetGain);
          
          const analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyserRef.current = analyser;

          // Graph: Osc -> Gain -> Distortion -> Filter -> Analyser -> Dest
          //                                            -> Delay -> WetGain -> Analyser
          
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
             // Glide Logic
             if (p.glideTime > 0) {
                 oscRef.current.frequency.setTargetAtTime(freq, now, p.glideTime);
                 if (subOscRef.current) subOscRef.current.frequency.setTargetAtTime(freq/2, now, p.glideTime);
                 setActiveNote(note);
                 // Don't restart envelope if gliding
                 return; 
             }
             
             // Hard stop previous note if no glide
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
         subOsc.frequency.setValueAtTime(freq / 2, now); // Octave down
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
          
          ctx.fillStyle = '#050505'; // Darker for high contrast
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
          ctx.strokeStyle = '#00f3ff'; // Cyber Cyan
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

  // EQ Spectrum Visualizer
  useEffect(() => {
      if (activeTab === 'EQ' && masterAnalyser && eqCanvasRef.current) {
          const canvas = eqCanvasRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const bufferLength = masterAnalyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          let frame = 0;

          const renderEq = () => {
              frame = requestAnimationFrame(renderEq);
              masterAnalyser.getByteFrequencyData(dataArray);
              
              const w = canvas.width;
              const h = canvas.height;
              ctx.clearRect(0,0,w,h);
              
              const barWidth = (w / bufferLength) * 2.5;
              let x = 0;
              
              for(let i=0; i<bufferLength; i++) {
                  const barHeight = (dataArray[i] / 255) * h;
                  ctx.fillStyle = `rgba(34, 197, 94, ${dataArray[i]/255})`; // Green
                  ctx.fillRect(x, h - barHeight, barWidth, barHeight);
                  x += barWidth + 1;
              }
          };
          renderEq();
          return () => cancelAnimationFrame(frame);
      }
  }, [activeTab, masterAnalyser]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (activeTab !== 'SYNTH' || e.repeat) return;
          const keyMap = SYNTH_KEYS.find(k => k.char === e.key.toLowerCase());
          if (keyMap) triggerAttack(keyMap.freq, keyMap.note);
      };
      const handleKeyUp = (e: KeyboardEvent) => {
          if (activeTab !== 'SYNTH') return;
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
  }, [activeTab, triggerAttack, triggerRelease]);

  const eqFrequencies = ['60Hz', '310Hz', '1kHz', '3kHz', '12kHz'];

  return (
    <div className="p-8 space-y-8 pb-32 max-w-6xl mx-auto">
      <div className="flex justify-between items-end border-b-4 border-black pb-4">
        <div>
          <h2 className="text-4xl font-bold text-black mb-2 font-mono">THE_LAB</h2>
          <p className="text-gray-600 font-mono">AUDIO_EXPERIMENTS_&_TOOLS</p>
        </div>
        <div className="flex space-x-2">
            {[{ id: 'MIXER', icon: ICONS.Sliders, label: 'AMBIENT_MIXER' }, { id: 'SYNTH', icon: ICONS.Piano, label: 'MONOSYNTH' }, { id: 'EQ', icon: ICONS.Radio, label: 'MASTER_EQ' }]
            .map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 font-bold font-mono text-xs flex items-center gap-2 border-2 border-black transition-all ${activeTab === tab.id ? 'bg-black text-white shadow-retro-sm' : 'bg-white text-black hover:bg-gray-100'}`}>
                    <tab.icon size={14} />{tab.label}
                </button>
            ))}
        </div>
      </div>

      {activeTab === 'MIXER' && (
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
                                      
                                      {/* Fader Handle (Fake) */}
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
      )}

      {activeTab === 'SYNTH' && (
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
                      {['BASS', 'LEAD', 'PLUCK', 'WOBBLE'].map((p) => (
                          <button 
                            key={p} 
                            onClick={() => applySynthPreset(p as any)}
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

                  {/* Middle: VCO (Voltage Controlled Oscillator) */}
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

                  {/* Right: VCA (Voltage Controlled Amplifier / Envelope) */}
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
                  {/* VCF (Filter) + LFO */}
                  <div className="flex-[1.5] bg-[#1a1a1a] border border-gray-700 p-4 rounded-lg relative overflow-hidden shadow-lg flex gap-6">
                      <div className="absolute top-0 right-0 bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-gray-400 uppercase border-b border-l border-gray-700">VCF / LFO</div>
                      
                      {/* Filter Controls */}
                      <div className="flex-1 flex gap-4 justify-center border-r border-gray-700 pr-4">
                          <div className="flex flex-col items-center gap-2">
                              <div className="relative w-14 h-14 rounded-full border-2 border-gray-600 bg-black flex items-center justify-center shadow-lg group">
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

                      {/* LFO Controls */}
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

                  {/* FX: Distortion & Delay */}
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
      )}

      {activeTab === 'EQ' && (
          <div className="bg-[#111] border-4 border-gray-800 p-8 shadow-2xl animate-in slide-in-from-left-4 rounded-lg relative overflow-hidden">
               {/* Screw holes for rack aesthetic */}
               <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-gray-800 border border-gray-600"></div>
               <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-gray-800 border border-gray-600"></div>
               <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-gray-800 border border-gray-600"></div>
               <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-gray-800 border border-gray-600"></div>

               <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4 relative z-10">
                   <h3 className="text-gray-200 font-bold font-mono text-xl tracking-widest flex items-center gap-2">
                       <ICONS.Sliders className="text-green-500" /> MASTER_EQ_RACK
                   </h3>
                   <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-gray-500 uppercase">Signal</span>
                       <div className={`w-3 h-3 rounded-full border border-green-900 ${masterAnalyser ? 'bg-green-500 shadow-[0_0_8px_lime]' : 'bg-green-900'}`}></div>
                   </div>
               </div>

               <div className="flex justify-between items-end h-64 px-4 md:px-12 gap-4 md:gap-8 bg-[#0a0a0a] rounded-lg border border-gray-800 pt-8 pb-4 shadow-inner relative overflow-hidden">
                   
                   {/* Background Visualizer Canvas */}
                   <canvas ref={eqCanvasRef} className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" width={600} height={300} />

                   {eqFrequencies.map((freq, i) => {
                       const val = eqValues?.[i] ?? 0;
                       return (
                       <div key={freq} className="flex-1 flex flex-col items-center h-full group relative z-10">
                           {/* Fader Track */}
                           <div className="flex-1 w-2 bg-gray-800 relative rounded-full overflow-hidden mb-2 shadow-[inset_0_0_5px_black]">
                               <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-600"></div> {/* Center Line */}
                           </div>
                           
                           {/* Fader Cap */}
                           <div 
                             className="absolute w-8 h-12 bg-gradient-to-b from-gray-700 to-black border border-gray-500 rounded flex items-center justify-center shadow-xl z-10 cursor-pointer hover:border-white transition-colors"
                             style={{ bottom: `calc(${(val + 10) * 5}% - 6px)` }}
                           >
                               <div className="w-full h-0.5 bg-white shadow-[0_0_5px_white]"></div>
                           </div>

                           {/* Invisible Input */}
                           <input 
                             type="range"
                             min="-10"
                             max="10"
                             step="1"
                             value={val}
                             onChange={(e) => setEQBand && setEQBand(i, parseFloat(e.target.value))}
                             className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-20"
                             {...({ orient: "vertical" } as any)}
                           />
                           
                           <span className="mt-2 font-mono text-[10px] font-bold text-gray-500 group-hover:text-white transition-colors">
                               {freq}
                           </span>
                           <span className={`absolute -top-6 font-mono text-[10px] font-bold transition-opacity ${val !== 0 ? 'opacity-100 text-green-400' : 'opacity-0'}`}>
                               {val > 0 ? '+' : ''}{val}dB
                           </span>
                       </div>
                   )})}
               </div>
               
               <div className="mt-6 flex justify-between items-center text-[10px] font-mono text-gray-600 uppercase">
                   <span>Input: Stereo / 48kHz</span>
                   <span>Output: Main Mix</span>
               </div>
          </div>
      )}
    </div>
  );
};

export default TheLab;
