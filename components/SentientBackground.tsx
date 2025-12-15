
import React, { useEffect, useRef } from 'react';

interface SentientBackgroundProps {
  mood: string;
  isPlaying: boolean;
  theme: string;
}

// Noise texture data URI (subtle grain)
const NOISE_URI = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`;

const SentientBackground: React.FC<SentientBackgroundProps> = ({ mood, isPlaying, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  // Light Theme Palettes (Pastels for readability with black text)
  const PALETTES_LIGHT: Record<string, string[]> = {
    energetic: ['#fed7aa', '#fdba74', '#fcd34d', '#fef08a'], // Orange/Yellow
    happy:     ['#fed7aa', '#fdba74', '#fcd34d', '#fef08a'],
    cool:      ['#bae6fd', '#7dd3fc', '#a5f3fc', '#cffafe'], // Sky/Cyan
    chill:     ['#bae6fd', '#7dd3fc', '#a5f3fc', '#cffafe'],
    focus:     ['#ddd6fe', '#c4b5fd', '#e9d5ff', '#f0abfc'], // Violet/Purple/Fuchsia
    deep:      ['#ddd6fe', '#c4b5fd', '#e9d5ff', '#f0abfc'],
    nature:    ['#bbf7d0', '#86efac', '#d9f99d', '#bef264'], // Green/Lime
    dark:      ['#e4e4e7', '#d4d4d8', '#a1a1aa', '#f4f4f5'], // Grays (kept light)
    default:   ['#f4f4f5', '#e4e4e7', '#f3f4f6', '#e5e7eb'],  // Zinc
    // Specific theme overrides
    minimal:   ['#f3f4f6', '#e5e7eb', '#f9fafb', '#f1f5f9'],
    solar:     ['#ffedd5', '#fed7aa', '#fef3c7', '#fff7ed'],
    glacier:   ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc'],
  };

  // Dark Theme Palettes (Deep/Neon for readability with white text)
  const PALETTES_DARK: Record<string, string[]> = {
    energetic: ['#c2410c', '#ea580c', '#b45309', '#d97706'], 
    happy:     ['#c2410c', '#ea580c', '#b45309', '#d97706'],
    cool:      ['#0369a1', '#0284c7', '#0e7490', '#0891b2'], 
    chill:     ['#0369a1', '#0284c7', '#0e7490', '#0891b2'],
    focus:     ['#6d28d9', '#7c3aed', '#7e22ce', '#9333ea'], 
    deep:      ['#4c1d95', '#5b21b6', '#581c87', '#6b21a8'],
    nature:    ['#15803d', '#16a34a', '#3f6212', '#4d7c0f'], 
    dark:      ['#000000', '#18181b', '#27272a', '#09090b'], 
    default:   ['#18181b', '#27272a', '#18181b', '#000000'],
    // Specific theme overrides
    midnight:  ['#0f172a', '#1e293b', '#334155', '#38bdf8'],
    matrix:    ['#002200', '#003300', '#001100', '#004400'],
    synthwave: ['#4a044e', '#701a75', '#86198f', '#22d3ee'],
    obsidian:  ['#000000', '#111111', '#222222', '#333333'],
    nebula:    ['#312e81', '#4338ca', '#6366f1', '#f472b6'],
  };

  const getPalette = (m: string, t: string) => {
      // Determine if the current theme is primarily dark
      const isDarkTheme = ['cyber', 'midnight', 'matrix', 'synthwave', 'obsidian', 'nebula'].includes(t);
      const map = isDarkTheme ? PALETTES_DARK : PALETTES_LIGHT;
      
      // If explicit theme exists in the map, use it regardless of mood
      if (map[t]) {
          return map[t];
      }

      const lower = m.toLowerCase();
      
      let key = 'default';
      if (lower.includes('energetic') || lower.includes('happy')) key = 'energetic';
      else if (lower.includes('cool') || lower.includes('chill')) key = 'cool';
      else if (lower.includes('focus') || lower.includes('deep')) key = 'focus';
      else if (lower.includes('nature') || lower.includes('forest')) key = 'nature';
      else if (lower.includes('dark') || lower.includes('night')) key = 'dark';
      
      return map[key];
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        mouseRef.current = {
            x: e.clientX / window.innerWidth,
            y: e.clientY / window.innerHeight
        };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const palette = getPalette(mood, theme);
    const isDarkTheme = ['cyber', 'midnight', 'matrix', 'synthwave', 'obsidian', 'nebula'].includes(theme);
    const isMinimal = theme === 'minimal';
    
    // Increased blob count for richer visuals
    const blobs = [
      { x: 0.2, y: 0.2, vx: 0.001, vy: 0.002, r: 0.4, color: palette[0], angle: 0 },
      { x: 0.8, y: 0.3, vx: -0.001, vy: 0.001, r: 0.5, color: palette[1], angle: 1 },
      { x: 0.4, y: 0.8, vx: 0.001, vy: -0.001, r: 0.4, color: palette[2], angle: 2 },
      { x: 0.7, y: 0.7, vx: -0.002, vy: -0.002, r: 0.3, color: palette[3], angle: 3 },
      { x: 0.5, y: 0.5, vx: 0.001, vy: 0.001, r: 0.6, color: palette[0], angle: 4 }, // Center-ish anchor
    ];

    const resize = () => {
        // Use window size directly, but keep internal resolution reasonable for blur performance
        canvas.width = window.innerWidth / 2; 
        canvas.height = window.innerHeight / 2;
    };
    window.addEventListener('resize', resize);
    resize();

    const render = () => {
      // Dynamic speed
      const baseSpeed = isPlaying ? 0.008 : 0.002; 
      time += baseSpeed;

      const w = canvas.width;
      const h = canvas.height;

      // Base background color logic
      let bg = '#ffffff'; // Default Light
      if (theme === 'classic') bg = '#fcfbf9';
      else if (theme === 'forest') bg = '#f0fdf4';
      else if (theme === 'lavender') bg = '#faf5ff';
      else if (theme === 'solar') bg = '#fff7ed';
      else if (theme === 'glacier') bg = '#f0f9ff';
      else if (theme === 'cyber') bg = '#09090b';
      else if (theme === 'midnight') bg = '#0f172a';
      else if (theme === 'matrix') bg = '#000000';
      else if (theme === 'synthwave') bg = '#2e022d';
      else if (theme === 'obsidian') bg = '#050505';
      else if (theme === 'nebula') bg = '#1e1b4b';

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      blobs.forEach((blob, i) => {
         // Mouse Interaction: Gently drift towards mouse, but repelled if too close (fluid-like)
         const mx = mouseRef.current.x;
         const my = mouseRef.current.y;
         const dx = mx - blob.x;
         const dy = my - blob.y;
         
         // Subtle attraction to mouse
         blob.vx += dx * 0.00005;
         blob.vy += dy * 0.00005;

         // Natural movement
         blob.x += blob.vx + Math.sin(time + blob.angle) * 0.002;
         blob.y += blob.vy + Math.cos(time + blob.angle) * 0.002;

         // Soft boundaries
         if (blob.x < -0.2) blob.vx += 0.002;
         if (blob.x > 1.2) blob.vx -= 0.002;
         if (blob.y < -0.2) blob.vy += 0.002;
         if (blob.y > 1.2) blob.vy -= 0.002;

         // Damping
         blob.vx *= 0.99;
         blob.vy *= 0.99;

         // Draw Blob
         const x = blob.x * w;
         const y = blob.y * h;
         const r = blob.r * Math.max(w, h); // Dynamic radius

         // Gradients for depth
         const g = ctx.createRadialGradient(x, y, 0, x, y, r);
         g.addColorStop(0, blob.color);
         g.addColorStop(1, 'transparent');

         ctx.fillStyle = g;
         // Lower opacity for light themes to prevent text blending issues
         // Minimal theme gets extra reduction for "10x better" readability
         if (isMinimal) {
             ctx.globalAlpha = 0.15; 
         } else if (isDarkTheme) {
             ctx.globalAlpha = 0.6;
         } else {
             ctx.globalAlpha = 0.35;
         }
         
         ctx.beginPath();
         ctx.arc(x, y, r, 0, Math.PI * 2);
         ctx.fill();
      });

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
        window.removeEventListener('resize', resize);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [mood, isPlaying, theme]);

  const getNoiseOpacity = () => {
      if (['cyber', 'midnight', 'matrix', 'synthwave', 'obsidian', 'nebula'].includes(theme)) return 0.3;
      if (theme === 'minimal') return 0.2; // Softer noise for minimal
      return 0.6;
  };

  return (
    <>
        <canvas 
        ref={canvasRef} 
        className="fixed inset-0 w-full h-full pointer-events-none transition-opacity duration-1000"
        style={{ zIndex: -2, filter: 'blur(80px)' }} 
        />
        {/* Noise Overlay for texture */}
        <div 
            className="fixed inset-0 w-full h-full pointer-events-none"
            style={{ 
                zIndex: -1, 
                backgroundImage: NOISE_URI,
                opacity: getNoiseOpacity(),
                mixBlendMode: 'overlay'
            }}
        ></div>
    </>
  );
};

export default SentientBackground;
