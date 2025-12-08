import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { useLiveSession } from '../hooks/useLiveSession';
import { Type } from '@google/genai';

interface IntroPageProps {
  onComplete: (userName: string) => void;
}

const IntroPage: React.FC<IntroPageProps> = ({ onComplete }) => {
  const [completedName, setCompletedName] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Define the tool the AI will use to "submit" the name
  const tools = [{
    functionDeclarations: [{
      name: "completeIntro",
      description: "Call this function when the user has provided their name and you have welcomed them. This completes the setup process.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          userName: { type: Type.STRING, description: "The name the user wants to be called." }
        },
        required: ["userName"]
      }
    }]
  }];

  const systemInstruction = `
    You are the "Music Companion OS", a futuristic, intelligent, and warm AI audio assistant booting up for the first time. 
    Your goal is to introduce yourself briefly and ask the user what they would like to be called.
    
    Rules:
    1. Keep your greeting short and cool. (e.g. "Systems initialized. Audio Core Online. I am your Music Companion. Who am I speaking with?")
    2. Listen to the user's name.
    3. If they give a name, reply warmly (e.g. "Nice to meet you, [Name]. Config loaded. Let's begin.") AND IMMEDIATELY call the "completeIntro" tool with their name.
    4. If they don't give a name or ask something else, politely guide them back to giving a name.
    5. Be concise. Do not talk too much. The user wants to listen to music.
  `;

  const { connect, disconnect, isConnected, isSpeaking, volume, error } = useLiveSession({
    systemInstruction,
    tools,
    onToolCall: (functionCalls) => {
      const call = functionCalls.find(fc => fc.name === 'completeIntro');
      if (call && call.args.userName) {
        setCompletedName(call.args.userName);
        // Wait a brief moment for the AI audio to finish/fade before switching
        setTimeout(() => {
           disconnect();
           onComplete(call.args.userName);
        }, 3500);
      }
    }
  });

  // Force show manual input on error if it's not a permission error we can retry
  useEffect(() => {
    if (error && !error.includes('denied')) {
        setShowManualInput(true);
    }
  }, [error]);

  const handleManualSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (manualName.trim()) {
          disconnect();
          onComplete(manualName.trim());
      }
  };

  // Visualizer Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    
    const render = () => {
       time += 0.05;
       const width = canvas.width = window.innerWidth;
       const height = canvas.height = window.innerHeight;
       const cx = width / 2;
       const cy = height / 2;

       ctx.clearRect(0, 0, width, height);

       if (!isConnected && !completedName) {
           // Idle Pulse
           ctx.beginPath();
           ctx.arc(cx, cy, 10 + Math.sin(time) * 5, 0, Math.PI * 2);
           ctx.fillStyle = '#333';
           ctx.fill();
           
           // Rings
           ctx.strokeStyle = '#ddd';
           ctx.lineWidth = 1;
           ctx.beginPath();
           ctx.arc(cx, cy, 50, 0, Math.PI * 2);
           ctx.stroke();
       } else if (completedName) {
           // Success State (Explosion/Fill)
           const progress = (Date.now() % 1000) / 1000; 
           ctx.fillStyle = '#fb923c'; // Orange
           ctx.beginPath();
           ctx.arc(cx, cy, 50 + (time * 50), 0, Math.PI * 2);
           ctx.fill();
           
           ctx.fillStyle = '#000';
           ctx.font = 'bold 40px monospace';
           ctx.textAlign = 'center';
           ctx.fillText(`WELCOME, ${completedName.toUpperCase()}`, cx, cy);
       } else {
           // Active Voice State
           const vol = Math.max(5, volume); // Minimum presence
           const radius = 80 + vol;

           // Core
           ctx.beginPath();
           ctx.arc(cx, cy, radius, 0, Math.PI * 2);
           ctx.fillStyle = isSpeaking ? '#fb923c' : '#000'; // Orange when speaking, black listening
           ctx.fill();
           
           // Glow
           ctx.shadowBlur = 40;
           ctx.shadowColor = isSpeaking ? '#fb923c' : '#000';
           ctx.fill();
           ctx.shadowBlur = 0;

           // Waveform Rings
           ctx.strokeStyle = '#000';
           ctx.lineWidth = 2;
           for(let i=0; i<3; i++) {
              ctx.beginPath();
              const r = radius + 30 + (i * 20) + (Math.sin(time + i) * 10);
              ctx.arc(cx, cy, r, 0, Math.PI * 2);
              ctx.globalAlpha = 0.5 / (i + 1);
              ctx.stroke();
           }
           ctx.globalAlpha = 1;
           
           // Connecting Lines decoration
           ctx.strokeStyle = '#fb923c';
           ctx.lineWidth = 1;
           ctx.beginPath();
           ctx.moveTo(0, cy);
           ctx.lineTo(width, cy);
           ctx.globalAlpha = 0.2;
           ctx.stroke();
           ctx.globalAlpha = 1;
       }

       animationFrameRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
       if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isConnected, isSpeaking, volume, completedName]);

  return (
    <div className="fixed inset-0 bg-[#fcfbf9] z-50 flex flex-col items-center justify-center font-mono text-black overflow-hidden cursor-crosshair">
       <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
       
       <div className="relative z-10 flex flex-col items-center gap-8 max-w-md w-full px-8">
           {!isConnected && !completedName && !showManualInput && (
               <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center gap-6 text-center">
                   <div className="bg-black text-white px-4 py-1 text-xs font-bold tracking-widest uppercase mb-4 shadow-retro-sm">
                       System Offline
                   </div>
                   
                   <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase mb-2">
                       Music Companion
                   </h1>
                   <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-8">
                       Neural Audio Interface v2.5
                   </p>
                   
                   {error && (
                        <div className="bg-red-50 border-2 border-red-500 text-red-600 p-4 text-xs font-bold mb-4 animate-pulse">
                            <span className="block mb-2 text-lg">⚠️ ERROR</span>
                            {error}
                        </div>
                   )}

                   <button 
                     onClick={connect}
                     className="group relative px-12 py-6 bg-black text-white font-bold text-xl uppercase tracking-widest hover:bg-orange-500 hover:text-black transition-all border-2 border-black shadow-retro hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]"
                   >
                       <span className="flex items-center gap-4">
                          <ICONS.Power size={24} className="group-hover:animate-pulse" />
                          {error ? "Retry Connection" : "Initialize"}
                       </span>
                   </button>
                   
                   <button 
                     onClick={() => setShowManualInput(true)} 
                     className="text-xs text-gray-400 hover:text-black underline mt-4"
                   >
                     Skip Voice Setup
                   </button>
               </div>
           )}

           {showManualInput && !completedName && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 w-full bg-white border-2 border-black p-6 shadow-retro">
                   <h3 className="text-xl font-bold font-mono uppercase mb-4">Manual Config</h3>
                   {error && <p className="text-red-600 text-xs font-bold mb-4">CONNECTION ERROR: {error}</p>}
                   <p className="text-sm text-gray-600 mb-4">Please enter your name to initialize the system manually.</p>
                   <form onSubmit={handleManualSubmit} className="flex gap-2">
                       <input 
                         type="text" 
                         value={manualName} 
                         onChange={(e) => setManualName(e.target.value)}
                         placeholder="Enter Name..."
                         className="flex-1 border-2 border-black p-3 font-mono focus:outline-none focus:bg-orange-50"
                         autoFocus
                       />
                       <button type="submit" className="bg-black text-white px-4 font-bold uppercase hover:bg-orange-500 transition-colors">
                           Enter
                       </button>
                   </form>
               </div>
           )}

           {isConnected && !completedName && !showManualInput && (
               <div className="flex flex-col items-center animate-in fade-in duration-1000 mt-64 text-center">
                   <div className={`px-4 py-2 border-2 border-black font-bold text-xs uppercase tracking-widest mb-4 transition-colors ${isSpeaking ? 'bg-orange-500 text-white' : 'bg-white text-black'}`}>
                       {isSpeaking ? "Agent Speaking" : "Listening..."}
                   </div>
                   <p className="text-gray-400 text-xs font-mono uppercase mb-4">Speak clearly to the interface</p>
                   <button onClick={() => setShowManualInput(true)} className="text-xs underline text-gray-400 hover:text-black">
                       Switch to Text Input
                   </button>
               </div>
           )}
           
           {completedName && (
               <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-50">
                  <div className="text-center">
                     <ICONS.Loader className="animate-spin w-12 h-12 mx-auto mb-4" />
                     <p className="font-bold font-mono uppercase">Loading Profile...</p>
                  </div>
               </div>
           )}
       </div>

       {/* Footer */}
       <div className="absolute bottom-8 text-center opacity-30 pointer-events-none">
           <ICONS.Music className="w-6 h-6 mx-auto mb-2" />
           <p className="text-[10px] uppercase font-bold tracking-[0.2em]">Gemini Live Audio Engine</p>
       </div>
    </div>
  );
};

export default IntroPage;