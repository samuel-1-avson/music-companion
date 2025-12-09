import React, { useState, useEffect } from 'react';
import MoodChart from './MoodChart';
import VibeSnap from './VibeSnap';
import { ICONS, MOCK_SONGS } from '../constants';
import { Song, AppView, MoodData, DashboardInsight, MusicProvider } from '../types';
import { searchUnified } from '../services/musicService';
import { generateDashboardInsights } from '../services/geminiService';

interface DashboardProps {
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onChangeView: (view: AppView) => void;
  spotifyToken?: string | null;
  moodData: MoodData[];
  musicProvider?: MusicProvider;
  onSetMusicProvider: (provider: MusicProvider) => void;
}

const PROVIDER_CONFIG: Record<MusicProvider, { label: string; icon: any; color: string; bg: string }> = {
  'YOUTUBE': { label: 'YouTube', icon: ICONS.Play, color: 'text-red-600', bg: 'bg-red-50' },
  'SPOTIFY': { label: 'Spotify', icon: ICONS.Music, color: 'text-green-600', bg: 'bg-green-50' },
  'APPLE': { label: 'Apple Music', icon: ICONS.Radio, color: 'text-pink-600', bg: 'bg-pink-50' },
  'DEEZER': { label: 'Deezer', icon: ICONS.Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
};

const Dashboard: React.FC<DashboardProps> = ({ 
    onPlaySong, 
    onChangeView, 
    spotifyToken, 
    moodData,
    musicProvider = 'YOUTUBE', // Default fallback
    onSetMusicProvider
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  
  // Intelligence State
  const [insight, setInsight] = useState<DashboardInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Simulated User Stats
  const userLevel = Math.floor(moodData.length / 5) + 1;
  const xp = (moodData.length % 5) * 20;
  
  // Calculate Listener Title based on level
  const getLevelTitle = (lvl: number) => {
     if (lvl < 2) return "NOVICE_LISTENER";
     if (lvl < 5) return "AUDIO_EXPLORER";
     if (lvl < 10) return "SONIC_CURATOR";
     return "SONIC_ARCHITECT";
  };

  useEffect(() => {
    // Generate AI Insights periodically or on load if enough data
    if (moodData.length > 0 && !insight) {
        refreshInsights();
    }
  }, [moodData.length]);

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

    setIsSearching(true);
    setSearchPerformed(true);
    try {
      // Use unified search
      const results = await searchUnified(musicProvider, searchQuery, spotifyToken);
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
  };

  const renderSongCard = (song: Song, contextQueue: Song[]) => (
    <div 
      key={song.id} 
      className="bg-[var(--bg-card)] border-2 border-theme p-4 flex items-center space-x-4 hover:shadow-retro hover:-translate-y-1 transition-all duration-200 group cursor-pointer" 
      onClick={() => onPlaySong(song, contextQueue)}
    >
      <div className="relative w-16 h-16 border-2 border-black flex-shrink-0 bg-gray-100">
        {song.coverUrl && <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300" />}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
           {/* Overlay could go here */}
        </div>
      </div>
      <div className="flex-1 min-w-0">
          <h4 className="font-bold text-[var(--text-main)] truncate font-mono uppercase text-sm group-hover:text-[var(--primary-hover)] transition-colors">{song.title}</h4>
          <p className="text-xs text-[var(--text-muted)] truncate font-bold">
            {song.artist}{song.album && <span className="font-normal"> • {song.album}</span>}
          </p>
          <div className="flex items-center mt-2 space-x-2">
            <span className="text-xs text-[var(--text-main)] border border-theme px-1 font-mono">{song.duration}</span>
            {song.mood && (
              <span className="text-[10px] text-black bg-[var(--primary)] px-1 border border-black font-bold uppercase">
                  {song.mood}
              </span>
            )}
          </div>
      </div>
      <div className="flex flex-col space-y-2">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onPlaySong(song, contextQueue);
          }}
          title="Play Preview"
          className="w-10 h-10 border-2 border-black bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black flex items-center justify-center transition-all shadow-retro-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
        >
            <ICONS.Play size={18} fill="currentColor" className="ml-0.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-8 space-y-8 pb-32">
      {/* Search Bar Container */}
      <div className="relative w-full max-w-3xl mx-auto z-20">
          
          {/* Provider Selector Tabs */}
          <div className="flex justify-center mb-0 relative z-10">
             <div className="inline-flex bg-[var(--bg-card)] border-2 border-b-0 border-theme shadow-sm p-1 gap-1">
                {(Object.keys(PROVIDER_CONFIG) as MusicProvider[]).map((p) => {
                   const config = PROVIDER_CONFIG[p];
                   const isActive = musicProvider === p;
                   return (
                      <button
                        key={p}
                        onClick={() => onSetMusicProvider(p)}
                        className={`
                           flex items-center gap-2 px-3 py-2 text-xs font-bold font-mono uppercase transition-all border border-transparent
                           ${isActive 
                              ? `bg-black text-white shadow-sm` 
                              : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                           }
                        `}
                      >
                         <config.icon size={14} className={isActive ? 'text-[var(--primary)]' : ''} />
                         {config.label}
                      </button>
                   );
                })}
             </div>
          </div>

          {/* Main Search Input */}
          <form onSubmit={handleSearch} className="relative">
             <div className={`
                relative flex items-center bg-[var(--bg-card)] border-4 border-black p-1 transition-all
                ${isSearching ? 'shadow-none translate-y-[2px]' : 'shadow-retro-lg'}
             `}>
                <div className="pl-4 pr-2">
                   <ICONS.Search size={24} className="text-[var(--text-main)]" strokeWidth={3} />
                </div>
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`SEARCH ${PROVIDER_CONFIG[musicProvider].label.toUpperCase()} DATABASE...`}
                  className="w-full bg-transparent border-none py-4 px-2 text-[var(--text-main)] font-mono font-bold placeholder-gray-400 focus:ring-0 text-xl tracking-tight"
                />
                
                {searchQuery && (
                   <button 
                     type="button" 
                     onClick={clearSearch} 
                     className="p-2 mr-2 text-gray-400 hover:text-red-500 transition-colors"
                   >
                     <ICONS.Close size={24} />
                   </button>
                )}

                <button 
                   type="submit"
                   className="bg-black text-white px-8 py-3 font-bold font-mono text-sm uppercase hover:bg-[var(--primary)] hover:text-black transition-colors border-l-2 border-black"
                >
                   {isSearching ? 'SCANNING' : 'GO'}
                </button>
             </div>
          </form>
          
          {/* Helper Text */}
          <div className="mt-2 text-center">
             <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                Searching Global Network via {musicProvider}
             </p>
          </div>
      </div>

      {searchPerformed ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
           <div className="flex items-center justify-between border-b-2 border-theme pb-4">
              <h3 className="text-xl font-bold font-mono uppercase text-[var(--text-main)]">
                 Query Results: "{searchQuery}"
              </h3>
              <button onClick={clearSearch} className="text-sm font-bold text-[var(--text-main)] hover:underline decoration-2 underline-offset-4 decoration-[var(--primary)]">CLEAR_FILTER</button>
           </div>
           
           {isSearching ? (
             <div className="flex justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                    <ICONS.Loader className="animate-spin text-[var(--text-main)]" size={40} />
                    <span className="font-mono font-bold animate-pulse text-[var(--text-main)]">QUERYING_{musicProvider}...</span>
                </div>
             </div>
           ) : searchResults.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {searchResults.map(song => renderSongCard(song, searchResults))}
             </div>
           ) : (
             <div className="text-center py-12 border-2 border-dashed border-gray-400 bg-[var(--bg-hover)]">
                <p className="font-mono text-gray-500 font-bold">NO_MATCHES_FOUND</p>
             </div>
           )}
        </div>
      ) : (
        <>
          {/* Header Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {/* User Level Card */}
             <div className="bg-black text-white p-4 border-2 border-black shadow-retro-sm">
                <p className="text-[10px] font-mono text-gray-400 uppercase mb-1">Sonic Identity</p>
                <div className="flex justify-between items-end">
                   <h3 className="text-2xl font-bold font-mono">LVL.{userLevel}</h3>
                   <span className="text-xs font-bold text-[var(--primary)]">{getLevelTitle(userLevel)}</span>
                </div>
                {/* XP Bar */}
                <div className="w-full h-1.5 bg-gray-800 mt-2">
                   <div className="h-full bg-[var(--primary)] transition-all duration-500" style={{ width: `${xp}%` }}></div>
                </div>
             </div>

             {/* Streak Card */}
             <div className="bg-[var(--bg-card)] p-4 border-2 border-theme shadow-retro-sm flex flex-col justify-between">
                <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Focus Streak</p>
                <div className="flex items-center gap-2">
                   <ICONS.Zap className="text-[var(--primary)]" size={24} fill="currentColor" />
                   <h3 className="text-2xl font-bold font-mono text-[var(--text-main)]">{Math.min(moodData.length, 12)}h</h3>
                </div>
             </div>

             {/* Grade Card */}
             <div className="bg-[var(--bg-card)] p-4 border-2 border-theme shadow-retro-sm flex flex-col justify-between relative overflow-hidden">
                <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Rhythm Grade</p>
                <div className="flex items-end justify-between z-10 relative">
                   <h3 className="text-4xl font-bold font-mono leading-none text-[var(--text-main)]">{insight?.grade || '-'}</h3>
                   <span className="text-[10px] font-bold bg-[var(--bg-hover)] text-[var(--text-main)] px-1 border border-theme">daily</span>
                </div>
                <div className="absolute -right-4 -bottom-4 text-[var(--bg-hover)] rotate-12 z-0">
                    <ICONS.Award size={80} />
                </div>
             </div>

             {/* Settings Shortcut */}
             <button 
                onClick={() => onChangeView(AppView.SETTINGS)}
                className="bg-[var(--bg-hover)] hover:bg-[var(--bg-card)] p-4 border-2 border-theme shadow-retro-sm hover:shadow-retro transition-all group flex flex-col items-center justify-center gap-2"
             >
                <ICONS.Settings size={24} className="group-hover:rotate-90 transition-transform duration-500 text-[var(--text-main)]" />
                <span className="text-xs font-bold font-mono uppercase text-[var(--text-main)]">System Config</span>
             </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* AI Intelligence Unit */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Smart Routine Engine */}
                <div className="bg-[var(--bg-card)] border-2 border-theme p-6 shadow-retro relative">
                   <div className="absolute top-0 right-0 p-2 bg-black text-white text-[10px] font-mono font-bold uppercase">
                      Gemini Routine Engine
                   </div>
                   
                   <div className="mb-4 pr-12">
                      <h3 className="text-xl font-bold font-mono uppercase flex items-center gap-2 text-[var(--text-main)]">
                         <ICONS.Cpu size={20} />
                         Current State: <span className="text-[var(--primary-hover)] underline decoration-2">{insight?.title || "CALIBRATING..."}</span>
                      </h3>
                   </div>

                   {loadingInsight ? (
                       <div className="h-24 flex items-center gap-4 text-gray-400 font-mono text-xs animate-pulse">
                          <ICONS.Loader size={20} className="animate-spin" />
                          ANALYZING_BIOMETRICS_AND_HISTORY...
                       </div>
                   ) : (
                       <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-1">
                             <p className="font-mono text-sm leading-relaxed text-[var(--text-muted)] mb-4 border-l-4 border-[var(--bg-hover)] pl-4">
                                "{insight?.recommendation || "Listen to more music to generate personalized insights."}"
                             </p>
                             <div className="flex items-center gap-4 text-xs font-bold font-mono text-[var(--text-muted)]">
                                <span>SUGGESTED_GENRE: <span className="text-black bg-[var(--primary)] opacity-80 px-1 border border-black">{insight?.nextGenre}</span></span>
                             </div>
                          </div>
                          <div className="flex flex-col gap-2 min-w-[140px]">
                             <button 
                               onClick={() => onPlaySong(MOCK_SONGS[2])} // Mock action
                               className="bg-black text-white py-3 px-4 font-bold font-mono text-xs border-2 border-black hover:bg-white hover:text-black transition-colors shadow-[2px_2px_0_0_var(--primary)] uppercase"
                             >
                                {insight?.actionLabel || "OPTIMIZE"}
                             </button>
                             <button onClick={refreshInsights} className="text-[10px] font-bold text-gray-400 hover:text-[var(--text-main)] underline uppercase">
                                Refresh Analysis
                             </button>
                          </div>
                       </div>
                   )}
                </div>

                {/* Mood Chart */}
                <div className="bg-[var(--bg-card)] border-2 border-theme p-6 shadow-retro">
                  <div className="flex items-center justify-between mb-6">
                     <h3 className="text-lg font-bold flex items-center space-x-2 font-mono uppercase text-[var(--text-main)]">
                       <ICONS.Chart size={20} strokeWidth={2.5} />
                       <span>Biometric_Flow</span>
                     </h3>
                     <div className="flex gap-2">
                        {['Today', 'Week'].map(range => (
                            <button key={range} className="text-xs font-mono font-bold border border-theme text-[var(--text-main)] px-2 py-1 hover:bg-[var(--text-main)] hover:text-[var(--bg-main)] transition-colors uppercase">
                                {range}
                            </button>
                        ))}
                     </div>
                  </div>
                  {moodData.length > 1 ? (
                     <MoodChart data={moodData} />
                  ) : (
                     <div className="h-48 flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300">
                        <p className="font-mono text-gray-400 text-sm">INSUFFICIENT_DATA</p>
                     </div>
                  )}
                </div>
            </div>

            {/* Quick Actions / Context */}
            <div className="space-y-6">
               <VibeSnap onPlaylistGenerated={(songs) => onPlaySong(songs[0], songs)} spotifyToken={spotifyToken} musicProvider={musicProvider} />

               {/* Focus Mode Promo */}
               <div 
                 onClick={() => onChangeView(AppView.FOCUS)}
                 className="bg-[var(--bg-hover)] border-2 border-theme p-6 cursor-pointer hover:bg-black hover:text-white transition-colors group relative overflow-hidden"
               > 
                  <ICONS.Code className="absolute -right-4 -bottom-4 text-[var(--bg-card)] group-hover:text-gray-800 transition-colors" size={100} />
                  <h3 className="text-lg font-bold font-mono uppercase mb-1 relative z-10 text-[var(--text-main)] group-hover:text-white">Deep Work Mode</h3>
                  <p className="text-xs font-mono opacity-70 relative z-10 text-[var(--text-muted)] group-hover:text-gray-300">Eliminate distractions. Timer + Ambient Audio.</p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-bold font-mono relative z-10 text-[var(--primary)]">
                     <span>ENTER_SESSION</span>
                     <ICONS.ArrowRight size={14} />
                  </div>
               </div>

               {/* Recent/Recommended Mini List */}
               <div className="bg-[var(--bg-card)] border-2 border-theme p-4">
                  <h3 className="text-xs font-bold font-mono uppercase mb-4 border-b-2 border-theme pb-2 text-[var(--text-main)]">Quick Picks</h3>
                  <div className="space-y-3">
                     {MOCK_SONGS.slice(0, 3).map((song, i) => (
                        <div key={i} className="flex items-center gap-3 group cursor-pointer" onClick={() => onPlaySong(song)}>
                           <div className="w-8 h-8 bg-gray-200 border border-black relative">
                              <img src={song.coverUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0" alt="cover" />
                           </div>
                           <div className="min-w-0">
                              <div className="text-xs font-bold truncate text-[var(--text-main)] group-hover:text-[var(--primary)] transition-colors">{song.title}</div>
                              <div className="text-[10px] text-[var(--text-muted)] font-mono truncate">{song.artist}</div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;