
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ICONS } from '../constants';
import MusicTrivia from './MusicTrivia';

// --- GAME SELECTION ---
type GameType = 'SELECT' | 'CYBER_DEFENSE' | 'MUSIC_TRIVIA';

// --- GAME CONSTANTS ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const FPS = 60;

// Physics
const DRAG = 0.94; // Friction
const ACCEL = 0.6; // Thruster power
const MAX_SPEED = 8;
const ROTATION_SPEED = 0.1;

// Colors
const COLORS = {
    bg: '#050505',
    grid: '#1a1a1a',
    player: '#00f3ff', // Cyan
    playerThrust: '#ff00ff', // Magenta
    bullet: '#ffff00', // Yellow
    enemyBasic: '#ff2a2a', // Red
    enemyFast: '#ffae00', // Orange
    enemyTank: '#aa00ff', // Purple
    text: '#ffffff'
};

// --- TYPES ---
type Vector = { x: number; y: number };
type Particle = { 
    x: number; y: number; 
    vx: number; vy: number; 
    life: number; maxLife: number; 
    size: number; color: string; 
};
type Bullet = {
    id: number;
    x: number; y: number;
    vx: number; vy: number;
    life: number;
};
type Enemy = {
    id: number;
    type: 'BASIC' | 'FAST' | 'TANK';
    x: number; y: number;
    vx: number; vy: number;
    hp: number;
    size: number;
    scoreValue: number;
    angle: number;
};

const Arcade: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Game Selection
  const [selectedGame, setSelectedGame] = useState<GameType>('SELECT');

  // Game State
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'GAMEOVER'>('MENU');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [wave, setWave] = useState(1);


  // Mutable Game Data (Refs for performance)
  const player = useRef({ x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2, vx: 0, vy: 0, angle: -Math.PI/2, hp: 100, iframes: 0 });
  const bullets = useRef<Bullet[]>([]);
  const enemies = useRef<Enemy[]>([]);
  const particles = useRef<Particle[]>([]);
  const keys = useRef<Record<string, boolean>>({});
  const shake = useRef(0);
  const scoreRef = useRef(0);
  const frameId = useRef<number>(0);
  const spawnTimer = useRef(0);

  // Load High Score
  useEffect(() => {
    const saved = localStorage.getItem('arcade_shooter_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // --- INPUT HANDLING ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- GAME ENGINE ---

  const spawnEnemy = () => {
      const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
      let x = 0, y = 0;
      const buffer = 50;

      if (edge === 0) { x = Math.random() * CANVAS_WIDTH; y = -buffer; }
      else if (edge === 1) { x = CANVAS_WIDTH + buffer; y = Math.random() * CANVAS_HEIGHT; }
      else if (edge === 2) { x = Math.random() * CANVAS_WIDTH; y = CANVAS_HEIGHT + buffer; }
      else { x = -buffer; y = Math.random() * CANVAS_HEIGHT; }

      const rand = Math.random();
      let type: Enemy['type'] = 'BASIC';
      let hp = 1;
      let size = 15;
      let scoreVal = 100;
      
      // Difficulty Scaling
      if (rand > 0.9 && wave > 2) { type = 'TANK'; hp = 5; size = 25; scoreVal = 500; }
      else if (rand > 0.7 && wave > 1) { type = 'FAST'; hp = 1; size = 10; scoreVal = 200; }

      enemies.current.push({
          id: Date.now() + Math.random(),
          type, x, y, vx: 0, vy: 0,
          hp, size, scoreValue: scoreVal, angle: 0
      });
  };

  const createParticles = (x: number, y: number, color: string, count: number, speed: number) => {
      for(let i=0; i<count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const vel = Math.random() * speed;
          particles.current.push({
              x, y,
              vx: Math.cos(angle) * vel,
              vy: Math.sin(angle) * vel,
              life: 1.0,
              maxLife: 1.0,
              size: Math.random() * 3 + 1,
              color
          });
      }
  };

  const fireBullet = () => {
      const p = player.current;
      const speed = 12;
      // Recoil
      p.vx -= Math.cos(p.angle) * 0.5;
      p.vy -= Math.sin(p.angle) * 0.5;

      bullets.current.push({
          id: Date.now(),
          x: p.x + Math.cos(p.angle) * 20,
          y: p.y + Math.sin(p.angle) * 20,
          vx: Math.cos(p.angle) * speed + (p.vx * 0.2), // Add some player momentum
          vy: Math.sin(p.angle) * speed + (p.vy * 0.2),
          life: 60
      });
      
      // Muzzle Flash
      createParticles(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, COLORS.bullet, 3, 2);
  };

  const update = () => {
      if (shake.current > 0) shake.current *= 0.9;
      if (shake.current < 0.5) shake.current = 0;

      const p = player.current;

      // --- PLAYER PHYSICS ---
      // Rotation
      if (keys.current['ArrowLeft'] || keys.current['KeyA']) p.angle -= ROTATION_SPEED;
      if (keys.current['ArrowRight'] || keys.current['KeyD']) p.angle += ROTATION_SPEED;
      
      // Thrust
      if (keys.current['ArrowUp'] || keys.current['KeyW']) {
          p.vx += Math.cos(p.angle) * ACCEL;
          p.vy += Math.sin(p.angle) * ACCEL;
          // Thruster particles
          if (Math.random() > 0.5) {
              createParticles(
                  p.x - Math.cos(p.angle) * 15, 
                  p.y - Math.sin(p.angle) * 15, 
                  COLORS.playerThrust, 1, 3
              );
          }
      }

      // Cap Speed
      const speed = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
      if (speed > MAX_SPEED) {
          const ratio = MAX_SPEED / speed;
          p.vx *= ratio;
          p.vy *= ratio;
      }

      // Friction
      p.vx *= DRAG;
      p.vy *= DRAG;

      // Position
      p.x += p.vx;
      p.y += p.vy;

      // Screen Wrap
      if (p.x < 0) p.x = CANVAS_WIDTH;
      if (p.x > CANVAS_WIDTH) p.x = 0;
      if (p.y < 0) p.y = CANVAS_HEIGHT;
      if (p.y > CANVAS_HEIGHT) p.y = 0;

      if (p.iframes > 0) p.iframes--;

      // Shooting (Simple cooldown via key check throttling could be added, here relying on user tapping or fast repeat)
      if (keys.current['Space'] && frameId.current % 8 === 0) { // 8 frame delay auto-fire
          fireBullet();
      }

      // --- BULLETS ---
      for (let i = bullets.current.length - 1; i >= 0; i--) {
          const b = bullets.current[i];
          b.x += b.vx;
          b.y += b.vy;
          b.life--;
          
          if (b.x < 0 || b.x > CANVAS_WIDTH || b.y < 0 || b.y > CANVAS_HEIGHT || b.life <= 0) {
              bullets.current.splice(i, 1);
          }
      }

      // --- ENEMIES ---
      spawnTimer.current++;
      // Spawn rate increases with wave
      if (spawnTimer.current > Math.max(20, 60 - (wave * 2))) {
          spawnEnemy();
          spawnTimer.current = 0;
      }

      for (let i = enemies.current.length - 1; i >= 0; i--) {
          const e = enemies.current[i];
          
          // AI: Move towards player
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const angle = Math.atan2(dy, dx);
          e.angle = angle;

          let speed = 2;
          if (e.type === 'FAST') speed = 4;
          if (e.type === 'TANK') speed = 1;

          e.vx = Math.cos(angle) * speed;
          e.vy = Math.sin(angle) * speed;
          
          e.x += e.vx;
          e.y += e.vy;

          // Collision: Enemy vs Bullets
          for (let j = bullets.current.length - 1; j >= 0; j--) {
              const b = bullets.current[j];
              const bDx = b.x - e.x;
              const bDy = b.y - e.y;
              if (bDx*bDx + bDy*bDy < (e.size + 5)*(e.size + 5)) {
                  // Hit
                  e.hp--;
                  bullets.current.splice(j, 1);
                  createParticles(b.x, b.y, COLORS.bullet, 3, 2);
                  if (e.hp <= 0) {
                      // Kill
                      scoreRef.current += e.scoreValue;
                      setScore(scoreRef.current);
                      
                      // Explosion
                      const color = e.type === 'BASIC' ? COLORS.enemyBasic : e.type === 'FAST' ? COLORS.enemyFast : COLORS.enemyTank;
                      createParticles(e.x, e.y, color, 15, 4);
                      shake.current = 5; // Screen shake
                      
                      enemies.current.splice(i, 1);
                      break; // Break bullet loop, enemy is gone
                  }
              }
          }

          // Collision: Enemy vs Player
          if (dist < e.size + 10 && p.iframes <= 0 && enemies.current[i]) { // check if enemy still exists
               // Hit Player
               p.hp -= 20;
               p.iframes = 60;
               shake.current = 20;
               createParticles(p.x, p.y, COLORS.player, 20, 5);
               enemies.current.splice(i, 1); // Destroy enemy on impact
               
               if (p.hp <= 0) {
                   setGameState('GAMEOVER');
                   if (scoreRef.current > highScore) {
                       localStorage.setItem('arcade_shooter_highscore', scoreRef.current.toString());
                       setHighScore(scoreRef.current);
                   }
               }
          }
      }

      // --- PARTICLES ---
      for (let i = particles.current.length - 1; i >= 0; i--) {
          const pt = particles.current[i];
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.life -= 0.02;
          if (pt.life <= 0) particles.current.splice(i, 1);
      }

      // Wave Logic
      setWave(1 + Math.floor(scoreRef.current / 2000));
  };

  const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear Screen with Trail Effect
      ctx.fillStyle = 'rgba(5, 5, 5, 0.4)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Apply Shake
      const shakeX = (Math.random() - 0.5) * shake.current;
      const shakeY = (Math.random() - 0.5) * shake.current;
      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Draw Grid (Moving perspective hint)
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      const offset = (Date.now() / 50) % 40;
      ctx.beginPath();
      for(let x=0; x<=CANVAS_WIDTH; x+=40) { ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); }
      for(let y=offset; y<=CANVAS_HEIGHT; y+=40) { ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); }
      ctx.stroke();

      // Draw Particles
      particles.current.forEach(p => {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Draw Enemies
      enemies.current.forEach(e => {
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(e.angle);
          
          ctx.strokeStyle = e.type === 'BASIC' ? COLORS.enemyBasic : e.type === 'FAST' ? COLORS.enemyFast : COLORS.enemyTank;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 10;
          ctx.shadowColor = ctx.strokeStyle;

          ctx.beginPath();
          if (e.type === 'TANK') {
              ctx.rect(-e.size, -e.size, e.size*2, e.size*2);
          } else if (e.type === 'FAST') {
              ctx.moveTo(e.size, 0);
              ctx.lineTo(-e.size, -e.size/2);
              ctx.lineTo(-e.size, e.size/2);
              ctx.closePath();
          } else {
              // Diamond
              ctx.moveTo(e.size, 0);
              ctx.lineTo(0, e.size);
              ctx.lineTo(-e.size, 0);
              ctx.lineTo(0, -e.size);
              ctx.closePath();
          }
          ctx.stroke();
          
          // Inner Glow
          ctx.fillStyle = ctx.strokeStyle;
          ctx.globalAlpha = 0.2;
          ctx.fill();
          ctx.globalAlpha = 1;

          ctx.restore();
      });

      // Draw Bullets
      ctx.strokeStyle = COLORS.bullet;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 5;
      ctx.shadowColor = COLORS.bullet;
      ctx.beginPath();
      bullets.current.forEach(b => {
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x - b.vx, b.y - b.vy); // Tail effect
      });
      ctx.stroke();

      // Draw Player
      const p = player.current;
      if (gameState !== 'GAMEOVER' && (p.iframes === 0 || Math.floor(Date.now() / 50) % 2 === 0)) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          
          ctx.strokeStyle = COLORS.player;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 15;
          ctx.shadowColor = COLORS.player;

          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(-10, 10);
          ctx.lineTo(-5, 0);
          ctx.lineTo(-10, -10);
          ctx.closePath();
          ctx.stroke();
          
          // Cockpit
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(0, 0, 2, 0, Math.PI*2);
          ctx.fill();

          ctx.restore();
      }

      ctx.restore(); // End Shake

      // CRT Scanline Overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      for(let y=0; y<CANVAS_HEIGHT; y+=2) {
          ctx.fillRect(0, y, CANVAS_WIDTH, 1);
      }
  };

  const loop = (timestamp: number) => {
      if (gameState === 'PLAYING') {
          update();
      }
      draw();
      frameId.current = requestAnimationFrame(loop);
  };

  const startGame = () => {
      player.current = { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2, vx: 0, vy: 0, angle: -Math.PI/2, hp: 100, iframes: 0 };
      bullets.current = [];
      enemies.current = [];
      particles.current = [];
      scoreRef.current = 0;
      setScore(0);
      setWave(1);
      shake.current = 0;
      setGameState('PLAYING');
  };

  useEffect(() => {
      if (selectedGame !== 'CYBER_DEFENSE') return; // Only run game loop for Cyber Defense
      frameId.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(frameId.current);
  }, [gameState, selectedGame]);

  // Game Selection Screen
  if (selectedGame === 'SELECT') {
    return (
      <div className="p-8 pb-32 flex flex-col items-center justify-center min-h-[80vh] font-mono select-none">
        <h1 className="text-5xl font-black uppercase mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500">
          🎮 ARCADE
        </h1>
        <p className="text-gray-500 text-sm mb-8">Choose your game</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          {/* Cyber Defense */}
          <button
            onClick={() => setSelectedGame('CYBER_DEFENSE')}
            className="group relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-cyan-500 p-6 rounded-xl hover:scale-105 transition-all hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]"
          >
            <div className="absolute top-3 right-3 text-[10px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">ACTION</div>
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-wider">Cyber Defense</h2>
            <p className="text-xs text-gray-400">Vector shooter with waves of enemies. Use WASD + Space to play.</p>
          </button>
          
          {/* Music Trivia */}
          <button
            onClick={() => setSelectedGame('MUSIC_TRIVIA')}
            className="group relative bg-gradient-to-br from-purple-900 to-indigo-900 border-2 border-purple-500 p-6 rounded-xl hover:scale-105 transition-all hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]"
          >
            <div className="absolute top-3 right-3 text-[10px] font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">TRIVIA</div>
            <div className="text-6xl mb-4">🎵</div>
            <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-wider">Music Trivia</h2>
            <p className="text-xs text-gray-400">Test your music knowledge! Earn XP with correct answers.</p>
          </button>
        </div>
      </div>
    );
  }

  // Music Trivia Game
  if (selectedGame === 'MUSIC_TRIVIA') {
    return (
      <div className="h-[calc(100vh-8rem)]">
        <MusicTrivia onExit={() => setSelectedGame('SELECT')} />
      </div>
    );
  }

  // Cyber Defense Game (Original)
  return (
    <div className="p-8 pb-32 flex flex-col items-center justify-center min-h-[80vh] font-mono select-none" ref={containerRef}>
       {/* Back Button */}
       <button 
         onClick={() => setSelectedGame('SELECT')}
         className="absolute top-4 left-4 p-2 hover:bg-white/10 rounded flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
       >
         <ICONS.ArrowUp size={16} className="rotate-[-90deg]" /> Back to Arcade
       </button>
       
       <div className="mb-6 text-center">
          <h2 className="text-4xl font-black font-mono uppercase mb-2 flex items-center justify-center gap-3 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
             <ICONS.Zap size={40} className="text-cyan-400" />
             CYBER_DEFENSE
          </h2>
          <p className="text-gray-500 font-bold tracking-widest text-xs">VECTOR GRAPHICS ENGINE // PHYSICS ENABLED</p>
       </div>

       <div className="bg-[#111] p-2 rounded-xl shadow-2xl relative border border-gray-800">
           {/* Screen Container */}
           <div className="relative rounded-lg overflow-hidden border border-gray-700 shadow-inner bg-black">
               <canvas 
                 ref={canvasRef} 
                 width={CANVAS_WIDTH} 
                 height={CANVAS_HEIGHT}
                 className="block cursor-crosshair"
               />

               {/* HUD */}
               <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none">
                   <div className="text-cyan-400 font-bold text-xl drop-shadow-[0_0_5px_rgba(0,255,255,0.8)]">
                       SCORE: {score.toString().padStart(6, '0')}
                   </div>
                   <div className="text-purple-400 font-bold text-xs">
                       WAVE: {wave}
                   </div>
               </div>

               <div className="absolute top-4 right-4 flex flex-col items-end gap-1 pointer-events-none">
                   <div className="text-xs text-gray-500 font-bold">SHIELD INTEGRITY</div>
                   <div className="w-32 h-4 bg-gray-800 border border-gray-600 skew-x-[-15deg]">
                       <div 
                         className="h-full bg-gradient-to-r from-red-500 to-green-500 transition-all duration-200" 
                         style={{ width: `${Math.max(0, player.current.hp)}%` }}
                       ></div>
                   </div>
               </div>

               {/* Overlays */}
               {gameState === 'MENU' && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                      <h1 className="text-6xl font-black text-white tracking-tighter mb-2 italic" style={{ textShadow: '4px 4px 0px #00ffff' }}>VECTOR WARS</h1>
                      <p className="text-cyan-400 animate-pulse font-mono tracking-widest mb-8">SYSTEM READY</p>
                      
                      <div className="grid grid-cols-2 gap-8 text-xs font-bold text-gray-400 mb-8 border border-gray-800 p-4 rounded">
                          <div className="text-center">
                              <div className="text-white mb-1">MOVEMENT</div>
                              <div>W A S D / ARROWS</div>
                          </div>
                          <div className="text-center">
                              <div className="text-white mb-1">FIRE</div>
                              <div>SPACE / HOLD</div>
                          </div>
                      </div>

                      <button 
                        onClick={startGame}
                        className="group relative px-8 py-4 bg-white text-black font-black uppercase tracking-widest hover:bg-cyan-400 hover:scale-105 transition-all clip-path-polygon"
                      >
                         INITIALIZE
                         <div className="absolute inset-0 border-2 border-white blur opacity-50 group-hover:opacity-100 transition-opacity"></div>
                      </button>
                  </div>
               )}

               {gameState === 'GAMEOVER' && (
                  <div className="absolute inset-0 bg-red-900/40 backdrop-blur-md flex flex-col items-center justify-center z-10">
                      <h2 className="text-5xl font-black text-white mb-2 tracking-widest">MISSION FAILED</h2>
                      <div className="text-4xl font-mono font-bold text-cyan-400 mb-1">{score.toString().padStart(6, '0')}</div>
                      <div className="text-xs text-white/70 mb-8 font-bold uppercase">Personal Best: {highScore}</div>
                      
                      <button 
                        onClick={startGame}
                        className="px-8 py-3 bg-red-600 text-white font-bold uppercase tracking-widest hover:bg-white hover:text-red-600 transition-all shadow-[0_0_20px_rgba(220,38,38,0.6)]"
                      >
                         RETRY
                      </button>
                  </div>
               )}
           </div>
           
           {/* Cabinet Detail */}
           <div className="flex justify-between items-center mt-3 px-2">
               <div className="flex gap-2">
                   <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_red]"></div>
                   <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_yellow]"></div>
                   <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_green]"></div>
               </div>
               <div className="text-[10px] text-gray-600 font-mono">
                   RENDERER: CANVAS_2D // FPS: {FPS}
               </div>
           </div>
       </div>
    </div>
  );
};

export default Arcade;
