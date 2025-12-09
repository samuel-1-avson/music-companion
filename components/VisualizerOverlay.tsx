
import React, { useEffect, useRef } from 'react';
import { ICONS } from '../constants';

interface VisualizerOverlayProps {
  analyser: AnalyserNode | null;
  onClose: () => void;
}

const VisualizerOverlay: React.FC<VisualizerOverlayProps> = ({ analyser, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    let angleOffset = 0;

    const render = () => {
      animationRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      // Trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, w, h);

      angleOffset += 0.005;

      // Circular Spectrum
      const radius = Math.min(w, h) / 4;
      const bars = 120; // Number of bars around circle
      const step = Math.floor(bufferLength / bars);

      ctx.lineWidth = 4;
      ctx.lineCap = 'round';

      for (let i = 0; i < bars; i++) {
         const value = dataArray[i * step];
         const percent = value / 255;
         const barHeight = percent * (Math.min(w, h) / 3);
         
         const angle = (Math.PI * 2 * (i / bars)) + angleOffset;
         
         const x1 = cx + Math.cos(angle) * radius;
         const y1 = cy + Math.sin(angle) * radius;
         const x2 = cx + Math.cos(angle) * (radius + barHeight);
         const y2 = cy + Math.sin(angle) * (radius + barHeight);

         // Color based on frequency/index
         const hue = (i / bars) * 360 + (angleOffset * 50);
         ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
         
         ctx.beginPath();
         ctx.moveTo(x1, y1);
         ctx.lineTo(x2, y2);
         ctx.stroke();
         
         // Reflection (Inner Circle)
         if (percent > 0.5) {
             const x3 = cx + Math.cos(angle) * (radius - barHeight * 0.2);
             const y3 = cy + Math.sin(angle) * (radius - barHeight * 0.2);
             ctx.globalAlpha = 0.3;
             ctx.beginPath();
             ctx.moveTo(x1, y1);
             ctx.lineTo(x3, y3);
             ctx.stroke();
             ctx.globalAlpha = 1;
         }
      }

      // Bass Thump Center
      let bass = 0;
      for(let i=0; i<10; i++) bass += dataArray[i];
      bass = bass / 10;
      
      const bassScale = 1 + (bass / 255) * 0.5;
      
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.8 * bassScale, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${bass/500})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Starfield effect moving towards camera
      // Simplified for brevity in this loop
    };

    render();

    return () => {
        window.removeEventListener('resize', resize);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser]);

  return (
    <div className="fixed inset-0 z-[100] bg-black">
       <canvas ref={canvasRef} className="block w-full h-full" />
       
       <button 
         onClick={onClose}
         className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors flex items-center gap-2 font-mono text-sm uppercase border border-white/20 hover:border-white px-4 py-2 rounded-full"
       >
          <ICONS.Close size={16} /> Close Visualizer
       </button>
       
       <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none">
          <h2 className="text-white/20 font-black text-6xl font-mono uppercase tracking-widest animate-pulse">
             HYPER_WAVE
          </h2>
       </div>
    </div>
  );
};

export default VisualizerOverlay;
