import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';
import { getSongLyrics, analyzeSongMeaning } from '../services/geminiService';

interface MusicPlayerProps {
  currentSong: Song | null;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  isRadioMode: boolean;
  toggleRadioMode: () => void;
}

interface LyricLine {
  time: number;
  text: string;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ currentSong, onNext, onPrev, hasNext, hasPrev, isRadioMode, toggleRadioMode }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.75); // 75% default
  const [isLiked, setIsLiked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Lyrics State
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<string>('');
  const [parsedLyrics, setParsedLyrics] = useState<LyricLine[] | null>(null);
  const [activeLineIndex, setActiveLineIndex] = useState<number>(-1);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  
  // Analysis State
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  // Handle song change
  useEffect(() => {
    if (currentSong) {
      if (currentSong.previewUrl) {
        setIsPlaying(true); // Auto-play if preview exists
      } else {
        setIsPlaying(false);
      }
      setProgress(0);
      setLyrics(''); // Reset lyrics on song change
      setParsedLyrics(null);
      setAnalysis(null); // Reset analysis
      setActiveLineIndex(-1);
      setIsLiked(false); // Reset like state
      
      // If panel is already open, fetch new lyrics immediately
      if (showLyrics) {
        fetchLyrics(currentSong);
      }
    }
  }, [currentSong]);

  // Update audio volume when volume state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Sync Lyrics Logic
  useEffect(() => {
    if (!parsedLyrics || !audioRef.current || parsedLyrics.length === 0) return;
    
    const currentTime = audioRef.current.currentTime;
    
    // Find active line
    let newIndex = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
        if (currentTime >= parsedLyrics[i].time) {
            newIndex = i;
        } else {
            break;
        }
    }
    
    if (newIndex !== activeLineIndex) {
      setActiveLineIndex(newIndex);
      // Scroll into view
      if (lyricsContainerRef.current && newIndex !== -1) {
        const lineElement = lyricsContainerRef.current.children[newIndex] as HTMLElement;
        if (lineElement) {
          lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [progress, parsedLyrics, activeLineIndex]);

  const fetchLyrics = async (song: Song) => {
    setLoadingLyrics(true);
    setLyrics('');
    setParsedLyrics(null);
    setAnalysis(null);
    try {
      const text = await getSongLyrics(song.artist, song.title);
      setLyrics(text);
      
      // Parse LRC
      const lines = text.split('\n');
      const hasTimestamps = lines.some(l => /\[\d+:\d+/.test(l));
      
      if (hasTimestamps) {
        const parsed: LyricLine[] = [];
        const timeRegex = /\[(\d+):(\d+(\.\d+)?)\]/;
        
        lines.forEach(line => {
             const match = line.match(timeRegex);
             if (match) {
                 const min = parseInt(match[1]);
                 const sec = parseFloat(match[2]);
                 const time = min * 60 + sec;
                 const lyricText = line.replace(timeRegex, '').trim();
                 if (lyricText) parsed.push({ time, text: lyricText });
             }
        });
        setParsedLyrics(parsed);
      }
      
    } catch (e) {
      setLyrics("Error loading lyrics.");
    } finally {
      setLoadingLyrics(false);
    }
  };
  
  const handleAnalyze = async () => {
    if (!currentSong || !lyrics) return;
    setLoadingAnalysis(true);
    try {
      const result = await analyzeSongMeaning(currentSong.artist, currentSong.title, lyrics);
      setAnalysis(result);
    } catch (e) {
      setAnalysis("Could not analyze meaning.");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const toggleLyrics = () => {
    const newState = !showLyrics;
    setShowLyrics(newState);
    if (newState && !lyrics && currentSong) {
      fetchLyrics(currentSong);
    }
  };

  // Handle Play/Pause
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.log("Playback blocked or failed", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Handle Progress update from audio element
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const duration = audioRef.current.duration || 30; // Previews are usually 30s
      const current = audioRef.current.currentTime;
      setProgress((current / duration) * 100);
    }
  };
  
  const handleEnded = () => {
    if (onNext && hasNext) {
      onNext();
    } else {
      setIsPlaying(false);
      setProgress(0);
    }
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (volumeRef.current) {
      const rect = volumeRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const newVolume = Math.max(0, Math.min(1, x / width));
      setVolume(newVolume);
    }
  };
  
  // Expose toggle play for parent
  // Note: Parent controls song, but player controls play state. 
  // We can assume parent doesn't need to force play unless changing song.

  if (!currentSong) return null;

  return (
    <>
      {/* Lyrics Panel - Popover above player */}
      {showLyrics && (
        <div className="fixed bottom-24 right-4 md:right-8 w-80 md:w-96 max-h-[60vh] h-[500px] bg-white border-2 border-black shadow-retro z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
          <div className="p-3 border-b-2 border-black flex justify-between items-center bg-orange-100 flex-shrink-0">
            <h3 className="font-mono font-bold text-sm uppercase flex items-center gap-2">
              <ICONS.Lyrics size={16} /> 
              Lyrics_Module
            </h3>
            <button onClick={() => setShowLyrics(false)} className="hover:bg-red-500 hover:text-white border-2 border-transparent hover:border-black transition-colors p-1">
              <ICONS.Close size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed bg-[#fcfbf9] relative scroll-smooth p-4" ref={lyricsContainerRef}>
            {loadingLyrics ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2 opacity-50 absolute inset-0">
                <ICONS.Loader className="animate-spin" size={24} />
                <span>ACCESSING_DATABASE...</span>
              </div>
            ) : analysis ? (
                <div className="space-y-4">
                    <div className="bg-orange-50 border-2 border-orange-200 p-4">
                        <h4 className="font-bold text-orange-600 mb-2 uppercase flex items-center gap-2">
                           <ICONS.Search size={14} /> Meaning Analysis
                        </h4>
                        <p className="text-gray-800 leading-relaxed font-sans">{analysis}</p>
                    </div>
                    <button onClick={() => setAnalysis(null)} className="text-xs underline text-gray-500">Back to Lyrics</button>
                </div>
            ) : parsedLyrics ? (
               <div className="space-y-4 pt-[40%] pb-[40%]">
                 {parsedLyrics.map((line, idx) => (
                    <p 
                      key={idx} 
                      className={`transition-all duration-300 ${
                        idx === activeLineIndex 
                          ? 'text-black font-bold text-sm scale-105 origin-left' 
                          : 'text-gray-400 text-xs blur-[0.5px]'
                      }`}
                    >
                      {line.text}
                    </p>
                 ))}
               </div>
            ) : (
              <div className="whitespace-pre-wrap">
                {lyrics || "No lyrics available."}
              </div>
            )}
          </div>
          
          {/* Footer Actions for Lyrics */}
          {!loadingLyrics && lyrics && !analysis && (
             <div className="p-3 border-t-2 border-black bg-gray-50 flex justify-center">
                <button 
                  onClick={handleAnalyze}
                  disabled={loadingAnalysis}
                  className="flex items-center gap-2 bg-black text-white px-4 py-2 text-xs font-bold font-mono hover:bg-orange-500 transition-colors"
                >
                   {loadingAnalysis ? <ICONS.Loader className="animate-spin" size={12} /> : <ICONS.Search size={12} />}
                   DEEP_DECODE
                </button>
             </div>
          )}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-black p-0 z-50 shadow-[0_-4px_0_0_rgba(0,0,0,0.05)]">
        {currentSong.previewUrl && (
          <audio 
            ref={audioRef}
            src={currentSong.previewUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
          />
        )}
        
        {/* Progress Bar Top */}
        <div className="w-full h-1 bg-gray-200 cursor-pointer group relative border-b border-black">
          <div 
            className="h-full bg-orange-500 transition-all duration-100 ease-linear relative" 
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-black border border-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex items-center justify-between p-4 h-20">
          
          {/* Track Info */}
          <div className="flex items-center space-x-4 w-1/4">
            <div className="w-12 h-12 border-2 border-black bg-gray-200 flex-shrink-0">
               <img 
                src={currentSong.coverUrl} 
                alt="Cover" 
                className="w-full h-full object-cover grayscale" 
              />
            </div>
            <div className="overflow-hidden">
              <h4 className="text-black font-bold font-mono text-sm truncate uppercase">{currentSong.title}</h4>
              <p className="text-gray-600 text-xs font-bold truncate">{currentSong.artist}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center justify-center w-2/4">
            <div className="flex items-center space-x-6">
              <button 
                className={`text-black hover:text-orange-600 transition active:scale-95 ${!hasPrev && 'opacity-30 cursor-not-allowed'}`} 
                title="Previous"
                onClick={onPrev}
                disabled={!hasPrev}
              >
                <ICONS.SkipBack size={24} strokeWidth={2.5} />
              </button>
              <button 
                className={`w-14 h-14 border-2 border-black flex items-center justify-center shadow-retro-sm transition-all active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${
                  !currentSong.previewUrl 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : isPlaying 
                      ? 'bg-black text-white hover:bg-gray-800' 
                      : 'bg-orange-400 text-black hover:bg-orange-300'
                }`}
                onClick={() => currentSong.previewUrl && setIsPlaying(!isPlaying)}
                disabled={!currentSong.previewUrl}
                title={isPlaying ? "Pause" : "Play"}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <ICONS.Pause size={28} fill="currentColor" />
                ) : (
                  <ICONS.Play size={28} fill="currentColor" className="ml-1" />
                )}
              </button>
              <button 
                className={`text-black hover:text-orange-600 transition active:scale-95 ${!hasNext && 'opacity-30 cursor-not-allowed'}`}
                title="Next"
                onClick={onNext}
                disabled={!hasNext}
              >
                <ICONS.SkipForward size={24} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Volume/Actions */}
          <div className="flex items-center justify-end space-x-4 w-1/4">
             {/* Radio Mode Toggle */}
             <button
               onClick={toggleRadioMode}
               className={`flex items-center gap-1 text-[10px] font-mono font-bold border border-black px-2 py-1 transition-all ${isRadioMode ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
               title="AI DJ Mode"
             >
                <ICONS.Mic size={12} />
                {isRadioMode ? 'ON AIR' : 'RADIO'}
             </button>

             {currentSong.externalUrl && (
               <a href={currentSong.externalUrl} target="_blank" rel="noopener noreferrer" className="text-black hover:text-green-600" title="Open in Spotify">
                 <ICONS.Music size={20} strokeWidth={2.5} />
               </a>
             )}
             
             {/* Lyrics Toggle */}
             <button 
               onClick={toggleLyrics}
               className={`transition ${showLyrics ? 'text-orange-600' : 'text-black hover:text-orange-600'}`}
               title="Show Lyrics"
             >
                <ICONS.Lyrics size={20} strokeWidth={2.5} />
             </button>

             <button 
               className={`transition ${isLiked ? 'text-red-600 fill-current' : 'text-black hover:text-red-500'}`} 
               title="Save to Liked"
               onClick={() => setIsLiked(!isLiked)}
             >
                <ICONS.Heart size={20} strokeWidth={2.5} fill={isLiked ? "currentColor" : "none"} />
             </button>
             
             <div className="flex items-center space-x-2 border-2 border-black px-2 py-1 bg-gray-50">
               <ICONS.Volume2 size={16} className="text-black" />
               <div 
                 className="w-16 h-2 bg-gray-300 border border-black relative cursor-pointer"
                 ref={volumeRef}
                 onClick={handleVolumeClick}
               >
                 <div className="h-full bg-black pointer-events-none" style={{ width: `${volume * 100}%` }}></div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MusicPlayer;
