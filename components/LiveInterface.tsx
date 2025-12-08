import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { useLiveSession } from '../hooks/useLiveSession';
import { Song } from '../types';

interface LiveInterfaceProps {
  currentSong: Song | null;
}

const LiveInterface: React.FC<LiveInterfaceProps> = ({ currentSong }) => {
  const [transcripts, setTranscripts] = useState<{text: string, isUser: boolean}[]>([]);
  const { 
    connect, 
    disconnect, 
    isConnected, 
    isSpeaking, 
    error, 
    volume,
    startVideo,
    stopVideo,
    isVideoActive,
    videoMode,
    videoStream
  } = useLiveSession({
    onTranscript: (text, isUser) => {
      setTranscripts(prev => {
        const last = prev[prev.length - 1];
        if (last && last.isUser === isUser) {
           return [...prev.slice(0, -1), { text: last.text + " " + text, isUser }];
        }
        return [...prev, { text, isUser }];
      });
    }
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Attach video stream to preview element
  useEffect(() => {
    if (videoPreviewRef.current) {
        if (videoStream) {
            videoPreviewRef.current.srcObject = videoStream;
        } else {
            videoPreviewRef.current.srcObject = null;
        }
    }
  }, [videoStream]);

  // Animation Logic for the "Entity"
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const draw = () => {
      time += 0.05;
      
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      
      const breath = Math.sin(time) * 5;
      const reaction = isSpeaking ? volume * 1.5 : 0;
      const radius = 60 + breath + reaction;

      if (isConnected) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 20, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(251, 146, 60, ${isSpeaking ? 0.3 : 0.1})`; 
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 40 + (Math.sin(time * 0.5) * 10), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(251, 146, 60, ${isSpeaking ? 0.1 : 0.05})`; 
          ctx.lineWidth = 1;
          ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      
      if (isConnected) {
        const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radius);
        gradient.addColorStop(0, '#fff'); 
        gradient.addColorStop(0.4, '#fb923c'); 
        gradient.addColorStop(1, '#000'); 
        
        ctx.fillStyle = isSpeaking ? '#fb923c' : '#000';
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 4;
        ctx.fill();
        ctx.stroke();

        if (isSpeaking) {
             ctx.fillStyle = '#fff';
             ctx.beginPath();
             ctx.arc(centerX + Math.random() * 10 - 5, centerY + Math.random() * 10 - 5, radius * 0.2, 0, Math.PI * 2);
             ctx.fill();
        }
      } else {
        ctx.fillStyle = '#e5e7eb'; 
        ctx.strokeStyle = '#9ca3af'; 
        ctx.lineWidth = 4;
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#9ca3af';
        ctx.font = '24px monospace';
        ctx.fillText("Zzz", centerX - 20, centerY + 8);
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isConnected, isSpeaking, volume]);

  const toggleCamera = () => {
    if (videoMode === 'camera') stopVideo();
    else startVideo('camera');
  };

  const toggleScreen = () => {
    if (videoMode === 'screen') stopVideo();
    else startVideo('screen');
  };

  return (
    <div className="flex flex-col h-full bg-[#fcfbf9] text-black relative overflow-hidden">
      
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      {/* Header Info */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20 pointer-events-none">
        <div>
           <div className="bg-black text-white px-3 py-1 text-xs font-mono font-bold inline-block mb-2">COMPANION_CORE_V2.1</div>
           <h2 className="text-4xl font-bold font-mono tracking-tighter uppercase">Echo Vision</h2>
        </div>
        
        {currentSong && (
           <div className="bg-white border-2 border-black p-3 shadow-retro-sm max-w-xs flex items-center space-x-3 pointer-events-auto">
              <div className="w-10 h-10 border border-black bg-gray-200 flex-shrink-0">
                 <img src={currentSong.coverUrl} className="w-full h-full object-cover grayscale" alt="art"/>
              </div>
              <div className="min-w-0">
                 <div className="text-[10px] font-bold font-mono text-gray-500 uppercase">Context</div>
                 <div className="font-bold text-sm truncate">{currentSong.title}</div>
              </div>
           </div>
        )}
      </div>

      {/* Main Interaction Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        
        {/* Status Text */}
        <div className="mb-8 h-8 font-mono font-bold text-orange-600 tracking-widest uppercase flex items-center space-x-4">
           {error ? (
             <span className="text-red-600 bg-red-100 px-2 py-1 border border-red-500">ERROR: {error}</span>
           ) : (
             <>
               {isSpeaking ? (
                 <span className="animate-pulse">● SPEAKING</span>
               ) : isConnected ? (
                 <span className="text-black">● LISTENING</span>
               ) : (
                 <span className="text-gray-400">● OFFLINE</span>
               )}
               
               {isVideoActive && (
                 <span className="bg-black text-white px-2 py-0.5 text-xs">
                   ● VISION_ACTIVE: {videoMode === 'camera' ? 'EYES' : 'SCREEN'}
                 </span>
               )}
             </>
           )}
        </div>

        {/* Video Preview Overlay */}
        {isVideoActive && (
          <div className="absolute top-24 right-8 w-48 border-2 border-black bg-black shadow-retro-sm z-30 transform rotate-1">
             <video 
               ref={videoPreviewRef} 
               autoPlay 
               muted 
               playsInline
               className="w-full h-auto grayscale opacity-80"
             />
             <div className="bg-black text-white text-[10px] font-mono px-1 py-0.5 text-center">
               LIVE_FEED_INGEST
             </div>
          </div>
        )}

        {/* The Core Visualizer */}
        <div className="relative w-80 h-80 flex items-center justify-center">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            
            {!isConnected && (
                <button 
                  onClick={connect}
                  className="absolute z-20 bg-black text-white hover:bg-orange-500 hover:text-black hover:border-black border-2 border-transparent transition-all w-20 h-20 rounded-full flex items-center justify-center shadow-lg font-bold font-mono text-xs uppercase tracking-widest active:scale-95"
                >
                   WAKE
                </button>
            )}
        </div>

        {/* Controls */}
        <div className="mt-8 flex items-center space-x-4">
           {isConnected && (
             <>
                <button 
                  onClick={toggleCamera}
                  className={`p-3 border-2 border-black rounded-full transition-all active:scale-95 ${
                    videoMode === 'camera' 
                      ? 'bg-black text-white shadow-none' 
                      : 'bg-white text-black hover:bg-orange-100 shadow-retro-sm'
                  }`}
                  title="Toggle Vision (Camera)"
                >
                   <ICONS.Image size={24} />
                </button>

                <button 
                  onClick={toggleScreen}
                  className={`p-3 border-2 border-black rounded-full transition-all active:scale-95 ${
                    videoMode === 'screen' 
                      ? 'bg-black text-white shadow-none' 
                      : 'bg-white text-black hover:bg-orange-100 shadow-retro-sm'
                  }`}
                  title="Toggle Screen Share"
                >
                   <ICONS.ScreenShare size={24} />
                </button>

                <div className="w-px h-8 bg-black mx-2"></div>

                <button 
                  onClick={disconnect}
                  className="px-4 py-2 text-xs font-bold font-mono bg-red-100 text-red-600 border-2 border-red-500 hover:bg-red-500 hover:text-white transition-colors uppercase tracking-widest shadow-retro-sm active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
                >
                  Terminate
                </button>
             </>
           )}
        </div>
        
        {!isConnected && (
            <p className="mt-8 text-gray-500 font-mono text-sm text-center">
              Wake Echo to enable vision sensors.
            </p>
        )}
      </div>

      {/* Live Transcript Log */}
      <div className="h-1/3 border-t-2 border-black bg-white p-6 overflow-hidden flex flex-col">
         <div className="flex justify-between items-center mb-4">
            <h3 className="font-mono font-bold text-sm uppercase flex items-center gap-2">
               <ICONS.MessageSquare size={14} /> Transcript_Log
            </h3>
            <div className="flex space-x-1">
               <div className="w-2 h-2 rounded-full bg-gray-300"></div>
               <div className="w-2 h-2 rounded-full bg-gray-300"></div>
            </div>
         </div>
         
         <div className="flex-1 overflow-y-auto space-y-3 font-mono text-sm pr-2">
            {transcripts.length === 0 && (
               <div className="text-gray-400 italic opacity-50 text-xs">
                  > System initialized.<br/>
                  > Waiting for input stream...
               </div>
            )}
            {transcripts.map((t, i) => (
               <div key={i} className={`flex ${t.isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-2 border-2 ${t.isUser ? 'border-black bg-gray-50 text-black' : 'border-orange-500 bg-orange-50 text-black shadow-retro-sm'}`}>
                     <span className="text-[10px] font-bold block mb-1 opacity-50 uppercase">{t.isUser ? 'USER' : 'ECHO'}</span>
                     {t.text}
                  </div>
               </div>
            ))}
         </div>
      </div>

    </div>
  );
};

export default LiveInterface;