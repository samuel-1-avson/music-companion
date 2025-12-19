import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { getHistoryDB } from '../utils/db';

interface ListenRecord {
  songId: string;
  title: string;
  artist: string;
  playedAt: Date;
  duration?: string;
  genre?: string;
}

interface ReportStats {
  totalMinutes: number;
  totalTracks: number;
  topArtists: { name: string; count: number }[];
  topGenres: { name: string; count: number }[];
  peakHour: number;
  streakDays: number;
  avgSessionLength: number;
}

interface ListeningReportProps {
  period: 'week' | 'month' | 'year';
  onClose?: () => void;
}

const ListeningReport: React.FC<ListeningReportProps> = ({ period, onClose }) => {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string>('');

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const historyItems = await getHistoryDB();
      
      // Map to usable format with artist from song
      const history = historyItems.map(item => ({
        artist: item.song?.artist || 'Unknown',
        title: item.song?.title || 'Unknown',
        playedAt: new Date(item.playedAt),
        genre: item.song?.mood || undefined
      }));
      
      // Calculate date range
      const now = new Date();
      const startDate = new Date();
      if (period === 'week') startDate.setDate(now.getDate() - 7);
      else if (period === 'month') startDate.setMonth(now.getMonth() - 1);
      else startDate.setFullYear(now.getFullYear() - 1);
      
      // Filter history by period
      const filtered = history.filter((h: any) => new Date(h.playedAt) >= startDate);

      
      // Calculate stats
      const artistCounts: Record<string, number> = {};
      const genreCounts: Record<string, number> = {};
      const hourCounts: Record<number, number> = {};
      
      filtered.forEach((record: any) => {
        artistCounts[record.artist] = (artistCounts[record.artist] || 0) + 1;
        if (record.genre) {
          genreCounts[record.genre] = (genreCounts[record.genre] || 0) + 1;
        }
        const hour = new Date(record.playedAt).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      
      const topArtists = Object.entries(artistCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
      
      const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
      
      const peakHour = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 12;
      
      // Estimate minutes (assume 3.5 min avg per song)
      const totalMinutes = Math.round(filtered.length * 3.5);
      
      setStats({
        totalMinutes,
        totalTracks: filtered.length,
        topArtists,
        topGenres,
        peakHour: parseInt(peakHour as string),
        streakDays: Math.min(7, filtered.length > 0 ? Math.ceil(filtered.length / 10) : 0),
        avgSessionLength: Math.round(totalMinutes / Math.max(1, Math.ceil(filtered.length / 5)))
      });
      
      // AI insight disabled due to type incompatibility
      // Could be re-enabled with proper MoodData format

    } catch (e) {
      console.error('[Report] Failed to load stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'This Year';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ICONS.Loader size={32} className="animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro">
      {/* Header */}
      <div className="p-4 border-b-2 border-theme bg-[var(--bg-hover)] flex justify-between items-center">
        <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2">
          <ICONS.Chart size={20} /> Listening Report
        </h2>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-main)] rounded">
            <ICONS.Close size={16} />
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Period Badge */}
        <div className="flex justify-center">
          <span className="bg-[var(--primary)] text-black px-4 py-1 text-xs font-mono font-bold uppercase">
            📅 {periodLabel}
          </span>
        </div>

        {/* Big Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--bg-main)] p-4 text-center border border-theme">
            <p className="text-3xl font-bold text-[var(--primary)]">{formatTime(stats?.totalMinutes || 0)}</p>
            <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Total Listening</p>
          </div>
          <div className="bg-[var(--bg-main)] p-4 text-center border border-theme">
            <p className="text-3xl font-bold text-[var(--primary)]">{stats?.totalTracks || 0}</p>
            <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Tracks Played</p>
          </div>
          <div className="bg-[var(--bg-main)] p-4 text-center border border-theme">
            <p className="text-3xl font-bold text-[var(--primary)]">{stats?.streakDays || 0}🔥</p>
            <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Day Streak</p>
          </div>
          <div className="bg-[var(--bg-main)] p-4 text-center border border-theme">
            <p className="text-3xl font-bold text-[var(--primary)]">{formatHour(stats?.peakHour || 12)}</p>
            <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Peak Hour</p>
          </div>
        </div>

        {/* Top Artists */}
        {stats?.topArtists && stats.topArtists.length > 0 && (
          <div>
            <h3 className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase mb-3">Top Artists</h3>
            <div className="space-y-2">
              {stats.topArtists.map((artist, i) => (
                <div key={artist.name} className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-[var(--primary)] text-black flex items-center justify-center font-bold text-xs">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-mono text-sm truncate">{artist.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{artist.count} plays</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Genres */}
        {stats?.topGenres && stats.topGenres.length > 0 && (
          <div>
            <h3 className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase mb-3">Top Genres</h3>
            <div className="flex flex-wrap gap-2">
              {stats.topGenres.map((genre) => (
                <span key={genre.name} className="px-3 py-1 bg-[var(--bg-hover)] border border-theme text-xs font-mono">
                  {genre.name} ({genre.count})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AI Insight */}
        {aiInsight && (
          <div className="bg-[var(--bg-hover)] border border-theme p-4">
            <h3 className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase mb-2">🤖 AI Insight</h3>
            <p className="text-sm text-[var(--text-main)]">{aiInsight}</p>
          </div>
        )}

        {/* Empty State */}
        {(!stats?.totalTracks || stats.totalTracks === 0) && (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <ICONS.Music size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-mono text-sm">No listening data for this period yet.</p>
            <p className="text-xs mt-2">Start playing music to see your stats!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListeningReport;
