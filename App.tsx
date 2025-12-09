
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
import { getMemories } from './utils/db';

const App: React.FC = () => {
  const [introCompleted, setIntroCompleted] = useState(false);
  const [userName, setUserName] = useState('');
  
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [currentSong, setCurrentSong] = useState<Song | null>(MOCK_SONGS[0]);
  const [queue, setQueue] = useState<Song[]>(MOCK_SONGS);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('minimal');
  const [musicProvider, setMusicProvider] = useState<MusicProvider>('YOUTUBE');
  const [isRadioMode, setIsRadioMode] = useState(false);
  const [isDJSpeaking, setIsDJSpeaking] = useState(false);
  const [moodData, setMoodData] = useState<MoodData[]>([{ time: '08:00', score: 50, label: 'Neutral' }]);
  const [isAutoDJLoading, setIsAutoDJLoading] = useState(false);

  // Audio Graph State
  const [musicAnalyser, setMusicAnalyser] = useState<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  // EQ Nodes: [Low, MidLow, Mid, MidHigh, High]
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const [eqValues, setEqValues] = useState<number[]>([0,0,0,0,0]);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Wake Word
  const handleWakeWordDetected = useCallback(() => {
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
    setCurrentView(AppView.LIVE);
  }, []);

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
        if (ctx.state === 'suspended') ctx.resume();

        // Create EQ Filters if not exist
        if (eqFiltersRef.current.length === 0) {
            const freqs = [60, 310, 1000, 3000, 12000];
            const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
            
            eqFiltersRef.current = freqs.map((f, i) => {
                const filter = ctx.createBiquadFilter();
                filter.type = types[i];
                filter.frequency.value = f;
                filter.gain.value = 0; // default 0dB
                return filter;
            });
        }

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512; // Higher resolution for visualization

        const source = ctx.createMediaElementSource(audioElement);
        
        // Connect Graph: Source -> EQ1 -> EQ2... -> EQ5 -> Analyser -> Destination
        let currentNode: AudioNode = source;
        eqFiltersRef.current.forEach(filter => {
            currentNode.connect(filter);
            currentNode = filter;
        });
        
        currentNode.connect(analyser);
        analyser.connect(ctx.destination);
        
        musicSourceRef.current = source;
        setMusicAnalyser(analyser);
    } catch (e) {
        console.warn("Web Audio API setup failed", e);
    }
  }, []);

  const setEQBand = (index: number, value: number) => {
      // Update State
      const newVals = [...eqValues];
      newVals[index] = value;
      setEqValues(newVals);
      
      // Update Audio Node
      if (eqFiltersRef.current[index]) {
          eqFiltersRef.current[index].gain.value = value;
      }
  };

  useEffect(() => {
    // Spotify Auth handling (same as before)
    const hash = window.location.hash;
    if (hash) {
      setIntroCompleted(true);
      const token = parseSpotifyToken(hash);
      const error = parseSpotifyError(hash);
      if (token) {
        setSpotifyToken(token);
        localStorage.setItem('spotify_token', token);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setCurrentView(AppView.SETTINGS);
      } else if (error) {
        setErrorMessage(`Spotify Connection Error: ${error}`);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setCurrentView(AppView.SETTINGS);
      }
    } else {
      const savedToken = localStorage.getItem('spotify_token');
      if (savedToken) setSpotifyToken(savedToken);
    }
    const handleStorageChange = () => {
        const token = localStorage.getItem('spotify_token');
        if (token && token !== spotifyToken) setSpotifyToken(token);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [spotifyToken]);

  useEffect(() => {
    if (spotifyToken) {
      getUserProfile(spotifyToken).then(profile => {
        setSpotifyProfile(profile);
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

  const playSong = async (song: Song, contextQueue?: Song[]) => {
    let trackToPlay = song;
    if (song.spotifyUri?.startsWith('yt:') && !song.previewUrl) {
        const videoId = song.spotifyUri.split(':')[1];
        if (videoId) {
            try {
                const streamUrl = await getYouTubeAudioStream(videoId);
                if (streamUrl) trackToPlay = { ...song, previewUrl: streamUrl };
                else { setErrorMessage("Could not resolve audio."); return; }
            } catch(e) { setErrorMessage("Network error."); return; }
        }
    }
    if (song.fileBlob && !song.previewUrl) {
       trackToPlay = { ...song, previewUrl: URL.createObjectURL(song.fileBlob) };
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
       audioContextRef.current.resume();
    }
    setCurrentSong(trackToPlay);
    // Update mood history
    const now = new Date();
    setMoodData(prev => [...prev.slice(-20), { 
        time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`, 
        score: Math.floor(Math.random() * 40) + 60, // simple calc
        label: song.mood || 'Vibe' 
    }]);

    if (contextQueue) setQueue(contextQueue);
    else if (!queue.find(s => s.id === trackToPlay.id)) setQueue(prev => [...prev, trackToPlay]);
  };

  const handleNext = async () => {
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    let nextSong: Song | null = null;
    if (idx < queue.length - 1) nextSong = queue[idx + 1];
    else {
      setIsAutoDJLoading(true);
      const generated = await recommendNextSong(currentSong, queue.slice(-3), spotifyToken || undefined);
      setIsAutoDJLoading(false);
      if (generated) {
         setQueue(prev => [...prev, generated]);
         nextSong = generated;
      } else nextSong = queue[0];
    }

    if (nextSong) {
       if (isRadioMode && currentSong) {
           const script = await generateDJTransition(currentSong, nextSong);
           if (script) {
               // DJ Logic
               setIsDJSpeaking(true);
               const u = new SpeechSynthesisUtterance(script);
               u.onend = () => { setIsDJSpeaking(false); playSong(nextSong!); };
               window.speechSynthesis.speak(u);
               return; 
           }
       }
       playSong(nextSong);
    }
  };

  const handlePrev = () => {
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    if (idx > 0) playSong(queue[idx - 1]);
    else playSong(queue[queue.length - 1]);
  };

  const handleLoadPlaylist = (songs: Song[]) => {
      if (songs.length > 0) {
          setQueue(songs);
          playSong(songs[0], songs);
      }
  };

  const renderContent = () => {
    if (currentView === AppView.FOCUS) {
        return <FocusMode currentSong={currentSong} onExit={() => setCurrentView(AppView.DASHBOARD)} isPlaying={!!currentSong?.previewUrl} togglePlay={() => {}} onNext={handleNext} />;
    }
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard onPlaySong={playSong} onChangeView={setCurrentView} spotifyToken={spotifyToken} moodData={moodData} musicProvider={musicProvider} onSetMusicProvider={setMusicProvider} />;
      case AppView.CHAT:
        return <ChatInterface onPlaySong={playSong} spotifyToken={spotifyToken} musicProvider={musicProvider} />;
      case AppView.LIVE:
        return <LiveInterface currentSong={currentSong} musicAnalyser={musicAnalyser} onPlaySong={playSong} spotifyToken={spotifyToken} musicProvider={musicProvider} />;
      case AppView.ARCADE:
        return <Arcade />;
      case AppView.OFFLINE:
        return <OfflineLibrary onPlaySong={playSong} />;
      case AppView.LAB:
        return <TheLab setEQBand={setEQBand} eqValues={eqValues} />;
      case AppView.EXTENSIONS:
        return <Extensions onPlaySong={playSong} spotifyToken={spotifyToken} musicProvider={musicProvider} />;
      case AppView.SETTINGS:
        return <Settings spotifyToken={spotifyToken} spotifyProfile={spotifyProfile} onDisconnect={handleDisconnectSpotify} currentTheme={theme} onSetTheme={setTheme} musicProvider={musicProvider} onSetMusicProvider={setMusicProvider} />;
      default:
        return <Dashboard onPlaySong={playSong} onChangeView={setCurrentView} spotifyToken={spotifyToken} moodData={moodData} musicProvider={musicProvider} onSetMusicProvider={setMusicProvider} />;
    }
  };
  
  if (!introCompleted) {
    return <IntroPage onComplete={(name) => { setUserName(name); setIntroCompleted(true); }} />;
  }

  return (
    <div className="flex h-screen w-full bg-[var(--bg-main)] text-[var(--text-main)] font-sans transition-colors duration-300">
      {currentView !== AppView.FOCUS && (
          <Sidebar currentView={currentView} onChangeView={setCurrentView} spotifyProfile={spotifyProfile} isListeningForWakeWord={isWakeWordListening} />
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
        
        {(isAutoDJLoading || isDJSpeaking) && (
           <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-[var(--text-main)] text-[var(--bg-main)] px-6 py-3 shadow-retro flex items-center space-x-3 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
              <div className="relative">
                 <ICONS.Loader className="animate-spin text-[var(--primary)]" />
                 {isDJSpeaking && <span className="absolute inset-0 bg-[var(--primary)] rounded-full animate-ping opacity-20"></span>}
              </div>
              <div className="flex flex-col">
                 <span className="font-bold font-mono text-sm uppercase tracking-wider">{isDJSpeaking ? "DJ ON AIR" : "Auto-DJ Active"}</span>
                 <span className="text-xs text-gray-400">{isDJSpeaking ? "Speaking..." : "Curating next track..."}</span>
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
            onReorderQueue={(f, t) => {
                setQueue(prev => {
                    const n = [...prev];
                    const [m] = n.splice(f, 1);
                    n.splice(t, 0, m);
                    return n;
                })
            }}
            onRemoveFromQueue={i => setQueue(prev => prev.filter((_, idx) => idx !== i))}
            onAddToQueue={s => setQueue(prev => [...prev, s])}
            onLoadPlaylist={handleLoadPlaylist}
            musicAnalyser={musicAnalyser}
          />
      )}
    </div>
  );
};

export default App;
