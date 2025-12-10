
import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { Song, MusicProvider } from '../types';
import { consultFocusAgent } from '../services/geminiService';
import { searchUnified } from '../services/musicService';

interface FocusModeProps {
  currentSong: Song | null;
  onExit: () => void;
  isPlaying: boolean;
  togglePlay: () => void;
  onNext: (song?: Song) => void;
}

type AmbienceType = 'VOID' | 'BREATHE' | 'PARTICLES';

interface Task {
  id: number;
  text: string;
  completed: boolean;
}

const FocusMode: React.FC<FocusModeProps> = ({ currentSong, onExit, isPlaying, togglePlay, onNext }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60); 
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [mode, setMode] = useState<'FOCUS' | 'BREAK'>('FOCUS');
  
  const [ambience, setAmbience] = useState<AmbienceType>('BREATHE');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Mouse Idle State for Minimal UI
  const [isUIVisible, setIsUIVisible] = useState(true);
  const mouseTimerRef = useRef<number | null>(null);

  // Agent State
  const [agentInput, setAgentInput] = useState('');
  const [agentResponse, setAgentResponse] = useState<string | null>(null);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [showAgentInput, setShowAgentInput] = useState(false);

  // Task State
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('focus_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTask, setNewTask] = useState('');
  const [showTasks, setShowTasks] = useState(false);

  useEffect(() => {
    localStorage.setItem('focus_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Handle Mouse Move for Minimal UI
  useEffect(() => {
      const handleMouseMove = () => {
          setIsUIVisible(true);
          if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
          mouseTimerRef.current = window.setTimeout(() => {
              if (!showAgentInput && !showTasks) {
                  setIsUIVisible(false);
              }
          }, 3000);
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
      };
  }, [showAgentInput, showTasks]);

  // Handle Agent Logic
  const handleAgentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!agentInput.trim()) return;
      
      const query = agentInput;
      setAgentInput('');
      setIsAgentThinking(true);
      
      try {
          const result = await consultFocusAgent(query, mode);
          setAgentResponse(result.reply);
          
          if (result.suggestedAction === 'CHANGE_MUSIC' && result.musicQuery) {
              const songs = await searchUnified('YOUTUBE', result.musicQuery); // Default to YouTube for focus
              if (songs.length > 0) {
                  onNext(songs[0]); // Hack to play specific song via onNext prop if we modify App.tsx, but simpler to just let user know
              }
          } else if (result.suggestedAction === 'TAKE_BREAK') {
              switchMode();
          }
          
          setTimeout(() => setAgentResponse(null), 5000); // Clear message after 5s
      } catch (e) {
          setAgentResponse("system_offline");
      } finally {
          setIsAgentThinking(false);
          setShowAgentInput(false);
      }
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: newTask.trim(), completed: false }]);
    setNewTask('');
  };

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const removeTask = (id: number) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  // Timer Logic
  useEffect(() => {
    let interval: number;
    if (isTimerRunning && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsTimerRunning(false);
      // Play soft chime?
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  // Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    let time = 0;
    
    const particles: {x: number, y: number, vx: number, vy: number, alpha: number}[] = [];
    for(let i=0; i<100; i++) particles.push({
        x: Math.random() * width, 
        y: Math.random() * height, 
        vx: (Math.random() - 0.5) * 0.2, 
        vy: (Math.random() - 0.5) * 0.2,
        alpha: Math.random()
    });

    const render = () => {
      time += 0.01;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#050505'; // Deep black
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      if (ambience === 'BREATHE') {
          // 4-7-8 Breathing Rhythm approximation (approx 19s cycle? Let's just do calm 6s in 6s out)
          // Sine wave from 0 to 1 over time
          const breatheSpeed = 0.02; 
          const breath = (Math.sin(time * 0.8) + 1) / 2; // 0 to 1
          
          const baseRadius = Math.min(width, height) * 0.15;
          const maxRadius = Math.min(width, height) * 0.25;
          const radius = baseRadius + (breath * (maxRadius - baseRadius));

          // Outer Glow
          const gradient = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 2);
          gradient.addColorStop(0, mode === 'FOCUS' ? 'rgba(255, 165, 0, 0.1)' : 'rgba(100, 200, 255, 0.1)');
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 2, 0, Math.PI * 2);
          ctx.fill();

          // Main Circle Ring
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.lineWidth = 2;
          ctx.strokeStyle = mode === 'FOCUS' ? 'rgba(255, 165, 0, 0.5)' : 'rgba(100, 200, 255, 0.5)';
          ctx.stroke();

          // Inner Progress (if timer running)
          if (isTimerRunning) {
             ctx.beginPath();
             ctx.arc(cx, cy, radius - 10, 0, Math.PI * 2);
             ctx.fillStyle = mode === 'FOCUS' ? 'rgba(255, 165, 0, 0.05)' : 'rgba(100, 200, 255, 0.05)';
             ctx.fill();
          }
      } 
      else if (ambience === 'PARTICLES') {
          ctx.fillStyle = '#ffffff';
          particles.forEach(p => {
              p.x += p.vx;
              p.y += p.vy;
              if (p.x < 0) p.x = width;
              if (p.x > width) p.x = 0;
              if (p.y < 0) p.y = height;
              if (p.y > height) p.y = 0;
              
              ctx.globalAlpha = p.alpha * 0.3;
              ctx.beginPath();
              ctx.arc(p.x, p.y, 1, 0, Math.PI*2);
              ctx.fill();
          });
          ctx.globalAlpha = 1;
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [ambience, mode, isTimerRunning]);

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);
  
  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(mode === 'FOCUS' ? 25 * 60 : 5 * 60);
  };

  const switchMode = () => {
    const newMode = mode === 'FOCUS' ? 'BREAK' : 'FOCUS';
    setMode(newMode);
    setTimeLeft(newMode === 'FOCUS' ? 25 * 60 : 5 * 60);
    setIsTimerRunning(false);
  };
  
  const cycleAmbience = () => {
      const modes: AmbienceType[] = ['VOID', 'BREATHE', 'PARTICLES'];
      const idx = modes.indexOf(ambience);
      setAmbience(modes[(idx + 1) % modes.length]);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black text-gray-300 z-50 flex flex-col items-center justify-center font-mono overflow-hidden cursor-none hover:cursor-default selection:bg-white selection:text-black">
       <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

       {/* Agent Overlay (Centered Toast) */}
       {agentResponse && (
           <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black border border-gray-800 text-white px-6 py-3 text-xs tracking-widest uppercase animate-in fade-in slide-in-from-top-4 z-50 shadow-2xl">
               <span className="text-orange-500 mr-2">●</span> {agentResponse}
           </div>
       )}

       {/* Floating Flow Agent Input */}
       {showAgentInput && (
           <div className="absolute top-32 left-1/2 -translate-x-1/2 w-96 z-50 animate-in fade-in slide-in-from-bottom-2">
               <form onSubmit={handleAgentSubmit} className="relative group">
                   <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-purple-600 opacity-75 blur transition duration-1000 group-hover:duration-200"></div>
                   <div className="relative bg-black flex items-center">
                       <span className="pl-4 text-orange-500 font-bold">{">"}</span>
                       <input 
                         autoFocus
                         type="text" 
                         value={agentInput}
                         onChange={(e) => setAgentInput(e.target.value)}
                         placeholder="Command Flow Agent..."
                         className="w-full bg-black text-white p-3 focus:outline-none font-mono text-sm placeholder-gray-700"
                         onBlur={() => !agentInput && setShowAgentInput(false)}
                       />
                       {isAgentThinking && <ICONS.Loader className="animate-spin text-gray-500 mr-3" size={14} />}
                   </div>
               </form>
           </div>
       )}

       {/* Top Bar - Minimal */}
       <div className={`absolute top-0 left-0 right-0 p-8 flex justify-between items-start transition-opacity duration-700 ${isUIVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex gap-4">
              <button 
                 onClick={cycleAmbience} 
                 className="text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors"
              >
                 VISUAL: {ambience}
              </button>
              <button 
                 onClick={() => setShowAgentInput(true)} 
                 className="text-[10px] uppercase tracking-widest text-orange-500 hover:text-orange-400 transition-colors flex items-center gap-2"
              >
                 <ICONS.Terminal size={12} /> CMD_AGENT
              </button>
          </div>

          <button onClick={onExit} className="text-gray-600 hover:text-red-500 transition-colors">
              <ICONS.Close size={24} strokeWidth={1} />
          </button>
       </div>

       {/* Tasks Panel */}
       <div className={`absolute left-8 bottom-8 transition-opacity duration-700 z-30 ${isUIVisible ? 'opacity-100' : 'opacity-0'}`}>
           <button 
             onClick={() => setShowTasks(!showTasks)}
             className="text-[10px] uppercase tracking-widest text-gray-600 hover:text-white flex items-center gap-2 mb-4"
           >
               <ICONS.CheckSquare size={14} /> TASKS [{tasks.filter(t => !t.completed).length}]
           </button>
           
           {showTasks && (
               <div className="w-64 bg-black/80 backdrop-blur border-l border-gray-800 p-4 space-y-4 text-xs">
                   <div className="space-y-2 max-h-48 overflow-y-auto">
                       {tasks.map(t => (
                           <div key={t.id} className="flex items-center gap-3 group">
                               <button onClick={() => toggleTask(t.id)} className={`w-3 h-3 border border-gray-600 ${t.completed ? 'bg-orange-500 border-orange-500' : 'hover:border-white'}`}></button>
                               <span className={`flex-1 ${t.completed ? 'line-through text-gray-600' : 'text-gray-300'}`}>{t.text}</span>
                               <button onClick={() => removeTask(t.id)} className="opacity-0 group-hover:opacity-100 text-red-500"><ICONS.Close size={10} /></button>
                           </div>
                       ))}
                   </div>
                   <form onSubmit={addTask}>
                       <input 
                         type="text" 
                         value={newTask}
                         onChange={e => setNewTask(e.target.value)}
                         placeholder="+ Add goal"
                         className="bg-transparent border-b border-gray-800 w-full py-1 focus:outline-none focus:border-gray-500"
                       />
                   </form>
               </div>
           )}
       </div>

       {/* Center Stage */}
       <div className="relative z-20 flex flex-col items-center">
           {/* Timer */}
           <div className={`font-mono text-9xl font-thin tracking-tighter mb-4 transition-colors duration-1000 select-none ${mode === 'FOCUS' ? 'text-white' : 'text-blue-200'}`}>
               {formatTime(timeLeft)}
           </div>
           
           {/* Controls - Only Visible on Hover/Activity */}
           <div className={`flex gap-8 items-center transition-all duration-500 ${isUIVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
               <button onClick={switchMode} className="text-[10px] uppercase tracking-[0.3em] text-gray-600 hover:text-white transition-colors">
                   {mode === 'FOCUS' ? 'Switch to Break' : 'Resume Focus'}
               </button>
               
               <button onClick={toggleTimer} className="p-4 border border-gray-800 rounded-full hover:border-white hover:bg-white hover:text-black transition-all group">
                   {isTimerRunning ? <ICONS.Pause size={20} fill="currentColor" /> : <ICONS.Play size={20} fill="currentColor" className="ml-1" />}
               </button>
               
               <button onClick={resetTimer} className="text-[10px] uppercase tracking-[0.3em] text-gray-600 hover:text-white transition-colors">
                   Reset
               </button>
           </div>
       </div>

       {/* Minimal Player at Bottom */}
       {currentSong && (
           <div className={`absolute bottom-8 right-8 flex items-center gap-4 transition-all duration-700 ${isUIVisible ? 'opacity-100' : 'opacity-30 grayscale'}`}>
               <div className="text-right">
                   <div className="text-xs text-white font-bold uppercase tracking-wider">{currentSong.title}</div>
                   <div className="text-[10px] text-gray-600 uppercase tracking-widest">{currentSong.artist}</div>
               </div>
               <div className="flex gap-2">
                   <button onClick={togglePlay} className="text-white hover:text-orange-500 transition-colors">
                       {isPlaying ? <ICONS.Pause size={16} /> : <ICONS.Play size={16} />}
                   </button>
                   <button onClick={() => onNext()} className="text-white hover:text-orange-500 transition-colors">
                       <ICONS.SkipForward size={16} />
                   </button>
               </div>
           </div>
       )}
    </div>
  );
};

export default FocusMode;
