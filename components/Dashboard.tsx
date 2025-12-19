
import React, { useState, useEffect, useRef } from 'react';
import MoodChart from './MoodChart';
import { ICONS, MOCK_SONGS } from '../constants';
import { Song, AppView, MoodData, DashboardInsight, MusicProvider } from '../types';
import { searchUnified } from '../services/musicService';
import { generateDashboardInsights } from '../services/geminiService';
import { getCurrentLocationWeather, WeatherData, getMoodPrompt } from '../services/weatherService';
import { getListeningStreakDB, StreakData, getDailyChallengesDB, Challenge, getUserXPDB } from '../utils/db';

interface DashboardProps {
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onChangeView: (view: AppView) => void;
  spotifyToken?: string | null;
  moodData: MoodData[];
  musicProvider?: MusicProvider;
  onSetMusicProvider: (provider: MusicProvider) => void;
}

const PROVIDER_CONFIG: Record<MusicProvider, { label: string; icon: any }> = {
  'YOUTUBE': { label: 'YouTube', icon: ICONS.Play },
  'SPOTIFY': { label: 'Spotify', icon: ICONS.Music },
  'APPLE': { label: 'Apple Music', icon: ICONS.Radio },
  'DEEZER': { label: 'Deezer', icon: ICONS.Activity },
  'LASTFM': { label: 'Last.fm', icon: ICONS.Radio },
  'SOUNDCLOUD': { label: 'SoundCloud', icon: ICONS.Waves },
};


// App navigation shortcuts for quick access
const APP_SHORTCUTS = [
  { id: 'chat', label: 'Chat Assistant', view: AppView.CHAT, icon: 'MessageSquare', keywords: ['chat', 'assistant', 'ai', 'help', 'ask'] },
  { id: 'live', label: 'Live Mode', view: AppView.LIVE, icon: 'Radio', keywords: ['live', 'radio', 'stream', 'broadcast'] },
  { id: 'profile', label: 'My Profile', view: AppView.PROFILE, icon: 'User', keywords: ['profile', 'account', 'me', 'user', 'stats'] },
  { id: 'offline', label: 'Offline Hub', view: AppView.OFFLINE, icon: 'DownloadCloud', keywords: ['offline', 'download', 'saved', 'local', 'library'] },
  { id: 'arcade', label: 'Retro Arcade', view: AppView.ARCADE, icon: 'Gamepad2', keywords: ['arcade', 'games', 'retro', 'play', 'fun'] },
  { id: 'lab', label: 'Sonic Lab', view: AppView.LAB, icon: 'Sliders', keywords: ['lab', 'sonic', 'experimental', 'tools', 'audio'] },
  { id: 'extensions', label: 'Integrations', view: AppView.EXTENSIONS, icon: 'Puzzle', keywords: ['extensions', 'integrations', 'plugins', 'connect', 'api'] },
  { id: 'settings', label: 'Settings', view: AppView.SETTINGS, icon: 'Settings', keywords: ['settings', 'preferences', 'config', 'options'] },
  { id: 'focus', label: 'Focus Mode', view: AppView.FOCUS, icon: 'Zap', keywords: ['focus', 'concentration', 'work', 'pomodoro', 'timer'] },
];

type SearchMode = 'all' | 'music' | 'app';

interface SearchResult {
  type: 'song' | 'app' | 'action';
  item: Song | typeof APP_SHORTCUTS[0] | { label: string; action: () => void };
}

const Dashboard: React.FC<DashboardProps> = ({ 
    onPlaySong, 
    onChangeView, 
    spotifyToken, 
    moodData,
    musicProvider = 'YOUTUBE', 
    onSetMusicProvider
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [appResults, setAppResults] = useState<typeof APP_SHORTCUTS>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('all');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  const [insight, setInsight] = useState<DashboardInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Phase 2: Weather, Streaks, Challenges
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userXP, setUserXP] = useState(0);

  // Time of day greeting
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Calculate Level Title (Subtle)
  const userLevel = Math.floor(moodData.length / 5) + 1;
  const getLevelTitle = (lvl: number) => {
     if (lvl < 2) return "Novice";
     if (lvl < 5) return "Explorer";
     if (lvl < 10) return "Curator";
     return "Architect";
  };

  // Fetch Phase 2 data on mount
  useEffect(() => {
    const fetchPhase2Data = async () => {
      try {
        const [streakData, challengeData, xp, weatherData] = await Promise.all([
          getListeningStreakDB(),
          getDailyChallengesDB(),
          getUserXPDB(),
          getCurrentLocationWeather()
        ]);
        setStreak(streakData);
        setChallenges(challengeData);
        setUserXP(xp);
        setWeather(weatherData);
      } catch (e) {
        console.error('Failed to fetch Phase 2 data:', e);
      }
    };
    fetchPhase2Data();
  }, []);


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (moodData.length > 0 && !insight) {
        refreshInsights();
    }
  }, [moodData.length]);

  // Live search for app shortcuts as user types
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matched = APP_SHORTCUTS.filter(shortcut => 
        shortcut.label.toLowerCase().includes(query) ||
        shortcut.keywords.some(kw => kw.includes(query))
      );
      setAppResults(matched);
      setShowDropdown(true);
    } else {
      setAppResults([]);
      setShowDropdown(false);
    }
  }, [searchQuery]);

  const refreshInsights = async () => {
     setLoadingInsight(true);
     try {
         const data = await generateDashboardInsights(moodData);
         setInsight(data);
     } catch (e) {
         console.error(e);
     } finally {
         setLoadingInsight(false);
     }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchPerformed(false);
      setSearchResults([]);
      return;
    }

    setShowDropdown(false);
    setIsSearching(true);
    setSearchPerformed(true);
    try {
      const results = await searchUnified(musicProvider as MusicProvider, searchQuery, spotifyToken);
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchPerformed(false);
    setShowDropdown(false);
    setAppResults([]);
  };

  const handleAppShortcut = (shortcut: typeof APP_SHORTCUTS[0]) => {
    setShowDropdown(false);
    setSearchQuery('');
    onChangeView(shortcut.view);
  };

  const getIconComponent = (iconName: string) => {
    return (ICONS as any)[iconName] || ICONS.Music;
  };

  const renderSongRow = (song: Song, contextQueue: Song[]) => (
    <div 
      key={song.id} 
      onClick={() => onPlaySong(song, contextQueue)}
      className="group flex items-center justify-between p-4 hover:bg-[var(--bg-hover)] rounded-2xl transition-all cursor-pointer border border-transparent hover:border-[var(--border)]"
    >
      <div className="flex items-center gap-4 overflow-hidden">
        <div className="relative w-12 h-12 rounded-lg overflow-hidden shadow-sm group-hover:shadow-md transition-shadow">
           <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
           <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
              <ICONS.Play size={16} fill="currentColor" />
           </div>
        </div>
        <div className="min-w-0">
           <h4 className="font-medium text-[var(--text-main)] truncate text-base">{song.title}</h4>
           <p className="text-xs text-[var(--text-muted)] truncate">{song.artist}</p>
        </div>
      </div>
      <div className="text-xs font-mono text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors">
         {song.duration}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 md:p-12 scroll-smooth">
        <div className="max-w-5xl mx-auto space-y-12">
           
           {/* --- HERO SECTION --- */}
           <section className="space-y-8 pt-4 md:pt-10 text-center">
              <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--bg-card)]/50 backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                          System Online • {getLevelTitle(userLevel)}
                      </span>
                  </div>
                  <h1 className="text-4xl md:text-6xl font-light tracking-tight text-[var(--text-main)]">
                     {timeGreeting}.
                  </h1>
              </div>

              {/* Enhanced Unified Search */}
              <div ref={searchRef} className="max-w-2xl mx-auto relative z-20">
                 <div className="absolute -inset-1 bg-gradient-to-r from-[var(--primary)] to-purple-500 rounded-full blur opacity-10 group-hover:opacity-20 transition-opacity duration-500"></div>
                 <form onSubmit={handleSearch} className="relative bg-[var(--bg-card)] rounded-full shadow-sm hover:shadow-md transition-shadow flex items-center p-2 border border-[var(--border)]">
                    <div className="pl-4 text-[var(--text-muted)]">
                       <ICONS.Search size={20} />
                    </div>
                    <input 
                       className="flex-1 bg-transparent border-none focus:ring-0 text-lg px-4 font-sans text-[var(--text-main)] placeholder-gray-400 h-12"
                       placeholder="Search music, features, or type a command..."
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       onFocus={() => searchQuery && setShowDropdown(true)}
                    />
                    {searchQuery && (
                        <button type="button" onClick={clearSearch} className="p-2 text-gray-400 hover:text-red-500">
                            <ICONS.Close size={18} />
                        </button>
                    )}
                    <button type="submit" className="bg-[var(--text-main)] text-[var(--bg-main)] rounded-full w-10 h-10 flex items-center justify-center hover:scale-105 transition-transform">
                       {isSearching ? <ICONS.Loader className="animate-spin" size={18} /> : <ICONS.ArrowRight size={18} />}
                    </button>
                 </form>

                 {/* Search Dropdown with App Shortcuts */}
                 {showDropdown && (appResults.length > 0 || searchQuery.length > 0) && (
                   <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                     
                     {/* App Navigation Results */}
                     {appResults.length > 0 && (
                       <div className="p-2">
                         <div className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                           Quick Navigation
                         </div>
                         {appResults.map(shortcut => {
                           const IconComp = getIconComponent(shortcut.icon);
                           return (
                             <button
                               key={shortcut.id}
                               onClick={() => handleAppShortcut(shortcut)}
                               className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--bg-hover)] transition-all text-left group"
                             >
                               <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                                 <IconComp size={18} />
                               </div>
                               <div>
                                 <div className="font-medium text-[var(--text-main)]">{shortcut.label}</div>
                                 <div className="text-xs text-[var(--text-muted)]">Navigate to {shortcut.label}</div>
                               </div>
                               <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                 <ICONS.ArrowRight size={16} className="text-[var(--text-muted)]" />
                               </div>
                             </button>
                           );
                         })}
                       </div>
                     )}

                     {/* Divider */}
                     {appResults.length > 0 && searchQuery.length > 1 && (
                       <div className="border-t border-[var(--border)]"></div>
                     )}

                     {/* Music Search Hint */}
                     {searchQuery.length > 1 && (
                       <div className="p-2">
                         <button
                           type="submit"
                           onClick={handleSearch}
                           className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--bg-hover)] transition-all text-left group"
                         >
                           <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500 group-hover:bg-green-500 group-hover:text-white transition-colors">
                             <ICONS.Music size={18} />
                           </div>
                           <div>
                             <div className="font-medium text-[var(--text-main)]">Search "{searchQuery}" in {PROVIDER_CONFIG[musicProvider].label}</div>
                             <div className="text-xs text-[var(--text-muted)]">Press Enter to search music</div>
                           </div>
                           <div className="ml-auto">
                             <kbd className="px-2 py-1 bg-[var(--bg-hover)] rounded text-xs font-mono text-[var(--text-muted)]">↵</kbd>
                           </div>
                         </button>
                       </div>
                     )}
                   </div>
                 )}
              </div>

              {/* Provider Toggles */}
              <div className="flex justify-center gap-2">
                 {(Object.keys(PROVIDER_CONFIG) as MusicProvider[]).map((p) => (
                    <button
                        key={p}
                        onClick={() => onSetMusicProvider(p)}
                        className={`
                           px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border
                           ${musicProvider === p 
                              ? 'bg-[var(--text-main)] text-[var(--bg-main)] border-[var(--text-main)]' 
                              : 'bg-transparent text-[var(--text-muted)] border-transparent hover:bg-[var(--bg-hover)]'
                           }
                        `}
                    >
                        {PROVIDER_CONFIG[p].label}
                    </button>
                 ))}
              </div>
           </section>

           {/* --- CONTENT AREA --- */}
           {searchPerformed ? (
               <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
                   <div className="flex items-center justify-between px-2">
                       <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">Results</h3>
                       <span className="text-xs text-[var(--text-muted)] font-mono">{searchResults.length} items</span>
                   </div>
                   
                   {searchResults.length > 0 ? (
                       <div className="bg-[var(--bg-card)]/60 backdrop-blur-xl border border-[var(--border)] rounded-3xl overflow-hidden shadow-sm">
                           <div className="divide-y divide-[var(--border)]">
                               {searchResults.map(s => renderSongRow(s, searchResults))}
                           </div>
                       </div>
                   ) : (
                       <div className="text-center py-20 opacity-50">
                           <p className="font-mono text-sm">No results found.</p>
                       </div>
                   )}
               </div>
           ) : (
               <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                   
                   {/* Insight Section */}
                   <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                       <div className="lg:col-span-3 bg-[var(--bg-card)]/60 backdrop-blur-xl border border-[var(--border)] rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                               <ICONS.MessageSquare size={80} />
                           </div>
                           
                           <div className="relative z-10">
                               <span className="text-xs font-bold font-mono text-[var(--primary)] uppercase tracking-widest mb-3 block">
                                   {insight?.title || "ANALYZING_PATTERNS..."}
                               </span>
                               <h2 className="text-2xl md:text-3xl font-serif italic leading-relaxed text-[var(--text-main)] mb-6">
                                  "{insight?.recommendation || "Loading your personalized insights..."}"
                               </h2>
                               
                               <div className="flex items-center gap-4">
                                   <button 
                                     onClick={() => onPlaySong(MOCK_SONGS[0])}
                                     className="px-6 py-2.5 bg-[var(--text-main)] text-[var(--bg-main)] rounded-full text-xs font-bold uppercase tracking-wide hover:opacity-80 transition-opacity"
                                   >
                                       {insight?.actionLabel || "Play Flow"}
                                   </button>
                                   <button onClick={refreshInsights} disabled={loadingInsight} className="p-2 rounded-full hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]">
                                       <ICONS.Loader className={loadingInsight ? 'animate-spin' : ''} size={16} />
                                   </button>
                               </div>
                           </div>
                       </div>

                       <div className="lg:col-span-2 bg-[var(--bg-card)]/40 backdrop-blur-md border border-[var(--border)] rounded-3xl p-6 flex flex-col justify-between">
                           <div className="flex justify-between items-center mb-4">
                               <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Energy Flow</span>
                               <span className="text-xs font-mono font-bold">{insight?.grade || 'A'}</span>
                           </div>
                           <div className="flex-1 min-h-[120px]">
                               {moodData.length > 1 ? (
                                   <MoodChart data={moodData} />
                               ) : (
                                   <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs font-mono">
                                       Gathering Data...
                                   </div>
                               )}
                           </div>
                       </div>
                   </section>

                   {/* --- PHASE 2 WIDGETS: Weather, Streak, Challenges --- */}
                   <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {/* Weather Mood Widget */}
                     <div className="bg-[var(--bg-card)]/60 backdrop-blur-xl border border-[var(--border)] rounded-2xl p-5 hover:shadow-md transition-all">
                       <div className="flex items-center justify-between mb-3">
                         <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Weather Mood</span>
                         {weather && <span className="text-2xl">{weather.moodEmoji}</span>}
                       </div>
                       {weather ? (
                         <div className="space-y-3">
                           <div className="flex items-baseline gap-2">
                             <span className="text-3xl font-light">{weather.temperature}°</span>
                             <span className="text-sm text-[var(--text-muted)]">{weather.weatherDescription}</span>
                           </div>
                           <p className="text-xs text-[var(--text-muted)]">
                             Perfect for <span className="text-[var(--primary)] font-medium">{weather.mood.replace('_', ' ')}</span>
                           </p>
                           <button className="w-full mt-2 px-4 py-2 bg-[var(--bg-hover)] hover:bg-[var(--primary)] hover:text-black rounded-xl text-xs font-bold uppercase tracking-wide transition-all">
                             Play Weather Mix
                           </button>
                         </div>
                       ) : (
                         <div className="text-center py-4 text-[var(--text-muted)] text-xs">
                           <ICONS.Globe size={24} className="mx-auto mb-2 opacity-50" />
                           <p>Enable location for weather music</p>
                         </div>
                       )}
                     </div>

                     {/* Listening Streak Widget */}
                     <div className="bg-[var(--bg-card)]/60 backdrop-blur-xl border border-[var(--border)] rounded-2xl p-5 hover:shadow-md transition-all">
                       <div className="flex items-center justify-between mb-3">
                         <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Streak</span>
                         <span className="text-2xl">{streak && streak.currentStreak > 0 ? '🔥' : '💤'}</span>
                       </div>
                       <div className="space-y-3">
                         <div className="flex items-baseline gap-2">
                           <span className="text-4xl font-bold">{streak?.currentStreak || 0}</span>
                           <span className="text-sm text-[var(--text-muted)]">days</span>
                         </div>
                         <div className="flex gap-4 text-xs text-[var(--text-muted)]">
                           <span>Best: <strong className="text-[var(--text-main)]">{streak?.longestStreak || 0}</strong></span>
                           <span>Total: <strong className="text-[var(--text-main)]">{Math.floor((streak?.totalListeningMinutes || 0) / 60)}h</strong></span>
                         </div>
                         {streak && !streak.listenedToday && streak.currentStreak > 0 && (
                           <div className="px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-600 text-xs">
                             🎵 Play a song to keep your streak!
                           </div>
                         )}
                       </div>
                     </div>

                     {/* Daily Challenges Widget */}
                     <div className="bg-[var(--bg-card)]/60 backdrop-blur-xl border border-[var(--border)] rounded-2xl p-5 hover:shadow-md transition-all">
                       <div className="flex items-center justify-between mb-3">
                         <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Challenges</span>
                         <span className="px-2 py-0.5 bg-purple-500/20 text-purple-500 text-[10px] font-bold rounded-full">{userXP} XP</span>
                       </div>
                       <div className="space-y-3">
                         {challenges.slice(0, 2).map(challenge => (
                           <div key={challenge.id} className="space-y-1.5">
                             <div className="flex items-center justify-between">
                               <span className="text-xs font-medium truncate flex-1">{challenge.title}</span>
                               {challenge.completed ? (
                                 <ICONS.CheckCircle size={14} className="text-green-500" />
                               ) : (
                                 <span className="text-[10px] text-[var(--text-muted)]">{challenge.progress}/{challenge.goal}</span>
                               )}
                             </div>
                             <div className="h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                               <div 
                                 className={`h-full rounded-full transition-all ${challenge.completed ? 'bg-green-500' : 'bg-[var(--primary)]'}`}
                                 style={{ width: `${Math.min(100, (challenge.progress / challenge.goal) * 100)}%` }}
                               />
                             </div>
                           </div>
                         ))}
                         {challenges.length === 0 && (
                           <p className="text-xs text-[var(--text-muted)] text-center py-2">Loading challenges...</p>
                         )}
                       </div>
                     </div>
                   </section>

                   {/* Quick Picks */}
                   <section>

                       <div className="flex items-center justify-between mb-6 px-2">
                           <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">Suggested</h3>
                       </div>
                       
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           {MOCK_SONGS.slice(0, 4).map((song, i) => (
                               <div 
                                 key={song.id} 
                                 onClick={() => onPlaySong(song)}
                                 className="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-500"
                               >
                                   <img src={song.coverUrl} alt="cover" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                   <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                                   
                                   <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                       <h4 className="text-white font-bold text-sm truncate">{song.title}</h4>
                                       <p className="text-white/70 text-xs truncate">{song.artist}</p>
                                   </div>
                                   
                                   <div className="absolute top-3 right-3 w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-[-10px] group-hover:translate-y-0 text-white">
                                       <ICONS.Play size={12} fill="currentColor" />
                                   </div>
                               </div>
                           ))}
                       </div>
                   </section>

                   {/* Tools Grid */}
                   <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
                       <button 
                         onClick={() => onChangeView(AppView.FOCUS)}
                         className="p-6 rounded-3xl bg-[var(--bg-card)]/40 border border-[var(--border)] hover:bg-[var(--text-main)] hover:text-[var(--bg-main)] transition-all group text-left"
                       >
                           <ICONS.Zap size={24} className="mb-4 text-[var(--primary)] group-hover:text-[var(--bg-main)]" />
                           <h4 className="font-bold text-sm">Focus Mode</h4>
                           <p className="text-xs opacity-60 mt-1">Deep work timer & ambience.</p>
                       </button>
                       <button 
                         onClick={() => onChangeView(AppView.LAB)}
                         className="p-6 rounded-3xl bg-[var(--bg-card)]/40 border border-[var(--border)] hover:bg-[var(--text-main)] hover:text-[var(--bg-main)] transition-all group text-left"
                       >
                           <ICONS.Sliders size={24} className="mb-4 text-[var(--primary)] group-hover:text-[var(--bg-main)]" />
                           <h4 className="font-bold text-sm">Sonic Lab</h4>
                           <p className="text-xs opacity-60 mt-1">Experimental audio tools.</p>
                       </button>
                       <button 
                         onClick={() => onChangeView(AppView.OFFLINE)}
                         className="p-6 rounded-3xl bg-[var(--bg-card)]/40 border border-[var(--border)] hover:bg-[var(--text-main)] hover:text-[var(--bg-main)] transition-all group text-left col-span-2 md:col-span-1"
                       >
                           <ICONS.DownloadCloud size={24} className="mb-4 text-[var(--primary)] group-hover:text-[var(--bg-main)]" />
                           <h4 className="font-bold text-sm">Offline Hub</h4>
                           <p className="text-xs opacity-60 mt-1">Your local collection.</p>
                       </button>
                   </section>

               </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
