import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ICONS } from '../constants';

const SOUNDS = [
  { id: 'rain', label: 'Heavy Rain', icon: ICONS.Rain, color: 'text-blue-500', bg: 'bg-blue-100', url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_34235e160a.mp3?filename=rain-thunder-heavy-weather-17154.mp3' },
  { id: 'keyboard', label: 'Mech Keys', icon: ICONS.Code, color: 'text-gray-700', bg: 'bg-gray-200', url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_5174092d6e.mp3?filename=keyboard-typing-13865.mp3' },
  { id: 'coffee', label: 'Coffee Shop', icon: ICONS.Coffee, color: 'text-orange-600', bg: 'bg-orange-100', url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_3a936a715f.mp3?filename=cafe-ambience-6379.mp3' },
  { id: 'vinyl', label: 'Vinyl Crackle', icon: ICONS.Music, color: 'text-black', bg: 'bg-white', url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=vinyl-crackle-40995.mp3' }
];

const SYNTH_KEYS = [
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

const TheLab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'MIXER' | 'SYNTH' | 'EQ'>('MIXER');
  
  // Mixer State
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  // Synth State
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [oscType, setOscType] = useState<OscillatorType>('sawtooth');
  const [envelope, setEnvelope] = useState({ attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.3 });

  // Refs for event listeners to access latest state without re-binding
  const envelopeRef = useRef(envelope);
  const oscTypeRef = useRef(oscType);

  useEffect(() => { envelopeRef.current = envelope; }, [envelope]);
  useEffect(() => { oscTypeRef.current = oscType; }, [oscType]);

  // Init Mixer
  useEffect(() => {
    SOUNDS.forEach(sound => {
        if (!audioRefs.current[sound.id]) {
            const audio = new Audio(sound.url);
            audio.loop = true;
            audio.volume = 0;
            audioRefs.current[sound.id] = audio;
        }
    });

    return () => {
        Object.values(audioRefs.current).forEach(audio => {
            audio.pause();
            audio.src = '';
        });
        if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  const handleVolumeChange = (id: string, val: number) => {
     setVolumes(prev => ({ ...prev, [id]: val }));
     const audio = audioRefs.current[id];
     if (audio) {
         if (val > 0 && audio.paused) audio.play().catch(e => console.log("Audio play failed", e));
         if (val === 0 && !audio.paused) audio.pause();
         audio.volume = val;
     }
  };

  const initAudioCtx = () => {
     if (!audioCtxRef.current) {
         const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
         audioCtxRef.current = new AudioContextClass();
     }
     if (audioCtxRef.current.state === 'suspended') {
         audioCtxRef.current.resume();
     }
     return audioCtxRef.current;
  };

  const triggerAttack = useCallback((freq: number, note: string) => {
     const ctx = initAudioCtx();
     const now = ctx.currentTime;
     const env = envelopeRef.current;

     // Stop previous note if playing (Monophonic behavior)
     if (oscillatorRef.current) {
         try {
             // Quick fade out old note to avoid click
             gainNodeRef.current?.gain.cancelScheduledValues(now);
             gainNodeRef.current?.gain.setValueAtTime(gainNodeRef.current.gain.value, now);
             gainNodeRef.current?.gain.linearRampToValueAtTime(0, now + 0.01);
             oscillatorRef.current.stop(now + 0.01);
         } catch (e) {}
     }

     const osc = ctx.createOscillator();
     const gain = ctx.createGain();
     
     osc.type = oscTypeRef.current;
     osc.frequency.setValueAtTime(freq, now);
     
     // ADSR: Attack -> Decay -> Sustain
     gain.gain.setValueAtTime(0, now);
     gain.gain.linearRampToValueAtTime(1, now + env.attack);
     gain.gain.linearRampToValueAtTime(env.sustain, now + env.attack + env.decay);

     osc.connect(gain);
     gain.connect(ctx.destination);
     
     osc.start(now);
     
     oscillatorRef.current = osc;
     gainNodeRef.current = gain;
     setActiveNote(note);
  }, []);

  const triggerRelease = useCallback(() => {
     const ctx = audioCtxRef.current;
     if (!ctx || !gainNodeRef.current || !oscillatorRef.current) return;

     const now = ctx.currentTime;
     const env = envelopeRef.current;
     const gain = gainNodeRef.current;
     const osc = oscillatorRef.current;

     // Cancel any scheduled future changes
     gain.gain.cancelScheduledValues(now);
     
     // Current value to start release from
     gain.gain.setValueAtTime(gain.gain.value, now);
     
     // Release ramp
     gain.gain.exponentialRampToValueAtTime(0.001, now + env.release);
     
     // Stop osc after release
     osc.stop(now + env.release + 0.1); // buffer
     
     setActiveNote(null);
  }, []);

  // Keyboard Event Handlers
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (activeTab !== 'SYNTH' || e.repeat) return;
          const keyMap = SYNTH_KEYS.find(k => k.char === e.key.toLowerCase());
          if (keyMap) {
              triggerAttack(keyMap.freq, keyMap.note);
          }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
          if (activeTab !== 'SYNTH') return;
          // Only release if the released key matches the active note's char? 
          // For monosynth, simple release is okay, or check key.
          const keyMap = SYNTH_KEYS.find(k => k.char === e.key.toLowerCase());
          if (keyMap) {
              // Only trigger release if we are releasing the current note (simple check)
              triggerRelease();
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, [activeTab, triggerAttack, triggerRelease]);

  return (
    <div className="p-8 space-y-8 pb-32 max-w-6xl mx-auto">
      <div className="flex justify-between items-end border-b-4 border-black pb-4">
        <div>
          <h2 className="text-4xl font-bold text-black mb-2 font-mono">THE_LAB</h2>
          <p className="text-gray-600 font-mono">AUDIO_EXPERIMENTS_&_TOOLS</p>
        </div>
        
        <div className="flex space-x-2">
            {[
                { id: 'MIXER', icon: ICONS.Sliders, label: 'AMBIENT_MIXER' },
                { id: 'SYNTH', icon: ICONS.Piano, label: 'MONOSYNTH' },
                { id: 'EQ', icon: ICONS.Radio, label: 'VISUAL_EQ' }
            ].map(tab => (
                <button
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as any)}
                   className={`px-4 py-2 font-bold font-mono text-xs flex items-center gap-2 border-2 border-black transition-all ${
                       activeTab === tab.id 
                       ? 'bg-black text-white shadow-retro-sm' 
                       : 'bg-white text-black hover:bg-gray-100'
                   }`}
                >
                    <tab.icon size={14} />
                    {tab.label}
                </button>
            ))}
        </div>
      </div>

      {activeTab === 'MIXER' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4">
              {SOUNDS.map(sound => {
                  const vol = volumes[sound.id] || 0;
                  return (
                      <div key={sound.id} className="bg-white border-2 border-black p-6 shadow-retro flex flex-col items-center text-center group">
                          <div className={`w-16 h-16 rounded-full border-2 border-black flex items-center justify-center mb-4 ${sound.bg} ${sound.color}`}>
                              <sound.icon size={32} />
                          </div>
                          <h3 className="font-bold font-mono uppercase mb-6">{sound.label}</h3>
                          
                          <div className="h-40 relative flex items-center justify-center">
                              {/* Custom Vertical Range Input */}
                              <div className="relative w-8 h-32 bg-gray-100 border-2 border-black rounded-full overflow-hidden">
                                  <div 
                                    className="absolute bottom-0 w-full bg-orange-500 transition-all duration-75 ease-out"
                                    style={{ height: `${vol * 100}%` }}
                                  ></div>
                                  <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.01"
                                    value={vol}
                                    onChange={(e) => handleVolumeChange(sound.id, parseFloat(e.target.value))}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none z-10"
                                    {...({ orient: "vertical" } as any)}
                                  />
                              </div>
                          </div>
                          <div className="mt-4 font-mono font-bold text-xs">{Math.round(vol * 100)}%</div>
                      </div>
                  );
              })}
              
              <div className="col-span-full mt-8 bg-black text-white p-4 font-mono text-sm text-center border-2 border-black">
                  <ICONS.Wind className="inline mr-2 animate-pulse" />
                  PRO TIP: Layer these sounds over your music in Focus Mode for maximum immersion.
              </div>
          </div>
      )}

      {activeTab === 'SYNTH' && (
          <div className="bg-white border-2 border-black p-8 shadow-retro flex flex-col items-center animate-in slide-in-from-right-4 select-none">
              <div className="mb-8 w-full flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-4">
                    <div className={`w-4 h-4 rounded-full border border-black ${activeNote ? 'bg-red-500 animate-pulse' : 'bg-red-900'}`}></div>
                    <div>
                        <h3 className="font-bold font-mono text-xl uppercase tracking-widest">MONOSYNTH_V1</h3>
                        <p className="text-[10px] text-gray-500 font-mono">Use Keyboard Keys (A-K) to play</p>
                    </div>
                  </div>

                  {/* Waveform Selector */}
                  <div className="flex bg-gray-100 border-2 border-black p-1">
                      {WAVEFORMS.map(wave => (
                          <button
                            key={wave}
                            onClick={() => setOscType(wave)}
                            className={`px-3 py-1 text-xs font-mono font-bold uppercase transition-colors ${oscType === wave ? 'bg-black text-white' : 'hover:bg-gray-200'}`}
                          >
                              {wave}
                          </button>
                      ))}
                  </div>
              </div>

              {/* Envelope Controls */}
              <div className="w-full grid grid-cols-4 gap-4 mb-8 bg-gray-50 p-4 border-2 border-black border-dashed">
                  {Object.entries(envelope).map(([key, val]) => (
                      <div key={key} className="flex flex-col items-center">
                          <label className="text-[10px] font-bold font-mono uppercase mb-2">{key}</label>
                          <input 
                            type="range" 
                            min="0.01" 
                            max={key === 'sustain' ? "1" : "2"} 
                            step="0.01"
                            value={val}
                            onChange={(e) => setEnvelope(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                            className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-orange-500"
                          />
                          <span className="text-[10px] font-mono mt-1 text-gray-500">{val.toFixed(2)}</span>
                      </div>
                  ))}
              </div>
              
              {/* Keyboard */}
              <div className="relative h-64 w-full max-w-3xl bg-gray-800 p-4 border-t-8 border-gray-600 rounded-b-lg shadow-2xl flex justify-center">
                  <div className="relative flex">
                    {SYNTH_KEYS.map((k) => {
                        const isBlack = k.type === 'black';
                        const isActive = activeNote === k.note;
                        
                        // Calculate position for black keys manually based on offset
                        // White keys are width 60px, Black keys are width 40px positioned absolute
                        const leftPos = k.offset * 60 - (isBlack ? 15 : 0); // rough approximation
                        
                        if (isBlack) {
                             return (
                                <div 
                                    key={k.note}
                                    className="absolute z-20"
                                    style={{ left: (k.offset * 60) + 40 }} // Position relative to previous white key
                                >
                                    <button
                                        onMouseDown={() => triggerAttack(k.freq, k.note)}
                                        onMouseUp={triggerRelease}
                                        onMouseLeave={() => isActive && triggerRelease()}
                                        className={`
                                            w-10 h-36 border-2 border-black border-t-0 rounded-b-lg shadow-md transition-all
                                            ${isActive ? 'bg-orange-500 mt-1' : 'bg-black'}
                                        `}
                                    >
                                        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 font-mono font-bold pointer-events-none">
                                            {k.char.toUpperCase()}
                                        </span>
                                    </button>
                                </div>
                             );
                        }
                        
                        return (
                            <button
                                key={k.note}
                                onMouseDown={() => triggerAttack(k.freq, k.note)}
                                onMouseUp={triggerRelease}
                                onMouseLeave={() => isActive && triggerRelease()}
                                className={`
                                    relative w-[60px] h-56 bg-white border-2 border-black border-t-0 rounded-b-lg -ml-[2px] first:ml-0 z-10 active:bg-gray-100 transition-colors
                                    ${isActive ? '!bg-orange-200 shadow-inner' : 'shadow-md'}
                                `}
                            >
                                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 font-bold font-mono text-gray-400 text-xs pointer-events-none">
                                    {k.note}
                                </span>
                                <span className="absolute bottom-8 left-1/2 -translate-x-1/2 font-bold font-mono text-black text-xs pointer-events-none border border-gray-300 px-1 rounded">
                                    {k.char.toUpperCase()}
                                </span>
                            </button>
                        );
                    })}
                  </div>
              </div>
              
              <div className="mt-8 text-xs font-mono text-gray-500 flex gap-4">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-black"></div> Black Keys</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-white border border-black"></div> White Keys</span>
              </div>
          </div>
      )}

      {activeTab === 'EQ' && (
          <div className="bg-gray-100 border-2 border-black p-12 shadow-retro animate-in slide-in-from-left-4">
               <div className="flex justify-between items-end h-64 px-12 gap-8">
                   {[60, 170, 310, 600, 1000, 3000, 6000, 12000, 16000].map((freq, i) => (
                       <div key={freq} className="flex-1 flex flex-col items-center h-full group">
                           <div className="flex-1 w-2 bg-gray-300 relative rounded-full overflow-hidden">
                               <div 
                                 className="absolute bottom-0 w-full bg-black group-hover:bg-orange-500 transition-colors"
                                 style={{ height: `${40 + Math.random() * 40}%` }}
                               ></div>
                               {/* Slider Knob */}
                               <div 
                                 className="absolute w-6 h-4 bg-white border-2 border-black left-1/2 -translate-x-1/2 shadow-sm cursor-pointer hover:scale-110 transition-transform"
                                 style={{ bottom: `${40 + Math.random() * 40}%` }}
                               ></div>
                           </div>
                           <span className="mt-4 font-mono text-xs font-bold text-gray-500 rotate-45 origin-left translate-y-2">
                               {freq < 1000 ? freq : `${freq/1000}k`}Hz
                           </span>
                       </div>
                   ))}
               </div>
               <p className="text-center mt-12 text-xs font-mono text-gray-500 uppercase tracking-widest">
                   Master Output Equalizer (Visual Simulation)
               </p>
          </div>
      )}
    </div>
  );
};

export default TheLab;