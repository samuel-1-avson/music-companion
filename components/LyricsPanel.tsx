import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';
import { 
  getLyrics, 
  LyricsResult, 
  LyricLine, 
  parseSyncedLyrics, 
  parsePlainLyrics, 
  getCurrentLyricIndex 
} from '../services/lyricsService';

interface LyricsPanelProps {
  currentSong: Song | null;
  currentTime: number;
  isPlaying: boolean;
  onClose: () => void;
}

const LyricsPanel: React.FC<LyricsPanelProps> = ({
  currentSong,
  currentTime,
  isPlaying,
  onClose,
}) => {
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedLines, setSyncedLines] = useState<LyricLine[]>([]);
  const [plainLines, setPlainLines] = useState<string[]>([]);
  
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLDivElement>(null);

  // Fetch lyrics when song changes
  useEffect(() => {
    if (!currentSong) {
      setLyrics(null);
      setSyncedLines([]);
      setPlainLines([]);
      return;
    }

    const fetchLyrics = async () => {
      setLoading(true);
      setError(null);

      try {
        // Clean up song title (remove video quality tags, etc.)
        const cleanTitle = currentSong.title
          .replace(/\s*[\[\(].*?[\]\)]\s*/g, '') // Remove [Official Video], (Lyrics), etc.
          .replace(/\s*-\s*(Official|Lyrics|Audio|Video|HD|HQ|4K).*$/i, '')
          .trim();

        const result = await getLyrics(
          cleanTitle,
          currentSong.artist,
          undefined,
          currentSong.duration ? parseInt(currentSong.duration) : undefined
        );

        if (result) {
          setLyrics(result);
          
          if (result.syncedLyrics) {
            setSyncedLines(parseSyncedLyrics(result.syncedLyrics));
            setPlainLines([]);
          } else if (result.plainLyrics) {
            setPlainLines(parsePlainLyrics(result.plainLyrics));
            setSyncedLines([]);
          }
        } else {
          setError('No lyrics found for this song');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load lyrics');
      } finally {
        setLoading(false);
      }
    };

    fetchLyrics();
  }, [currentSong?.id]);

  // Current lyric line index for synced lyrics
  const currentLineIndex = useMemo(() => {
    if (syncedLines.length === 0) return -1;
    return getCurrentLyricIndex(syncedLines, currentTime);
  }, [syncedLines, currentTime]);

  // Auto-scroll to current lyric
  useEffect(() => {
    if (activeLyricRef.current && lyricsContainerRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentLineIndex]);

  const hasSyncedLyrics = syncedLines.length > 0;
  const hasPlainLyrics = plainLines.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[var(--bg-card)] border-4 border-theme w-full max-w-2xl max-h-[80vh] flex flex-col shadow-retro">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-theme bg-[var(--bg-hover)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--primary)] text-black border-2 border-black">
              <ICONS.Music size={20} />
            </div>
            <div>
              <h2 className="font-mono font-bold text-[var(--text-main)] uppercase">
                {currentSong?.title || 'No Song Playing'}
              </h2>
              <p className="text-xs font-mono text-[var(--text-muted)]">
                {currentSong?.artist || 'Unknown Artist'}
                {hasSyncedLyrics && ' • Synced Lyrics'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-hover)] border-2 border-transparent hover:border-theme transition-colors"
          >
            <ICONS.X size={20} className="text-[var(--text-main)]" />
          </button>
        </div>

        {/* Lyrics Content */}
        <div 
          ref={lyricsContainerRef}
          className="flex-1 overflow-y-auto p-6 scroll-smooth"
        >
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <p className="font-mono text-[var(--text-muted)] text-sm">Loading lyrics...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <ICONS.AlertCircle size={48} className="text-[var(--text-muted)]" />
              <p className="font-mono text-[var(--text-muted)]">{error}</p>
              <p className="text-xs font-mono text-[var(--text-muted)]">
                Try searching for "{currentSong?.title}" on Genius
              </p>
            </div>
          )}

          {lyrics?.instrumental && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <ICONS.Music size={48} className="text-[var(--primary)]" />
              <p className="font-mono text-[var(--text-main)] text-lg">♪ Instrumental ♪</p>
              <p className="text-sm font-mono text-[var(--text-muted)]">
                This track has no vocals
              </p>
            </div>
          )}

          {/* Synced Lyrics */}
          {hasSyncedLyrics && (
            <div className="space-y-4">
              {syncedLines.map((line, index) => {
                const isActive = index === currentLineIndex;
                const isPast = index < currentLineIndex;
                
                return (
                  <div
                    key={`${line.time}-${index}`}
                    ref={isActive ? activeLyricRef : null}
                    className={`
                      font-mono text-lg leading-relaxed transition-all duration-300 cursor-pointer
                      ${isActive 
                        ? 'text-[var(--primary)] scale-105 font-bold' 
                        : isPast 
                          ? 'text-[var(--text-muted)] opacity-50'
                          : 'text-[var(--text-main)] opacity-70'
                      }
                    `}
                  >
                    {line.text}
                  </div>
                );
              })}
            </div>
          )}

          {/* Plain Lyrics */}
          {hasPlainLyrics && (
            <div className="space-y-3">
              {plainLines.map((line, index) => (
                <p
                  key={index}
                  className="font-mono text-[var(--text-main)] leading-relaxed"
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t-2 border-theme bg-[var(--bg-hover)] flex items-center justify-between">
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Powered by LRCLIB
          </span>
          {hasSyncedLyrics && (
            <span className="text-xs font-mono text-[var(--primary)] flex items-center gap-1">
              <ICONS.Clock size={12} />
              Synced
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default LyricsPanel;
