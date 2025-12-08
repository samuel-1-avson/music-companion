import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';

interface FocusModeProps {
  currentSong: Song | null;
  onExit: () => void;
  isPlaying: boolean;
  togglePlay: () => void;
  onNext: () => void;
}

type AmbienceType = 'VOID' | 'GRID' | 'RAIN' | 'PARTICLES';

interface Task {
  id: number;
  text: string;
  completed: boolean;
}

const FocusMode: React.FC<FocusModeProps> = ({ currentSong, onExit, isPlaying, togglePlay, onNext }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [mode, setMode] = useState<'FOCUS' | 'BREAK'>('FOCUS');
  
  // Ambience State
  const [ambience, setAmbience] = useState<AmbienceType>('GRID');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Refs for Canvas Animation (to avoid re-renders)
  const timeLeftRef = useRef(timeLeft);
  const modeRef = useRef(mode);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Task State
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('focus_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTask, setNewTask] = useState('');
  const [showTasks, setShowTasks] = useState(false);

  // Persist tasks
  useEffect(() => {
    localStorage.setItem('focus_tasks', JSON.stringify(tasks));
  }, [tasks]);

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

  // Auto-switch ambience based on mode
  useEffect(() => {
    if (mode === 'FOCUS') setAmbience('GRID');
    else setAmbience('RAIN');
  }, [mode]);

  // Timer Logic
  useEffect(() => {
    let interval: number;
    if (isTimerRunning && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsTimerRunning(false);
      // Optional: Play sound here
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  // Canvas Animation Logic
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

    // Animation State Variables
    let time = 0;
    
    // Rain State
    const drops: {x: number, y: number, speed: number, len: number}[] = [];
    for(let i=0; i<100; i++) drops.push({
        x: Math.random() * width, 
        y: Math.random() * height, 
        speed: 2 + Math.random() * 3, 
        len: 10 + Math.random() * 20
    });

    // Particles State
    const particles: {x: number, y: number, vx: number, vy: number}[] = [];
    for(let i=0; i<50; i++) particles.push({
        x: Math.random() * width, 
        y: Math.random() * height, 
        vx: (Math.random() - 0.5) * 0.5, 
        vy: (Math.random() - 0.5) * 0.5
    });

    const render = () => {
      time += 0.01;
      ctx.clearRect(0, 0, width, height);

      // Background Base
      ctx.fillStyle = '#111'; 
      ctx.fillRect(0, 0, width, height);

      // --- Ambience Effects ---
      if (ambience === 'GRID') {
        // Retro Perspective Grid
        const cx = width / 2;
        const cy = height / 2;
        const horizon = height * 0.6; // lower horizon looks more "floor" like
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;

        // Vertical lines converging to vanishing point
        for (let i = -width; i < width * 2; i += 100) {
           ctx.beginPath();
           // Simplified projection
           const x1 = i; 
           const y1 = height;
           const x2 = cx + (i - cx) * 0.1; // converge towards center
           const y2 = horizon;
           
           ctx.moveTo(x2, y2);
           ctx.lineTo(x1, y1);
           ctx.stroke();
        }

        // Horizontal lines moving towards viewer
        const speed = (Date.now() / 20) % 50;
        for (let z = 0; z < height - horizon; z += 50) {
            const y = horizon + z + speed;
            if (y > height) continue;
            
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Add a subtle glow
        const gradient = ctx.createRadialGradient(cx, horizon, 10, cx, height, height);
        gradient.addColorStop(0, 'rgba(251, 146, 60, 0.1)'); // Orange glow at horizon
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, horizon, width, height - horizon);
      } 
      else if (ambience === 'RAIN') {
        ctx.strokeStyle = 'rgba(100, 149, 237, 0.3)';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; // slight dimming

        for (let drop of drops) {
            drop.y += drop.speed;
            if (drop.y > height) {
                drop.y = -drop.len;
                drop.x = Math.random() * width;
            }
            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x, drop.y + drop.len);
            ctx.stroke();
        }
      } 
      else if (ambience === 'PARTICLES') {
        ctx.fillStyle = '#444';
        ctx.strokeStyle = '#333';
        
        // Update and draw particles
        particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fill();

            // Connect nearby
            for(let j=i+1; j<particles.length; j++) {
                const p2 = particles[j];
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if(dist < 150) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.globalAlpha = 1 - dist/150;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
        });
      }

      // --- Progress Indicator ---
      const cx = width / 2;
      const cy = height / 2 - 50; // Offset slightly up to center around text roughly
      
      const currentMode = modeRef.current;
      const maxTime = currentMode === 'FOCUS' ? 25 * 60 : 5 * 60;
      const progress = Math.max(0, timeLeftRef.current / maxTime);
      
      // Radius of the ring
      const ringRadius = 220; 

      // Background Ring
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 8;
      ctx.stroke();

      // Progress Ring
      ctx.beginPath();
      // Start at top (-PI/2)
      // End based on progress (Full circle is 2*PI)
      // We want it to deplete counter-clockwise or clockwise? 
      // Typically deplete clockwise: Start at top, end reduces.
      // So draw from startAngle to startAngle + (2PI * progress)
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (Math.PI * 2 * progress);
      
      ctx.arc(cx, cy, ringRadius, startAngle, endAngle);
      ctx.strokeStyle = currentMode === 'FOCUS' ? '#fb923c' : '#60a5fa'; // Orange or Blue
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      
      // Add Glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = currentMode === 'FOCUS' ? '#fb923c' : '#60a5fa';
      ctx.stroke();
      
      // Reset Shadow for next frame
      ctx.shadowBlur = 0;

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [ambience]); // Re-init on ambience change is fine

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
      const modes: AmbienceType[] = ['VOID', 'GRID', 'RAIN', 'PARTICLES'];
      const idx = modes.indexOf(ambience);
      setAmbience(modes[(idx + 1) % modes.length]);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-[#111] text-[#f0f0f0] z-50 flex flex-col items-center justify-center p-8 transition-colors duration-700 overflow-hidden">
       {/* Background Canvas */}
       <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

       {/* Top Controls */}
       <div className="absolute top-8 left-8 z-10">
          <button 
             onClick={cycleAmbience} 
             className="flex items-center gap-2 text-gray-500 hover:text-white font-mono text-xs uppercase border border-transparent hover:border-gray-500 px-2 py-1 transition-all"
          >
             <ICONS.Image size={14} />
             BG: {ambience}
          </button>
       </div>

       <button onClick={onExit} className="absolute top-8 right-8 text-gray-500 hover:text-white flex items-center gap-2 font-mono text-sm group z-10">
          <ICONS.Close size={20} className="group-hover:rotate-90 transition-transform" />
          EXIT_FOCUS
       </button>

       {/* Task List Toggle */}
       <div className="absolute bottom-8 right-8 z-20 flex flex-col items-end">
          {showTasks && (
            <div className="mb-4 w-72 bg-black/50 backdrop-blur-md border border-white/20 p-4 animate-in slide-in-from-right-4 duration-300">
               <h3 className="font-mono font-bold text-xs uppercase text-gray-400 mb-3 border-b border-gray-700 pb-2 flex justify-between">
                  Session Goals
                  <span className="text-white">{tasks.filter(t => t.completed).length}/{tasks.length}</span>
               </h3>
               
               <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
                  {tasks.length === 0 && (
                     <p className="text-xs text-gray-500 italic text-center py-4">No tasks yet.</p>
                  )}
                  {tasks.map(task => (
                     <div key={task.id} className="flex items-center justify-between group">
                        <div 
                          className={`flex items-center gap-2 cursor-pointer ${task.completed ? 'opacity-40' : 'opacity-100'}`}
                          onClick={() => toggleTask(task.id)}
                        >
                           {task.completed ? <ICONS.Check size={14} className="text-green-500" /> : <ICONS.Square size={14} />}
                           <span className={`text-sm font-mono ${task.completed ? 'line-through' : ''}`}>{task.text}</span>
                        </div>
                        <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400">
                           <ICONS.Close size={12} />
                        </button>
                     </div>
                  ))}
               </div>

               <form onSubmit={addTask} className="flex gap-2">
                  <input 
                     type="text" 
                     value={newTask}
                     onChange={(e) => setNewTask(e.target.value)}
                     className="bg-transparent border-b border-gray-500 text-sm font-mono w-full focus:outline-none focus:border-orange-500 pb-1"
                     placeholder="Add task..."
                  />
                  <button type="submit" disabled={!newTask.trim()} className="text-orange-500 disabled:opacity-50">
                     <ICONS.Close size={16} className="rotate-45" />
                  </button>
               </form>
            </div>
          )}
          <button 
             onClick={() => setShowTasks(!showTasks)} 
             className={`flex items-center gap-2 font-mono text-sm uppercase px-4 py-2 border transition-all shadow-[4px_4px_0_0_rgba(0,0,0,1)] ${showTasks ? 'bg-orange-500 text-black border-orange-500' : 'bg-white text-black border-white hover:bg-gray-200'}`}
          >
             {showTasks ? 'Hide Tasks' : 'Tasks'}
             <div className="bg-black text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                {tasks.filter(t => !t.completed).length}
             </div>
          </button>
       </div>

       <div className="w-full max-w-2xl text-center space-y-12 relative z-10">
          {/* Timer Section */}
          <div className="space-y-6">
             <div className="flex items-center justify-center gap-4">
                <span className={`text-xs font-mono tracking-widest uppercase transition-colors duration-300 ${mode === 'FOCUS' ? 'text-orange-500 font-bold' : 'text-gray-700'}`}>● WORK_SESSION</span>
                <span className={`text-xs font-mono tracking-widest uppercase transition-colors duration-300 ${mode === 'BREAK' ? 'text-blue-400 font-bold' : 'text-gray-700'}`}>● SHORT_BREAK</span>
             </div>
             
             {/* Offset slightly to match the ring center in canvas */}
             <div className="font-mono text-[120px] leading-none font-bold tabular-nums tracking-tighter drop-shadow-2xl -mt-6">
                {formatTime(timeLeft)}
             </div>

             <div className="flex justify-center gap-4">
                <button onClick={toggleTimer} className="w-16 h-16 rounded-full border-2 border-white flex items-center justify-center hover:bg-white hover:text-black transition-colors backdrop-blur-sm">
                   {isTimerRunning ? <ICONS.Pause size={24} fill="currentColor" /> : <ICONS.Play size={24} fill="currentColor" className="ml-1" />}
                </button>
                <button onClick={resetTimer} className="w-16 h-16 rounded-full border-2 border-gray-600 text-gray-400 flex items-center justify-center hover:border-white hover:text-white transition-colors backdrop-blur-sm">
                   <ICONS.Square size={20} />
                </button>
                <button onClick={switchMode} className="w-16 h-16 rounded-full border-2 border-gray-600 text-gray-400 flex items-center justify-center hover:border-white hover:text-white transition-colors backdrop-blur-sm">
                   <ICONS.SkipForward size={20} />
                </button>
             </div>
          </div>

          {/* Minimal Player */}
          {currentSong && (
             <div className="border-t border-gray-800 pt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="w-32 h-32 mx-auto mb-6 bg-gray-800 border border-gray-700 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                   <img src={currentSong.coverUrl} className="w-full h-full object-cover grayscale opacity-70" alt="Cover" />
                </div>
                <h2 className="text-xl font-bold font-mono uppercase tracking-wide mb-1 text-white shadow-black drop-shadow-md">{currentSong.title}</h2>
                <p className="text-gray-500 font-mono text-sm">{currentSong.artist}</p>
                
                <div className="flex justify-center items-center gap-8 mt-6 opacity-50 hover:opacity-100 transition-opacity">
                   <button onClick={togglePlay} className="hover:text-orange-500 transition-colors">
                      {isPlaying ? <ICONS.Pause size={32} /> : <ICONS.Play size={32} />}
                   </button>
                   <button onClick={onNext} className="hover:text-orange-500 transition-colors">
                      <ICONS.SkipForward size={24} />
                   </button>
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

export default FocusMode;
