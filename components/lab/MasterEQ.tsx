/**
 * MasterEQ Component
 * 5-band equalizer with spectrum visualization
 */

import React, { useRef, useEffect } from 'react';
import { ICONS } from '../../constants';

interface MasterEQProps {
  eqValues?: number[];
  setEQBand?: (index: number, value: number) => void;
  analyser?: AnalyserNode | null;
}

const EQ_FREQUENCIES = ['60Hz', '310Hz', '1kHz', '3kHz', '12kHz'];

const MasterEQ: React.FC<MasterEQProps> = ({ 
  eqValues = [0, 0, 0, 0, 0], 
  setEQBand,
  analyser 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Spectrum visualizer
  useEffect(() => {
    if (!analyser || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let frame = 0;

    const render = () => {
      frame = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);
      
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      
      const barWidth = (w / bufferLength) * 2.5;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * h;
        ctx.fillStyle = `rgba(34, 197, 94, ${dataArray[i]/255})`;
        ctx.fillRect(x, h - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    
    render();
    return () => cancelAnimationFrame(frame);
  }, [analyser]);

  return (
    <div className="bg-[#111] border-4 border-gray-800 p-8 shadow-2xl animate-in slide-in-from-left-4 rounded-lg relative overflow-hidden">
      {/* Screw holes for rack aesthetic */}
      <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-gray-800 border border-gray-600"></div>
      <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-gray-800 border border-gray-600"></div>
      <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-gray-800 border border-gray-600"></div>
      <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-gray-800 border border-gray-600"></div>

      <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4 relative z-10">
        <h3 className="text-gray-200 font-bold font-mono text-xl tracking-widest flex items-center gap-2">
          <ICONS.Sliders className="text-green-500" /> MASTER_EQ_RACK
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Signal</span>
          <div className={`w-3 h-3 rounded-full border border-green-900 ${analyser ? 'bg-green-500 shadow-[0_0_8px_lime]' : 'bg-green-900'}`}></div>
        </div>
      </div>

      <div className="flex justify-between items-end h-64 px-4 md:px-12 gap-4 md:gap-8 bg-[#0a0a0a] rounded-lg border border-gray-800 pt-8 pb-4 shadow-inner relative overflow-hidden">
        
        {/* Background Visualizer Canvas */}
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" 
          width={600} 
          height={300} 
        />

        {EQ_FREQUENCIES.map((freq, i) => {
          const val = eqValues?.[i] ?? 0;
          return (
            <div key={freq} className="flex-1 flex flex-col items-center h-full group relative z-10">
              {/* Fader Track */}
              <div className="flex-1 w-2 bg-gray-800 relative rounded-full overflow-hidden mb-2 shadow-[inset_0_0_5px_black]">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-600"></div>
              </div>
              
              {/* Fader Cap */}
              <div 
                className="absolute w-8 h-12 bg-gradient-to-b from-gray-700 to-black border border-gray-500 rounded flex items-center justify-center shadow-xl z-10 cursor-pointer hover:border-white transition-colors"
                style={{ bottom: `calc(${(val + 10) * 5}% - 6px)` }}
              >
                <div className="w-full h-0.5 bg-white shadow-[0_0_5px_white]"></div>
              </div>

              {/* Invisible Input */}
              <input 
                type="range"
                min="-10"
                max="10"
                step="1"
                value={val}
                onChange={(e) => setEQBand && setEQBand(i, parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-20"
                {...({ orient: "vertical" } as any)}
              />
              
              <span className="mt-2 font-mono text-[10px] font-bold text-gray-500 group-hover:text-white transition-colors">
                {freq}
              </span>
              <span className={`absolute -top-6 font-mono text-[10px] font-bold transition-opacity ${val !== 0 ? 'opacity-100 text-green-400' : 'opacity-0'}`}>
                {val > 0 ? '+' : ''}{val}dB
              </span>
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 flex justify-between items-center text-[10px] font-mono text-gray-600 uppercase">
        <span>Input: Stereo / 48kHz</span>
        <span>Output: Main Mix</span>
      </div>
    </div>
  );
};

export default MasterEQ;
