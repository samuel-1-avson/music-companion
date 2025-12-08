import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { useLiveSession } from '../hooks/useLiveSession';
import { Song, MusicProvider } from '../types';
import { Type } from '@google/genai';
import { searchMusic, getYouTubeAudioStream, downloadAudioAsBlob, searchUnified } from '../services/musicService';
import { searchSpotifyTrack } from '../services/spotifyService';
import { saveSong } from '../utils/db';

interface LiveInterfaceProps {
  currentSong: Song | null;
  musicAnalyser?: AnalyserNode | null;
  onPlaySong?: (song: Song) => void;
  spotifyToken?: string | null;
  musicProvider?: MusicProvider;
}

const LiveInterface: React.FC<LiveInterfaceProps> = ({ 
    currentSong, 
    musicAnalyser, 
    onPlaySong, 
    spotifyToken,
    musicProvider = 'YOUTUBE' 
}) => {
  const [transcripts, setTranscripts] = useState<{text: string, isUser: boolean, timestamp: number}[]>([]);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Define Tools
  const tools = [{
      functionDeclarations: [
        {
          name: "downloadMusic",
          description: "Search for and download a music track to the user's offline library. Call this when the user explicitly asks to DOWNLOAD a song.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              query: { type: Type.STRING, description: "The song and artist name to search for." }
            },
            required: ["query"]
          }
        },
        {
          name: "playMusic",
          description: "Search for and play a specific song immediately. Call this when the user asks to PLAY a song or artist.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              query: { type: Type.STRING, description: "The song and artist name to search for." }
            },
            required: ["query"]
          }
        }
      ]
  }];
  
  const systemInstruction = `
    You are a warm, knowledgeable, and cool Music Companion. 
    You act like a late-night radio host or a close friend hanging out in the studio. 
    
    Capabilities:
    1. See: You have eyes. If the user shares their screen or camera, comment on it.
    2. DJ: You can play music. If the user asks to hear something, use the 'playMusic' tool.
    3. Download: If the user wants to save a song for offline, use the 'downloadMusic' tool.
    
    Style:
    - Keep responses concise (1-2 sentences) unless asked for deep analysis.
    - Be enthusiastic about music.
  `;

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
    videoStream,
    toggleMute,
    isMuted,
    sendToolResponse
  } = useLiveSession({
    tools: tools,
    systemInstruction: systemInstruction,
    onTranscript: (text, isUser) => {
      setTranscripts(prev => {
        const last = prev[prev.length - 1];
        // Merge contiguous messages from same user if they are recent
        if (last && last.isUser === isUser && (Date.now() - last.timestamp < 3000)) {
           return [...prev.slice(0, -1), { text: last.text + " " + text, isUser, timestamp: Date.now() }];
        }
        return [...prev, { text, isUser, timestamp: Date.now() }];
      });
    },
    onToolCall: async (functionCalls) => {
        const responses = [];
        for (const call of functionCalls) {
            if (call.name === 'downloadMusic') {
                const query = call.args.query;
                setStatusMessage(`Downloading "${query}"...`);
                
                try {
                    const results = await searchMusic(query);
                    if (results.length > 0) {
                        const track = results[0];
                        
                        let downloadUrl = track.downloadUrl;
                        if (track.source === 'YOUTUBE' && track.videoId) {
                            const stream = await getYouTubeAudioStream(track.videoId);
                            if (stream) downloadUrl = stream;
                        }

                        if (downloadUrl) {
                            const blob = await downloadAudioAsBlob(downloadUrl);
                            if (blob) {
                                const song: Song = {
                                    id: `dl-live-${Date.now()}`,
                                    title: track.title,
                                    artist: track.artist,
                                    album: track.album,
                                    duration: '3:00',
                                    coverUrl: track.artworkUrl,
                                    mood: 'Downloaded',
                                    fileBlob: blob,
                                    isOffline: true,
                                    addedAt: Date.now()
                                };
                                await saveSong(song);
                                setStatusMessage(`Downloaded "${track.title}" successfully.`);
                                
                                responses.push({
                                    id: call.id,
                                    name: call.name,
                                    response: { result: `Successfully downloaded "${track.title}" by ${track.artist} to the Offline Hub.` }
                                });
                            } else {
                                throw new Error("Failed to download audio blob");
                            }
                        } else {
                             throw new Error("No audio stream available");
                        }
                    } else {
                        setStatusMessage("No results found.");
                        responses.push({
                            id: call.id,
                            name: call.name,
                            response: { result: `Could not find any songs matching "${query}".` }
                        });
                    }
                } catch (e: any) {
                    console.error("Download error", e);
                    setStatusMessage("Download failed.");
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: { result: `Error downloading song: ${e.message}.` }
                    });
                }
            }
            
            if (call.name === 'playMusic') {
                const query = call.args.query;
                setStatusMessage(`Searching for "${query}" on ${musicProvider}...`);

                try {
                    let songToPlay: Song | null = null;
                    let source = musicProvider;

                    // Use Unified Search logic
                    if (musicProvider === 'SPOTIFY' && spotifyToken) {
                         songToPlay = await searchSpotifyTrack(spotifyToken, query);
                         if (!songToPlay) {
                             // Fallback to YouTube if Spotify fails
                             const results = await searchUnified('YOUTUBE', query);
                             if (results.length > 0) {
                                 songToPlay = results[0];
                                 source = 'YOUTUBE';
                             }
                         }
                    } else {
                         const results = await searchUnified(musicProvider, query);
                         if (results.length > 0) {
                             songToPlay = results[0];
                         } else {
                             // Fallback to YouTube if preferred provider fails
                             const results = await searchUnified('YOUTUBE', query);
                             if (results.length > 0) {
                                 songToPlay = results[0];
                                 source = 'YOUTUBE';
                             }
                         }
                    }

                    if (songToPlay && onPlaySong) {
                        onPlaySong(songToPlay);
                        setStatusMessage(`Playing "${songToPlay.title}" via ${source}`);
                        responses.push({
                            id: call.id,
                            name: call.name,
                            response: { result: `Now playing "${songToPlay.title}" by ${songToPlay.artist} via ${source}.` }
                        });
                    } else {
                        setStatusMessage("Song not found.");
                        responses.push({
                            id: call.id,
                            name: call.name,
                            response: { result: `I couldn't find a playable version of "${query}" on ${source}.` }
                        });
                    }
                } catch (e: any) {
                    console.error("Play error", e);
                    setStatusMessage("Playback failed.");
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: { result: `Error playing song: ${e.message}.` }
                    });
                }
            }
        }
        
        if (responses.length > 0) {
            sendToolResponse(responses);
            setTimeout(() => setStatusMessage(null), 5000);
        }
    }
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptContainerRef.current) {
        transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcripts]);

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

  // Animation Logic for the "Entity" and Music Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const particles: {x: number, y: number, vx: number, vy: number, life: number}[] = [];

    // Frequency Buffer for Music
    let musicDataArray: Uint8Array | null = null;
    if (musicAnalyser) {
        musicDataArray = new Uint8Array(musicAnalyser.frequencyBinCount);
    }

    const draw = () => {
      time += 0.02;
      
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;

      // --- Music Visualization Layer (Behind) ---
      if (musicAnalyser && musicDataArray) {
         musicAnalyser.getByteFrequencyData(musicDataArray);
         const bars = 64; // Limit bars for cleaner look
         const step = (Math.PI * 2) / bars;
         const baseRadius = 100;

         ctx.lineWidth = 4;
         ctx.lineCap = 'round';
         
         for (let i = 0; i < bars; i++) {
             // Map to frequency data
             const dataIndex = Math.floor((i / bars) * (musicAnalyser.frequencyBinCount * 0.7));
             const value = musicDataArray[dataIndex];
             
             if (value > 10) {
                // Dynamic Color
                const hue = 30 + (value / 255) * 40; // Orange (30) to Yellow (70)
                ctx.strokeStyle = `hsla(${hue}, 100%, 50%, 0.6)`;
                
                const barHeight = (value / 255) * 60;
                const angle = i * step + (time * 0.2); // Slowly rotate
                
                const x1 = cx + Math.cos(angle) * baseRadius;
                const y1 = cy + Math.sin(angle) * baseRadius;
                const x2 = cx + Math.cos(angle) * (baseRadius + barHeight);
                const y2 = cy + Math.sin(angle) * (baseRadius + barHeight);

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
             }
         }
      }

      // --- Voice Core Layer (Foreground) ---
      if (!isConnected) {
         // Offline State - Pulsing Dot
         const pulse = Math.sin(time * 2) * 5;
         ctx.beginPath();
         ctx.arc(cx, cy, 10 + pulse, 0, Math.PI * 2);
         ctx.fillStyle = '#d1d5db'; // gray-300
         ctx.fill();
         
         ctx.strokeStyle = '#9ca3af';
         ctx.lineWidth = 1;
         ctx.beginPath();
         ctx.arc(cx, cy, 30, 0, Math.PI * 2);
         ctx.stroke();
      } else {
         // Live State Visualization
         const baseRadius = 60;
         const volMod = Math.max(5, volume); 
         
         // Main Core
         ctx.beginPath();
         // Deform the circle based on volume
         for(let i=0; i<=Math.PI * 2; i+=0.1) {
             const r = baseRadius + (volMod * 0.5) + (Math.sin(i * 5 + time * 3) * (volMod * 0.2));
             const x = cx + Math.cos(i) * r;
             const y = cy + Math.sin(i) * r;
             if (i===0) ctx.moveTo(x,y);
             else ctx.lineTo(x,y);
         }
         ctx.closePath();
         
         // Color based on state
         if (isSpeaking) {
             ctx.fillStyle = '#fb923c'; // Orange-400
             ctx.shadowColor = '#fb923c';
             ctx.shadowBlur = 20 + volMod;
         } else {
             ctx.fillStyle = '#111'; // Black
             ctx.shadowColor = '#fb923c';
             ctx.shadowBlur = 0;
         }
         ctx.fill();
         ctx.shadowBlur = 0; // Reset

         // Outer Rings
         ctx.strokeStyle = '#fb923c';
         ctx.lineWidth = 1.5;
         
         // Static Ring -> Pulsating Ring 1
         ctx.beginPath();
         const ring1Radius = baseRadius + 20 + (volMod * 0.2) + (Math.sin(time * 3) * 3);
         ctx.arc(cx, cy, ring1Radius, 0, Math.PI * 2);
         ctx.globalAlpha = 0.3 + (volMod / 300);
         ctx.stroke();

         // Dynamic Ring -> Pulsating Ring 2
         ctx.beginPath();
         const ring2Radius = baseRadius + 35 + (volMod * 0.4) + (Math.sin(time * 2) * 5);
         ctx.arc(cx, cy, ring2Radius, 0, Math.PI * 2);
         ctx.globalAlpha = 0.1 + (volMod / 200);
         ctx.stroke();
         
         // Rotating segments with Volume Speed
         ctx.save();
         ctx.translate(cx, cy);
         ctx.rotate(time * 0.5 + (volMod * 0.01));
         ctx.beginPath();
         const ring3Radius = baseRadius + 50 + (volMod * 0.15);
         ctx.arc(0, 0, ring3Radius, 0, Math.PI * 1.5);
         ctx.globalAlpha = 0.2;
         ctx.stroke();
         
         // Extra Counter-Rotating Segment
         ctx.beginPath();
         ctx.rotate(Math.PI);
         ctx.arc(0, 0, ring3Radius + 10, 0, Math.PI * 0.5);
         ctx.stroke();
         
         ctx.restore();

         ctx.globalAlpha = 1;

         // Particles emission when speaking loud
         if (isSpeaking && volMod > 15) {
             const count = volMod > 50 ? 2 : 1;
             for(let i=0; i<count; i++) {
                 const angle = Math.random() * Math.PI * 2;
                 // Emit from slightly outside core
                 const r = baseRadius + (Math.random() * 20);
                 particles.push({
                     x: cx + Math.cos(angle) * r,
                     y: cy + Math.sin(angle) * r,
                     vx: Math.cos(angle) * (0.5 + Math.random() * 2),
                     vy: Math.sin(angle) * (0.5 + Math.random() * 2),
                     life: 1.0
                 });
             }
         }
      }

      // Draw Particles
      for(let i=particles.length-1; i>=0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          
          // Subtle wobble animation
          p.x += Math.sin(time * 10 + i) * 0.5;
          p.y += Math.cos(time * 10 + i) * 0.5;

          p.life -= 0.02;
          
          if (p.life <= 0) {
              particles.splice(i, 1);
              continue;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, 2 * p.life, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 146, 60, ${p.life})`;
          ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isConnected, isSpeaking, volume, musicAnalyser]);

  const toggleCamera = () => {
    if (videoMode === 'camera') stopVideo();
    else startVideo('camera');
  };

  const toggleScreen = () => {
    if (videoMode === 'screen') stopVideo();
    else startVideo('screen');
  };

  return (
    <div className="flex h-full bg-[#fcfbf9] text-black relative overflow-hidden">
      
      {/* Background Grid Texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', 
             backgroundSize: '40px 40px' 
           }}>
      </div>

      {/* LEFT COLUMN: Visualizer & Controls */}
      <div className="flex-1 flex flex-col relative z-10">
          
          {/* Header */}
          <div className="p-6 flex justify-between items-start pointer-events-none">
            <div>
               <div className="bg-black text-white px-3 py-1 text-xs font-mono font-bold inline-block mb-2 shadow-retro-sm">LIVE_SESSION_V2</div>
               <h2 className="text-3xl font-bold font-mono tracking-tighter uppercase">Echo Vision</h2>
            </div>
            {currentSong && (
               <div className="bg-white border-2 border-black p-2 shadow-retro-sm flex items-center space-x-3 pointer-events-auto animate-in fade-in slide-in-from-top-2">
                  <div className="w-8 h-8 border border-black bg-gray-200 flex-shrink-0">
                     <img src={currentSong.coverUrl} className="w-full h-full object-cover grayscale" alt="art"/>
                  </div>
                  <div className="min-w-0 max-w-[120px]">
                     <div className="text-[9px] font-bold font-mono text-gray-500 uppercase">Playing</div>
                     <div className="font-bold text-xs truncate">{currentSong.title}</div>
                  </div>
               </div>
            )}
          </div>

          {/* Main Visualizer Area */}
          <div className="flex-1 flex flex-col items-center justify-center relative">
             {/* Status Badge */}
             <div className="absolute top-4 font-mono font-bold text-xs uppercase flex items-center space-x-3">
                 {error ? (
                    <span className="text-white bg-red-600 px-3 py-1 shadow-retro-sm">ERROR: {error}</span>
                 ) : isConnected ? (
                    <span className="bg-white border border-black px-3 py-1 shadow-[2px_2px_0_0_rgba(0,0,0,0.1)] flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></span>
                        {isSpeaking ? 'VOICE_ACTIVE' : 'LISTENING'}
                        {isMuted && <span className="text-red-500 ml-1">[MUTED]</span>}
                    </span>
                 ) : (
                    <span className="text-gray-400 bg-gray-100 px-3 py-1 border border-gray-300">OFFLINE</span>
                 )}
                 {statusMessage && (
                     <span className="bg-blue-100 text-blue-800 border border-blue-500 px-3 py-1 animate-pulse">
                         {statusMessage}
                     </span>
                 )}
             </div>

             {/* Canvas Container */}
             <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
                <canvas ref={canvasRef} className="w-full h-full" />
                
                {!isConnected && (
                    <button 
                      onClick={connect}
                      className="absolute z-20 bg-black text-white hover:bg-orange-500 hover:text-black hover:border-black border-2 border-transparent transition-all w-24 h-24 rounded-full flex items-center justify-center shadow-2xl font-bold font-mono text-sm uppercase tracking-widest active:scale-95 group"
                    >
                       <ICONS.Radio size={24} className="group-hover:animate-ping absolute opacity-20" />
                       <span className="relative z-10">CONNECT</span>
                    </button>
                )}
             </div>
             
             {/* Controls Bar */}
             <div className="mb-12 flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-500">
                {isConnected && (
                    <>
                        <button 
                            onClick={toggleMute}
                            className={`p-4 border-2 border-black rounded-full transition-all active:scale-95 shadow-retro-sm hover:shadow-retro-hover ${isMuted ? 'bg-red-500 text-white' : 'bg-white text-black hover:bg-gray-50'}`}
                            title={isMuted ? "Unmute Mic" : "Mute Mic"}
                        >
                            {isMuted ? <ICONS.MicOff size={24} /> : <ICONS.Mic size={24} />}
                        </button>

                        <button 
                            onClick={toggleCamera}
                            className={`p-4 border-2 border-black rounded-full transition-all active:scale-95 shadow-retro-sm hover:shadow-retro-hover ${videoMode === 'camera' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'}`}
                            title="Toggle Camera"
                        >
                            <ICONS.Image size={24} />
                        </button>

                        <button 
                            onClick={toggleScreen}
                            className={`p-4 border-2 border-black rounded-full transition-all active:scale-95 shadow-retro-sm hover:shadow-retro-hover ${videoMode === 'screen' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'}`}
                            title="Share Screen"
                        >
                            <ICONS.ScreenShare size={24} />
                        </button>

                        <div className="w-px h-10 bg-gray-300 mx-2"></div>

                        <button 
                            onClick={disconnect}
                            className="px-6 py-4 font-bold font-mono bg-red-100 text-red-600 border-2 border-red-500 hover:bg-red-500 hover:text-white transition-colors uppercase tracking-widest shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                        >
                            END
                        </button>
                    </>
                )}
             </div>
          </div>
      </div>

      {/* RIGHT COLUMN: Transcript & Vision Preview */}
      <div className="w-80 border-l-2 border-black bg-white flex flex-col relative z-20 shadow-[-4px_0_15px_rgba(0,0,0,0.05)]">
         
         {/* Vision Preview (Sticky Top) */}
         {isVideoActive && (
            <div className="aspect-video bg-black border-b-2 border-black relative overflow-hidden group">
               <video 
                 ref={videoPreviewRef} 
                 autoPlay 
                 muted 
                 playsInline
                 className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
               />
               <div className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-mono px-1 font-bold animate-pulse">
                  LIVE_FEED
               </div>
               <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black to-transparent p-2">
                  <p className="text-white text-[10px] font-mono truncate">
                      {videoMode === 'camera' ? 'CAMERA_INPUT_01' : 'SCREEN_CAPTURE_01'}
                  </p>
               </div>
            </div>
         )}

         {/* Transcript Header */}
         <div className="p-4 border-b-2 border-black bg-gray-50 flex justify-between items-center">
            <h3 className="font-mono font-bold text-xs uppercase flex items-center gap-2">
               <ICONS.ScrollText size={14} /> Transcript
            </h3>
            <div className="flex space-x-1">
               <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
               <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
            </div>
         </div>
         
         {/* Transcript List */}
         <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8f9fa]" ref={transcriptContainerRef}>
            {transcripts.length === 0 && (
               <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                  <ICONS.MessageSquare size={24} className="mb-2" />
                  <p className="text-[10px] font-mono uppercase tracking-widest">Awaiting Audio...</p>
               </div>
            )}
            
            {transcripts.map((t, i) => (
               <div key={i} className={`flex flex-col ${t.isUser ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[90%] p-3 rounded-none border shadow-[2px_2px_0_0_rgba(0,0,0,0.1)] ${
                      t.isUser 
                        ? 'bg-white border-gray-300 text-gray-800 rounded-tl-lg rounded-bl-lg rounded-br-none' 
                        : 'bg-orange-50 border-orange-200 text-black rounded-tr-lg rounded-br-lg rounded-bl-none'
                  }`}>
                     <span className="text-[9px] font-bold block mb-1 opacity-40 uppercase font-mono tracking-wider">
                        {t.isUser ? 'YOU' : 'ECHO'}
                     </span>
                     <p className="text-xs leading-relaxed font-medium">{t.text}</p>
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default LiveInterface;