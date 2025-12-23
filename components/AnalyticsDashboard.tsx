/**
 * AnalyticsDashboard - Advanced listening analytics and insights
 * 
 * Features:
 * - Listening heatmap
 * - Trend charts
 * - AI personality summary
 * - Discovery vs repeat analysis
 */
import React, { useState, useEffect, useMemo } from 'react';
import { ICONS } from '../constants';
import { getHistoryDB } from '../utils/db';

interface HistoryItem {
  songId: string;
  song?: {
    title: string;
    artist: string;
    mood?: string;
  };
  playedAt: Date | string;
}

interface Analytics {
  totalMinutes: number;
  totalTracks: number;
  uniqueTracks: number;
  uniqueArtists: number;
  
  topArtists: { name: string; count: number; percent: number }[];
  topMoods: { name: string; count: number }[];
  
  // Heatmap data: [day][hour] = count
  heatmap: number[][];
  
  // Daily trend: last 7/30 days
  dailyTrend: { date: string; count: number }[];
  
  // Discovery rate
  discoveryRate: number; // % of new songs
  repeatRate: number; // % of plays that are repeats
  
  peakHour: number;
  peakDay: number;
  avgSessionLength: number;
}

interface AnalyticsDashboardProps {
  period: 'week' | 'month' | 'year';
  onClose?: () => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ period, onClose }) => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'trends' | 'insights'>('overview');

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const historyItems = await getHistoryDB();
      
      // Calculate date range
      const now = new Date();
      const startDate = new Date();
      if (period === 'week') startDate.setDate(now.getDate() - 7);
      else if (period === 'month') startDate.setMonth(now.getMonth() - 1);
      else startDate.setFullYear(now.getFullYear() - 1);

      // Filter and map history
      const history: HistoryItem[] = historyItems
        .map(item => ({
          songId: item.song?.id || '',
          song: item.song,
          playedAt: new Date(item.playedAt)
        }))
        .filter(h => new Date(h.playedAt) >= startDate);

      if (history.length === 0) {
        setAnalytics(null);
        setLoading(false);
        return;
      }

      // Calculate analytics
      const artistCounts: Record<string, number> = {};
      const moodCounts: Record<string, number> = {};
      const songCounts: Record<string, number> = {};
      const heatmap: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
      const dailyCounts: Record<string, number> = {};

      history.forEach(record => {
        const artist = record.song?.artist || 'Unknown';
        const mood = record.song?.mood || 'Unknown';
        const date = new Date(record.playedAt);
        const day = date.getDay();
        const hour = date.getHours();
        const dateKey = date.toISOString().split('T')[0];

        artistCounts[artist] = (artistCounts[artist] || 0) + 1;
        moodCounts[mood] = (moodCounts[mood] || 0) + 1;
        songCounts[record.songId] = (songCounts[record.songId] || 0) + 1;
        heatmap[day][hour]++;
        dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
      });

      const totalTracks = history.length;
      const uniqueTracks = Object.keys(songCounts).length;
      const uniqueArtists = Object.keys(artistCounts).length;
      
      // Discovery vs repeat
      const newSongs = Object.values(songCounts).filter(c => c === 1).length;
      const discoveryRate = Math.round((newSongs / uniqueTracks) * 100);
      const repeatPlayCount = totalTracks - uniqueTracks;
      const repeatRate = Math.round((repeatPlayCount / totalTracks) * 100);

      // Top artists with percentages
      const topArtists = Object.entries(artistCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({
          name,
          count,
          percent: Math.round((count / totalTracks) * 100)
        }));

      // Top moods
      const topMoods = Object.entries(moodCounts)
        .filter(([name]) => name !== 'Unknown')
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      // Daily trend
      const dailyTrend = Object.entries(dailyCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-14) // Last 14 days
        .map(([date, count]) => ({ date, count }));

      // Peak hour and day
      let peakHour = 12, peakDay = 0, maxCount = 0;
      heatmap.forEach((dayData, day) => {
        dayData.forEach((count, hour) => {
          if (count > maxCount) {
            maxCount = count;
            peakHour = hour;
            peakDay = day;
          }
        });
      });

      // Estimate minutes (3.5 min avg per song)
      const totalMinutes = Math.round(totalTracks * 3.5);
      const avgSessionLength = Math.round(totalMinutes / Math.max(1, dailyTrend.length));

      setAnalytics({
        totalMinutes,
        totalTracks,
        uniqueTracks,
        uniqueArtists,
        topArtists,
        topMoods,
        heatmap,
        dailyTrend,
        discoveryRate,
        repeatRate,
        peakHour,
        peakDay,
        avgSessionLength,
      });
    } catch (e) {
      console.error('[Analytics] Failed to load:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12AM';
    if (hour === 12) return '12PM';
    return hour > 12 ? `${hour - 12}PM` : `${hour}AM`;
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'This Year';

  // Get max value for heatmap scaling
  const maxHeatmapValue = useMemo(() => {
    if (!analytics) return 1;
    return Math.max(...analytics.heatmap.flat(), 1);
  }, [analytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ICONS.Loader size={32} className="animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro p-8 text-center">
        <p className="text-4xl mb-4">📊</p>
        <p className="font-mono text-sm text-[var(--text-muted)]">No listening data available</p>
        <p className="text-xs mt-2">Start playing music to see your analytics!</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro">
      {/* Header */}
      <div className="p-4 border-b-2 border-theme bg-[var(--bg-hover)] flex justify-between items-center">
        <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2">
          📊 Analytics
        </h2>
        <div className="flex items-center gap-2">
          <span className="bg-[var(--primary)] text-black px-3 py-1 text-xs font-mono font-bold">
            {periodLabel}
          </span>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-[var(--bg-main)] rounded">
              <ICONS.Close size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-theme">
        {(['overview', 'trends', 'insights'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`flex-1 p-3 font-mono text-sm font-bold uppercase ${
              selectedTab === tab
                ? 'bg-[var(--primary)] text-black'
                : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-6">
        {selectedTab === 'overview' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[var(--bg-main)] p-3 text-center border border-theme">
                <p className="text-2xl font-bold text-[var(--primary)]">{formatTime(analytics.totalMinutes)}</p>
                <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase">Total Time</p>
              </div>
              <div className="bg-[var(--bg-main)] p-3 text-center border border-theme">
                <p className="text-2xl font-bold text-[var(--primary)]">{analytics.totalTracks}</p>
                <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase">Tracks Played</p>
              </div>
              <div className="bg-[var(--bg-main)] p-3 text-center border border-theme">
                <p className="text-2xl font-bold text-[var(--primary)]">{analytics.uniqueArtists}</p>
                <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase">Artists</p>
              </div>
              <div className="bg-[var(--bg-main)] p-3 text-center border border-theme">
                <p className="text-2xl font-bold text-[var(--primary)]">{analytics.discoveryRate}%</p>
                <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase">New Music</p>
              </div>
            </div>

            {/* Top Artists */}
            <div>
              <h3 className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase mb-3">Top Artists</h3>
              <div className="space-y-2">
                {analytics.topArtists.map((artist, i) => (
                  <div key={artist.name} className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-[var(--primary)] text-black flex items-center justify-center font-bold text-xs">
                      {i + 1}
                    </span>
                    <div className="flex-1 bg-[var(--bg-main)] h-6 overflow-hidden">
                      <div 
                        className="h-full bg-[var(--primary)] opacity-30"
                        style={{ width: `${artist.percent}%` }}
                      />
                    </div>
                    <span className="font-mono text-sm truncate w-24">{artist.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{artist.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {selectedTab === 'trends' && (
          <>
            {/* Listening Heatmap */}
            <div>
              <h3 className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase mb-3">
                🗓️ Activity Heatmap
              </h3>
              <div className="overflow-x-auto">
                <div className="grid gap-0.5" style={{ gridTemplateColumns: 'auto repeat(24, 1fr)' }}>
                  <div /> {/* Empty corner */}
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="text-[8px] text-[var(--text-muted)] text-center font-mono">
                      {h % 6 === 0 ? formatHour(h) : ''}
                    </div>
                  ))}
                  {analytics.heatmap.map((dayData, day) => (
                    <React.Fragment key={day}>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono pr-1">{DAY_NAMES[day]}</div>
                      {dayData.map((count, hour) => (
                        <div
                          key={hour}
                          className="w-full aspect-square"
                          style={{
                            backgroundColor: count > 0
                              ? `rgba(var(--primary-rgb), ${0.2 + (count / maxHeatmapValue) * 0.8})`
                              : 'var(--bg-main)',
                          }}
                          title={`${DAY_NAMES[day]} ${formatHour(hour)}: ${count} plays`}
                        />
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* Daily Trend */}
            <div>
              <h3 className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase mb-3">
                📈 Daily Trend
              </h3>
              <div className="flex items-end gap-1 h-24">
                {analytics.dailyTrend.map((day, i) => {
                  const maxDaily = Math.max(...analytics.dailyTrend.map(d => d.count), 1);
                  const height = (day.count / maxDaily) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-[var(--primary)] transition-all"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${day.date}: ${day.count} plays`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] text-[var(--text-muted)] font-mono mt-1">
                <span>{analytics.dailyTrend[0]?.date.split('-').slice(1).join('/')}</span>
                <span>{analytics.dailyTrend[analytics.dailyTrend.length - 1]?.date.split('-').slice(1).join('/')}</span>
              </div>
            </div>
          </>
        )}

        {selectedTab === 'insights' && (
          <>
            {/* Listening Pattern */}
            <div className="bg-[var(--bg-hover)] p-4 border border-theme">
              <h3 className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase mb-2">
                🎧 Your Listening Pattern
              </h3>
              <p className="text-sm">
                You listen most on <strong>{DAY_NAMES[analytics.peakDay]}s</strong> around{' '}
                <strong>{formatHour(analytics.peakHour)}</strong>. Your average session is{' '}
                <strong>{formatTime(analytics.avgSessionLength)}</strong>.
              </p>
            </div>

            {/* Discovery vs Repeat */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--bg-main)] p-4 border border-theme text-center">
                <p className="text-3xl font-bold text-green-500">{analytics.discoveryRate}%</p>
                <p className="text-xs font-mono text-[var(--text-muted)] uppercase mt-1">New Discoveries</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-2">
                  {analytics.uniqueTracks - Math.round(analytics.uniqueTracks * analytics.repeatRate / 100)} new songs
                </p>
              </div>
              <div className="bg-[var(--bg-main)] p-4 border border-theme text-center">
                <p className="text-3xl font-bold text-blue-500">{analytics.repeatRate}%</p>
                <p className="text-xs font-mono text-[var(--text-muted)] uppercase mt-1">Repeat Listens</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-2">
                  You love your favorites!
                </p>
              </div>
            </div>

            {/* Top Moods */}
            {analytics.topMoods.length > 0 && (
              <div>
                <h3 className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase mb-2">
                  🎭 Your Mood Profile
                </h3>
                <div className="flex flex-wrap gap-2">
                  {analytics.topMoods.map((mood) => (
                    <span
                      key={mood.name}
                      className="px-3 py-1 bg-[var(--bg-hover)] border border-theme text-sm font-mono"
                    >
                      {mood.name} ({mood.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Music Personality */}
            <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] p-4 text-black">
              <h3 className="text-xs font-mono font-bold uppercase mb-2">🎵 Your Music Personality</h3>
              <p className="text-sm font-bold">
                {analytics.discoveryRate > 50 ? 'The Explorer' : 
                 analytics.repeatRate > 70 ? 'The Loyalist' :
                 analytics.uniqueArtists > 20 ? 'The Curator' : 'The Balanced Listener'}
              </p>
              <p className="text-xs mt-1 opacity-80">
                {analytics.discoveryRate > 50 
                  ? "You're always on the hunt for new sounds and artists!"
                  : analytics.repeatRate > 70
                  ? "You know what you love and stick to your favorites."
                  : analytics.uniqueArtists > 20
                  ? "You have an eclectic taste spanning many artists."
                  : "You enjoy a healthy mix of new discoveries and old favorites."}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
