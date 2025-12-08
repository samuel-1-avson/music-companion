import React, { useState, useRef, useEffect } from 'react';
import { ICONS } from '../constants';
import { Song, Message, MusicProvider } from '../types';
import { generatePlaylistFromContext, transcribeAudio } from '../services/geminiService';
import { saveSong } from '../utils/db';
import { searchMusic, getYouTubeAudioStream, downloadAudioAsBlob } from '../services/musicService';

interface ChatInterfaceProps {
  onPlaySong: (song: Song, queue?: Song[]) => void;
  spotifyToken?: string | null;
  musicProvider?: MusicProvider;
}

const SUGGESTED_PROMPTS = [
  { icon: ICONS.Music, label: "Deep Focus", text: "I need deep focus music for coding. No lyrics, just flow." },
  { icon: ICONS.DownloadCloud, label: "Download Song", text: "Download 'Midnight City' for offline listening." },
  { icon: ICONS.Play, label: "Workout Energy", text: "High tempo energetic tracks for a intense gym session." },
  { icon: ICONS.Search, label: "Discover Jazz", text: "Introduce me to some classic jazz tracks for a rainy afternoon." },
];

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onPlaySong, spotifyToken, musicProvider = 'YOUTUBE' }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hi. I am your Music Companion. State your mood, activity, or ask me to download a track.",
      type: 'text',
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isRecording) {
       const timer = setTimeout(() => {
         drawVisualizer();
       }, 100);
       return () => clearTimeout(timer);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const processMessage = async (text: string, image: string | null) => {
    setIsLoading(true);
    setAttachedImage(null);

    try {
      const base64Data = image ? image.split(',')[1] : undefined;
      // Pass the selected musicProvider here
      const { explanation, songs, downloadTrack } = await generatePlaylistFromContext(text, musicProvider, base64Data, spotifyToken || undefined);

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: explanation,
        type: 'text',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, modelMsg]);

      // Handle Explicit Download
      if (downloadTrack) {
         setMessages(prev => [...prev, {
             id: `dl-status-${Date.now()}`,
             role: 'model',
             text: `Searching networks for "${downloadTrack}"...`,
             type: 'text',
             timestamp: new Date()
         }]);

         // Real Search & Download
         try {
             const results = await searchMusic(downloadTrack);
             
             if (results.length > 0) {
                 const track = results[0];
                 setMessages(prev => [...prev, {
                     id: `dl-found-${Date.now()}`,
                     role: 'model',
                     text: `Found "${track.title}" on ${track.source === 'YOUTUBE' ? 'YouTube' : 'iTunes'}. Initializing extraction...`,
                     type: 'text',
                     timestamp: new Date()
                 }]);

                 let downloadUrl = track.downloadUrl;
                 if (track.source === 'YOUTUBE' && track.videoId) {
                     const stream = await getYouTubeAudioStream(track.videoId);
                     if (stream) downloadUrl = stream;
                 }
                 
                 if (downloadUrl) {
                     const blob = await downloadAudioAsBlob(downloadUrl);
                     if (blob) {
                        const song: Song = {
                            id: `dl-agent-${Date.now()}`,
                            title: track.title,
                            artist: track.artist,
                            album: track.album,
                            duration: formatDuration(track.duration),
                            coverUrl: track.artworkUrl,
                            mood: 'Downloaded',
                            fileBlob: blob,
                            isOffline: true,
                            addedAt: Date.now()
                        };
                        await saveSong(song);

                        setMessages(prev => [...prev, {
                            id: `dl-done-${Date.now()}`,
                            role: 'model',
                            text: `✔ Success. Full audio for "${track.title}" has been saved to your Offline Hub.`,
                            type: 'text',
                            timestamp: new Date()
                        }]);
                     } else {
                         throw new Error("Blob fetch failed");
                     }
                 } else {
                     throw new Error("Audio stream unavailable");
                 }
             } else {
                 setMessages(prev => [...prev, {
                     id: `dl-fail-${Date.now()}`,
                     role: 'model',
                     text: `Could not find any matches for "${downloadTrack}".`,
                     type: 'text',
                     timestamp: new Date()
                 }]);
             }
         } catch (e) {
             setMessages(prev => [...prev, {
                 id: `dl-err-${Date.now()}`,
                 role: 'model',
                 text: `Download failed. Network may be restricted.`,
                 type: 'text',
                 timestamp: new Date()
             }]);
         }
      }

      if (songs.length > 0) {
        setMessages(prev => [...prev, {
            id: `playlist-${Date.now()}`,
            role: 'model',
            text: "Recommendations:",
            type: 'text',
            timestamp: new Date(),
        }]);
      }
      
      (modelMsg as any).songs = songs;

    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "Error connecting to service.",
        type: 'text',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedImage) || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      type: 'text',
      timestamp: new Date(),
      attachments: attachedImage ? [{ type: 'image', url: attachedImage }] : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    const currentImage = attachedImage;
    
    setInput('');
    
    await processMessage(currentInput, currentImage);
  };

  const handleSuggestionClick = (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      type: 'text',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    processMessage(text, null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256; 
      analyser.smoothingTimeConstant = 0.8;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        handleTranscription(audioBlob);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContext.state !== 'closed') audioContext.close();
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone.");
    }
  };

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Sync canvas size to display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        // Scale height to fit canvas nicely, peaking around 80% height
        const barHeight = (value / 255) * canvas.height * 0.8;
        
        ctx.fillStyle = '#fb923c'; // Orange-400

        const y = (canvas.height - barHeight) / 2;
        ctx.fillRect(x, y, barWidth - 2, Math.max(4, barHeight));

        x += barWidth;
      }
    };
    draw();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const handleTranscription = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const text = await transcribeAudio(base64Audio, audioBlob.type);
        setInput(prev => prev ? `${prev} ${text}` : text);
        setIsTranscribing(false);
      };
    } catch (error) {
      console.error("Transcription failed", error);
      setIsTranscribing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f3f0e8] text-gray-900 relative">
      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24 scroll-smooth">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            {msg.role === 'model' && (
               <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center mr-3 mt-1 flex-shrink-0 shadow-retro-sm">
                  <ICONS.Music size={18} className="text-black" />
               </div>
            )}
            <div className={`max-w-[85%] border-2 border-black p-4 shadow-retro-sm ${
              msg.role === 'user' 
                ? 'bg-black text-white' 
                : 'bg-white text-black'
            }`}>
              {msg.attachments?.map((att, i) => (
                <img key={i} src={att.url} alt="Attachment" className="max-w-full h-48 object-cover border-2 border-white mb-3 grayscale" />
              ))}
              <p className="whitespace-pre-wrap leading-relaxed font-mono text-sm">{msg.text}</p>
              
              {/* Render Recommended Songs if attached */}
              {(msg as any).songs && (
                <div className="mt-4 space-y-2">
                  {(msg as any).songs.map((song: Song) => (
                    <div key={song.id} className="flex items-center justify-between p-3 bg-gray-50 border-2 border-black hover:shadow-retro-sm transition group cursor-pointer hover:bg-orange-100" onClick={() => onPlaySong(song, (msg as any).songs)}>
                       <div className="flex items-center space-x-3 overflow-hidden">
                          <div className="w-10 h-10 border border-black bg-gray-200 relative flex-shrink-0">
                            <img src={song.coverUrl} className="w-full h-full object-cover grayscale" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 transition-opacity">
                              <ICONS.Play size={16} className="text-white" />
                            </div>
                          </div>
                          <div className="min-w-0">
                             <div className="font-bold font-mono text-sm truncate text-black">{song.title}</div>
                             <div className="text-xs text-gray-600 truncate font-bold">{song.artist}</div>
                             <div className="text-[10px] text-orange-600 truncate font-mono mt-1">{song.mood}</div>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
               <div className="w-10 h-10 border-2 border-black bg-orange-400 flex items-center justify-center ml-3 mt-1 flex-shrink-0 shadow-retro-sm">
                  <span className="text-xs font-bold text-black font-mono">YOU</span>
               </div>
            )}
          </div>
        ))}
        
        {/* Loading Indicator */}
        {isLoading && (
           <div className="flex justify-start">
             <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center mr-3 flex-shrink-0">
                  <ICONS.Loader size={18} className="text-black animate-spin" />
             </div>
             <div className="bg-white border-2 border-black p-4 flex items-center space-x-3 shadow-retro-sm">
               <span className="text-black text-sm font-bold font-mono uppercase blink">COMPUTING_RESPONSE...</span>
             </div>
           </div>
        )}

        {/* Suggested Prompts */}
        {messages.length < 3 && !isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 max-w-2xl mx-auto">
             {SUGGESTED_PROMPTS.map((suggestion, idx) => (
               <button 
                 key={idx}
                 onClick={() => handleSuggestionClick(suggestion.text)}
                 className="flex items-start p-4 bg-white border-2 border-black hover:shadow-retro transition-all text-left group hover:bg-orange-50"
               >
                 <div className="border-2 border-black p-2 mr-3 bg-white group-hover:bg-black transition-colors">
                    <suggestion.icon size={18} className="text-black group-hover:text-white" />
                 </div>
                 <div>
                    <h4 className="text-sm font-bold text-black font-mono uppercase">{suggestion.label}</h4>
                    <p className="text-xs text-gray-600 mt-0.5">{suggestion.text}</p>
                 </div>
               </button>
             ))}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#f3f0e8] border-t-2 border-black p-6">
        <div className="max-w-4xl mx-auto relative">
          {attachedImage && (
            <div className="absolute bottom-full left-0 mb-4 p-2 bg-white border-2 border-black flex items-center space-x-2 shadow-retro-sm">
               <div className="relative">
                 <img src={attachedImage} className="w-16 h-16 object-cover border border-black grayscale" />
                 <button onClick={() => setAttachedImage(null)} className="absolute -top-3 -right-3 bg-red-500 text-white border-2 border-black w-6 h-6 flex items-center justify-center hover:bg-red-600">
                   <ICONS.Square size={10} className="fill-current rotate-45" /> 
                 </button>
               </div>
               <span className="text-xs text-black font-mono font-bold px-2">IMAGE_LOADED</span>
            </div>
          )}
          
          <div className="flex items-center space-x-2 bg-white border-2 border-black p-1 shadow-retro-lg transition-all">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload}
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-black hover:bg-gray-100 border-r-2 border-black border-transparent transition"
              title="Upload"
              disabled={isRecording || isTranscribing}
            >
              <ICONS.Image size={24} strokeWidth={2} />
            </button>
            
            {/* Voice Input Toggle */}
            <button 
              onClick={toggleRecording}
              disabled={isTranscribing}
              className={`p-3 transition border-2 border-transparent ${isRecording ? 'text-white bg-red-500' : 'text-black hover:bg-gray-100'}`}
            >
              {isTranscribing ? (
                <ICONS.Loader className="animate-spin" size={24} />
              ) : isRecording ? (
                <ICONS.Square size={16} className="fill-current" />
              ) : (
                <ICONS.Mic size={24} strokeWidth={2} />
              )}
            </button>

            {isRecording ? (
               <div className="flex-1 h-12 flex items-center justify-center relative overflow-hidden bg-black border-x-2 border-black mx-2">
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-orange-500 font-mono font-bold tracking-widest z-10 pointer-events-none mix-blend-difference">RECORDING_AUDIO</div>
                  <canvas ref={canvasRef} className="w-full h-full" />
               </div>
            ) : (
               <input 
                 type="text" 
                 className="flex-1 bg-transparent border-none focus:ring-0 text-black placeholder-gray-500 h-12 px-2 text-lg font-mono"
                 placeholder={isTranscribing ? "PROCESSING..." : `Chat with ${musicProvider}...`}
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                 disabled={isTranscribing}
                 autoFocus
               />
            )}
            
            <button 
              onClick={handleSend}
              disabled={(!input.trim() && !attachedImage) || isRecording || isTranscribing}
              className={`p-3 transition border-l-2 border-black ${
                input.trim() || attachedImage 
                  ? 'bg-black text-white hover:bg-gray-800' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <ICONS.Send size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;