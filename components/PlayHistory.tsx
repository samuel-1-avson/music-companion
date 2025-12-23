import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';
import { getHistoryDB, addToHistoryDB } from '../utils/db';

interface PlayHistoryProps {
  onPlaySong: (song: Song) => void;
  currentSongId: string | null;
}

interface HistoryEntry {
  song: Song;
  playedAt: number;
}

const PlayHistory: React.FC<PlayHistoryProps> = ({
  onPlaySong,
  currentSongId,
}) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const historyData = await getHistoryDB();
      // Sort by most recent first
      const sorted = historyData.sort((a: HistoryEntry, b: HistoryEntry) => b.playedAt - a.playedAt);
      setHistory(sorted.slice(0, 50)); // Limit to 50 items
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
  };

  const groupByDate = (entries: HistoryEntry[]) => {
    const groups: { [key: string]: HistoryEntry[] } = {};
    
    entries.forEach(entry => {
      const date = new Date(entry.playedAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else {
        key = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });
    
    return groups;
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <ICONS.Loader className="animate-spin mx-auto mb-4" size={32} />
        <p className="font-mono text-[var(--text-muted)]">Loading history...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-8 text-center">
        <ICONS.History size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
        <p className="font-mono text-[var(--text-muted)]">No play history yet</p>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          Songs you play will appear here
        </p>
      </div>
    );
  }

  const groupedHistory = groupByDate(history);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-theme bg-[var(--bg-hover)]">
        <h3 className="font-mono font-bold uppercase flex items-center gap-2">
          <ICONS.History size={18} />
          Play History
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-[var(--primary)] text-black' : 'hover:bg-[var(--bg-hover)]'}`}
            title="List View"
          >
            <ICONS.ListMusic size={14} />
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'timeline' ? 'bg-[var(--primary)] text-black' : 'hover:bg-[var(--bg-hover)]'}`}
            title="Timeline View"
          >
            <ICONS.Activity size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'list' ? (
          <div className="p-2 space-y-1">
            {history.map((entry, index) => (
              <button
                key={`${entry.song.id}-${entry.playedAt}`}
                onClick={() => onPlaySong(entry.song)}
                className={`w-full flex items-center gap-3 p-2 rounded transition-colors text-left
                  ${entry.song.id === currentSongId ? 'bg-[var(--primary)]/20' : 'hover:bg-[var(--bg-hover)]'}
                `}
              >
                <img 
                  src={entry.song.coverUrl} 
                  alt="" 
                  className="w-10 h-10 object-cover border border-theme"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm truncate">{entry.song.title}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{entry.song.artist}</p>
                </div>
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  {formatTime(entry.playedAt)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4">
            {Object.entries(groupedHistory).map(([date, entries]) => (
              <div key={date} className="mb-6">
                <h4 className="font-mono font-bold text-sm uppercase text-[var(--text-muted)] mb-3 sticky top-0 bg-[var(--bg-main)] py-1">
                  {date}
                </h4>
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--primary)]/30" />
                  
                  {entries.map((entry, idx) => (
                    <div 
                      key={`${entry.song.id}-${entry.playedAt}`}
                      className="relative flex items-start gap-4 mb-3 pl-8"
                    >
                      {/* Timeline dot */}
                      <div className="absolute left-[13px] top-3 w-2 h-2 rounded-full bg-[var(--primary)]" />
                      
                      <button
                        onClick={() => onPlaySong(entry.song)}
                        className="flex-1 flex items-center gap-3 p-2 rounded hover:bg-[var(--bg-hover)] transition-colors text-left"
                      >
                        <img 
                          src={entry.song.coverUrl} 
                          alt="" 
                          className="w-8 h-8 object-cover border border-theme"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm truncate">{entry.song.title}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {entry.song.artist} • {new Date(entry.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayHistory;
