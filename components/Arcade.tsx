import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ICONS } from '../constants';

// Game Constants
const CELL_SIZE = 20;
const GRID_WIDTH = 30; 
const GRID_HEIGHT = 20;
const CANVAS_WIDTH = GRID_WIDTH * CELL_SIZE; // 600px
const CANVAS_HEIGHT = GRID_HEIGHT * CELL_SIZE; // 400px
const INITIAL_SPEED = 100;

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type FoodType = 'NORMAL' | 'GOLDEN' | 'SPEED';

interface FoodItem extends Point {
  type: FoodType;
}

const Arcade: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  
  // Game Refs for loop (to avoid closure staleness)
  const snakeRef = useRef<Point[]>([{ x: 10, y: 10 }]);
  const foodRef = useRef<FoodItem>({ x: 15, y: 10, type: 'NORMAL' });
  const particlesRef = useRef<Particle[]>([]);
  
  const directionRef = useRef<Direction>('RIGHT');
  const nextDirectionRef = useRef<Direction>('RIGHT');
  const speedRef = useRef(INITIAL_SPEED);
  const lastTimeRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const scoreRef = useRef(0); // Ref for loop access

  // Load High Score
  useEffect(() => {
    const saved = localStorage.getItem('arcade_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const spawnParticles = (x: number, y: number, color: string, count: number = 8) => {
      for(let i=0; i<count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 3 + 1;
          particlesRef.current.push({
              x: x * CELL_SIZE + CELL_SIZE/2,
              y: y * CELL_SIZE + CELL_SIZE/2,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1.0,
              color: color,
              size: Math.random() * 3 + 1
          });
      }
  };

  const resetGame = () => {
    snakeRef.current = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';
    speedRef.current = INITIAL_SPEED;
    particlesRef.current = [];
    scoreRef.current = 0;
    setScore(0);
    spawnFood();
  };

  const spawnFood = () => {
    let newFood: FoodItem;
    let valid = false;
    
    // 20% Chance for special food
    const rand = Math.random();
    let type: FoodType = 'NORMAL';
    if (rand > 0.9) type = 'GOLDEN'; // Bonus points
    else if (rand > 0.8) type = 'SPEED'; // Faster but points

    while (!valid) {
      newFood = {
        x: Math.floor(Math.random() * GRID_WIDTH),
        y: Math.floor(Math.random() * GRID_HEIGHT),
        type
      };
      // Check collision with snake
      const collision = snakeRef.current.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      if (!collision) valid = true;
    }
    
    // Spawn effect
    spawnParticles(newFood!.x, newFood!.y, '#ffffff', 5);
    if (newFood!) foodRef.current = newFood!;
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Pause Toggle
    if (e.key === 'p' || e.key === 'Escape') {
        setGameState(prev => {
            if (prev === 'PLAYING') return 'PAUSED';
            if (prev === 'PAUSED') return 'PLAYING';
            return prev;
        });
        return;
    }

    if (gameState !== 'PLAYING') return;

    switch(e.key) {
      case 'ArrowUp':
      case 'w':
        if (directionRef.current !== 'DOWN') nextDirectionRef.current = 'UP';
        break;
      case 'ArrowDown':
      case 's':
        if (directionRef.current !== 'UP') nextDirectionRef.current = 'DOWN';
        break;
      case 'ArrowLeft':
      case 'a':
        if (directionRef.current !== 'RIGHT') nextDirectionRef.current = 'LEFT';
        break;
      case 'ArrowRight':
      case 'd':
        if (directionRef.current !== 'LEFT') nextDirectionRef.current = 'RIGHT';
        break;
    }
  }, [gameState]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const gameLoop = (timestamp: number) => {
    if (gameState !== 'PLAYING') {
         // Draw once even if paused/gameover to keep screen updated
         if (gameState === 'PAUSED' || gameState === 'GAMEOVER') draw(); 
         return;
    }

    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const deltaTime = timestamp - lastTimeRef.current;

    // Update Particles regardless of snake speed
    updateParticles();
    draw(); // Draw every frame for smooth particles

    if (deltaTime > speedRef.current) {
      updateSnake();
      lastTimeRef.current = timestamp;
    }

    animationRef.current = requestAnimationFrame(gameLoop);
  };

  const updateParticles = () => {
      particlesRef.current.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.05;
          p.size *= 0.95;
      });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };

  const updateSnake = () => {
    const snake = [...snakeRef.current];
    const head = { ...snake[0] };
    const direction = nextDirectionRef.current;
    directionRef.current = direction; // Commit direction

    // Move Head
    if (direction === 'UP') head.y -= 1;
    if (direction === 'DOWN') head.y += 1;
    if (direction === 'LEFT') head.x -= 1;
    if (direction === 'RIGHT') head.x += 1;

    // Check Wall Collision
    if (head.x < 0 || head.x >= GRID_WIDTH || head.y < 0 || head.y >= GRID_HEIGHT) {
      gameOver();
      return;
    }

    // Check Self Collision
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      gameOver();
      return;
    }

    snake.unshift(head);

    // Check Food Collision
    const food = foodRef.current;
    if (head.x === food.x && head.y === food.y) {
      // Eat Food
      let points = 10;
      let color = '#fb923c'; // Orange

      if (food.type === 'GOLDEN') {
          points = 50;
          color = '#ffd700'; // Gold
          // Slow down slightly for reward
          speedRef.current = Math.min(INITIAL_SPEED, speedRef.current + 5);
      } else if (food.type === 'SPEED') {
          points = 25;
          color = '#3b82f6'; // Blue
          speedRef.current = Math.max(40, speedRef.current - 10); // Speed up
      } else {
          // Normal: speed up slightly
          speedRef.current = Math.max(50, speedRef.current - 1);
      }

      scoreRef.current += points;
      setScore(scoreRef.current);
      
      spawnParticles(head.x, head.y, color, 12);
      spawnFood();
    } else {
      // Remove Tail
      snake.pop();
    }

    snakeRef.current = snake;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear with slight trail effect? No, clean clear for retro look
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Grid (Subtle)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<=GRID_WIDTH; i++) {
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, CANVAS_HEIGHT);
    }
    for(let i=0; i<=GRID_HEIGHT; i++) {
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(CANVAS_WIDTH, i * CELL_SIZE);
    }
    ctx.stroke();

    // Draw Food
    const food = foodRef.current;
    const cx = food.x * CELL_SIZE + CELL_SIZE/2;
    const cy = food.y * CELL_SIZE + CELL_SIZE/2;
    
    ctx.shadowBlur = 15;
    if (food.type === 'NORMAL') {
        ctx.fillStyle = '#ef4444'; // Red
        ctx.shadowColor = '#ef4444';
        ctx.beginPath();
        ctx.arc(cx, cy, CELL_SIZE/2 - 2, 0, Math.PI * 2);
        ctx.fill();
    } else if (food.type === 'GOLDEN') {
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        const pulse = Math.sin(Date.now() / 100) * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL_SIZE/2 - 2 + pulse, 0, Math.PI * 2);
        ctx.fill();
    } else if (food.type === 'SPEED') {
        ctx.fillStyle = '#3b82f6';
        ctx.shadowColor = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(cx, cy - CELL_SIZE/2 + 2);
        ctx.lineTo(cx + CELL_SIZE/2 - 2, cy + CELL_SIZE/2 - 2);
        ctx.lineTo(cx - CELL_SIZE/2 + 2, cy + CELL_SIZE/2 - 2);
        ctx.fill();
    }

    // Draw Snake
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#22c55e'; // Green Glow
    
    snakeRef.current.forEach((segment, index) => {
      const x = segment.x * CELL_SIZE;
      const y = segment.y * CELL_SIZE;
      
      if (index === 0) {
          // Head
          ctx.fillStyle = '#4ade80'; // Lighter Green
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          
          // Eyes
          ctx.fillStyle = '#000';
          // Simple eyes logic
          ctx.fillRect(x + 4, y + 4, 4, 4);
          ctx.fillRect(x + 12, y + 4, 4, 4);
      } else {
          // Body - Gradient opacity effect
          const alpha = 1 - (index / (snakeRef.current.length + 5));
          ctx.fillStyle = `rgba(34, 197, 94, ${Math.max(0.3, alpha)})`;
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      }
    });

    // Draw Particles
    ctx.shadowBlur = 0;
    particlesRef.current.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
  };

  const gameOver = () => {
    setGameState('GAMEOVER');
    spawnParticles(snakeRef.current[0].x, snakeRef.current[0].y, '#ef4444', 20);
    draw(); // Final draw to show death
    
    if (scoreRef.current > highScore) {
       setHighScore(scoreRef.current);
       localStorage.setItem('arcade_highscore', scoreRef.current.toString());
    }
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  const startGame = () => {
    resetGame();
    setGameState('PLAYING');
    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(gameLoop);
  };

  const resumeGame = () => {
      setGameState('PLAYING');
      lastTimeRef.current = 0;
      animationRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
      // Initial draw for menu bg
      if (gameState === 'MENU') {
          resetGame(); // Setup initial positions for background visual
          draw();
      }
      return () => {
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
      }
  }, [gameState]);


  return (
    <div className="p-8 pb-32 flex flex-col items-center justify-center min-h-[80vh] font-mono select-none">
       <div className="mb-8 text-center">
          <h2 className="text-4xl font-bold font-mono uppercase mb-2 flex items-center justify-center gap-3">
             <ICONS.Game size={40} className="text-orange-500" />
             NEON_SNAKE
          </h2>
          <p className="text-gray-500 font-bold">SYSTEM_PAUSE // RECREATIONAL_MODULE</p>
       </div>

       {/* Game Console Frame */}
       <div className="bg-[#222] p-8 border-b-8 border-r-8 border-black rounded-xl shadow-2xl relative">
           
           {/* Screen Bezel */}
           <div className="bg-[#111] p-4 rounded-lg shadow-inner border border-gray-700">
               <div className="relative">
                  <canvas 
                    ref={canvasRef} 
                    width={CANVAS_WIDTH} 
                    height={CANVAS_HEIGHT}
                    className="bg-[#050505] block rounded-sm shadow-[0_0_20px_rgba(0,255,0,0.1)]"
                  />
                  
                  {/* CRT Scanline Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent bg-[length:100%_3px] pointer-events-none opacity-20"></div>

                  {/* UI Overlay */}
                  {gameState === 'MENU' && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                          <h3 className="text-5xl font-black mb-4 font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500" style={{ textShadow: '0 0 20px rgba(74, 222, 128, 0.5)' }}>NEON SNAKE</h3>
                          <p className="text-xs mb-8 animate-pulse text-green-400 tracking-widest">PRESS START TO INITIALIZE</p>
                          <button 
                             onClick={startGame}
                             className="px-8 py-3 bg-green-500 text-black font-bold hover:bg-white transition-all uppercase tracking-wider shadow-[0_0_15px_rgba(34,197,94,0.6)] hover:shadow-[0_0_25px_rgba(255,255,255,0.8)] clip-path-polygon"
                          >
                             START GAME
                          </button>
                      </div>
                  )}

                  {gameState === 'PAUSED' && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                          <h3 className="text-4xl font-bold mb-8 text-white tracking-widest">PAUSED</h3>
                          <button 
                             onClick={resumeGame}
                             className="px-8 py-3 border-2 border-white text-white font-bold hover:bg-white hover:text-black transition-all uppercase tracking-wider mb-4"
                          >
                             RESUME
                          </button>
                          <button 
                             onClick={() => setGameState('MENU')}
                             className="text-xs text-gray-400 hover:text-white"
                          >
                             QUIT TO MENU
                          </button>
                      </div>
                  )}

                  {gameState === 'GAMEOVER' && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                          <h3 className="text-4xl font-bold mb-2 text-red-500 tracking-widest" style={{ textShadow: '0 0 20px rgba(239, 68, 68, 0.6)' }}>CRITICAL FAILURE</h3>
                          <div className="text-center mb-8 border-2 border-red-900 bg-red-900/20 p-4 rounded">
                              <p className="text-sm text-gray-400 uppercase mb-1">Final Score</p>
                              <p className="text-4xl font-bold mb-2 text-white">{score}</p>
                              <p className="text-xs text-orange-400">HIGH SCORE: {highScore}</p>
                          </div>
                          <button 
                             onClick={startGame}
                             className="px-8 py-3 bg-white text-black font-bold hover:bg-red-500 hover:text-white transition-all uppercase tracking-wider"
                          >
                             REBOOT SYSTEM
                          </button>
                      </div>
                  )}
               </div>
           </div>

           {/* Controls / Info */}
           <div className="mt-6 flex justify-between items-center px-4 text-gray-400">
              <div className="flex flex-col gap-1">
                 <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Score</span>
                 <span className="text-3xl font-bold font-mono text-green-500" style={{ textShadow: '0 0 10px rgba(34, 197, 94, 0.4)' }}>{score.toString().padStart(6, '0')}</span>
              </div>

              {/* D-Pad Visual */}
              <div className="flex flex-col items-center gap-1 opacity-50">
                  <div className="w-8 h-8 bg-[#333] rounded border border-[#444] flex items-center justify-center shadow-lg">
                     <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-gray-500"></div>
                  </div>
                  <div className="flex gap-1">
                      <div className="w-8 h-8 bg-[#333] rounded border border-[#444] flex items-center justify-center shadow-lg">
                         <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] border-r-gray-500"></div>
                      </div>
                      <div className="w-8 h-8 flex items-center justify-center">
                         <div className="w-2 h-2 rounded-full bg-red-900 animate-pulse"></div>
                      </div>
                      <div className="w-8 h-8 bg-[#333] rounded border border-[#444] flex items-center justify-center shadow-lg">
                         <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-gray-500"></div>
                      </div>
                  </div>
                  <div className="w-8 h-8 bg-[#333] rounded border border-[#444] flex items-center justify-center shadow-lg">
                     <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-gray-500"></div>
                  </div>
              </div>

              <div className="flex flex-col gap-1 text-right">
                 <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">High Score</span>
                 <span className="text-xl font-bold font-mono text-orange-500">{highScore.toString().padStart(6, '0')}</span>
                 <span className="text-[9px] uppercase mt-1">[P] to Pause</span>
              </div>
           </div>
           
           {/* Decorative details */}
           <div className="absolute top-4 left-4 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]"></div>
           <div className="absolute top-4 right-4 flex gap-1">
               <div className="w-8 h-1 bg-gray-700"></div>
               <div className="w-8 h-1 bg-gray-700"></div>
               <div className="w-8 h-1 bg-gray-700"></div>
           </div>
       </div>
    </div>
  );
};

export default Arcade;