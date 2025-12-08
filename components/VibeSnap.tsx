import React, { useRef, useState } from 'react';
import { ICONS } from '../constants';
import { generatePlaylistFromContext } from '../services/geminiService';
import { Song, MusicProvider } from '../types';

interface VibeSnapProps {
  onPlaylistGenerated: (songs: Song[]) => void;
  spotifyToken?: string | null;
  musicProvider?: MusicProvider;
}

const VibeSnap: React.FC<VibeSnapProps> = ({ onPlaylistGenerated, spotifyToken, musicProvider = 'YOUTUBE' }) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setIsCameraOpen(true);
    } catch (e: any) {
      console.error("Camera access denied", e);
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError' || e.message?.includes('Permission denied')) {
         setError("Camera permission denied. Check browser settings.");
      } else {
         setError("Could not access camera device.");
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setError(null);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);

    // Capture frame
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
      
      stopCamera(); // Close camera immediately after snap

      try {
        const { songs } = await generatePlaylistFromContext("Generate a vibe based on this visual context.", musicProvider, base64, spotifyToken || undefined);
        onPlaylistGenerated(songs);
      } catch (e) {
        console.error("Vibe Snap Failed", e);
        setError("Failed to analyze vibe. Please try again.");
      }
    }
    setIsProcessing(false);
  };

  return (
    <div className="bg-black text-white p-6 border-2 border-black shadow-retro relative overflow-hidden group">
       <div className="absolute top-0 right-0 p-4 opacity-20">
          <ICONS.Image size={100} />
       </div>
       
       <div className="relative z-10">
         <h3 className="text-xl font-bold font-mono uppercase mb-2 flex items-center gap-2">
            <ICONS.Image className="text-orange-500" />
            Vibe_Snap
         </h3>
         <p className="text-gray-400 text-sm mb-4 font-mono">
            Scan your face or room. Let AI generate the soundtrack via {musicProvider}.
         </p>

         {error && (
            <div className="bg-red-900 border border-red-500 text-red-200 text-xs p-2 mb-4 font-mono flex items-center justify-between">
               <span>{error}</span>
               <button onClick={() => setError(null)}><ICONS.Close size={12} /></button>
            </div>
         )}

         {isCameraOpen ? (
            <div className="space-y-4">
               <div className="relative border-2 border-white w-full h-48 bg-gray-900 overflow-hidden">
                  <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
                  {isProcessing && (
                     <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <ICONS.Loader className="animate-spin text-orange-500" size={32} />
                     </div>
                  )}
               </div>
               <div className="flex gap-2">
                  <button 
                    onClick={captureAndAnalyze}
                    disabled={isProcessing}
                    className="flex-1 bg-white text-black font-bold font-mono py-2 hover:bg-orange-500 hover:text-white transition-colors uppercase text-sm"
                  >
                    {isProcessing ? "ANALYZING..." : "CAPTURE_VIBE"}
                  </button>
                  <button 
                    onClick={stopCamera}
                    className="px-3 border-2 border-white hover:bg-white hover:text-black transition-colors"
                  >
                    <ICONS.Close />
                  </button>
               </div>
            </div>
         ) : (
            <button 
              onClick={startCamera}
              className="w-full border-2 border-white border-dashed h-20 flex items-center justify-center hover:bg-white/10 transition-colors group-hover:border-orange-500"
            >
               <span className="font-mono font-bold text-sm uppercase flex items-center gap-2 group-hover:text-orange-500 transition-colors">
                  <ICONS.User size={16} /> Open Camera
               </span>
            </button>
         )}
       </div>
    </div>
  );
};

export default VibeSnap;