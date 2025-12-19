import React, { useRef, useEffect, useState } from 'react';
import { ICONS } from '../constants';

interface MusicVisualizerProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  onClose?: () => void;
}

type VisualizerMode = 'bars' | 'wave' | 'circle' | 'particles';

const MusicVisualizer: React.FC<MusicVisualizerProps> = ({ audioRef, isPlaying, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const [mode, setMode] = useState<VisualizerMode>('bars');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hue, setHue] = useState(0);

  // Initialize audio analyser
  useEffect(() => {
    if (!audioRef.current) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    try {
      const source = audioContext.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      analyserRef.current = analyser;
    } catch (e) {
      // Already connected
      console.log('[Visualizer] Audio already connected');
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [audioRef]);

  // Animation loop
  useEffect(() => {
    if (!canvasRef.current || !analyserRef.current || !isPlaying) {
      cancelAnimationFrame(animationRef.current);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas with fade effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, width, height);
      
      // Update hue for rainbow effect
      setHue(prev => (prev + 0.5) % 360);

      switch (mode) {
        case 'bars':
          drawBars(ctx, dataArray, width, height);
          break;
        case 'wave':
          drawWave(ctx, dataArray, width, height);
          break;
        case 'circle':
          drawCircle(ctx, dataArray, width, height);
          break;
        case 'particles':
          drawParticles(ctx, dataArray, width, height);
          break;
      }
    };

    const drawBars = (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const barWidth = (w / data.length) * 2.5;
      let x = 0;
      
      for (let i = 0; i < data.length; i++) {
        const barHeight = (data[i] / 255) * h * 0.8;
        const gradient = ctx.createLinearGradient(0, h, 0, h - barHeight);
        gradient.addColorStop(0, `hsl(${hue + i * 2}, 100%, 50%)`);
        gradient.addColorStop(1, `hsl(${hue + i * 2 + 60}, 100%, 70%)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, h - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
    };

    const drawWave = (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      ctx.beginPath();
      ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
      ctx.lineWidth = 3;
      
      const sliceWidth = w / data.length;
      let x = 0;
      
      for (let i = 0; i < data.length; i++) {
        const y = (data[i] / 255) * h * 0.5 + h * 0.25;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      
      ctx.stroke();
    };

    const drawCircle = (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const centerX = w / 2;
      const centerY = h / 2;
      const radius = Math.min(w, h) * 0.3;
      
      for (let i = 0; i < data.length; i++) {
        const angle = (i / data.length) * Math.PI * 2;
        const amp = (data[i] / 255) * radius * 0.5;
        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + amp);
        const y2 = centerY + Math.sin(angle) * (radius + amp);
        
        ctx.beginPath();
        ctx.strokeStyle = `hsl(${hue + i * 3}, 100%, 60%)`;
        ctx.lineWidth = 2;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    };

    const drawParticles = (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const avgFreq = data.reduce((a, b) => a + b, 0) / data.length;
      const numParticles = Math.floor(avgFreq / 10);
      
      for (let i = 0; i < numParticles; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const size = Math.random() * 4 + 2;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue + Math.random() * 60}, 100%, 60%, 0.8)`;
        ctx.fill();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, mode, hue]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      canvasRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Controls */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
        <div className="flex gap-2">
          {(['bars', 'wave', 'circle', 'particles'] as VisualizerMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-xs font-mono font-bold uppercase ${
                mode === m ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-white/20 text-white hover:bg-white/30"
          >
            <ICONS.Maximize size={16} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 bg-white/20 text-white hover:bg-white/30"
            >
              <ICONS.Close size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="flex-1"
      />

      {/* Instructions */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white/50 font-mono text-lg">▶ Play music to see visualization</p>
        </div>
      )}
    </div>
  );
};

export default MusicVisualizer;
