import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import MusicPlayer from './components/MusicPlayer';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import LiveInterface from './components/LiveInterface';
import Settings from './components/Settings';
import FocusMode from './components/FocusMode';
import Extensions from './components/Extensions';
import TheLab from './components/TheLab';
import IntroPage from './components/IntroPage';
import Arcade from './components/Arcade';
import OfflineLibrary from './components/OfflineLibrary';
import { AppView, Song, MoodData, SpotifyProfile, Theme, MusicProvider } from './types';
import { MOCK_SONGS, ICONS } from './constants';
import { parseSpotifyToken, parseSpotifyError, getUserProfile } from './services/spotifyService';
import { recommendNextSong, generateDJTransition } from './services/geminiService';
import { useWakeWord } from './hooks/useWakeWord';
import { getYouTubeAudioStream } from './services/musicService';

const App: React.FC = () => {
  const [introCompleted, setIntroCompleted] = useState(false);
  const [userName, setUserName] = useState('');
  
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [currentSong, setCurrentSong] = useState<Song | null>(MOCK_SONGS[0]);
  const [queue, setQueue] = useState<Song[]>(MOCK_SONGS);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Theme State
  const [theme, setTheme] = useState<Theme>('minimal');
  
  // Provider State
  const [musicProvider, setMusicProvider] = useState<MusicProvider>('YOUTUBE');

  // Radio Mode
  const [isRadioMode, setIsRadioMode] = useState(false);
  const [isDJSpeaking, setIsDJSpeaking] = useState(false);
  
  // Real Mood State
  const [moodData, setMoodData] = useState<MoodData[]>([
     { time: '08:00', score: 50, label: 'Neutral' }
  ]);
  
  // Auto-DJ State
  const [isAutoDJLoading, setIsAutoDJLoading] = useState(false);

  // Music Visualization State
  const [musicAnalyser, setMusicAnalyser] = useState<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Apply Theme
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Wake Word Handler
  const handleWakeWordDetected = useCallback(() => {
    // Play a "Listening" Chime
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);

    // Switch to Live Mode
    setCurrentView(AppView.LIVE);
  }, []);

  // Use Wake Word Hook - Only active when NOT in Live mode or Focus Mode
  // We disable it in Live mode because Live mode claims the microphone for Gemini
  const { isListening: isWakeWordListening } = useWakeWord(
      handleWakeWordDetected, 
      introCompleted && currentView !== AppView.LIVE && currentView !== AppView.FOCUS
  );

  const handleAudioElement = useCallback((audioElement: HTMLAudioElement) => {
    if (musicSourceRef.current?.mediaElement === audioElement) return;

    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContextClass();
        }
        const ctx = audioContextRef.current;

        // Resume context on user interaction if suspended
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128; // Use 128 for chunky bars
        
        const source = ctx.createMediaElementSource(audioElement);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        
        musicSourceRef.current = source;
        setMusicAnalyser(analyser);
    } catch (e) {
        console.warn("Web Audio API setup failed (possibly CORS)", e);
    }
  }, []);

  useEffect(() => {
    // Check for hash in URL (callback from Spotify)
    const hash = window.location.hash;
    if (hash) {
      // If returning from Spotify auth, skip intro
      setIntroCompleted(true);
      
      const token = parseSpotifyToken(hash);
      const error = parseSpotifyError(hash);
      
      if (token) {
        setSpotifyToken(token);
        localStorage.setItem('spotify_token', token);
        // Clear hash but preserve path
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setCurrentView(AppView.SETTINGS);
      } else if (error) {
        let displayError = error;
        if (error.includes('invalid_client')) displayError += ' (Check Client ID)';
        if (error.includes('invalid_redirect_uri')) displayError += ' (Mismatching Redirect URI)';
        
        setErrorMessage(`Spotify Connection Error: ${displayError}`);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setCurrentView(AppView.SETTINGS);
      }
    } else {
      const savedToken = localStorage.getItem('spotify_token');
      if (savedToken) setSpotifyToken(savedToken);
    }
    
    // Listen for storage changes (e.g. login in another tab/popup)
    const handleStorageChange = () => {
        const token = localStorage.getItem('spotify_token');
        if (token && token !== spotifyToken) {
            setSpotifyToken(token);
        }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [spotifyToken]);

  // Fetch profile when token changes
  useEffect(() => {
    if (spotifyToken) {
      getUserProfile(spotifyToken).then(profile => {
        setSpotifyProfile(profile);
        // Auto-switch to Spotify provider if connected
        setMusicProvider('SPOTIFY');
      });
    } else {
      setSpotifyProfile(null);
      if (musicProvider === 'SPOTIFY') setMusicProvider('YOUTUBE');
    }
  }, [spotifyToken]);

  const handleDisconnectSpotify = () => {
    setSpotifyToken(null);
    setSpotifyProfile(null);
    localStorage.removeItem('spotify_token');
  };

  const calculateMoodScore = (mood?: string): number => {
      if (!mood) return 50;
      const m = mood.toLowerCase();
      if (m.includes('energy') || m.includes('happy') || m.includes('party')) return 90;
      if (m.includes('focus') || m.includes('study')) return 75;
      if (m.includes('chill') || m.includes('calm') || m.includes('relax')) return 40;
      if (m.includes('sad') || m.includes('blue')) return 20;
      return 60;
  };

  const updateMoodHistory = (song: Song) => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const score = calculateMoodScore(song.mood);
      
      setMoodData(prev => {
          const newData = [...prev, { time: timeStr, score, label: song.mood || 'Vibe' }];
          // Keep last 20 entries
          return newData.slice(-20);
      });
  };

  const playSong = async (song: Song, contextQueue?: Song[]) => {
    // If it's a YouTube track but hasn't resolved a stream URL yet
    let trackToPlay = song;
    
    if (song.spotifyUri?.startsWith('yt:') && !song.previewUrl) {
        // Extract ID from URI "yt:VIDEO_ID"
        const videoId = song.spotifyUri.split(':')[1];
        if (videoId) {
            try {
                // Fetch real stream
                const streamUrl = await getYouTubeAudioStream(videoId);
                if (streamUrl) {
                    trackToPlay = { ...song, previewUrl: streamUrl };
                } else {
                    setErrorMessage("Could not resolve audio stream for this track.");
                    return; // Abort
                }
            } catch(e) {
                setErrorMessage("Network error resolving audio.");
                return;
            }
        }
    }
    
    // Ensure blob URL is generated if missing for offline files
    if (song.fileBlob && !song.previewUrl) {
       trackToPlay = { ...song, previewUrl: URL.createObjectURL(song.fileBlob) };
    }

    // Try to resume audio context if it was suspended
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
       audioContextRef.current.resume();
    }

    setCurrentSong(trackToPlay);
    updateMoodHistory(trackToPlay);
    
    if (contextQueue) {
      setQueue(contextQueue);
    } else if (!queue.find(s => s.id === trackToPlay.id)) {
      setQueue(prev => [...prev, trackToPlay]);
    }
  };

  const handleReorderQueue = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= queue.length) return;
    setQueue(prev => {
        const newQueue = [...prev];
        const [moved] = newQueue.splice(fromIndex, 1);
        newQueue.splice(toIndex, 0, moved);
        return newQueue;
    });
  };

  const handleRemoveFromQueue = (index: number) => {
      setQueue(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddToQueue = (song: Song) => {
      setQueue(prev => [...prev, song]);
  };

  const speakDJIntro = (text: string, onEnd: () => void) => {
     if (!window.speechSynthesis) {
         onEnd();
         return;
     }
     
     setIsDJSpeaking(true);
     const utterance = new SpeechSynthesisUtterance(text);
     utterance.rate = 1.1; // Slightly faster
     utterance.pitch = 0.9; // Slightly deeper
     
     // Try to find a good English voice
     const voices = window.speechSynthesis.getVoices();
     const preferred = voices.find(v => v.name.includes('Google US English')) || voices.find(v => v.lang === 'en-US');
     if (preferred) utterance.voice = preferred;

     utterance.onend = () => {
         setIsDJSpeaking(false);
         onEnd();
     };
     utterance.onerror = () => {
         setIsDJSpeaking(false);
         onEnd();
     };

     window.speechSynthesis.speak(utterance);
  };

  const handleNext = async () => {
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    let nextSong: Song | null = null;
    
    if (idx < queue.length - 1) {
      nextSong = queue[idx + 1];
    } else {
      // End of Queue - Trigger Auto-DJ
      setIsAutoDJLoading(true);
      const recentHistory = queue.slice(-3);
      const generated = await recommendNextSong(currentSong, recentHistory, spotifyToken || undefined);
      setIsAutoDJLoading(false);
      
      if (generated) {
         setQueue(prev => [...prev, generated]);
         nextSong = generated;
      } else {
         // Fallback loop
         nextSong = queue[0];
      }
    }

    if (nextSong) {
       // Radio Mode Logic
       if (isRadioMode && currentSong) {
           // Generate script
           const script = await generateDJTransition(currentSong, nextSong);
           if (script) {
               speakDJIntro(script, () => {
                   playSong(nextSong!);
               });
               return; // Return early, playSong happens in callback
           }
       }
       
       playSong(nextSong);
    }
  };

  const handlePrev = () => {
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    if (idx > 0) {
      const prevSong = queue[idx - 1];
      playSong(prevSong);
    } else {
      playSong(queue[queue.length - 1]);
    }
  };

  const renderContent = () => {
    if (currentView === AppView.FOCUS) {
        return (
            <FocusMode 
                currentSong={currentSong} 
                onExit={() => setCurrentView(AppView.DASHBOARD)}
                isPlaying={!!currentSong?.previewUrl} // Simplified check, assumes player sync
                togglePlay={() => { /* Toggle handled by internal player ref, this is just visual sync for now */ }}
                onNext={handleNext}
            />
        );
    }

    switch (currentView) {
      case AppView.DASHBOARD:
        return (
            <Dashboard 
                onPlaySong={playSong} 
                onChangeView={setCurrentView} 
                spotifyToken={spotifyToken} 
                moodData={moodData}
                musicProvider={musicProvider}
            />
        );
      case AppView.CHAT:
        return (
            <ChatInterface 
                onPlaySong={playSong} 
                spotifyToken={spotifyToken} 
                musicProvider={musicProvider}
            />
        );
      case AppView.LIVE:
        return (
            <LiveInterface 
                currentSong={currentSong} 
                musicAnalyser={musicAnalyser} 
                onPlaySong={playSong} 
                spotifyToken={spotifyToken} 
                musicProvider={musicProvider}
            />
        );
      case AppView.ARCADE:
        return <Arcade />;
      case AppView.OFFLINE:
        return <OfflineLibrary onPlaySong={playSong} />;
      case AppView.LAB:
        return <TheLab />;
      case AppView.EXTENSIONS:
        return (
            <Extensions 
                onPlaySong={playSong} 
                spotifyToken={spotifyToken} 
                musicProvider={musicProvider}
            />
        );
      case AppView.SETTINGS:
        return (
           <Settings 
             spotifyToken={spotifyToken} 
             spotifyProfile={spotifyProfile}
             onDisconnect={handleDisconnectSpotify}
             currentTheme={theme}
             onSetTheme={setTheme}
             musicProvider={musicProvider}
             onSetMusicProvider={setMusicProvider}
           />
        );
      default:
        return (
            <Dashboard 
                onPlaySong={playSong} 
                onChangeView={setCurrentView} 
                spotifyToken={spotifyToken} 
                moodData={moodData}
                musicProvider={musicProvider}
            />
        );
    }
  };
  
  // Show Intro Page if not completed
  if (!introCompleted) {
    return <IntroPage onComplete={(name) => {
      setUserName(name);
      setIntroCompleted(true);
    }} />;
  }

  return (
    <div className="flex h-screen w-full bg-[var(--bg-main)] text-[var(--text-main)] font-sans selection:bg-[var(--primary)] selection:text-white transition-colors duration-300">
      {currentView !== AppView.FOCUS && (
          <Sidebar 
            currentView={currentView} 
            onChangeView={setCurrentView} 
            spotifyProfile={spotifyProfile}
            isListeningForWakeWord={isWakeWordListening}
          />
      )}
      
      <main className={`relative h-full overflow-hidden flex flex-col ${currentView === AppView.FOCUS ? 'w-full' : 'flex-1 ml-64'}`}>
        {errorMessage && (
           <div className="bg-red-500 text-white p-4 font-mono font-bold text-sm text-center flex justify-between items-center shadow-lg z-50 animate-in slide-in-from-top-2">
              <span className="flex-1">{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="ml-4 hover:underline font-bold bg-white text-red-500 px-2 py-1">DISMISS</button>
           </div>
        )}

        <div className="flex-1 overflow-y-auto scroll-smooth">
          {renderContent()}
        </div>
        
        {/* DJ / Auto-DJ Loading Indicator */}
        {(isAutoDJLoading || isDJSpeaking) && (
           <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-[var(--text-main)] text-[var(--bg-main)] px-6 py-3 shadow-retro flex items-center space-x-3 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
              <div className="relative">
                 <ICONS.Loader className="animate-spin text-[var(--primary)]" />
                 {isDJSpeaking && <span className="absolute inset-0 bg-[var(--primary)] rounded-full animate-ping opacity-20"></span>}
              </div>
              <div className="flex flex-col">
                 <span className="font-bold font-mono text-sm uppercase tracking-wider">
                     {isDJSpeaking ? "DJ ON AIR" : "Auto-DJ Active"}
                 </span>
                 <span className="text-xs text-gray-400">
                     {isDJSpeaking ? "Speaking..." : "Curating next track..."}
                 </span>
              </div>
           </div>
        )}

        {currentView !== AppView.FOCUS && <div className="h-24 flex-shrink-0"></div>}
      </main>

      {currentView !== AppView.FOCUS && (
          <MusicPlayer 
            currentSong={currentSong} 
            queue={queue}
            onNext={handleNext}
            onPrev={handlePrev}
            hasNext={true} 
            hasPrev={queue.length > 1}
            isRadioMode={isRadioMode}
            toggleRadioMode={() => setIsRadioMode(!isRadioMode)}
            onAudioElement={handleAudioElement}
            onPlaySong={playSong}
            onReorderQueue={handleReorderQueue}
            onRemoveFromQueue={handleRemoveFromQueue}
            onAddToQueue={handleAddToQueue}
          />
      )}
    </div>
  );
};

export default App;