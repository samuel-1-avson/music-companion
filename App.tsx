import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MusicPlayer from './components/MusicPlayer';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import LiveInterface from './components/LiveInterface';
import Settings from './components/Settings';
import FocusMode from './components/FocusMode';
import { AppView, Song, MoodData, SpotifyProfile } from './types';
import { MOCK_SONGS, ICONS } from './constants';
import { parseSpotifyToken, parseSpotifyError, getUserProfile } from './services/spotifyService';
import { recommendNextSong, generateDJTransition } from './services/geminiService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [currentSong, setCurrentSong] = useState<Song | null>(MOCK_SONGS[0]);
  const [queue, setQueue] = useState<Song[]>(MOCK_SONGS);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Radio Mode
  const [isRadioMode, setIsRadioMode] = useState(false);
  const [isDJSpeaking, setIsDJSpeaking] = useState(false);
  
  // Real Mood State
  const [moodData, setMoodData] = useState<MoodData[]>([
     { time: '08:00', score: 50, label: 'Neutral' }
  ]);
  
  // Auto-DJ State
  const [isAutoDJLoading, setIsAutoDJLoading] = useState(false);

  useEffect(() => {
    // Check for hash in URL (callback from Spotify)
    const hash = window.location.hash;
    if (hash) {
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
      });
    } else {
      setSpotifyProfile(null);
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

  const playSong = (song: Song, contextQueue?: Song[]) => {
    setCurrentSong(song);
    updateMoodHistory(song);
    
    if (contextQueue) {
      setQueue(contextQueue);
    } else if (!queue.find(s => s.id === song.id)) {
      setQueue([song]);
    }
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
           // Note: We use a simple non-blocking placeholder if intro generation is slow? 
           // Better to wait a bit for the effect.
           const script = await generateDJTransition(currentSong, nextSong);
           if (script) {
               speakDJIntro(script, () => {
                   setCurrentSong(nextSong);
                   updateMoodHistory(nextSong!);
               });
               return; // Return early, playSong happens in callback
           }
       }
       
       setCurrentSong(nextSong);
       updateMoodHistory(nextSong);
    }
  };

  const handlePrev = () => {
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    if (idx > 0) {
      const prevSong = queue[idx - 1];
      setCurrentSong(prevSong);
      updateMoodHistory(prevSong);
    } else {
      setCurrentSong(queue[queue.length - 1]);
      updateMoodHistory(queue[queue.length - 1]);
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
        return <Dashboard onPlaySong={playSong} onChangeView={setCurrentView} spotifyToken={spotifyToken} moodData={moodData} />;
      case AppView.CHAT:
        return <ChatInterface onPlaySong={playSong} spotifyToken={spotifyToken} />;
      case AppView.LIVE:
        return <LiveInterface currentSong={currentSong} />;
      case AppView.SETTINGS:
        return (
           <Settings 
             spotifyToken={spotifyToken} 
             spotifyProfile={spotifyProfile}
             onDisconnect={handleDisconnectSpotify} 
           />
        );
      default:
        return <Dashboard onPlaySong={playSong} onChangeView={setCurrentView} spotifyToken={spotifyToken} moodData={moodData} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#fcfbf9] text-gray-900 font-sans selection:bg-orange-400 selection:text-black">
      {currentView !== AppView.FOCUS && (
          <Sidebar currentView={currentView} onChangeView={setCurrentView} spotifyProfile={spotifyProfile} />
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
           <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-black text-white px-6 py-3 shadow-retro flex items-center space-x-3 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
              <div className="relative">
                 <ICONS.Loader className="animate-spin text-orange-500" />
                 {isDJSpeaking && <span className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-20"></span>}
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
            onNext={handleNext}
            onPrev={handlePrev}
            hasNext={true} 
            hasPrev={queue.length > 1}
            isRadioMode={isRadioMode}
            toggleRadioMode={() => setIsRadioMode(!isRadioMode)}
          />
      )}
    </div>
  );
};

export default App;
