
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ICONS } from '../constants';
import { useLiveSession } from '../hooks/useLiveSession';
import { Song, MusicProvider } from '../types';
import { Type } from '@google/genai';
import { searchUnified } from '../services/musicService';

interface LiveInterfaceProps {
  currentSong: Song | null;
  musicAnalyser?: AnalyserNode | null;
  onPlaySong?: (song: Song) => void;
  spotifyToken?: string | null;
  musicProvider?: MusicProvider;
}

// --- THEME & PERSONALITY CONFIG ---

type BgMode = 'AURORA' | 'GRID' | 'MINIMAL' | 'NOIR';
type VisualizerType = 'ORB_FLUID' | 'TECH_RINGS' | 'RIPPLE' | 'ECLIPSE' | 'VOLTAGE' | 'TESSERACT';

interface Personality {
  id: string;
  name: string;
  icon: any;
  desc: string;
  instruction: string;
  theme: {
    primary: string; // Tailwind color name e.g. 'rose'
    text: string;
    bgMode: BgMode;
    visualizer: VisualizerType;
  };
}

const PERSONALITIES: Personality[] = [
  {
    id: 'EMPATH',
    name: 'The Empath',
    icon: ICONS.Heart,
    desc: 'Warm, organic, and connected.',
    instruction: "You are a warm, empathetic close friend. Focus on emotional connection and comfort. If music is requested, choose tracks that match the emotional depth of the conversation.",
    theme: {
        primary: 'rose',
        text: 'text-rose-100',
        bgMode: 'AURORA',
        visualizer: 'ORB_FLUID',
    }
  },
  {
    id: 'ZEN',
    name: 'Zen Guide',
    icon: ICONS.Wind,
    desc: 'Calm, grounding, and flowing.',
    instruction: "You are a wise Zen guide. Speak slowly, calmly, and with intention. Use metaphors of nature. Help the user find their center.",
    theme: {
        primary: 'emerald',
        text: 'text-emerald-100',
        bgMode: 'AURORA',
        visualizer: 'RIPPLE',
    }
  },
  {
    id: 'DRIFTER',
    name: 'Neon Drifter',
    icon: ICONS.Rocket,
    desc: 'Futuristic, curious, and energetic.',
    instruction: "You are a high-tech voyager from a neon future. Enthusiastic, curious, and sharp. You love synthwave and electronic beats.",
    theme: {
        primary: 'cyan',
        text: 'text-cyan-400',
        bgMode: 'GRID',
        visualizer: 'TECH_RINGS',
    }
  },
  {
    id: 'NOIR',
    name: 'Midnight Noir',
    icon: ICONS.Eye,
    desc: 'Mysterious, shadow, and reflection.',
    instruction: "You are a reflective, slightly cynical but loyal partner in a noir film. Speak concisely. Focus on the mood, the shadows, and the mystery.",
    theme: {
        primary: 'gray',
        text: 'text-gray-300',
        bgMode: 'NOIR',
        visualizer: 'ECLIPSE',
    }
  },
  {
    id: 'HYPE',
    name: 'Hype Coach',
    icon: ICONS.Zap,
    desc: 'Intense, voltage, and power.',
    instruction: "You are a high-energy performance coach. Get the user pumped up! Use short, punchy sentences. Focus on action, winning, and energy.",
    theme: {
        primary: 'orange',
        text: 'text-orange-400',
        bgMode: 'GRID',
        visualizer: 'VOLTAGE',
    }
  },
  {
    id: 'PROFESSOR',
    name: 'The Analyst',
    icon: ICONS.BookOpen,
    desc: 'Precise, geometric, and structural.',
    instruction: "You are a distinguished professor of audio and culture. You are polite, detailed, and knowledgeable. You enjoy explaining the history and theory behind music.",
    theme: {
        primary: 'indigo',
        text: 'text-indigo-200',
        bgMode: 'MINIMAL',
        visualizer: 'TESSERACT',
    }
  }
];

// --- MAIN COMPONENT ---

const LiveInterface: React.FC<LiveInterfaceProps> = ({ 
    currentSong, 
    musicAnalyser, 
    onPlaySong, 
    spotifyToken, 
    musicProvider = 'YOUTUBE' 
}) => {
  const [selectedPid, setSelectedPid] = useState('EMPATH');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  
  // Music Analysis State
  const [musicVolume, setMusicVolume] = useState(0);
  const musicAnimRef = useRef<number | null>(null);
  
  // Animation State
  const [rotation, setRotation] = useState(0);
  const animationFrameRef = useRef<number | null>(null);

  const p = PERSONALITIES.find(x => x.id === selectedPid) || PERSONALITIES[0];

  // Define Tools (Memoized to prevent reconnect loops)
  const tools = useMemo(() => [{
      functionDeclarations: [
        {
          name: "playMusic",
          description: "Search for and play a specific song immediately.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              query: { type: Type.STRING, description: "Song and artist name." }
            },
            required: ["query"]
          }
        }
      ]
  }], []);
  
  const { 
    connect, 
    disconnect, 
    isConnected, 
    isSpeaking, 
    error, 
    volume, 
    startVideo,
    stopVideo,
    isVideoActive,
    videoMode,
    videoStream,
    toggleMute,
    isMuted,
    sendToolResponse,
    transcripts // Now available from hook
  } = useLiveSession({
    systemInstruction: p.instruction,
    tools,
    onToolCall: async (functionCalls) => {
        for (const call of functionCalls) {
            if (call.name === 'playMusic') {
                setStatusMessage(`Searching: "${call.args.query}"`);
                try {
                    const results = await searchUnified(musicProvider as MusicProvider, call.args.query, spotifyToken);
                    if (results.length > 0 && onPlaySong) {
                        onPlaySong(results[0]);
                        sendToolResponse({
                            functionResponses: [{
                                id: call.id,
                                name: call.name, // Required for proper parsing
                                response: { result: `Playing ${results[0].title}` }
                            }]
                        });
                        setStatusMessage(null);
                    } else {
                        sendToolResponse({
                            functionResponses: [{
                                id: call.id,
                                name: call.name, // Required for proper parsing
                                response: { result: "Not found." }
                            }]
                        });
                        setStatusMessage("Not Found");
                    }
                } catch (e) {
                    setStatusMessage("Error");
                }
            }
        }
    }
  });

  // Auto-scroll transcripts
  useEffect(() => {
      if (transcriptRef.current) {
          transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
      }
  }, [transcripts]);

  // Track Music Volume
  useEffect(() => {
      const updateMusicAnalysis = () => {
          if (musicAnalyser) {
              const data = new Uint8Array(musicAnalyser.frequencyBinCount);
              musicAnalyser.getByteFrequencyData(data);
              let sum = 0;
              for (let i = 0; i < data.length; i++) sum += data[i];
              setMusicVolume(sum / data.length);
          }
          musicAnimRef.current = requestAnimationFrame(updateMusicAnalysis);
      };
      updateMusicAnalysis();
      return () => {
          if (musicAnimRef.current) cancelAnimationFrame(musicAnimRef.current);
      };
  }, [musicAnalyser]);

  // Global Rotation Animation Loop
  useEffect(() => {
      const animate = () => {
          setRotation(r => (r + 0.5) % 360);
          animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
      return () => {
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
  }, []);

  useEffect(() => {
    if (previewVideoRef.current && videoStream) {
        previewVideoRef.current.srcObject = videoStream;
    }
  }, [videoStream, isVideoActive]);

  const handleSwitchPersonality = (id: string) => {
      if (isConnected) disconnect();
      setSelectedPid(id);
  };

  // Visualizer Math: Differentiate Speech and Music
  const speechLevel = volume * 2.5; 
  const musicLevel = musicVolume;
  // Mixed active level for scale
  const combinedVol = Math.max(speechLevel, musicLevel);
  const coreScale = 1 + (combinedVol / 150); 
  const pulseOpacity = 0.5 + Math.min(0.5, combinedVol / 100);

  // --- RENDER HELPERS ---

  const renderBackground = () => {
      if (p.theme.bgMode === 'GRID') {
          return (
            <div className="absolute inset-0 pointer-events-none perspective-[1000px]">
               <div className={`absolute inset-0 bg-gradient-to-b from-black via-black to-${p.theme.primary}-900/20`}></div>
               <div className={`absolute -bottom-[50%] -left-[50%] -right-[50%] h-[200%] bg-[linear-gradient(0deg,transparent_24%,rgba(255,255,255,0.05)_25%,rgba(255,255,255,0.05)_26%,transparent_27%,transparent_74%,rgba(255,255,255,0.05)_75%,rgba(255,255,255,0.05)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(255,255,255,0.05)_25%,rgba(255,255,255,0.05)_26%,transparent_27%,transparent_74%,rgba(255,255,255,0.05)_75%,rgba(255,255,255,0.05)_76%,transparent_77%,transparent)] bg-[length:50px_50px] transform rotateX(60deg) animate-[moveGrid_20s_linear_infinite]`}></div>
               <style>{`@keyframes moveGrid { 0% { transform: rotateX(60deg) translateY(0); } 100% { transform: rotateX(60deg) translateY(50px); } }`}</style>
            </div>
          );
      }
      if (p.theme.bgMode === 'AURORA') {
          return (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className={`absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-${p.theme.primary}-500/20 blur-[120px] rounded-full animate-[pulse_8s_infinite]`}></div>
                <div className={`absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-${p.theme.primary}-600/10 blur-[100px] rounded-full animate-[pulse_12s_infinite]`}></div>
            </div>
          );
      }
      if (p.theme.bgMode === 'NOIR') {
          return (
             <div className="absolute inset-0 pointer-events-none bg-neutral-950">
                 <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                 <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-80"></div>
             </div>
          );
      }
      return <div className={`absolute inset-0 bg-gradient-to-b from-gray-900 to-${p.theme.primary}-950`}></div>;
  };

  const renderAvatar = () => {
      // Common particle logic that reacts to both, but different speed/color influence
      const musicInfluence = musicLevel / 2;
      const speechInfluence = speechLevel / 2;

      // 1. EMPATH: Fluid Orb
      if (p.theme.visualizer === 'ORB_FLUID') {
          return (
            <div className="relative w-80 h-80 flex items-center justify-center">
                {/* Speech Aura */}
                <div 
                    className={`absolute inset-0 bg-${p.theme.primary}-400 blur-[80px] opacity-40 transition-all duration-100 ease-out`}
                    style={{ transform: `scale(${1 + speechInfluence/50})` }}
                ></div>
                
                {/* Music Pulse Ring (Distinct color if music active) */}
                {musicLevel > 5 && (
                    <div 
                       className={`absolute inset-[-20px] rounded-full border border-blue-400/30 blur-md`}
                       style={{ transform: `scale(${1 + musicInfluence/80})`, opacity: musicInfluence/100 }}
                    ></div>
                )}

                {/* Speaking Sparkles */}
                {isSpeaking && [...Array(6)].map((_, i) => (
                    <div 
                        key={i}
                        className={`absolute w-1.5 h-1.5 bg-white rounded-full animate-[ping_1.5s_infinite]`}
                        style={{ 
                            top: '50%', left: '50%',
                            transform: `rotate(${i * 60 + rotation}deg) translateX(${60 + speechLevel}px)`,
                            opacity: 0.8,
                            animationDelay: `${i * 0.2}s`
                        }}
                    ></div>
                ))}

                <div 
                    className={`w-48 h-48 bg-gradient-to-tr from-${p.theme.primary}-300 to-${p.theme.primary}-100 opacity-90 transition-all duration-100 ease-out animate-[blob_8s_infinite]`}
                    style={{ 
                        transform: `scale(${coreScale})`,
                        boxShadow: `0 0 ${combinedVol}px rgba(255,255,255,0.5)` 
                    }}
                ></div>
                <style>{`
                    @keyframes blob {
                        0% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
                        50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
                        100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
                    }
                `}</style>
            </div>
          );
      }

      // 2. ZEN: Ripples
      if (p.theme.visualizer === 'RIPPLE') {
          return (
            <div className="relative flex items-center justify-center w-80 h-80">
                {[1, 2, 3, 4].map(i => (
                    <div 
                        key={i} 
                        className={`absolute border rounded-full transition-colors duration-300 ${musicLevel > speechLevel ? 'border-cyan-300/30' : `border-${p.theme.primary}-300/30`}`}
                        style={{ 
                            width: `${100 + (combinedVol * i * 1.8)}px`,
                            height: `${100 + (combinedVol * i * 1.8)}px`,
                            transition: 'all 0.1s ease-out',
                            opacity: Math.max(0, 1 - (combinedVol/80) - (i * 0.2)),
                            transform: `scale(${1 + (combinedVol/400)})`
                        }}
                    ></div>
                ))}
                
                {/* Flowing Particles */}
                {isSpeaking && [...Array(8)].map((_, i) => (
                    <div 
                        key={i}
                        className={`absolute w-1 h-1 bg-${p.theme.primary}-200 rounded-full`}
                        style={{ 
                            top: '50%', left: '50%',
                            transform: `rotate(${i * 45 + rotation/2}deg) translateX(${80 + (speechLevel * 1.5)}px)`,
                            opacity: 0.6,
                            transition: 'transform 0.2s ease-out'
                        }}
                    ></div>
                ))}

                <div className={`w-32 h-32 rounded-full bg-${p.theme.primary}-500/20 backdrop-blur-sm border border-${p.theme.primary}-400/50 flex items-center justify-center z-10`}>
                    <div className={`w-2 h-2 bg-${p.theme.primary}-200 rounded-full shadow-[0_0_20px_currentColor] animate-pulse`}></div>
                </div>
            </div>
          );
      }

      // 3. DRIFTER: Tech Rings
      if (p.theme.visualizer === 'TECH_RINGS') {
          return (
            <div className="relative w-80 h-80 flex items-center justify-center">
                {/* Outer Pulsing Aura */}
                <div 
                    className={`absolute inset-0 rounded-full border border-${p.theme.primary}-500/30`}
                    style={{ 
                        transform: `scale(${coreScale * 1.2})`,
                        opacity: pulseOpacity,
                        transition: 'all 0.05s ease-out'
                    }}
                ></div>

                {/* Spinning Rings - Music speeds up rotation */}
                <div 
                    className={`absolute inset-8 rounded-full border-2 border-${p.theme.primary}-500/50 border-t-transparent animate-[spin_3s_linear_infinite]`}
                    style={{ transform: `scale(${coreScale}) rotate(${rotation + (musicLevel * 2)}deg)` }}
                ></div>
                <div 
                    className={`absolute inset-16 rounded-full border-2 border-${p.theme.primary}-400/30 border-b-transparent animate-[spin_5s_linear_infinite_reverse]`}
                    style={{ transform: `scale(${coreScale * 0.9}) rotate(-${rotation + (musicLevel)}deg)` }}
                ></div>
                
                {/* Data Particles - React to Speech */}
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isSpeaking ? 'opacity-100' : 'opacity-0'}`}>
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className={`absolute w-1 h-1 bg-${p.theme.primary}-300 rounded-full`}
                            style={{
                                transform: `rotate(${i * 30 + rotation * 2}deg) translateX(${120 + speechLevel}px)`,
                                boxShadow: `0 0 5px currentColor`,
                                transition: 'transform 0.1s linear'
                            }}
                        ></div>
                    ))}
                </div>

                <div className={`w-32 h-32 rounded-full bg-${p.theme.primary}-900/50 backdrop-blur-md border border-${p.theme.primary}-500 flex items-center justify-center overflow-hidden relative z-10`}>
                    <div className={`w-full h-[1px] bg-${p.theme.primary}-400 absolute top-1/2`}></div>
                    <div 
                        className={`w-full h-full bg-${p.theme.primary}-500 opacity-20 transition-all duration-75`}
                        style={{ height: `${Math.min(100, combinedVol)}%` }}
                    ></div>
                </div>
            </div>
          );
      }

      // 4. NOIR: Eclipse
      if (p.theme.visualizer === 'ECLIPSE') {
          return (
             <div className="relative w-72 h-72 flex items-center justify-center">
                 {/* Outer Glow (Rim Light) - Music makes it flash brighter */}
                 <div 
                    className={`absolute inset-0 rounded-full bg-white opacity-0 transition-opacity duration-100`}
                    style={{ 
                        opacity: combinedVol > 10 ? combinedVol / 100 : 0,
                        boxShadow: `0 0 ${40 + combinedVol}px rgba(255,255,255,0.2)`
                    }}
                 ></div>
                 
                 {/* Particles - Speech driven */}
                 {isSpeaking && [...Array(20)].map((_, i) => (
                     <div 
                        key={i}
                        className="absolute w-[2px] h-[2px] bg-white rounded-full opacity-50"
                        style={{
                            transform: `rotate(${Math.random() * 360}deg) translateX(${140 + Math.random() * 20}px)`,
                            opacity: (speechLevel / 100) * Math.random()
                        }}
                     ></div>
                 ))}

                 {/* The Shadow Body */}
                 <div className="w-48 h-48 bg-black rounded-full border border-gray-800 relative z-10 shadow-2xl flex items-center justify-center overflow-hidden">
                     <div className="absolute inset-0 rounded-full opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,#333_3px)]"></div>
                 </div>
                 {/* Back Light */}
                 <div className="absolute w-52 h-52 bg-white rounded-full blur-xl -z-10 opacity-10"></div>
             </div>
          );
      }

      // 5. HYPE: Voltage
      if (p.theme.visualizer === 'VOLTAGE') {
          return (
              <div className="relative flex items-center justify-center gap-2 h-64">
                  {[...Array(5)].map((_, i) => (
                      <div 
                        key={i}
                        className={`w-8 shadow-[0_0_15px_rgba(249,115,22,0.5)] transition-all duration-75 ease-out ${musicLevel > 20 ? 'bg-orange-300' : `bg-${p.theme.primary}-500`}`}
                        style={{ 
                            height: `${Math.max(20, combinedVol * (Math.random() + 0.5) * 3)}px`,
                            opacity: 0.8
                        }}
                      ></div>
                  ))}
                  {isSpeaking && (
                      <div className="absolute inset-0 flex items-center justify-center">
                          <div className={`w-full h-1 bg-${p.theme.primary}-400 blur-md animate-pulse opacity-50`}></div>
                      </div>
                  )}
              </div>
          );
      }

      // 6. ANALYST: Tesseract
      if (p.theme.visualizer === 'TESSERACT') {
          return (
              <div className="perspective-[800px] w-64 h-64 flex items-center justify-center">
                  <div 
                    className={`relative w-32 h-32 transform-style-3d`}
                    style={{ transform: `rotateX(${combinedVol + rotation}deg) rotateY(${combinedVol + rotation}deg)` }}
                  >
                      <div className={`absolute inset-0 border-2 border-${p.theme.primary}-400 bg-${p.theme.primary}-900/20`}></div>
                      <div className={`absolute inset-0 border-2 border-${p.theme.primary}-400 bg-${p.theme.primary}-900/20 translate-z-16`} style={{ transform: 'translateZ(32px)' }}></div>
                      <div className={`absolute inset-0 border-2 border-${p.theme.primary}-400 bg-${p.theme.primary}-900/20 -translate-z-16`} style={{ transform: 'translateZ(-32px)' }}></div>
                      {/* Inner Core - Reacts to Speech */}
                      <div 
                        className={`absolute top-1/2 left-1/2 w-12 h-12 -translate-x-1/2 -translate-y-1/2 bg-${p.theme.primary}-500 shadow-[0_0_20px_currentColor] transition-all`}
                        style={{ opacity: 0.5 + (speechLevel / 100), transform: `translate(-50%, -50%) scale(${1 + musicLevel/50})` }}
                      ></div>
                  </div>
                  
                  {isSpeaking && (
                      <div className="absolute inset-0 border border-dashed border-white/20 rounded-full animate-spin-slow pointer-events-none"></div>
                  )}
              </div>
          );
      }

      return null;
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-black text-white font-sans transition-colors duration-700">
       
       {renderBackground()}

       {/* Top Bar */}
       <div className="relative z-10 p-6 flex justify-between items-start">
           <div className="flex flex-col gap-4">
               {/* Personality Selector */}
               <div className="flex flex-wrap gap-2">
                   {PERSONALITIES.map(pers => (
                       <button
                         key={pers.id}
                         onClick={() => handleSwitchPersonality(pers.id)}
                         className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border
                            ${selectedPid === pers.id 
                                ? `bg-${pers.theme.primary}-500/20 border-${pers.theme.primary}-400 text-${pers.theme.primary}-100 shadow-[0_0_15px_rgba(0,0,0,0.3)]` 
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                            }
                         `}
                       >
                           <pers.icon size={12} />
                           {pers.name}
                       </button>
                   ))}
               </div>
               {/* Current Status */}
               {!isConnected && (
                   <div className={`text-${p.theme.primary}-200 text-sm font-medium animate-in fade-in slide-in-from-left-2`}>
                       {p.desc}
                   </div>
               )}
           </div>

           {/* Video Preview (Draggable-ish look) */}
           {isVideoActive && (
               <div className={`w-48 aspect-video bg-black/50 border border-${p.theme.primary}-500/30 rounded-lg overflow-hidden relative shadow-lg`}>
                   <video ref={previewVideoRef} autoPlay muted playsInline className="w-full h-full object-cover opacity-80" />
                   <button onClick={stopVideo} className="absolute top-2 right-2 text-white hover:text-red-400"><ICONS.Close size={12} /></button>
                   <div className="absolute bottom-2 left-2 text-[8px] uppercase tracking-widest text-white/50">Feed Active</div>
               </div>
           )}
       </div>

       {/* Center Content - THE AVATAR STAGE */}
       <div className="flex-1 relative flex flex-col items-center justify-center p-8 z-10">
           {!isConnected ? (
               <div className="flex flex-col items-center gap-8 animate-in zoom-in duration-500">
                   <div className={`relative group cursor-pointer`} onClick={connect}>
                       <div className={`absolute inset-0 bg-${p.theme.primary}-500 blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-1000`}></div>
                       <div className={`w-32 h-32 rounded-full border-2 border-${p.theme.primary}-500/50 flex items-center justify-center bg-black/20 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300 shadow-[0_0_30px_rgba(0,0,0,0.5)]`}>
                           <ICONS.Power size={48} className={`text-${p.theme.primary}-200`} />
                       </div>
                   </div>
                   <h2 className={`text-4xl font-light tracking-wide text-${p.theme.primary}-100 uppercase`}>
                       Initialize <span className="font-bold">{p.name}</span>
                   </h2>
                   {error && <p className="text-red-400 text-sm bg-red-950/50 px-4 py-2 rounded">{error}</p>}
               </div>
           ) : (
               <div className="w-full h-full flex flex-col items-center justify-center relative">
                   {/* Status Pill */}
                   {statusMessage && (
                       <div className={`absolute top-0 bg-${p.theme.primary}-950/80 border border-${p.theme.primary}-500/30 px-6 py-2 rounded-full text-xs text-${p.theme.primary}-200 animate-in slide-in-from-top-2 tracking-widest uppercase font-bold flex items-center gap-2`}>
                           <span className="w-2 h-2 bg-current rounded-full animate-pulse"></span>
                           {statusMessage}
                       </div>
                   )}

                   {/* Main Visualizer Avatar */}
                   <div className="flex-1 flex items-center justify-center w-full transform transition-all duration-500">
                       {renderAvatar()}
                   </div>
                   
                   {/* Live Transcripts HUD */}
                   {transcripts.length > 0 && (
                       <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 pointer-events-none">
                           <div className="flex flex-col gap-2 items-center text-center">
                               {/* Show last 2 transcripts for context */}
                               {transcripts.slice(-2).map((msg, i) => (
                                   <div 
                                     key={i}
                                     className={`px-4 py-2 rounded-xl backdrop-blur-md border border-white/5 text-sm font-mono tracking-wide max-w-lg transition-all duration-300
                                        ${msg.role === 'model' 
                                            ? `bg-${p.theme.primary}-900/40 text-${p.theme.primary}-100 border-${p.theme.primary}-500/20` 
                                            : 'bg-gray-800/40 text-gray-200'}
                                        ${!msg.isFinal ? 'animate-pulse' : ''}
                                     `}
                                   >
                                       <span className="opacity-50 text-xs uppercase mr-2">{msg.role === 'model' ? 'AI' : 'YOU'}</span>
                                       {msg.text}
                                       {!msg.isFinal && <span className="inline-block w-2 h-4 bg-current ml-1 animate-blink align-middle"></span>}
                                   </div>
                               ))}
                           </div>
                       </div>
                   )}

                   {/* Listener State Indicator (If no transcript) */}
                   {transcripts.length === 0 && (
                       <div className={`text-${p.theme.primary}-400/50 text-[10px] font-bold tracking-[0.3em] uppercase animate-pulse mb-20`}>
                           {isSpeaking ? "TRANSMITTING" : "LISTENING..."}
                       </div>
                   )}
               </div>
           )}
       </div>

       {/* Bottom Controls */}
       {isConnected && (
           <div className="relative z-20 p-8 flex justify-center items-center gap-6 bg-gradient-to-t from-black via-black/80 to-transparent">
               <button 
                 onClick={toggleMute} 
                 className={`w-16 h-16 flex items-center justify-center rounded-full transition-all duration-300 ${isMuted ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500' : 'bg-white/10 hover:bg-white/20 text-white'}`}
               >
                   {isMuted ? <ICONS.MicOff size={24} /> : <ICONS.Mic size={24} />}
               </button>
               
               <div className="h-12 w-px bg-white/10"></div>
               
               <button 
                 onClick={() => isVideoActive ? stopVideo() : startVideo('camera')}
                 className={`w-14 h-14 flex items-center justify-center rounded-full transition-all ${isVideoActive ? `bg-${p.theme.primary}-500/20 text-${p.theme.primary}-300 ring-1 ring-${p.theme.primary}-500` : 'bg-white/10 hover:bg-white/20 text-white'}`}
               >
                   <ICONS.Image size={20} />
               </button>
               
               <button 
                 onClick={() => isVideoActive && videoMode === 'screen' ? stopVideo() : startVideo('screen')}
                 className="w-14 h-14 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
               >
                   <ICONS.ScreenShare size={20} />
               </button>
               
               <button 
                 onClick={disconnect} 
                 className="ml-4 px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full text-xs tracking-widest uppercase transition-colors shadow-lg"
               >
                   Terminate
               </button>
           </div>
       )}
    </div>
  );
};

export default LiveInterface;
