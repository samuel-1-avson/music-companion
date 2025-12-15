
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import LiveInterface from './components/LiveInterface';
import Settings from './components/Settings';
import FocusMode from './components/FocusMode';
import Extensions from './components/Extensions';
import TheLab from './components/TheLab';
import Arcade from './components/Arcade';
import OfflineLibrary from './components/OfflineLibrary';
import UserProfile from './components/UserProfile'; 
import SentientBackground from './components/SentientBackground';
import { AppView, Song, MoodData, SpotifyProfile, Theme, MusicProvider } from './types';
import { MOCK_SONGS, ICONS } from './constants';
import { parseSpotifyToken, parseSpotifyError, getUserProfile, remoteControl } from './services/spotifyService';
import { recommendNextSong, generateDJTransition, generateGreeting } from './services/geminiService';
import { useWakeWord } from './hooks/useWakeWord';
import { getYouTubeAudioStream } from './services/musicService';
import { getFavoritesDB, toggleFavoriteDB, addToHistoryDB, saveSettingDB, getSettingDB } from './utils/db'; 

const App: React.FC = () => {
  const [userName, setUserName] = useState('User');
  
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [currentSong, setCurrentSong] = useState<Song | null>(MOCK_SONGS[0]);
  const [queue, setQueue] = useState<Song[]>(MOCK_SONGS);
  const [favorites, setFavorites] = useState<Song[]>([]); 
  
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [musicProvider, setMusicProvider] = useState<MusicProvider>('YOUTUBE');
  const [isRadioMode, setIsRadioMode] = useState(false);
  const [isDJSpeaking, setIsDJSpeaking] = useState(false);
  const [moodData, setMoodData] = useState<MoodData[]>([{ time: '08:00', score: 50, label: 'Neutral' }]);
  const [isAutoDJLoading, setIsAutoDJLoading] = useState(false);
  
  // Theme State
  const [theme, setTheme] = useState<Theme>('minimal');
  const [isSmartTheme, setIsSmartTheme] = useState(true);

  // Proactive Greeting State
  const [greeting, setGreeting] = useState<{message: string, action: string} | null>(null);

  // Audio Graph State
  const [musicAnalyser, setMusicAnalyser] = useState<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const hiddenAudioRef = useRef<HTMLAudioElement | null>(null);
  // EQ Nodes: [Low, MidLow, Mid, MidHigh, High]
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const [eqValues, setEqValues] = useState<number[]>([0,0,0,0,0]);

  // --- PERSISTENCE & INIT ---
  useEffect(() => {
      const savedSmart = localStorage.getItem('smart_theme_enabled');
      if (savedSmart !== null) setIsSmartTheme(savedSmart === 'true');
      
      const savedTheme = localStorage.getItem('user_theme');
      if (savedTheme && !isSmartTheme) setTheme(savedTheme as Theme);

      // Load Username
      getSettingDB('user_name').then(name => {
          if (name) setUserName(name);
      });
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Load Favorites on Mount
  useEffect(() => {
      getFavoritesDB().then(setFavorites).catch(console.error);
  }, []);

  const handleSetTheme = (t: Theme) => {
      setTheme(t);
      localStorage.setItem('user_theme', t);
      if (isSmartTheme) {
          setIsSmartTheme(false);
          localStorage.setItem('smart_theme_enabled', 'false');
      }
  };

  const handleToggleSmartTheme = () => {
      const newVal = !isSmartTheme;
      setIsSmartTheme(newVal);
      localStorage.setItem('smart_theme_enabled', String(newVal));
  };

  const handleUpdateProfile = (name: string, avatar?: string) => {
      setUserName(name);
      saveSettingDB('user_name', name);
      if (avatar) saveSettingDB('user_avatar', avatar);
  };

  // --- SMART THEME ENGINE ---
  useEffect(() => {
      if (!isSmartTheme) return;

      // 1. Context/View Based Overrides
      if (currentView === AppView.ARCADE) { setTheme('synthwave'); return; }
      if (currentView === AppView.LAB) { setTheme('terminal'); return; }
      if (currentView === AppView.FOCUS) { setTheme('obsidian'); return; }
      if (currentView === AppView.OFFLINE) { setTheme('minimal'); return; }

      // 2. Song Mood Based
      if (currentSong && currentSong.mood) {
          const mood = currentSong.mood.toLowerCase();
          if (mood.includes('energy') || mood.includes('workout')) setTheme('ember');
          else if (mood.includes('happy') || mood.includes('dance')) setTheme('solar');
          else if (mood.includes('chill') || mood.includes('relax')) setTheme('glacier');
          else if (mood.includes('focus') || mood.includes('study')) setTheme('midnight');
          else if (mood.includes('sad') || mood.includes('deep')) setTheme('oceanic');
          else if (mood.includes('nature')) setTheme('forest');
          else if (mood.includes('love')) setTheme('sakura');
          else if (mood.includes('cyber') || mood.includes('future')) setTheme('cyber');
          else if (mood.includes('retro')) setTheme('sunset');
          else setTheme('classic');
      } else {
          // 3. Time of Day Fallback
          const hour = new Date().getHours();
          if (hour >= 20 || hour < 6) setTheme('midnight');
          else if (hour >= 6 && hour < 11) setTheme('classic');
          else if (hour >= 18 && hour < 20) setTheme('sunset');
      }
  }, [currentView, currentSong?.id, currentSong?.mood, isSmartTheme]);


  const handleToggleFavorite = async (song: Song) => {
      const isAdded = await toggleFavoriteDB(song);
      if (isAdded) {
          setFavorites(prev => [...prev, song]);
      } else {
          setFavorites(prev => prev.filter(s => s.id !== song.id));
      }
  };

  // --- PROACTIVE COMPANION LOGIC ---
  useEffect(() => {
      if (!greeting) {
          generateGreeting(userName, moodData).then(result => {
             setGreeting(result);
             setTimeout(() => setGreeting(null), 10000);
          });
      }
  }, [userName]); // Regenerate greeting if name changes

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
      currentView !== AppView.LIVE && currentView !== AppView.FOCUS
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

        if (eqFiltersRef.current.length === 0) {
            const freqs = [60, 310, 1000, 3000, 12000];
            const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
            
            eqFiltersRef.current = freqs.map((f, i) => {
                const filter = ctx.createBiquadFilter();
                filter.type = types[i];
                filter.frequency.value = f;
                filter.gain.value = 0; 
                return filter;
            });
        }

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512; 

        const source = ctx.createMediaElementSource(audioElement);
        
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
      const newVals = [...eqValues];
      newVals[index] = value;
      setEqValues(newVals);
      
      if (eqFiltersRef.current[index]) {
          eqFiltersRef.current[index].gain.value = value;
      }
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const token = parseSpotifyToken(hash);
      const error = parseSpotifyError(hash);
      if (token) {
        setSpotifyToken(token);
        localStorage.setItem('spotify_token', token);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setCurrentView(AppView.EXTENSIONS);
      } else if (error) {
        setErrorMessage(`Spotify Connection Error: ${error}`);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setCurrentView(AppView.EXTENSIONS);
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

  // --- PLAYBACK CONTROL ---
  
  useEffect(() => {
      if (!currentSong) return;

      const triggerPlayback = async () => {
          if (musicProvider === 'SPOTIFY' && spotifyToken && currentSong.spotifyUri) {
              try {
                  await remoteControl.play(spotifyToken, currentSong.spotifyUri);
              } catch (e) {
                  console.error("Remote play failed", e);
                  setErrorMessage("Failed to send command to Spotify.");
              }
          } 
          else if (hiddenAudioRef.current && (currentSong.previewUrl || currentSong.fileBlob)) {
              hiddenAudioRef.current.src = currentSong.previewUrl || (currentSong.fileBlob ? URL.createObjectURL(currentSong.fileBlob) : '');
              hiddenAudioRef.current.play().catch(e => console.warn("Auto-play blocked", e));
          }
      };

      triggerPlayback();
  }, [currentSong?.id, musicProvider, spotifyToken]);

  const playSong = async (song: Song, contextQueue?: Song[]) => {
    let trackToPlay = song;
    
    if (musicProvider !== 'SPOTIFY') {
        if (song.spotifyUri?.startsWith('yt:') && !song.previewUrl) {
            const videoId = song.spotifyUri.split(':')[1];
            if (videoId) {
                try {
                    const streamUrl = await getYouTubeAudioStream(videoId);
                    if (streamUrl) trackToPlay = { ...song, previewUrl: streamUrl };
                } catch(e) {}
            }
        }
        if (song.fileBlob && !song.previewUrl) {
           trackToPlay = { ...song, previewUrl: URL.createObjectURL(song.fileBlob) };
        }
    }

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
       audioContextRef.current.resume();
    }
    
    setCurrentSong(trackToPlay);
    
    if (musicProvider !== 'SPOTIFY' && !trackToPlay.previewUrl && trackToPlay.externalUrl) {
        window.open(trackToPlay.externalUrl, '_blank');
    }
    
    const now = new Date();
    setMoodData(prev => [...prev.slice(-20), { 
        time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`, 
        score: Math.floor(Math.random() * 40) + 60, 
        label: song.mood || 'Vibe' 
    }]);

    addToHistoryDB(trackToPlay).catch(console.error);

    if (contextQueue) setQueue(contextQueue);
    else if (!queue.find(s => s.id === trackToPlay.id)) setQueue(prev => [...prev, trackToPlay]);
  };

  const handleNext = async () => {
    if (!currentSong || queue.length === 0) return;
    
    if (musicProvider === 'SPOTIFY' && spotifyToken) {
        await remoteControl.next(spotifyToken);
    }

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

  const handlePrev = async () => {
    if (musicProvider === 'SPOTIFY' && spotifyToken) {
        await remoteControl.previous(spotifyToken);
    }

    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    if (idx > 0) playSong(queue[idx - 1]);
    else playSong(queue[queue.length - 1]);
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
        return <TheLab setEQBand={setEQBand} eqValues={eqValues} analyser={musicAnalyser} />;
      case AppView.EXTENSIONS:
        return <Extensions onPlaySong={playSong} spotifyToken={spotifyToken} spotifyProfile={spotifyProfile} musicProvider={musicProvider} onSetMusicProvider={setMusicProvider} onDisconnectSpotify={handleDisconnectSpotify} />;
      case AppView.SETTINGS:
        return <Settings currentTheme={theme} onSetTheme={handleSetTheme} isSmartTheme={isSmartTheme} onToggleSmartTheme={handleToggleSmartTheme} />;
      case AppView.PROFILE: 
        return <UserProfile userName={userName} favorites={favorites} onPlaySong={playSong} onToggleFavorite={handleToggleFavorite} onUpdateProfile={handleUpdateProfile} />;
      default:
        return <Dashboard onPlaySong={playSong} onChangeView={setCurrentView} spotifyToken={spotifyToken} moodData={moodData} musicProvider={musicProvider} onSetMusicProvider={setMusicProvider} />;
    }
  };
  
  return (
    <div className="flex h-screen w-full bg-transparent text-[var(--text-main)] font-sans transition-colors duration-300 relative">
      
      <SentientBackground 
         mood={currentSong?.mood || 'Neutral'} 
         isPlaying={!!currentSong?.previewUrl && !isAutoDJLoading} 
         theme={theme}
      />

      <audio 
        ref={(el) => {
            hiddenAudioRef.current = el;
            if (el) handleAudioElement(el);
        }}
        onEnded={handleNext}
        className="hidden"
        crossOrigin="anonymous"
      />

      {greeting && (
          <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-700 w-[90%] max-w-md">
              <div className="bg-white/90 backdrop-blur-md border-2 border-black p-4 shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-xl flex items-start gap-4">
                  <div className="bg-black text-white p-2 rounded-full flex-shrink-0">
                      <ICONS.Smile size={24} />
                  </div>
                  <div className="flex-1">
                      <p className="text-sm font-medium font-sans text-black leading-snug">{greeting.message}</p>
                      <button 
                        onClick={() => {
                            setGreeting(null);
                            if (greeting.action.includes("Focus")) setCurrentView(AppView.FOCUS);
                            if (greeting.action.includes("Play")) playSong(MOCK_SONGS[2]);
                        }}
                        className="text-xs font-bold bg-black text-white px-3 py-1.5 rounded-full mt-3 hover:bg-[var(--primary)] hover:text-black transition-colors"
                      >
                          {greeting.action}
                      </button>
                  </div>
                  <button onClick={() => setGreeting(null)} className="text-gray-400 hover:text-black">
                      <ICONS.Close size={14} />
                  </button>
              </div>
          </div>
      )}

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
           <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-[var(--text-main)] text-[var(--bg-main)] px-6 py-3 shadow-retro flex items-center space-x-3 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 rounded-full">
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
      </main>
    </div>
  );
};

export default App;
