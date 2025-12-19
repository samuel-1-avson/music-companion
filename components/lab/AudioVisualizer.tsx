/**
 * AudioVisualizer - Canvas-based audio waveform and spectrum visualization
 */
import React, { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  type: 'waveform' | 'spectrum';
  width?: number;
  height?: number;
  className?: string;
  label?: string;
  activeNote?: string | null;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyser,
  type,
  width = 300,
  height = 150,
  className = '',
  label = 'SIGNAL_OUT',
  activeNote = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current || !analyser) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);

      if (type === 'waveform') {
        analyser.getByteTimeDomainData(dataArray);
        
        // Background
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Grid
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < canvas.width; i += 40) {
          ctx.moveTo(i, 0);
          ctx.lineTo(i, canvas.height);
        }
        for (let i = 0; i < canvas.height; i += 40) {
          ctx.moveTo(0, i);
          ctx.lineTo(canvas.width, i);
        }
        ctx.stroke();

        // Waveform
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00f3ff'; // Cyber Cyan
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#00f3ff';
        ctx.beginPath();
        
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * canvas.height / 2;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Spectrum
        analyser.getByteFrequencyData(dataArray);
        
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        
        const barWidth = (w / bufferLength) * 2.5;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * h;
          ctx.fillStyle = `rgba(34, 197, 94, ${dataArray[i] / 255})`; // Green
          ctx.fillRect(x, h - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [analyser, type]);

  return (
    <div className={`bg-black border-2 border-gray-700 rounded-lg p-4 relative shadow-[inset_0_0_30px_rgba(0,0,0,1)] ${className}`}>
      <canvas ref={canvasRef} width={width} height={height} className="w-full h-full opacity-90" />
      <div className="absolute top-2 left-3 text-[10px] font-mono text-cyan-500 uppercase tracking-widest border border-cyan-900 px-1 bg-black/50">
        {label}
      </div>
      {activeNote !== undefined && (
        <div className="absolute top-2 right-3 text-xl font-bold font-mono text-orange-500">
          {activeNote || '--'}
        </div>
      )}
    </div>
  );
};

export default AudioVisualizer;
