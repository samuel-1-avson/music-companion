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
  
  // Video Preview Ref
  const previewVideoRef = useRef<HTMLVideoElement>(null);

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
    systemInstruction,
    tools,
    onTranscript: (text, isUser) => {
        setTranscripts(prev => [...prev.slice(-4), { text, isUser, timestamp: Date.now() }]);
    },
    onToolCall: async (functionCalls) => {
        for (const call of functionCalls) {
            if (call.name === 'playMusic') {
                setStatusMessage(`DJing: Searching for "${call.args.query}"...`);
                try {
                    const results = await searchUnified(musicProvider as MusicProvider, call.args.query, spotifyToken);
                    if (results.length > 0 && onPlaySong) {
                        onPlaySong(results[0]);
                        sendToolResponse({
                            functionResponses: [{
                                response: { result: `Playing ${results[0].title} by ${results[0].artist}` },
                                id: call.id
                            }]
                        });
                        setStatusMessage(null);
                    } else {
                        sendToolResponse({
                            functionResponses: [{
                                response: { result: "No song found." },
                                id: call.id
                            }]
                        });
                        setStatusMessage("Song not found.");
                        setTimeout(() => setStatusMessage(null), 2000);
                    }
                } catch (e) {
                    console.error(e);
                    setStatusMessage("Error playing music.");
                    setTimeout(() => setStatusMessage(null), 2000);
                }
            } else if (call.name === 'downloadMusic') {
                 setStatusMessage(`Downloading "${call.args.query}"...`);
                 try {
                     // 1. Search for the track
                     const results = await searchMusic(call.args.query);
                     
                     if (results.length > 0) {
                         const track = results[0];
                         setStatusMessage(`Found "${track.title}". Extracting audio...`);
                         
                         // 2. Respond to AI immediately so it can speak/acknowledge
                         sendToolResponse({
                            functionResponses: [{
                                response: { result: `Download started for ${track.title}.` },
                                id: call.id
                            }]
                         });

                         // 3. Process Download in background
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
                                     duration: '3:00', // Approximate as we don't parse full metadata here
                                     coverUrl: track.artworkUrl,
                                     mood: 'Downloaded',
                                     fileBlob: blob,
                                     isOffline: true,
                                     addedAt: Date.now()
                                 };
                                 await saveSong(song);
                                 setStatusMessage(`✔ Saved "${track.title}" to Library`);
                             } else {
                                 setStatusMessage(`Download failed for "${track.title}"`);
                             }
                         } else {
                             setStatusMessage(`No audio stream found for "${track.title}"`);
                         }
                     } else {
                         sendToolResponse({
                            functionResponses: [{
                                response: { result: "Song not found." },
                                id: call.id
                            }]
                         });
                         setStatusMessage("Song not found for download.");
                     }
                 } catch (e) {
                     console.error(e);
                     setStatusMessage("Download Error.");
                     // Ensure response is sent if we fail before sending it
                     try {
                         sendToolResponse({
                            functionResponses: [{
                                response: { result: "Error executing download." },
                                id: call.id
                            }]
                         });
                     } catch(err) {}
                 }
                 setTimeout(() => setStatusMessage(null), 3000);
            }
        }
    }
  });

  // Attach video stream to preview element
  useEffect(() => {
    if (previewVideoRef.current && videoStream) {
        previewVideoRef.current.srcObject = videoStream;
    }
  }, [videoStream, isVideoActive]);

  // Auto-scroll transcripts
  useEffect(() => {
    if (transcriptContainerRef.current) {
        transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcripts]);

  const isScreenShare = videoMode === 'screen';
  const themeColor = isScreenShare ? 'blue' : 'red';
  const borderColor = isScreenShare ? 'border-blue-500' : 'border-red-500';
  const shadowColor = isScreenShare ? 'shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'shadow-[0_0_20px_rgba(239,68,68,0.3)]';
  const badgeColor = isScreenShare ? 'bg-blue-600' : 'bg-red-600';
  const textColor = isScreenShare ? 'text-blue-400' : 'text-red-400';

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-[#111] text-white">
       
       {/* Background Visualizer / Ambient */}
       <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500 rounded-full blur-[100px] transition-all duration-300 ${isSpeaking ? 'scale-150 opacity-40' : 'scale-100 opacity-20'}`}></div>
       </div>

       {/* Video Preview Layer */}
       {isVideoActive && (
         <div className="absolute top-0 right-0 p-4 z-20 w-full md:w-1/3 max-w-sm animate-in slide-in-from-right duration-500">
            <div className={`bg-black border-2 ${borderColor} ${shadowColor} relative group`}>
                <video 
                  ref={previewVideoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className="w-full h-auto object-cover opacity-90" 
                />
                
                <div className={`absolute top-0 left-0 ${badgeColor} text-white text-[10px] font-bold font-mono px-2 py-1 uppercase flex items-center gap-2 animate-pulse`}>
                   <div className="w-2 h-2 bg-white rounded-full"></div>
                   {isScreenShare ? 'SCREEN_SHARE_ACTIVE' : 'LIVE_CAMERA_FEED'}
                </div>
                
                {/* Mode Icon Overlay */}
                <div className="absolute bottom-2 right-2 opacity-50 p-1 bg-black/50 rounded">
                    {isScreenShare ? <ICONS.ScreenShare size={20} className="text-blue-400" /> : <ICONS.Image size={20} className="text-red-400" />}
                </div>

                <button 
                  onClick={stopVideo}
                  className={`absolute top-2 right-2 bg-black/50 hover:${isScreenShare ? 'bg-blue-600' : 'bg-red-600'} text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity`}
                >
                   <ICONS.Close size={16} />
                </button>
            </div>
            <p className={`text-[10px] font-mono ${textColor} mt-1 text-right`}>
                {isScreenShare ? 'ANALYZING SCREEN CONTEXT...' : 'STREAMING VISUAL DATA...'}
            </p>
         </div>
       )}

       {/* Main Content Area */}
       <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
           
           {!isConnected ? (
              <div className="text-center space-y-6">
                 <div className="inline-block p-6 rounded-full border-2 border-white/20 bg-white/5 mb-4">
                    <ICONS.Live size={64} className="text-gray-400" />
                 </div>
                 <h2 className="text-3xl font-bold font-mono tracking-tight">LIVE SESSION</h2>
                 <p className="text-gray-400 max-w-md mx-auto font-mono text-sm">
                    Connect for real-time voice and vision interaction. I can see your screen, analyze code, or just vibe with you.
                 </p>
                 
                 {error && (
                    <div className="bg-red-900/50 border border-red-500 p-4 text-red-200 text-sm font-mono max-w-md mx-auto">
                        {error}
                    </div>
                 )}

                 <button 
                   onClick={connect}
                   className="bg-white text-black px-8 py-4 font-bold font-mono text-lg hover:bg-orange-500 hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                 >
                    INITIALIZE UPLINK
                 </button>
              </div>
           ) : (
              <div className="w-full max-w-4xl flex flex-col h-full">
                 
                 {/* Header Status */}
                 <div className="flex justify-between items-start mb-8 relative">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="font-mono text-xs font-bold text-green-500 tracking-widest uppercase">
                            Signal Established • {volume > 10 ? 'Receiving Audio' : 'Idle'}
                        </span>
                    </div>
                    
                    {/* Active Action / Tool Status Overlay */}
                    {statusMessage && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-top-2 w-full max-w-sm">
                             <div className="bg-black/90 backdrop-blur-sm border border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)] px-4 py-2 flex items-center justify-center gap-3 rounded-sm">
                                <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></div>
                                <span className="text-orange-500 font-mono text-xs font-bold uppercase tracking-widest truncate">{statusMessage}</span>
                             </div>
                        </div>
                    )}
                 </div>

                 {/* Center Visual/Transcript */}
                 <div className="flex-1 flex flex-col justify-end pb-12 space-y-6 relative">
                     {/* Transcript Overlay */}
                     <div ref={transcriptContainerRef} className="max-h-[60vh] overflow-y-auto space-y-4 pr-4 scrollbar-hide">
                         {transcripts.length === 0 && (
                             <div className="text-center text-gray-600 font-mono text-sm italic">
                                Listening for input...
                             </div>
                         )}
                         {transcripts.map((t, i) => (
                             <div key={t.timestamp + i} className={`flex ${t.isUser ? 'justify-end' : 'justify-start'}`}>
                                 <div className={`max-w-[80%] p-4 border-2 ${
                                     t.isUser 
                                     ? 'border-gray-600 bg-gray-900/50 text-gray-300 rounded-tl-xl rounded-bl-xl rounded-br-xl' 
                                     : 'border-orange-500 bg-orange-900/20 text-orange-100 rounded-tr-xl rounded-br-xl rounded-bl-xl shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                                 }`}>
                                     <p className="font-mono text-sm md:text-base leading-relaxed">{t.text}</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>

                 {/* Control Deck */}
                 <div className="bg-[#1a1a1a] border-t-2 border-gray-800 p-6 -mx-8 -mb-8 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                         {/* Mic Control */}
                         <button 
                           onClick={toggleMute}
                           className={`h-14 w-14 rounded-full border-2 flex items-center justify-center transition-all ${
                               isMuted 
                               ? 'border-red-500 bg-red-900/20 text-red-500' 
                               : 'border-white bg-white text-black hover:bg-gray-200'
                           }`}
                           title={isMuted ? "Unmute" : "Mute"}
                         >
                            {isMuted ? <ICONS.MicOff size={24} /> : <ICONS.Mic size={24} />}
                         </button>

                         {/* Camera Control */}
                         <button 
                           onClick={() => isVideoActive && videoMode === 'camera' ? stopVideo() : startVideo('camera')}
                           disabled={isVideoActive && videoMode !== 'camera'}
                           className={`h-14 px-6 rounded-full border-2 flex items-center gap-3 font-bold font-mono text-xs uppercase transition-all ${
                               isVideoActive && videoMode === 'camera'
                               ? 'border-red-500 bg-red-500 text-white animate-pulse'
                               : 'border-gray-600 text-gray-300 hover:border-white hover:text-white disabled:opacity-30'
                           }`}
                         >
                            <ICONS.Image size={20} />
                            {isVideoActive && videoMode === 'camera' ? 'Stop Cam' : 'Camera'}
                         </button>

                         {/* Screen Share Control */}
                         <button 
                           onClick={() => isVideoActive && videoMode === 'screen' ? stopVideo() : startVideo('screen')}
                           disabled={isVideoActive && videoMode !== 'screen'}
                           className={`h-14 px-6 rounded-full border-2 flex items-center gap-3 font-bold font-mono text-xs uppercase transition-all ${
                               isVideoActive && videoMode === 'screen'
                               ? 'border-blue-500 bg-blue-500 text-white animate-pulse'
                               : 'border-gray-600 text-gray-300 hover:border-white hover:text-white disabled:opacity-30'
                           }`}
                         >
                            <ICONS.ScreenShare size={20} />
                            {isVideoActive && videoMode === 'screen' ? 'Stop Share' : 'Share Screen'}
                         </button>
                     </div>

                     <button 
                       onClick={disconnect}
                       className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 font-bold font-mono uppercase text-sm border-2 border-red-800 rounded shadow-lg transition-all active:scale-95"
                     >
                        End Session
                     </button>
                 </div>
              </div>
           )}
       </div>
    </div>
  );
};

export default LiveInterface;