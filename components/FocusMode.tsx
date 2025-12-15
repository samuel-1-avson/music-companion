
import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { Song, MusicProvider } from '../types';
import { consultFocusAgent } from '../services/geminiService';
import { searchUnified } from '../services/musicService';
import { useLiveSession } from '../hooks/useLiveSession';
import { Type } from '@google/genai';

interface FocusModeProps {
  currentSong: Song | null;
  onExit: () => void;
  isPlaying: boolean;
  togglePlay: () => void;
  onNext: (song?: Song) => void;
  spotifyToken?: string | null;
  musicProvider?: MusicProvider;
}

type VisualMode = 
  | 'NEBULA' 
  | 'GRID_RUNNER' 
  | 'BINARY_RAIN' 
  | 'WARP_SPEED' 
  | 'CYMATIC' 
  | 'VOID_GAZE' 
  | 'ZEN_FLOW' 
  | 'DATA_STREAM' 
  | 'PULSE_CORE' 
  | 'RETRO_CONSOLE';

const VISUAL_MODES: VisualMode[] = [
  'PULSE_CORE', 'GRID_RUNNER', 'BINARY_RAIN', 'WARP_SPEED', 'CYMATIC', 
  'VOID_GAZE', 'ZEN_FLOW', 'NEBULA', 'DATA_STREAM', 'RETRO_CONSOLE'
];

interface Task {
  id: number;
  text: string;
  completed: boolean;
}

interface PendingAction {
    type: 'CHANGE_MUSIC' | 'TAKE_BREAK' | 'ADD_TASK';
    query?: string;
    task?: string;
}

const FocusMode: React.FC<FocusModeProps> = ({ currentSong, onExit, isPlaying, togglePlay, onNext, spotifyToken, musicProvider }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60); 
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [mode, setMode] = useState<'FOCUS' | 'BREAK'>('FOCUS');
  
  const [visualMode, setVisualMode] = useState<VisualMode>('PULSE_CORE');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Mouse Idle State
  const [isUIVisible, setIsUIVisible] = useState(true);
  const mouseTimerRef = useRef<number | null>(null);

  // Agent State
  const [agentInput, setAgentInput] = useState('');
  const [agentResponse, setAgentResponse] = useState<string | null>(null);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [showAgentInput, setShowAgentInput] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Tasks
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('focus_tasks');
        return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [newTask, setNewTask] = useState('');
  const [showTasks, setShowTasks] = useState(false);
  const tasksRef = useRef(tasks);

  useEffect(() => {
    localStorage.setItem('focus_tasks', JSON.stringify(tasks));
    tasksRef.current = tasks;
  }, [tasks]);

  const addTask = (text: string) => {
    if (!text.trim()) return;
    setTasks(prev => [...prev, { id: Date.now(), text: text.trim(), completed: false }]);
  };

  const toggleTask = (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // --- LIVE AI ---
  const tools = [
    {
      functionDeclarations: [
        {
          name: "playMusic",
          description: "Play music.",
          parameters: {
            type: Type.OBJECT,
            properties: { query: { type: Type.STRING } },
            required: ["query"]
          }
        },
        {
          name: "addTask",
          description: "Add a task.",
          parameters: {
            type: Type.OBJECT,
            properties: { task: { type: Type.STRING } },
            required: ["task"]
          }
        },
        {
          name: "getTasks",
          description: "Read tasks.",
          parameters: { type: Type.OBJECT, properties: {} }
        },
        {
          name: "changeVisual",
          description: "Change the visual background style.",
          parameters: {
                type: Type.OBJECT,
                properties: { mode: { type: Type.STRING, enum: VISUAL_MODES } },
                required: ["mode"]
          }
        }
      ]
    }
  ];

  const { connect, disconnect, isConnected, isSpeaking, volume, sendToolResponse } = useLiveSession({
    systemInstruction: `You are Melody, an advanced AI Focus Coach. Your voice is calm, precise, and encouraging. You help the user maintain deep work states. Be concise.`,
    tools,
    onToolCall: async (functionCalls) => {
        for (const call of functionCalls) {
            if (call.name === 'playMusic') {
                const songs = await searchUnified(musicProvider || 'YOUTUBE', call.args.query, spotifyToken);
                if (songs.length > 0) {
                    onNext(songs[0]);
                    sendToolResponse({ functionResponses: [{ 
                        response: { result: "ok" }, 
                        id: call.id,
                        name: call.name 
                    }] });
                } else {
                    sendToolResponse({ functionResponses: [{ 
                        response: { result: "song not found" }, 
                        id: call.id,
                        name: call.name 
                    }] });
                }
            } else if (call.name === 'addTask') {
                addTask(call.args.task);
                setShowTasks(true);
                sendToolResponse({ functionResponses: [{ 
                    response: { result: "ok" }, 
                    id: call.id,
                    name: call.name 
                }] });
            } else if (call.name === 'changeVisual') {
                setVisualMode(call.args.mode as VisualMode);
                sendToolResponse({ functionResponses: [{ 
                    response: { result: "ok" }, 
                    id: call.id,
                    name: call.name 
                }] });
            } else if (call.name === 'getTasks') {
                const txt = tasksRef.current.map(t => t.text).join(', ');
                sendToolResponse({ functionResponses: [{ 
                    response: { result: txt }, 
                    id: call.id,
                    name: call.name 
                }] });
            }
        }
    }
  });

  const volumeRef = useRef(0);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  // --- VISUALIZATION ENGINE ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    let time = 0;
    
    // State containers for visualizers
    const stars: any[] = Array.from({length: 400}, () => ({
        x: Math.random() * width - width/2, 
        y: Math.random() * height - height/2, 
        z: Math.random() * width
    }));
    
    const rainDrops: any[] = Array.from({length: Math.floor(width/15)}, () => ({
        y: Math.random() * height,
        speed: Math.random() * 5 + 2,
        chars: Array.from({length: 15}, () => String.fromCharCode(0x30A0 + Math.random() * 96))
    }));

    const render = () => {
      // Use raw volume for reactivity
      const vol = volumeRef.current; 
      // Smoothed volume factor (0.0 to ~2.0)
      const vFac = vol / 20; 
      
      time += 0.01 + (vFac * 0.01); // Time moves faster with sound

      const cx = width / 2;
      const cy = height / 2;

      // 1. CLEAR
      if (visualMode === 'BINARY_RAIN' || visualMode === 'RETRO_CONSOLE') {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // Trail effect
          ctx.fillRect(0, 0, width, height);
      } else {
          ctx.fillStyle = '#050505';
          ctx.fillRect(0, 0, width, height);
      }

      // --- VISUAL MODES ---

      if (visualMode === 'PULSE_CORE') {
          const rBase = Math.min(width, height) * 0.2;
          const rPulse = rBase + (vol * 4);
          
          // Outer Glow
          const g = ctx.createRadialGradient(cx, cy, rBase * 0.5, cx, cy, rPulse * 2);
          g.addColorStop(0, mode === 'FOCUS' ? 'rgba(255, 100, 50, 0.8)' : 'rgba(50, 200, 255, 0.8)');
          g.addColorStop(0.5, mode === 'FOCUS' ? 'rgba(100, 0, 0, 0.2)' : 'rgba(0, 50, 100, 0.2)');
          g.addColorStop(1, 'transparent');
          
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, rPulse * 2, 0, Math.PI * 2);
          ctx.fill();

          // Core Rings
          ctx.strokeStyle = mode === 'FOCUS' ? '#ffaa55' : '#55aaff';
          ctx.lineWidth = 2;
          
          for(let i=0; i<3; i++) {
              ctx.beginPath();
              const offset = Math.sin(time * 2 + i) * 10;
              ctx.arc(cx, cy, rBase + (vol * 2) + (i * 20) + offset, 0, Math.PI*2);
              ctx.stroke();
          }
      }

      else if (visualMode === 'GRID_RUNNER') {
          // Retro Sun
          const sunGrad = ctx.createLinearGradient(0, 0, 0, height);
          sunGrad.addColorStop(0, '#ff00cc');
          sunGrad.addColorStop(0.5, '#330099');
          sunGrad.addColorStop(1, '#000');
          
          ctx.fillStyle = sunGrad;
          ctx.fillRect(0,0,width,height);

          // Grid Floor
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 1;
          const horizon = height * 0.5;
          const gridSpeed = (time * 200) % 100;
          
          ctx.beginPath();
          // Vertical lines (Perspective)
          for(let i=-width; i<width*2; i+=80) {
              ctx.moveTo(i, height);
              ctx.lineTo(cx + (i-cx)*0.1, horizon);
          }
          // Horizontal lines (Moving)
          for(let i=0; i<height-horizon; i+=20) {
              // Actually simpler: just draw static perspective lines and moving horizontals
              const yPos = horizon + (i * 10 + (time * 100) % 40); 
              if(yPos < height) {
                  ctx.moveTo(0, yPos);
                  ctx.lineTo(width, yPos);
              }
          }
          ctx.stroke();
          
          // Reactivity: Sun Pulse
          ctx.fillStyle = 'rgba(255, 200, 0, 0.5)';
          ctx.beginPath();
          ctx.arc(cx, horizon - 50, 60 + (vol), 0, Math.PI * 2);
          ctx.fill();
      }

      else if (visualMode === 'BINARY_RAIN') {
          ctx.fillStyle = '#0F0';
          ctx.font = '14px monospace';
          
          rainDrops.forEach((drop, i) => {
              // Draw characters
              drop.chars.forEach((char: string, j: number) => {
                  const alpha = 1 - (j / drop.chars.length);
                  ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
                  if (j === 0) ctx.fillStyle = '#FFF'; // Head is white
                  ctx.fillText(char, i * 16, drop.y - j * 16);
              });
              
              drop.y += drop.speed + vFac;
              if (drop.y > height + 300) {
                  drop.y = 0;
                  drop.chars = Array.from({length: 15}, () => String.fromCharCode(0x30A0 + Math.random() * 96));
              }
          });
      }

      else if (visualMode === 'WARP_SPEED') {
          ctx.fillStyle = '#FFF';
          const speed = 10 + (vol * 2);
          
          stars.forEach(star => {
              star.z -= speed;
              if (star.z <= 0) {
                  star.z = width;
                  star.x = Math.random() * width - cx;
                  star.y = Math.random() * height - cy;
              }
              
              const k = 128.0 / star.z;
              const px = star.x * k + cx;
              const py = star.y * k + cy;
              
              if (px >= 0 && px <= width && py >= 0 && py <= height) {
                  const size = (1 - star.z / width) * 4;
                  const tailX = (px - cx) * (vFac * 0.1); // Motion blur tail
                  const tailY = (py - cy) * (vFac * 0.1);
                  
                  ctx.beginPath();
                  ctx.moveTo(px, py);
                  ctx.lineTo(px - tailX, py - tailY);
                  ctx.strokeStyle = `rgba(255, 255, 255, ${1 - star.z/width})`;
                  ctx.lineWidth = size;
                  ctx.stroke();
              }
          });
      }

      else if (visualMode === 'CYMATIC') {
          ctx.translate(cx, cy);
          const symmetry = 12;
          const radius = Math.min(width, height) * 0.4;
          
          ctx.strokeStyle = mode === 'FOCUS' ? `hsl(${time * 50}, 70%, 50%)` : `hsl(${200 + time * 20}, 80%, 60%)`;
          ctx.lineWidth = 2;
          
          for (let i = 0; i < symmetry; i++) {
              ctx.rotate((Math.PI * 2) / symmetry);
              ctx.beginPath();
              
              // Wave function
              for (let x = 0; x < radius; x += 5) {
                  const y = Math.sin(x * 0.05 - time * 2) * (20 + vol);
                  ctx.lineTo(x, y);
              }
              ctx.stroke();
          }
          ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
      }

      else if (visualMode === 'VOID_GAZE') {
          const r = 100 + (vol * 2);
          
          // Accretion Disk
          const diskGrad = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 3);
          diskGrad.addColorStop(0, '#000');
          diskGrad.addColorStop(0.1, '#fff');
          diskGrad.addColorStop(0.4, mode === 'FOCUS' ? '#ff4400' : '#4400ff');
          diskGrad.addColorStop(1, 'transparent');
          
          ctx.fillStyle = diskGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, r * 3, 0, Math.PI * 2);
          ctx.fill();

          // Event Horizon (Black Hole)
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          
          // Photon Ring
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
          ctx.stroke();
      }

      else if (visualMode === 'ZEN_FLOW') {
          // Smooth sine waves
          ctx.lineWidth = 1;
          const lines = 20;
          const step = height / lines;
          
          for(let i=0; i<lines; i++) {
              const yBase = i * step + (step/2);
              ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + (i/lines) * 0.5})`;
              ctx.beginPath();
              for(let x=0; x<width; x+=10) {
                  const yOffset = Math.sin(x * 0.01 + time + i) * (20 + vol);
                  ctx.lineTo(x, yBase + yOffset);
              }
              ctx.stroke();
          }
      }

      else if (visualMode === 'NEBULA') {
          // Multi-layer gradients moving in Lissajous patterns
          for(let i=0; i<3; i++) {
              const x = cx + Math.sin(time * 0.5 + i) * (width * 0.3);
              const y = cy + Math.cos(time * 0.3 + i) * (height * 0.3);
              const r = 300 + (vol * 5);
              
              const g = ctx.createRadialGradient(x, y, 0, x, y, r);
              g.addColorStop(0, i===0 ? 'rgba(255,0,100,0.2)' : i===1 ? 'rgba(0,100,255,0.2)' : 'rgba(100,255,0,0.2)');
              g.addColorStop(1, 'transparent');
              
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.arc(x, y, r, 0, Math.PI * 2);
              ctx.fill();
          }
      }

      else if (visualMode === 'DATA_STREAM') {
          // Bar graphs and numbers
          ctx.fillStyle = '#0f0';
          ctx.font = '10px monospace';
          
          const cols = Math.floor(width / 40);
          for(let i=0; i<cols; i++) {
              const h = Math.random() * 100 + (vol * 2);
              const x = i * 40;
              const y = height / 2;
              
              // Top bar
              ctx.fillRect(x + 10, y - h, 20, h);
              // Bottom bar (mirror)
              ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
              ctx.fillRect(x + 10, y, 20, h);
              ctx.fillStyle = '#0f0';
              
              // Number
              ctx.fillText(Math.floor(Math.random()*99).toString(), x + 10, y - h - 5);
          }
          
          // Scanline
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
          ctx.beginPath();
          ctx.moveTo(0, (time * 100) % height);
          ctx.lineTo(width, (time * 100) % height);
          ctx.stroke();
      }

      else if (visualMode === 'RETRO_CONSOLE') {
          // CRT Effect with text
          ctx.fillStyle = '#ff8800'; // Amber phosphor
          ctx.font = '20px monospace';
          
          const logs = [
              "SYSTEM_READY...",
              `AUDIO_INPUT: ${vol.toFixed(2)} dB`,
              `MODE: ${mode}`,
              "EXECUTING MAIN LOOP...",
              "MEMORY_OK",
              `TIME_DELTA: ${(time).toFixed(4)}`
          ];
          
          logs.forEach((text, i) => {
              ctx.fillText(text, 50, 100 + (i * 30));
          });
          
          // Scanlines
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          for(let y=0; y<height; y+=4) {
              ctx.fillRect(0, y, width, 2);
          }
          
          // Vignette
          const g = ctx.createRadialGradient(cx, cy, height * 0.4, cx, cy, height * 0.8);
          g.addColorStop(0, 'transparent');
          g.addColorStop(1, 'black');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, width, height);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [visualMode, mode, isTimerRunning]);

  // --- LOGIC ---
  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);
  
  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(mode === 'FOCUS' ? 25 * 60 : 5 * 60);
    setAgentResponse(null);
  };

  const handleAgentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!agentInput.trim()) return;
      
      const query = agentInput;
      setAgentInput('');
      setIsAgentThinking(true);
      
      try {
          const result = await consultFocusAgent(query, mode);
          setAgentResponse(result.reply);
          if (result.suggestedAction === 'ADD_TASK' && result.task) addTask(result.task);
          if (result.suggestedAction === 'CHANGE_MUSIC' && result.musicQuery) {
              setPendingAction({ type: 'CHANGE_MUSIC', query: result.musicQuery });
          }
          setTimeout(() => setAgentResponse(null), 8000);
      } finally {
          setIsAgentThinking(false);
          setShowAgentInput(false);
      }
  };

  const executePendingAction = async () => {
      if (!pendingAction) return;
      setPendingAction(null);
      if (pendingAction.type === 'CHANGE_MUSIC' && pendingAction.query) {
          const songs = await searchUnified('YOUTUBE', pendingAction.query);
          if (songs.length > 0) onNext(songs[0]);
      }
  };

  // Timer Tick
  useEffect(() => {
    let interval: number;
    if (isTimerRunning && timeLeft > 0) {
      interval = window.setInterval(() => setTimeLeft(p => p - 1), 1000);
    } else if (timeLeft === 0) setIsTimerRunning(false);
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  // Mouse Interaction
  useEffect(() => {
      const handleMouseMove = () => {
          setIsUIVisible(true);
          if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
          mouseTimerRef.current = window.setTimeout(() => {
              if (!showAgentInput && !showTasks && isTimerRunning) setIsUIVisible(false);
          }, 3000);
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
      };
  }, [showAgentInput, showTasks, isTimerRunning]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black text-gray-200 font-mono overflow-hidden cursor-crosshair select-none">
       
       <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
       
       {/* Vignette Overlay for Focus */}
       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] pointer-events-none"></div>

       {/* --- TOP BAR (HUD) --- */}
       <div className={`absolute top-0 left-0 right-0 p-6 flex justify-between items-start transition-opacity duration-500 z-30 ${isUIVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-[10px] tracking-widest uppercase text-gray-300 font-bold">SYSTEM: {isConnected ? "ONLINE" : "OFFLINE"}</span>
                  {isSpeaking && <span className="text-[10px] text-orange-400 font-bold animate-pulse ml-2">VOICE_ACTIVE</span>}
              </div>
              
              <div className="flex gap-2 mt-2">
                  <select 
                    value={visualMode} 
                    onChange={(e) => setVisualMode(e.target.value as VisualMode)}
                    className="bg-black/40 backdrop-blur-md border border-white/10 text-[10px] px-3 py-1.5 uppercase hover:border-orange-500 focus:outline-none rounded text-gray-300 font-bold"
                  >
                      {VISUAL_MODES.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                  </select>
                  <select 
                    value={mode} 
                    onChange={(e) => {
                        const newMode = e.target.value as 'FOCUS' | 'BREAK';
                        setMode(newMode);
                        setTimeLeft(newMode === 'FOCUS' ? 25 * 60 : 5 * 60);
                        setIsTimerRunning(false);
                    }}
                    className="bg-black/40 backdrop-blur-md border border-white/10 text-[10px] px-3 py-1.5 uppercase hover:border-blue-500 focus:outline-none rounded text-gray-300 font-bold"
                  >
                      <option value="FOCUS">DEEP WORK</option>
                      <option value="BREAK">RECOVERY</option>
                  </select>
              </div>
          </div>
          
          <button onClick={() => { disconnect(); onExit(); }} className="bg-black/40 backdrop-blur-md p-3 rounded-full border border-white/10 hover:bg-red-900/50 hover:border-red-500 transition-colors text-white">
              <ICONS.Close size={20} />
          </button>
       </div>

       {/* --- CENTER STAGE --- */}
       <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 transition-all duration-700 ${isUIVisible ? 'scale-100' : 'scale-105'}`}>
           
           {/* Agent Response Toast */}
           {agentResponse && (
               <div className="absolute top-24 z-40 bg-black/80 border-l-4 border-orange-500 px-6 py-4 max-w-lg backdrop-blur-xl shadow-2xl animate-in slide-in-from-top-4">
                   <p className="text-xs font-bold text-orange-500 mb-1 uppercase tracking-widest">AI Coach</p>
                   <p className="text-lg leading-tight font-sans text-white">{agentResponse}</p>
                   {pendingAction && (
                       <button onClick={executePendingAction} className="mt-3 bg-orange-600 text-white px-4 py-2 text-xs font-bold hover:bg-orange-500 transition-colors uppercase rounded shadow-lg">
                           Execute: {pendingAction.type.replace('_', ' ')}
                       </button>
                   )}
               </div>
           )}

           {/* MAIN TIMER */}
           <div className="text-center group relative">
               <div 
                 className={`text-[8rem] md:text-[12rem] leading-none font-thin tracking-tighter transition-all duration-1000 select-none ${isTimerRunning ? 'text-white' : 'text-gray-500'} ${mode === 'BREAK' ? 'text-blue-200' : ''}`}
                 style={{ 
                     textShadow: isTimerRunning ? '0 0 40px rgba(255,255,255,0.3)' : 'none',
                     filter: isTimerRunning ? 'blur(0px)' : 'blur(1px)'
                 }}
               >
                   {formatTime(timeLeft)}
               </div>
               
               {/* Floating Controls */}
               <div className={`flex items-center justify-center gap-6 mt-8 transition-all duration-500 ${isUIVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                   <button 
                     onClick={toggleTimer} 
                     className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                   >
                       {isTimerRunning ? <ICONS.Pause size={32} fill="black" /> : <ICONS.Play size={32} fill="black" className="ml-1" />}
                   </button>
                   
                   <button 
                     onClick={resetTimer} 
                     className="w-12 h-12 rounded-full border border-white/20 hover:bg-white/10 flex items-center justify-center transition-colors text-white"
                     title="Reset Timer"
                   >
                       <ICONS.Box size={20} />
                   </button>
                   
                   <button 
                     onClick={() => setShowAgentInput(true)} 
                     className="w-12 h-12 rounded-full border border-orange-500/50 text-orange-500 hover:bg-orange-500 hover:text-white flex items-center justify-center transition-colors"
                     title="AI Command"
                   >
                       <ICONS.Terminal size={20} />
                   </button>
               </div>
           </div>
           
           {/* Floating Input */}
           {showAgentInput && (
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl z-50 animate-in fade-in zoom-in duration-200">
                   <div className="bg-black/90 border border-orange-500/50 backdrop-blur-2xl rounded-xl shadow-2xl overflow-hidden p-1">
                       <form onSubmit={handleAgentSubmit} className="relative flex items-center">
                           <ICONS.Terminal className="ml-4 text-orange-500" size={20} />
                           <input 
                             autoFocus
                             type="text" 
                             value={agentInput}
                             onChange={e => setAgentInput(e.target.value)}
                             placeholder="Ask Melody to change music, add tasks, or pause..."
                             className="w-full bg-transparent text-white px-4 py-4 font-mono text-lg focus:outline-none placeholder-gray-600"
                             onBlur={() => !agentInput && setShowAgentInput(false)}
                           />
                           {isAgentThinking && <ICONS.Loader className="mr-4 animate-spin text-orange-500" size={20} />}
                       </form>
                   </div>
               </div>
           )}
       </div>

       {/* --- RIGHT PANEL (TASKS) --- */}
       <div className={`absolute right-6 top-24 bottom-24 w-72 transition-all duration-500 z-20 ${showTasks || isUIVisible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0 pointer-events-none'}`}>
           <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl h-full flex flex-col overflow-hidden shadow-2xl">
               <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                   <h3 className="text-xs font-bold uppercase tracking-widest text-white/70 flex items-center gap-2">
                       <ICONS.CheckSquare size={12} /> Objectives
                   </h3>
                   <div className="text-[10px] font-mono text-gray-500">{tasks.filter(t => t.completed).length}/{tasks.length}</div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-2 space-y-1">
                   {tasks.length === 0 && (
                       <div className="text-center mt-10 opacity-30 text-xs font-mono">NO_ACTIVE_TASKS</div>
                   )}
                   {tasks.map(t => (
                       <div key={t.id} className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors relative">
                           <button 
                             onClick={() => toggleTask(t.id)} 
                             className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${t.completed ? 'bg-green-500 border-green-500' : 'border-gray-500 hover:border-white'}`}
                           >
                               {t.completed && <ICONS.Check size={10} className="text-black" />}
                           </button>
                           <span className={`text-sm leading-tight flex-1 ${t.completed ? 'line-through text-gray-600' : 'text-gray-200'}`}>{t.text}</span>
                           <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 transition-opacity">
                               <ICONS.Close size={12} />
                           </button>
                       </div>
                   ))}
               </div>

               <form onSubmit={e => { e.preventDefault(); addTask(newTask); setNewTask(''); }} className="p-3 border-t border-white/10 bg-white/5">
                   <input 
                     type="text" 
                     value={newTask} 
                     onChange={e => setNewTask(e.target.value)} 
                     placeholder="+ Add Task"
                     className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-gray-600"
                   />
               </form>
           </div>
       </div>

       {/* --- BOTTOM BAR (MEDIA) --- */}
       <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 transition-all duration-500 z-30 ${isUIVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
           <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full p-2 flex items-center justify-between shadow-2xl">
               
               {/* Left Controls */}
               <div className="flex items-center gap-2 pl-4">
                   <button 
                     onClick={isConnected ? disconnect : connect} 
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-colors ${isConnected ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                   >
                       {isSpeaking ? <ICONS.Mic size={12} className="animate-pulse" /> : <ICONS.Music size={12} />} 
                       {isConnected ? 'LIVE' : 'LINK AI'}
                   </button>
                   
                   <button onClick={() => setShowTasks(!showTasks)} className="p-2 text-gray-400 hover:text-white transition-colors lg:hidden">
                       <ICONS.ListMusic size={18} />
                   </button>
               </div>

               {/* Track Info (Centered) */}
               {currentSong ? (
                   <div className="flex flex-col items-center mx-4 overflow-hidden max-w-[200px] md:max-w-xs">
                       <div className="text-sm font-bold text-white truncate w-full text-center">{currentSong.title}</div>
                       <div className="text-[10px] text-gray-400 uppercase tracking-wider truncate w-full text-center">{currentSong.artist}</div>
                   </div>
               ) : (
                   <div className="text-xs text-gray-500 font-mono uppercase">NO_AUDIO_SOURCE</div>
               )}

               {/* Playback Controls */}
               <div className="flex items-center gap-2 pr-2">
                   <button onClick={togglePlay} className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform">
                       {isPlaying ? <ICONS.Pause size={16} fill="currentColor" /> : <ICONS.Play size={16} fill="currentColor" className="ml-0.5" />}
                   </button>
                   <button onClick={() => onNext()} className="w-10 h-10 flex items-center justify-center border border-white/20 rounded-full hover:bg-white/10 text-white transition-colors">
                       <ICONS.SkipForward size={16} />
                   </button>
               </div>
           </div>
       </div>

    </div>
  );
};

export default FocusMode;
