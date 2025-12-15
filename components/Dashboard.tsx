
import React, { useState, useEffect } from 'react';
import MoodChart from './MoodChart';
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

const PROVIDER_CONFIG: Record<MusicProvider, { label: string; icon: any }> = {
  'YOUTUBE': { label: 'YouTube', icon: ICONS.Play },
  'SPOTIFY': { label: 'Spotify', icon: ICONS.Music },
  'APPLE': { label: 'Apple Music', icon: ICONS.Radio },
  'DEEZER': { label: 'Deezer', icon: ICONS.Activity },
};

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
  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  
  const [insight, setInsight] = useState<DashboardInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

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

  useEffect(() => {
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

              {/* Minimal Search */}
              <div className="max-w-2xl mx-auto relative group z-20">
                 <div className="absolute -inset-1 bg-gradient-to-r from-[var(--primary)] to-purple-500 rounded-full blur opacity-10 group-hover:opacity-20 transition-opacity duration-500"></div>
                 <form onSubmit={handleSearch} className="relative bg-[var(--bg-card)] rounded-full shadow-sm hover:shadow-md transition-shadow flex items-center p-2 border border-[var(--border)]">
                    <div className="pl-4 text-[var(--text-muted)]">
                       <ICONS.Search size={20} />
                    </div>
                    <input 
                       className="flex-1 bg-transparent border-none focus:ring-0 text-lg px-4 font-sans text-[var(--text-main)] placeholder-gray-400 h-12"
                       placeholder={`Search ${PROVIDER_CONFIG[musicProvider].label}...`}
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
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
