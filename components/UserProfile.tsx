
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';
import { HistoryItem, getHistoryDB, saveSettingDB, getSettingDB, getListeningStatsDB, ListeningStats, getListeningStreakDB, StreakData } from '../utils/db';

import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

interface UserProfileProps {
  userName: string;
  favorites: Song[];
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onToggleFavorite: (song: Song) => void;
  onUpdateProfile?: (name: string, avatar?: string) => void;
}

const COLORS = ['#fb923c', '#818cf8', '#34d399', '#f472b6', '#60a5fa'];

const UserProfile: React.FC<UserProfileProps> = ({ 
  userName, 
  favorites, 
  onPlaySong, 
  onToggleFavorite,
  onUpdateProfile 
}) => {
  const [activeTab, setActiveTab] = useState<'DNA' | 'FAVORITES' | 'HISTORY' | 'STATS'>('DNA');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(userName);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 2: Detailed Stats
  const [detailedStats, setDetailedStats] = useState<ListeningStats | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);


  useEffect(() => {
    const loadData = async () => {
        const h = await getHistoryDB();
        setHistory(h);
        
        const savedAvatar = await getSettingDB('user_avatar');
        if (savedAvatar) setAvatar(savedAvatar);

        // Phase 2: Load detailed stats with error handling
        try {
          const stats = await getListeningStatsDB();
          setDetailedStats(stats);
          
          const streakData = await getListeningStreakDB();
          setStreak(streakData);
        } catch (err) {
          console.error('Failed to load Phase 2 stats:', err);
        }
    };
    loadData();
  }, []);



  // --- STATS ENGINE ---

  const stats = useMemo(() => {
      const totalTracks = history.length;
      const uniqueArtists = new Set(history.map(h => h.song.artist)).size;
      
      // Calculate Top Genre / Mood
      const moodCounts: Record<string, number> = {};
      history.forEach(h => {
          const m = h.song.mood || 'Unknown';
          moodCounts[m] = (moodCounts[m] || 0) + 1;
      });
      const topMood = Object.entries(moodCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'Eclectic';

      // Calculate Listening Time (Mock: avg 3 mins per song)
      const totalMinutes = totalTracks * 3.5;
      const hours = Math.floor(totalMinutes / 60);

      // Archetype Logic
      let archetype = "The Explorer";
      if (totalTracks > 50 && uniqueArtists < 10) archetype = "The Loyalist";
      if (topMood.includes('Focus') || topMood.includes('Study')) archetype = "The Deep Worker";
      if (topMood.includes('Energy') || topMood.includes('Workout')) archetype = "The Dynamo";
      if (history.filter(h => {
          const hr = new Date(h.playedAt).getHours();
          return hr >= 22 || hr < 4;
      }).length > totalTracks * 0.4) archetype = "The Night Owl";

      return { totalTracks, uniqueArtists, topMood, hours, archetype };
  }, [history]);

  const activityData = useMemo(() => {
      const hours: number[] = Array.from({ length: 24 }, () => 0);

      history.forEach(h => {
          const hour = new Date(h.playedAt).getHours();
          hours[hour]++;
      });
      return hours.map((count, i) => ({ hour: i, count }));
  }, [history]);

  const dnaData = useMemo(() => {
      // Mock DNA based on mood keywords in history
      let energy = 50, focus = 50, chill = 50, vocals = 50, obscure = 50;
      
      history.forEach(h => {
          const m = (h.song.mood || '').toLowerCase();
          if (m.includes('energy') || m.includes('workout') || m.includes('happy')) energy += 5;
          if (m.includes('focus') || m.includes('study') || m.includes('deep')) focus += 5;
          if (m.includes('chill') || m.includes('relax') || m.includes('lo-fi')) chill += 5;
          if (m.includes('pop') || m.includes('rap')) vocals += 5;
          if (m.includes('instrumental')) vocals -= 5;
      });

      // Normalize roughly to 100 max
      const normalize = (v: number) => Math.min(100, Math.max(20, v));

      return [
          { subject: 'Energy', A: normalize(energy), fullMark: 100 },
          { subject: 'Focus', A: normalize(focus), fullMark: 100 },
          { subject: 'Chill', A: normalize(chill), fullMark: 100 },
          { subject: 'Vocals', A: normalize(vocals), fullMark: 100 },
          { subject: 'Depth', A: normalize(obscure + (stats.uniqueArtists * 2)), fullMark: 100 },
      ];
  }, [history, stats.uniqueArtists]);

  // --- HANDLERS ---

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const res = reader.result as string;
              setAvatar(res);
              saveSettingDB('user_avatar', res);
              if (onUpdateProfile) onUpdateProfile(userName, res);
          };
          reader.readAsDataURL(file);
      }
  };

  const saveProfile = () => {
      if (editName.trim() && onUpdateProfile) {
          onUpdateProfile(editName, avatar || undefined);
          setIsEditing(false);
      }
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-main)]">
        <div className="max-w-6xl mx-auto p-6 md:p-12 space-y-12">
            
            {/* HERO HEADER */}
            <div className="relative rounded-3xl overflow-hidden border border-[var(--border)] bg-[var(--bg-card)] shadow-sm group">
                {/* Dynamic Background Pattern */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[var(--primary)] via-purple-500 to-transparent"></div>
                
                <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-center md:items-end gap-8">
                    {/* Avatar */}
                    <div className="relative group/avatar">
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[var(--bg-main)] shadow-xl overflow-hidden bg-gray-200">
                            {avatar ? (
                                <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-black text-white">
                                    <span className="text-4xl font-bold font-mono">{userName.charAt(0).toUpperCase()}</span>
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity text-white font-bold text-xs uppercase tracking-widest cursor-pointer"
                        >
                            Change
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-center md:text-left space-y-2">
                        <div className="flex items-center justify-center md:justify-start gap-3">
                            <span className="px-3 py-1 rounded-full bg-[var(--primary)] text-[var(--bg-main)] text-[10px] font-bold uppercase tracking-widest">
                                {stats.archetype}
                            </span>
                            <span className="px-3 py-1 rounded-full border border-[var(--border)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                Level {Math.floor(stats.totalTracks / 20) + 1}
                            </span>
                        </div>
                        
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input 
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="text-3xl md:text-5xl font-black tracking-tight bg-transparent border-b-2 border-[var(--primary)] focus:outline-none w-full md:w-auto"
                                    autoFocus
                                />
                                <button onClick={saveProfile} className="p-2 bg-green-500 text-white rounded-full"><ICONS.Check size={20} /></button>
                            </div>
                        ) : (
                            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[var(--text-main)] flex items-center justify-center md:justify-start gap-4 group/name">
                                {userName}
                                <button onClick={() => setIsEditing(true)} className="opacity-0 group-hover/name:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-[var(--primary)]">
                                    <ICONS.Box size={20} /> {/* Edit Icon placeholder */}
                                </button>
                            </h1>
                        )}
                        <p className="text-[var(--text-muted)] font-mono text-sm max-w-lg mx-auto md:mx-0">
                            Sonic Explorer • Joined 2024 • {stats.hours} Hours Streamed
                        </p>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-3 gap-6 text-center md:text-right border-t md:border-t-0 md:border-l border-[var(--border)] pt-6 md:pt-0 md:pl-8 w-full md:w-auto">
                        <div>
                            <div className="text-2xl font-bold font-mono">{stats.totalTracks}</div>
                            <div className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider">Plays</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold font-mono">{favorites.length}</div>
                            <div className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider">Saved</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold font-mono">{stats.uniqueArtists}</div>
                            <div className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider">Artists</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* NAVIGATION TABS */}
            <div className="flex justify-center md:justify-start border-b border-[var(--border)]">
                {['DNA', 'STATS', 'FAVORITES', 'HISTORY'].map(tab => (

                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`
                            px-8 py-4 text-xs font-bold uppercase tracking-widest transition-all relative
                            ${activeTab === tab ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}
                        `}
                    >
                        {tab}
                        {activeTab === tab && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)]"></span>
                        )}
                    </button>
                ))}
            </div>

            {/* CONTENT AREA */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {activeTab === 'DNA' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Radar Chart */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-6 flex flex-col items-center justify-center min-h-[400px]">
                            <h3 className="text-sm font-bold uppercase tracking-widest mb-8 text-[var(--text-muted)] flex items-center gap-2">
                                <ICONS.Activity size={16} /> Sonic Fingerprint
                            </h3>
                            <div className="w-full h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={dnaData}>
                                        <PolarGrid stroke="var(--border)" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 'bold' }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Radar
                                            name="User"
                                            dataKey="A"
                                            stroke="var(--primary)"
                                            strokeWidth={3}
                                            fill="var(--primary)"
                                            fillOpacity={0.3}
                                        />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                                            itemStyle={{ color: 'var(--text-main)', fontFamily: 'monospace' }}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Activity Bar Chart */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-6 flex flex-col justify-center min-h-[400px]">
                            <h3 className="text-sm font-bold uppercase tracking-widest mb-8 text-[var(--text-muted)] flex items-center gap-2">
                                <ICONS.Chart size={16} /> Rhythm Cycles
                            </h3>
                            <div className="w-full h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={activityData}>
                                        <XAxis 
                                            dataKey="hour" 
                                            tickFormatter={(val) => `${val}:00`} 
                                            tick={{ fontSize: 10, fill: 'var(--text-muted)' }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <Tooltip 
                                            cursor={{fill: 'var(--bg-hover)'}}
                                            contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                            labelStyle={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                                        />
                                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                            {activityData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.count > 5 ? 'var(--primary)' : 'var(--text-muted)'} opacity={entry.count > 0 ? 1 : 0.2} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-center text-xs text-[var(--text-muted)] font-mono mt-4">
                                Peak activity detected around {[...activityData].sort((a,b) => b.count - a.count)[0]?.hour}:00.

                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'FAVORITES' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {favorites.length === 0 ? (
                            <div className="col-span-full py-20 text-center text-[var(--text-muted)]">
                                <ICONS.Heart size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="font-mono text-sm uppercase">No Favorites Yet</p>
                            </div>
                        ) : favorites.map(song => (
                            <div key={song.id} className="group bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 flex gap-4 hover:shadow-md transition-all cursor-pointer relative overflow-hidden">
                                <div className="w-16 h-16 rounded-lg overflow-hidden relative flex-shrink-0" onClick={() => onPlaySong(song, favorites)}>
                                    <img src={song.coverUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={song.title} />
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ICONS.Play size={20} className="text-white fill-current" />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <h4 className="font-bold text-sm text-[var(--text-main)] truncate">{song.title}</h4>
                                    <p className="text-xs text-[var(--text-muted)] truncate">{song.artist}</p>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(song); }}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors self-center"
                                >
                                    <ICONS.Heart size={18} fill="currentColor" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'HISTORY' && (
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl overflow-hidden">
                        {history.length === 0 ? (
                            <div className="p-20 text-center text-[var(--text-muted)]">
                                <p className="font-mono text-sm uppercase">History Empty</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[var(--border)]">
                                {history.slice().reverse().slice(0, 50).map(item => (
                                    <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-[var(--bg-hover)] transition-colors group">
                                        <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                                            <img src={item.song.coverUrl} className="w-full h-full object-cover" alt="art" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm text-[var(--text-main)]">{item.song.title}</div>
                                            <div className="text-xs text-[var(--text-muted)]">{item.song.artist}</div>
                                        </div>
                                        <div className="text-xs font-mono text-[var(--text-muted)] hidden md:block">
                                            {new Date(item.playedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </div>
                                        <button 
                                            onClick={() => onPlaySong(item.song)}
                                            className="p-2 rounded-full hover:bg-[var(--bg-main)] text-[var(--text-main)] opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <ICONS.Play size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'STATS' && detailedStats && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* Streak Card */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-6">
                            <h3 className="text-sm font-bold uppercase tracking-widest mb-6 text-[var(--text-muted)] flex items-center gap-2">
                                🔥 Listening Streak
                            </h3>
                            <div className="flex items-center gap-8">
                                <div className="text-center">
                                    <div className="text-5xl font-bold font-mono">{streak?.currentStreak || 0}</div>
                                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mt-1">Current</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold font-mono text-[var(--primary)]">{streak?.longestStreak || 0}</div>
                                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mt-1">Best</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold font-mono">{Math.floor((streak?.totalListeningMinutes || 0) / 60)}</div>
                                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mt-1">Hours</div>
                                </div>
                            </div>
                            {streak && !streak.listenedToday && streak.currentStreak > 0 && (
                                <div className="mt-4 px-4 py-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-600 text-sm">
                                    🎵 Play a song today to keep your streak alive!
                                </div>
                            )}
                        </div>

                        {/* Top Artists */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-6">
                            <h3 className="text-sm font-bold uppercase tracking-widest mb-6 text-[var(--text-muted)] flex items-center gap-2">
                                <ICONS.User size={16} /> Top Artists
                            </h3>

                            <div className="space-y-3">
                                {detailedStats.topArtists.slice(0, 5).map((artist, i) => (
                                    <div key={artist.name} className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-[var(--bg-main)] flex items-center justify-center text-xs font-bold">
                                            {i + 1}
                                        </span>
                                        <span className="flex-1 truncate font-medium">{artist.name}</span>
                                        <span className="text-xs text-[var(--text-muted)] font-mono">{artist.count} plays</span>
                                    </div>
                                ))}
                                {detailedStats.topArtists.length === 0 && (
                                    <p className="text-sm text-[var(--text-muted)]">No data yet. Start listening!</p>
                                )}
                            </div>
                        </div>

                        {/* Top Moods */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-6">
                            <h3 className="text-sm font-bold uppercase tracking-widest mb-6 text-[var(--text-muted)] flex items-center gap-2">
                                <ICONS.Smile size={16} /> Top Moods
                            </h3>
                            <div className="space-y-3">
                                {detailedStats.topMoods.map(mood => (
                                    <div key={mood.name} className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm font-medium">{mood.name}</span>
                                                <span className="text-xs text-[var(--text-muted)]">{mood.count}</span>
                                            </div>
                                            <div className="h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-[var(--primary)] rounded-full"
                                                    style={{ width: `${detailedStats.totalSongs > 0 ? (mood.count / detailedStats.totalSongs) * 100 : 0}%` }}
                                                />

                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Weekly Activity */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-6">
                            <h3 className="text-sm font-bold uppercase tracking-widest mb-6 text-[var(--text-muted)] flex items-center gap-2">
                                <ICONS.Chart size={16} /> This Week
                            </h3>
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={detailedStats.recentDays}>
                                        <XAxis 
                                            dataKey="date" 
                                            tickFormatter={(val) => new Date(val).toLocaleDateString('en', { weekday: 'short' })}
                                            tick={{ fontSize: 10, fill: 'var(--text-muted)' }} 
                                            axisLine={false} 
                                            tickLine={false} 
                                        />
                                        <Tooltip 
                                            cursor={{fill: 'var(--bg-hover)'}}
                                            contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                        />
                                        <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-center text-xs text-[var(--text-muted)] font-mono mt-4">
                                {detailedStats.totalSongs} songs • {detailedStats.totalMinutes} minutes this week
                            </p>
                        </div>

                    </div>
                )}

            </div>

        </div>
    </div>
  );
};

export default UserProfile;
