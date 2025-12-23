import React, { useRef, useEffect, useState } from 'react';
import { ICONS } from '../constants';

type VisualizerMode = 'bars' | 'wave' | 'circle';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  primaryColor?: string;
  size?: 'sm' | 'md' | 'lg';
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyser,
  isPlaying,
  primaryColor = 'var(--primary)',
  size = 'md',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [mode, setMode] = useState<VisualizerMode>('bars');

  const sizeMap = {
    sm: { width: 100, height: 40 },
    md: { width: 200, height: 60 },
    lg: { width: 300, height: 100 },
  };

  const { width, height } = sizeMap[size];

  useEffect(() => {
    if (!analyser || !canvasRef.current || !isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const drawBars = () => {
      analyser.getByteFrequencyData(dataArray);
      
      ctx.fillStyle = 'transparent';
      ctx.clearRect(0, 0, width, height);
      
      const barCount = 32;
      const barWidth = (width / barCount) * 0.8;
      const gap = (width / barCount) * 0.2;
      
      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * bufferLength);
        const barHeight = (dataArray[dataIndex] / 255) * height;
        
        const x = i * (barWidth + gap);
        const y = height - barHeight;
        
        // Gradient effect
        const gradient = ctx.createLinearGradient(0, height, 0, y);
        gradient.addColorStop(0, primaryColor);
        gradient.addColorStop(1, `${primaryColor}66`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };

    const drawWave = () => {
      analyser.getByteTimeDomainData(dataArray);
      
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = primaryColor;
      ctx.beginPath();
      
      const sliceWidth = width / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    const drawCircle = () => {
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, width, height);
      
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 3;
      const barCount = 64;
      
      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * bufferLength);
        const barLength = (dataArray[dataIndex] / 255) * radius * 0.8;
        
        const angle = (i / barCount) * Math.PI * 2;
        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + barLength);
        const y2 = centerY + Math.sin(angle) * (radius + barLength);
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = primaryColor;
        ctx.stroke();
      }
    };

    const draw = () => {
      if (mode === 'bars') drawBars();
      else if (mode === 'wave') drawWave();
      else if (mode === 'circle') drawCircle();
      
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isPlaying, mode, width, height, primaryColor]);

  const cycleMode = () => {
    setMode(prev => {
      if (prev === 'bars') return 'wave';
      if (prev === 'wave') return 'circle';
      return 'bars';
    });
  };

  return (
    <div className="flex items-center gap-2">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="bg-transparent"
        style={{ width, height }}
      />
      <button
        onClick={cycleMode}
        className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors"
        title={`Visualizer: ${mode}`}
      >
        <ICONS.Activity size={14} className="text-[var(--text-muted)]" />
      </button>
    </div>
  );
};

export default AudioVisualizer;
