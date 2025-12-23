import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';

// Lazy load views for code splitting
const Dashboard = lazy(() => import('./components/Dashboard'));
const ChatInterface = lazy(() => import('./components/ChatInterface'));
const LiveInterface = lazy(() => import('./components/LiveInterface'));
const Settings = lazy(() => import('./components/Settings'));
const FocusMode = lazy(() => import('./components/FocusMode'));
const Extensions = lazy(() => import('./components/Extensions'));
const TheLab = lazy(() => import('./components/TheLab'));
const Arcade = lazy(() => import('./components/Arcade'));
const OfflineLibrary = lazy(() => import('./components/OfflineLibrary'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const CollaborativePlaylists = lazy(() => import('./components/CollaborativePlaylists'));

// Non-lazy components (always needed)
import SentientBackground from './components/SentientBackground';
import ErrorBoundary from './components/ErrorBoundary';
import InstallPrompt from './components/InstallPrompt';
import RadioStation from './components/RadioStation';
import ArtistGraph from './components/ArtistGraph';
import { LoadingSkeleton } from './components/LazyLoad';
import UserMenu from './components/UserMenu';

import { AppView, Song, MoodData, SpotifyProfile, Theme, MusicProvider } from './types';
import { ICONS } from './constants';
import { parseSpotifyToken, parseSpotifyError, getUserProfile, remoteControl } from './services/spotifyService';
import { recommendNextSong, generateDJTransition, generateGreeting, generatePlaylistFromContext, generateSmartDJQueue } from './services/geminiService';

import { useWakeWord } from './hooks/useWakeWord';
import { useFavorites } from './hooks/useFavorites';
import { getYouTubeAudioStream } from './services/musicService';
import { addToHistoryDB, saveSettingDB, getSettingDB } from './utils/db';
import { initializeDeveloperApi, dispatchApiEvent } from './services/developerApiService';
import { dispatchEvent as dispatchWebhookEvent } from './services/webhookService';
import { authenticateWithToken as lastfmAuthenticateWithToken } from './services/lastfmService';

// Zustand Stores
import { usePlayerStore, useUIStore, useSettingsStore, useErrorStore } from './stores';

// React Query
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './hooks/useApiQuery';

// Providers
import { ToastProvider } from './contexts/ToastContext';
import { I18nProvider } from './i18n';
import { AuthProvider, useAuth } from './contexts/AuthContext';


const App: React.FC = () => {
  const { spotifyTokens, profile, isAuthenticated } = useAuth();
  
  // === ZUSTAND STORES ===
  // Player Store
  const currentSong = usePlayerStore(state => state.currentSong);
  const setCurrentSong = usePlayerStore(state => state.setCurrentSong);
  const queue = usePlayerStore(state => state.queue);
  const setQueue = usePlayerStore(state => state.setQueue);
  const volume = usePlayerStore(state => state.volume);
  const setVolume = usePlayerStore(state => state.setVolume);
  const isMuted = usePlayerStore(state => state.isMuted);
  const toggleMute = usePlayerStore(state => state.toggleMute);
  const setIsMuted = (muted: boolean | ((prev: boolean) => boolean)) => {
    if (typeof muted === 'function') {
      usePlayerStore.setState(state => ({ isMuted: muted(state.isMuted) }));
    } else {
      usePlayerStore.setState({ isMuted: muted });
    }
  };
  const playbackSpeed = usePlayerStore(state => state.playbackSpeed);
  const setPlaybackSpeed = usePlayerStore(state => state.setPlaybackSpeed);
  const shuffleEnabled = usePlayerStore(state => state.shuffleEnabled);
  const setShuffleEnabled = (enabled: boolean | ((prev: boolean) => boolean)) => {
    if (typeof enabled === 'function') {
      usePlayerStore.setState(state => ({ shuffleEnabled: enabled(state.shuffleEnabled) }));
    } else {
      usePlayerStore.setState({ shuffleEnabled: enabled });
    }
  };
  const repeatMode = usePlayerStore(state => state.repeatMode);
  const setRepeatMode = (mode: 'off' | 'all' | 'one' | ((prev: 'off' | 'all' | 'one') => 'off' | 'all' | 'one')) => {
    if (typeof mode === 'function') {
      usePlayerStore.setState(state => ({ repeatMode: mode(state.repeatMode) }));
    } else {
      usePlayerStore.setState({ repeatMode: mode });
    }
  };
  const smartDJEnabled = usePlayerStore(state => state.smartDJEnabled);
  const setSmartDJEnabled = (enabled: boolean | ((prev: boolean) => boolean)) => {
    if (typeof enabled === 'function') {
      usePlayerStore.setState(state => ({ smartDJEnabled: enabled(state.smartDJEnabled) }));
    } else {
      usePlayerStore.setState({ smartDJEnabled: enabled });
    }
  };
  const isSmartDJLoading = usePlayerStore(state => state.isSmartDJLoading);
  const setIsSmartDJLoading = usePlayerStore(state => state.setIsSmartDJLoading);
  const isRadioMode = usePlayerStore(state => state.isRadioMode);
  const setIsRadioMode = usePlayerStore(state => state.setIsRadioMode);
  const isDJSpeaking = usePlayerStore(state => state.isDJSpeaking);
  const setIsDJSpeaking = usePlayerStore(state => state.setIsDJSpeaking);
  const musicProvider = usePlayerStore(state => state.musicProvider);
  const setMusicProvider = usePlayerStore(state => state.setMusicProvider);
  
  // UI Store
  const currentView = useUIStore(state => state.currentView);
  const setCurrentView = useUIStore(state => state.setCurrentView);
  const theme = useUIStore(state => state.theme);
  const setTheme = useUIStore(state => state.setTheme);
  const isSmartTheme = useUIStore(state => state.isSmartTheme);
  const setIsSmartTheme = useUIStore(state => state.setIsSmartTheme);
  const showKeyboardHelp = useUIStore(state => state.showKeyboardHelp);
  const setShowKeyboardHelp = useUIStore(state => state.setShowKeyboardHelp);
  const showRadio = useUIStore(state => state.showRadio);
  const setShowRadio = (show: boolean | ((prev: boolean) => boolean)) => {
    if (typeof show === 'function') {
      useUIStore.setState(state => ({ showRadio: show(state.showRadio) }));
    } else {
      useUIStore.setState({ showRadio: show });
    }
  };
  const showArtistGraph = useUIStore(state => state.showArtistGraph);
  const setShowArtistGraph = useUIStore(state => state.setShowArtistGraph);
  const artistGraphSeed = useUIStore(state => state.artistGraphSeed);
  const setArtistGraphSeed = useUIStore(state => state.setArtistGraphSeed);
  const errorMessage = useUIStore(state => state.errorMessage);
  const setErrorMessage = useUIStore(state => state.setErrorMessage);
  const greeting = useUIStore(state => state.greeting);
  const setGreeting = useUIStore(state => state.setGreeting);
  const moodData = useUIStore(state => state.moodData);
  const setMoodData = useUIStore(state => state.setMoodData);
  
  // Settings Store
  const userName = useSettingsStore(state => state.userName);
  const setUserName = useSettingsStore(state => state.setUserName);
  const crossfadeDuration = useSettingsStore(state => state.crossfadeDuration);
  const setCrossfadeDuration = useSettingsStore(state => state.setCrossfadeDuration);
  const eqValues = useSettingsStore(state => state.eqValues);
  const sleepTimerState = useSettingsStore(state => state.sleepTimer);
  const sleepTimerMinutes = sleepTimerState.minutes;
  const sleepTimerRemaining = sleepTimerState.remaining;
  
  // Use Supabase-backed favorites hook (falls back to localStorage for guests)
  const { favorites: favoriteSongs, toggleFavorite: toggleFavoriteSupabase, isFavorite } = useFavorites();
  
  // Convert FavoriteSong[] to Song[] for component compatibility
  const favorites: Song[] = favoriteSongs.map(f => ({
    id: f.song_id,
    title: f.title,
    artist: f.artist,
    coverUrl: f.cover_url || '',
    previewUrl: '',
  })); 
  
  // Legacy state that still needs local management
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);
  const [isAutoDJLoading, setIsAutoDJLoading] = useState(false);

  // Refs
  const smartDJFetchingRef = useRef(false);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const crossfadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCrossfadingRef = useRef(false);
  const [musicAnalyser, setMusicAnalyser] = useState<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const hiddenAudioRef = useRef<HTMLAudioElement | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const sleepTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- PERSISTENCE & INIT ---
  useEffect(() => {
      const savedSmart = localStorage.getItem('smart_theme_enabled');
      if (savedSmart !== null) setIsSmartTheme(savedSmart === 'true');
      
      const savedTheme = localStorage.getItem('user_theme');
      if (savedTheme && !isSmartTheme) setTheme(savedTheme as Theme);

      // Load Crossfade Setting
      const savedCrossfade = localStorage.getItem('crossfade_duration');
      if (savedCrossfade !== null) setCrossfadeDuration(Number(savedCrossfade));

      // Load Username - prefer auth profile, fallback to localStorage
      if (profile?.display_name) {
        setUserName(profile.display_name);
      } else {
        getSettingDB('user_name').then(name => {
            if (name) setUserName(name);
        });
      }

      // Initialize Developer API

      const api = initializeDeveloperApi();
      api._registerHandlers({
        play: (songId?: string) => {
          if (songId) {
            const song = queue.find(s => s.id === songId);
            if (song) playSong(song);
          } else if (hiddenAudioRef.current) {
            hiddenAudioRef.current.play();
          }
        },
        pause: () => hiddenAudioRef.current?.pause(),
        next: handleNext,
        previous: handlePrev,
        getQueue: () => queue,
        addToQueue: (song: Song) => setQueue(prev => [...prev, song]),
        getCurrentSong: () => currentSong,
        getPlaybackState: () => ({
          isPlaying: !hiddenAudioRef.current?.paused,
          currentSong,
          position: hiddenAudioRef.current?.currentTime || 0,
          duration: hiddenAudioRef.current?.duration || 0,
          volume: (hiddenAudioRef.current?.volume || 1) * 100
        }),
        getMoodData: () => moodData,
        generatePlaylist: async (prompt: string) => {
          const { songs } = await generatePlaylistFromContext(prompt, musicProvider, undefined, spotifyToken || undefined);
          return songs;
        }
      });
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Sync userName when auth profile changes
  useEffect(() => {
    if (profile?.display_name) {
      setUserName(profile.display_name);
    } else if (!isAuthenticated) {
      // Reset to default when signed out
      setUserName('User');
    }
  }, [profile, isAuthenticated]);

  // Favorites are now loaded by useFavorites hook automatically

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
      if (currentView === AppView.ARCADE) { setTheme('retro'); return; } // Gaming -> Retro/Cyberpunk
      if (currentView === AppView.LAB) { setTheme('glass'); return; } // Lab -> Glassmorphism (High tech)
      if (currentView === AppView.FOCUS) { setTheme('minimal'); return; } // Focus -> Minimalism (Distraction free)
      
      // 2. Song Mood Based Adaptation
      if (currentSong && currentSong.mood) {
          const mood = currentSong.mood.toLowerCase();
          
          if (mood.includes('energy') || mood.includes('workout') || mood.includes('intense')) {
              // High Energy -> Neo-Brutalism (Bold, striking)
              setTheme('neobrutalism');
          }
          else if (mood.includes('happy') || mood.includes('dance') || mood.includes('pop')) {
              // Upbeat/General -> Material Design (Clean, familiar, vibrant)
              setTheme('material');
          }
          else if (mood.includes('chill') || mood.includes('relax') || mood.includes('acoustic')) {
              // Chill -> Neumorphism (Soft, pillowy, tactile)
              setTheme('neumorphism');
          }
          else if (mood.includes('sad') || mood.includes('deep') || mood.includes('ethereal')) {
              // Emotional/Deep -> Glassmorphism (Translucent, dreamy)
              setTheme('glass');
          }
          else if (mood.includes('cyber') || mood.includes('electronic') || mood.includes('future')) {
              // Electronic -> Retro/Cyberpunk (Neon, dark)
              setTheme('retro');
          }
          else if (mood.includes('focus') || mood.includes('study') || mood.includes('classical')) {
              // Focus -> Minimalism (Clean lines)
              setTheme('minimal');
          }
          else {
              setTheme('material'); // Default fallback
          }
      } else {
          // 3. Time of Day Fallback (If no song playing)
          const hour = new Date().getHours();
          if (hour >= 18 || hour < 6) setTheme('glass'); // Night -> Dark/Sleek Glass
          else setTheme('material'); // Day -> Bright Material
      }
  }, [currentView, currentSong?.id, currentSong?.mood, isSmartTheme]);


  const handleToggleFavorite = async (song: Song) => {
      // Use Supabase-backed favorites (useFavorites hook handles state updates)
      await toggleFavoriteSupabase({
        id: song.id,
        title: song.title,
        artist: song.artist,
        coverUrl: song.coverUrl,
      });
  };

  // --- PHASE 1: SLEEP TIMER LOGIC ---
  const startSleepTimer = (minutes: number) => {
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
    }
    const endTime = Date.now() + minutes * 60 * 1000;
    useSettingsStore.getState().startSleepTimer(minutes);
    
    sleepTimerIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      useSettingsStore.getState().updateSleepTimerRemaining(remaining);
      if (remaining <= 0) {
        // Stop playback
        if (hiddenAudioRef.current) {
          hiddenAudioRef.current.pause();
        }
        cancelSleepTimer();
      }
    }, 1000);
  };

  const cancelSleepTimer = () => {
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
      sleepTimerIntervalRef.current = null;
    }
    useSettingsStore.getState().cancelSleepTimer();
  };

  // Cleanup sleep timer on unmount
  useEffect(() => {
    return () => {
      if (sleepTimerIntervalRef.current) {
        clearInterval(sleepTimerIntervalRef.current);
      }
    };
  }, []);

  // --- PHASE 1: KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (hiddenAudioRef.current) {
            if (hiddenAudioRef.current.paused) {
              hiddenAudioRef.current.play();
            } else {
              hiddenAudioRef.current.pause();
            }
          }
          break;
        case 'arrowright':
          e.preventDefault();
          handleNext();
          break;
        case 'arrowleft':
          e.preventDefault();
          handlePrev();
          break;
        case 'arrowup':
          e.preventDefault();
          setVolume(prev => Math.min(1, prev + 0.1));
          break;
        case 'arrowdown':
          e.preventDefault();
          setVolume(prev => Math.max(0, prev - 0.1));
          break;
        case 'm':
          setIsMuted(prev => !prev);
          break;
        case 's':
          if (!e.ctrlKey && !e.metaKey) {
            setShuffleEnabled(prev => !prev);
          }
          break;
        case 'r':
          if (!e.ctrlKey && !e.metaKey) {
            setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
          }
          break;
        case 'l':
          setCurrentView(AppView.LIVE);
          break;
        case 'f':
          if (!e.ctrlKey && !e.metaKey) {
            setCurrentView(currentView === AppView.FOCUS ? AppView.DASHBOARD : AppView.FOCUS);
          }
          break;
        case '?':
          setShowKeyboardHelp(prev => !prev);
          break;
        case 'escape':
          setShowKeyboardHelp(false);
          if (currentView === AppView.FOCUS) setCurrentView(AppView.DASHBOARD);
          break;
        case '1':
          setCurrentView(AppView.DASHBOARD);
          break;
        case '2':
          setCurrentView(AppView.CHAT);
          break;
        case '3':
          setCurrentView(AppView.LIVE);
          break;
        case '4':
          setCurrentView(AppView.EXTENSIONS);
          break;
        case '5':
          setCurrentView(AppView.LAB);
          break;
        case '6':
          setCurrentView(AppView.OFFLINE);
          break;
        case '7':
          setCurrentView(AppView.ARCADE);
          break;
        case '8':
          setCurrentView(AppView.FOCUS);
          break;
        case '9':
          setCurrentView(AppView.SETTINGS);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView]);

  // --- PHASE 1: VOLUME & PLAYBACK SPEED SYNC ---
  useEffect(() => {
    if (hiddenAudioRef.current) {
      hiddenAudioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (hiddenAudioRef.current) {
      hiddenAudioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // --- PHASE 2: CROSSFADE PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem('crossfade_duration', String(crossfadeDuration));
  }, [crossfadeDuration]);

  // --- PHASE 3: SMART DJ AUTO-PREFETCH ---
  useEffect(() => {
    if (!smartDJEnabled || !currentSong || smartDJFetchingRef.current) return;
    
    // Find current position in queue
    const currentIdx = queue.findIndex(s => s.id === currentSong.id);
    const remainingInQueue = queue.length - currentIdx - 1;
    
    // Pre-fetch when less than 3 songs remain
    if (remainingInQueue < 3) {
      smartDJFetchingRef.current = true;
      setIsSmartDJLoading(true);
      
      console.log('[SmartDJ] Pre-fetching songs... Queue has', remainingInQueue, 'remaining');
      
      // Determine mood from current song
      const currentMood = currentSong.mood || 'mixed';
      
      generateSmartDJQueue(queue.slice(-5), currentMood, 'medium', 5)
        .then(newSongs => {
          if (newSongs.length > 0) {
            setQueue(prev => [...prev, ...newSongs]);
            console.log('[SmartDJ] Added', newSongs.length, 'songs to queue');
          }
        })
        .catch(err => {
          console.error('[SmartDJ] Pre-fetch failed:', err);
        })
        .finally(() => {
          setIsSmartDJLoading(false);
          // Reset fetch lock after delay to allow next fetch
          setTimeout(() => {
            smartDJFetchingRef.current = false;
          }, 30000); // Wait 30s before allowing another fetch
        });
    }
  }, [smartDJEnabled, currentSong?.id, queue.length]);

  // --- PHASE 3: GAPLESS PLAYBACK ---
  // Pre-load next track and detect near-end for seamless transition
  useEffect(() => {
    if (!hiddenAudioRef.current || !currentSong || crossfadeDuration > 0) return;
    // Don't use gapless if crossfade is enabled (they conflict)
    
    const audio = hiddenAudioRef.current;
    const currentIdx = queue.findIndex(s => s.id === currentSong.id);
    const nextSong = currentIdx < queue.length - 1 ? queue[currentIdx + 1] : null;
    
    // Pre-load next track
    if (nextSong && (nextSong.previewUrl || nextSong.fileBlob)) {
      if (!nextAudioRef.current) {
        nextAudioRef.current = new Audio();
        nextAudioRef.current.crossOrigin = 'anonymous';
      }
      const nextSrc = nextSong.previewUrl || (nextSong.fileBlob ? URL.createObjectURL(nextSong.fileBlob) : '');
      if (nextAudioRef.current.src !== nextSrc) {
        nextAudioRef.current.src = nextSrc;
        nextAudioRef.current.load();
        console.log('[Gapless] Pre-loaded:', nextSong.title);
      }
    }
    
    // Near-end detection for gapless switch
    const handleTimeUpdate = () => {
      const duration = audio.duration;
      const currentTime = audio.currentTime;
      
      // Trigger switch 150ms before end
      if (duration && currentTime && duration - currentTime < 0.15 && !isCrossfadingRef.current) {
        isCrossfadingRef.current = true;
        if (nextAudioRef.current && nextSong) {
          console.log('[Gapless] Switching to:', nextSong.title);
          nextAudioRef.current.play().catch(() => {});
          handleNext();
        }
      }
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      isCrossfadingRef.current = false;
    };
  }, [currentSong?.id, queue, crossfadeDuration]);


  // --- PHASE 1: NOW PLAYING NOTIFICATION ---

  const sendNowPlayingNotification = useCallback((song: Song) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Now Playing: ${song.title}`, {
        body: song.artist,
        icon: song.coverUrl,
        silent: true
      });
    }
  }, []);

  // Request notification permission on first interaction
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // We'll request permission when user plays first song
    }
  }, []);

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
      useSettingsStore.getState().setEQBand(index, value);
      
      if (eqFiltersRef.current[index]) {
          eqFiltersRef.current[index].gain.value = value;
      }
  };

  useEffect(() => {
    // 1. Prefer Supabase Auth Tokens (Best for persistence & refresh)
    if (spotifyTokens?.accessToken) {
        setSpotifyToken(spotifyTokens.accessToken);
        localStorage.setItem('spotify_token', spotifyTokens.accessToken);
        setMusicProvider('SPOTIFY');
        return;
    }

    // 2. Handle Spotify hash callback (Legacy/Implicit)
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
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
      // 3. Fallback to localStorage
      const savedToken = localStorage.getItem('spotify_token');
      if (savedToken) setSpotifyToken(savedToken);
    }

    // Handle Last.fm query param callback (?token=...)
    const urlParams = new URLSearchParams(window.location.search);
    const lastfmToken = urlParams.get('token');
    if (lastfmToken) {
      // Exchange token for session
      lastfmAuthenticateWithToken(lastfmToken).then((session) => {
        if (session) {
          console.log('Last.fm authenticated:', session.name);
          // Dispatch a storage event so Extensions.tsx picks up the session
          window.dispatchEvent(new Event('storage'));
          setCurrentView(AppView.EXTENSIONS);
        } else {
          setErrorMessage('Last.fm authentication failed. Please try again.');
        }
        // Clean up the URL
        window.history.replaceState(null, '', window.location.pathname);
      });
    }

    // Handle Supabase OAuth callback errors (reuse urlParams from above)
    const oauthError = urlParams.get('error');
    const oauthErrorCode = urlParams.get('error_code');
    const oauthErrorDesc = urlParams.get('error_description');
    
    if (oauthError) {
      // Handle identity_already_exists - this means the OAuth account is linked to a DIFFERENT user
      if (oauthErrorCode === 'identity_already_exists') {
        console.warn('[OAuth] Identity already linked to another user');
        setErrorMessage(
          'This account is already linked to a different user. ' +
          'Each Spotify/Discord account can only be connected to one account. ' +
          'Please use a different Spotify/Discord account, or sign in with the original account.'
        );
        window.history.replaceState(null, '', window.location.pathname);
        setCurrentView(AppView.EXTENSIONS);
      } else {
        // Show other OAuth errors
        setErrorMessage(`OAuth Error: ${oauthErrorDesc || oauthError}`);
        window.history.replaceState(null, '', window.location.pathname);
        setCurrentView(AppView.EXTENSIONS);
      }
    }

    const handleStorageChange = () => {
        const token = localStorage.getItem('spotify_token');
        if (token && token !== spotifyToken) setSpotifyToken(token);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [spotifyToken, spotifyTokens]); // Added spotifyTokens dependency

  // Ref to prevent duplicate token validation
  const isValidatingTokenRef = useRef(false);
  const lastTokenValidatedRef = useRef<string | null>(null);
  const tokenValidationCooldownRef = useRef(false);

  useEffect(() => {
    // Skip if no token
    if (!spotifyToken) {
      setSpotifyProfile(null);
      if (musicProvider === 'SPOTIFY') setMusicProvider('YOUTUBE');
      return;
    }

    // Skip if already validating, same token, or in cooldown
    if (isValidatingTokenRef.current || 
        spotifyToken === lastTokenValidatedRef.current ||
        tokenValidationCooldownRef.current) {
      return;
    }

    isValidatingTokenRef.current = true;
    lastTokenValidatedRef.current = spotifyToken;

    getUserProfile(spotifyToken).then(profile => {
      isValidatingTokenRef.current = false;
      
      if (profile) {
        setSpotifyProfile(profile);
        setMusicProvider('SPOTIFY');
      } else {
        // Token invalid - Clear everything
        console.warn('[Spotify] Token invalid, clearing session');
        setSpotifyToken(null);
        setSpotifyProfile(null);
        localStorage.removeItem('spotify_token');
        lastTokenValidatedRef.current = null;
        
        // Set cooldown to prevent rapid validation loops
        tokenValidationCooldownRef.current = true;
        setTimeout(() => {
          tokenValidationCooldownRef.current = false;
        }, 5000); // 5 second cooldown
      }
    }).catch(() => {
      isValidatingTokenRef.current = false;
      // On error, also set cooldown
      tokenValidationCooldownRef.current = true;
      setTimeout(() => {
        tokenValidationCooldownRef.current = false;
      }, 5000);
    });
  }, [spotifyToken, musicProvider]);

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
    
    // Dispatch events to Developer API and Webhooks
    dispatchApiEvent('songChanged', trackToPlay);
    dispatchWebhookEvent('SONG_CHANGED', { 
      title: trackToPlay.title, 
      artist: trackToPlay.artist, 
      album: trackToPlay.album,
      mood: trackToPlay.mood 
    });
    
    // Only open external URLs in browser for non-streaming URLs (e.g. YouTube watch links)
    // Server downloads have stream URLs that should play in the app's audio player
    if (musicProvider !== 'SPOTIFY' && !trackToPlay.previewUrl && trackToPlay.externalUrl && !trackToPlay.externalUrl.includes('/stream')) {
        window.open(trackToPlay.externalUrl, '_blank');
    }
    
    const now = new Date();
    setMoodData(prev => [...prev.slice(-20), { 
        time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`, 
        score: Math.floor(Math.random() * 40) + 60, 
        label: song.mood || 'Vibe' 
    }]);

    addToHistoryDB(trackToPlay).catch(console.error);

    // Request notification permission and send Now Playing notification
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        sendNowPlayingNotification(trackToPlay);
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            sendNowPlayingNotification(trackToPlay);
          }
        });
      }
    }

    if (contextQueue) setQueue(contextQueue);
    else if (!queue.find(s => s.id === trackToPlay.id)) setQueue(prev => [...prev, trackToPlay]);
  };

  const handleNext = async () => {
    if (!currentSong || queue.length === 0) return;
    
    // Handle Repeat One mode
    if (repeatMode === 'one') {
      if (hiddenAudioRef.current) {
        hiddenAudioRef.current.currentTime = 0;
        hiddenAudioRef.current.play();
      }
      return;
    }

    if (musicProvider === 'SPOTIFY' && spotifyToken) {
        await remoteControl.next(spotifyToken);
    }

    const idx = queue.findIndex(s => s.id === currentSong.id);
    let nextSong: Song | null = null;

    // Handle Shuffle mode
    if (shuffleEnabled && queue.length > 1) {
      const availableSongs = queue.filter(s => s.id !== currentSong.id);
      if (availableSongs.length > 0) {
        nextSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];
      }
    } else if (idx < queue.length - 1) {
      nextSong = queue[idx + 1];
    } else if (repeatMode === 'all') {
      // Loop back to start
      nextSong = queue[0];
    } else {
      // End of queue, generate new song with Auto-DJ
      setIsAutoDJLoading(true);
      const generated = await recommendNextSong(currentSong, queue.slice(-3), spotifyToken || undefined);
      setIsAutoDJLoading(false);
      if (generated) {
         setQueue(prev => [...prev, generated]);
         nextSong = generated;
      } else {
        // No generated song and not repeating - loop to start
        nextSong = queue[0];
      }
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
    
    // In shuffle mode, go to start if we're at beginning... (or could track history)
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
        return <Settings currentTheme={theme} onSetTheme={handleSetTheme} isSmartTheme={isSmartTheme} onToggleSmartTheme={handleToggleSmartTheme} crossfadeDuration={crossfadeDuration} onSetCrossfadeDuration={setCrossfadeDuration} />;

      case AppView.PROFILE: 
        return <UserProfile userName={userName} favorites={favorites} onPlaySong={playSong} onToggleFavorite={handleToggleFavorite} onUpdateProfile={handleUpdateProfile} />;
      case AppView.COLLAB:
        return <CollaborativePlaylists onPlaySong={playSong} />;
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
                            // Note: For "Play" actions, user can search and play actual songs
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

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro max-w-lg w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b-2 border-theme bg-[var(--bg-hover)] flex justify-between items-center">
              <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2">
                <ICONS.Keyboard size={20} /> Keyboard Shortcuts
              </h2>
              <button onClick={() => setShowKeyboardHelp(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <ICONS.Close size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <h3 className="font-mono font-bold text-sm uppercase text-[var(--text-muted)] mb-2">Playback</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Play / Pause</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">Space</kbd></div>
                  <div className="flex justify-between"><span>Next Track</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">→</kbd></div>
                  <div className="flex justify-between"><span>Previous Track</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">←</kbd></div>
                  <div className="flex justify-between"><span>Volume Up</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">↑</kbd></div>
                  <div className="flex justify-between"><span>Volume Down</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">↓</kbd></div>
                  <div className="flex justify-between"><span>Mute / Unmute</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">M</kbd></div>
                  <div className="flex justify-between"><span>Toggle Shuffle</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">S</kbd></div>
                  <div className="flex justify-between"><span>Cycle Repeat</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">R</kbd></div>
                </div>
              </div>
              <div>
                <h3 className="font-mono font-bold text-sm uppercase text-[var(--text-muted)] mb-2">Navigation</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Dashboard</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">1</kbd></div>
                  <div className="flex justify-between"><span>Chat</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">2</kbd></div>
                  <div className="flex justify-between"><span>Live Mode</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">3 / L</kbd></div>
                  <div className="flex justify-between"><span>Extensions</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">4</kbd></div>
                  <div className="flex justify-between"><span>The Lab</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">5</kbd></div>
                  <div className="flex justify-between"><span>Offline Hub</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">6</kbd></div>
                  <div className="flex justify-between"><span>Arcade</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">7</kbd></div>
                  <div className="flex justify-between"><span>Focus Mode</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">8 / F</kbd></div>
                  <div className="flex justify-between"><span>Settings</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">9</kbd></div>
                </div>
              </div>
              <div>
                <h3 className="font-mono font-bold text-sm uppercase text-[var(--text-muted)] mb-2">Other</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Show/Hide Shortcuts</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">?</kbd></div>
                  <div className="flex justify-between"><span>Close Modal / Exit Focus</span><kbd className="px-2 py-0.5 bg-[var(--bg-hover)] border border-theme font-mono text-xs">Esc</kbd></div>
                </div>
              </div>
              
              {/* Current Status */}
              <div className="pt-4 border-t border-theme">
                <h3 className="font-mono font-bold text-sm uppercase text-[var(--text-muted)] mb-2">Current Status</h3>
                <div className="flex gap-2 flex-wrap">
                  <span className={`px-2 py-1 text-xs font-mono border ${shuffleEnabled ? 'bg-[var(--primary)] text-black border-[var(--primary)]' : 'bg-[var(--bg-hover)] border-theme'}`}>
                    Shuffle: {shuffleEnabled ? 'ON' : 'OFF'}
                  </span>
                  <span className={`px-2 py-1 text-xs font-mono border ${repeatMode !== 'off' ? 'bg-[var(--primary)] text-black border-[var(--primary)]' : 'bg-[var(--bg-hover)] border-theme'}`}>
                    Repeat: {repeatMode.toUpperCase()}
                  </span>
                  <span className={`px-2 py-1 text-xs font-mono border ${isMuted ? 'bg-red-500 text-white border-red-500' : 'bg-[var(--bg-hover)] border-theme'}`}>
                    {isMuted ? 'MUTED' : `Vol: ${Math.round(volume * 100)}%`}
                  </span>
                  {sleepTimerMinutes && (
                    <span className="px-2 py-1 text-xs font-mono border bg-purple-500 text-white border-purple-500">
                      Sleep: {Math.floor(sleepTimerRemaining / 60)}:{(sleepTimerRemaining % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentView !== AppView.FOCUS && (
          <Sidebar 
            currentView={currentView} 
            onChangeView={setCurrentView} 
            spotifyProfile={isAuthenticated ? spotifyProfile : null} 
            userProfile={isAuthenticated ? profile : null}
            isListeningForWakeWord={isWakeWordListening} 
          />
      )}
      
      <main className={`relative h-full overflow-hidden flex flex-col ${currentView === AppView.FOCUS ? 'w-full' : 'flex-1 ml-64'}`}>
        {/* User Menu Header */}
        {currentView !== AppView.FOCUS && (
          <div 
            className="flex justify-end items-center px-4 py-3 border-b-2 border-theme bg-[var(--bg-card)]"
            style={{ position: 'relative', zIndex: 1000 }}
          >
            <UserMenu onProfileClick={() => setCurrentView(AppView.PROFILE)} />
          </div>
        )}

        {errorMessage && (
           <div className="bg-red-500 text-white p-4 font-mono font-bold text-sm text-center flex justify-between items-center shadow-lg z-50 animate-in slide-in-from-top-2">
              <span className="flex-1">{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="ml-4 hover:underline font-bold bg-white text-red-500 px-2 py-1">DISMISS</button>
           </div>
        )}

        <div className="flex-1 overflow-y-auto scroll-smooth">
          <ErrorBoundary
            fallbackTitle="View Error"
            onReset={() => setCurrentView(AppView.DASHBOARD)}
          >
            <Suspense fallback={<LoadingSkeleton />}>
              {renderContent()}
            </Suspense>
          </ErrorBoundary>
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

        {/* Floating Playback Control Bar */}
        {currentSong && currentView !== AppView.FOCUS && (
          <div className="fixed bottom-0 left-64 right-0 bg-[var(--bg-card)] border-t-2 border-theme p-3 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
              
              {/* Song Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <img src={currentSong.coverUrl} alt="" className="w-12 h-12 border-2 border-theme object-cover" />
                <div className="min-w-0">
                  <p className="font-mono font-bold text-sm truncate">{currentSong.title}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{currentSong.artist}</p>
                </div>
                {/* Discover Similar Artists Button */}
                <button
                  onClick={() => {
                    setArtistGraphSeed(currentSong.artist);
                    setShowArtistGraph(true);
                  }}
                  className="p-2 hover:bg-[var(--bg-hover)] rounded transition-colors"
                  title="Discover Similar Artists"
                >
                  <ICONS.Music size={16} />
                </button>
              </div>


              {/* Center Controls */}
              <div className="flex items-center gap-2">
                {/* Shuffle */}
                <button 
                  onClick={() => setShuffleEnabled(prev => !prev)}
                  className={`p-2 rounded transition-colors ${shuffleEnabled ? 'bg-[var(--primary)] text-black' : 'hover:bg-[var(--bg-hover)]'}`}
                  title="Shuffle (S)"
                >
                  <ICONS.Shuffle size={16} />
                </button>

                {/* Prev */}
                <button onClick={handlePrev} className="p-2 hover:bg-[var(--bg-hover)] rounded transition-colors" title="Previous (←)">
                  <ICONS.SkipBack size={20} />
                </button>

                {/* Play/Pause */}
                <button 
                  onClick={() => hiddenAudioRef.current?.paused ? hiddenAudioRef.current?.play() : hiddenAudioRef.current?.pause()}
                  className="p-3 bg-[var(--primary)] text-black rounded-full hover:opacity-90 transition-opacity"
                  title="Play/Pause (Space)"
                >
                  {hiddenAudioRef.current?.paused ? <ICONS.Play size={24} fill="currentColor" /> : <ICONS.Pause size={24} fill="currentColor" />}
                </button>

                {/* Next */}
                <button onClick={handleNext} className="p-2 hover:bg-[var(--bg-hover)] rounded transition-colors" title="Next (→)">
                  <ICONS.SkipForward size={20} />
                </button>

                {/* Repeat */}
                <button 
                  onClick={() => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')}
                  className={`p-2 rounded transition-colors relative ${repeatMode !== 'off' ? 'bg-[var(--primary)] text-black' : 'hover:bg-[var(--bg-hover)]'}`}
                  title="Repeat (R)"
                >
                  {repeatMode === 'one' ? <ICONS.Repeat1 size={16} /> : <ICONS.Repeat size={16} />}
                </button>

                {/* Smart DJ Mode Toggle */}
                <button 
                  onClick={() => setSmartDJEnabled(prev => !prev)}
                  className={`p-2 rounded transition-colors relative flex items-center gap-1 ${smartDJEnabled ? 'bg-[var(--primary)] text-black' : 'hover:bg-[var(--bg-hover)]'}`}
                  title="Smart DJ Mode"
                >
                  {isSmartDJLoading ? (
                    <ICONS.Loader size={16} className="animate-spin" />
                  ) : (
                    <ICONS.Cpu size={16} />
                  )}
                  <span className="text-[10px] font-mono font-bold">DJ</span>
                </button>

                {/* Radio Station Toggle */}
                <button 
                  onClick={() => setShowRadio(prev => !prev)}
                  className={`p-2 rounded transition-colors relative flex items-center gap-1 ${showRadio ? 'bg-[var(--primary)] text-black' : 'hover:bg-[var(--bg-hover)]'}`}
                  title="Radio Stations"
                >
                  <ICONS.Radio size={16} />
                  <span className="text-[10px] font-mono font-bold">📻</span>
                </button>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-3 flex-1 justify-end">
                
                {/* Playback Speed */}
                <div className="relative group">
                  <button className="px-2 py-1 text-xs font-mono border border-theme hover:bg-[var(--bg-hover)] rounded" title="Playback Speed">
                    {playbackSpeed}x
                  </button>
                  <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-[var(--bg-card)] border-2 border-theme shadow-retro p-2 min-w-[80px]">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                      <button 
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`block w-full text-left px-2 py-1 text-xs font-mono hover:bg-[var(--bg-hover)] ${playbackSpeed === speed ? 'bg-[var(--primary)] text-black' : ''}`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsMuted(prev => !prev)} 
                    className="p-1 hover:bg-[var(--bg-hover)] rounded"
                    title="Mute (M)"
                  >
                    {isMuted || volume === 0 ? <ICONS.VolumeX size={18} /> : <ICONS.Volume2 size={18} />}
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={isMuted ? 0 : volume * 100}
                    onChange={(e) => { setVolume(parseInt(e.target.value) / 100); setIsMuted(false); }}
                    className="w-20 h-1 accent-[var(--primary)]"
                    title={`Volume: ${Math.round(volume * 100)}%`}
                  />
                </div>

                {/* Sleep Timer */}
                <div className="relative group">
                  <button 
                    className={`p-2 rounded transition-colors ${sleepTimerMinutes ? 'bg-purple-500 text-white' : 'hover:bg-[var(--bg-hover)]'}`}
                    title="Sleep Timer"
                  >
                    {sleepTimerMinutes ? <ICONS.Timer size={18} /> : <ICONS.TimerOff size={18} />}
                    {sleepTimerMinutes && (
                      <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[10px] px-1 rounded">
                        {Math.floor(sleepTimerRemaining / 60)}m
                      </span>
                    )}
                  </button>
                  <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-[var(--bg-card)] border-2 border-theme shadow-retro p-2 min-w-[100px]">
                    <p className="text-xs font-mono font-bold mb-2 text-[var(--text-muted)]">SLEEP TIMER</p>
                    {sleepTimerMinutes ? (
                      <button 
                        onClick={cancelSleepTimer}
                        className="block w-full text-left px-2 py-1 text-xs font-mono text-red-500 hover:bg-red-50"
                      >
                        Cancel ({Math.floor(sleepTimerRemaining / 60)}:{(sleepTimerRemaining % 60).toString().padStart(2, '0')})
                      </button>
                    ) : (
                      [15, 30, 45, 60, 90, 120].map(mins => (
                        <button 
                          key={mins}
                          onClick={() => startSleepTimer(mins)}
                          className="block w-full text-left px-2 py-1 text-xs font-mono hover:bg-[var(--bg-hover)]"
                        >
                          {mins} min
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Keyboard Shortcuts Help */}
                <button 
                  onClick={() => setShowKeyboardHelp(true)}
                  className="p-2 hover:bg-[var(--bg-hover)] rounded transition-colors"
                  title="Keyboard Shortcuts (?)"
                >
                  <ICONS.Keyboard size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Phase 4: Radio Station Panel */}
      {showRadio && (
        <RadioStation
          currentSong={currentSong}
          queue={queue}
          onPlaySong={playSong}
          onAddToQueue={(songs) => setQueue(prev => [...prev, ...songs])}
          onClose={() => setShowRadio(false)}
        />
      )}
      
      {/* Phase 4: Artist Discovery Graph */}
      {showArtistGraph && artistGraphSeed && (
        <ArtistGraph
          seedArtist={artistGraphSeed}
          onPlaySong={playSong}
          onClose={() => setShowArtistGraph(false)}
        />
      )}
      
      {/* PWA Install Prompt */}
      <InstallPrompt />


    </div>

  );
};

export default App;

// Wrapped App with providers
const WrappedApp: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export { WrappedApp };
