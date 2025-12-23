import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';

interface MiniPlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onExpand: () => void;
  mainPlayerVisible: boolean;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentSong,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  onExpand,
  mainPlayerVisible,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Show mini player when main player scrolls out of view
  useEffect(() => {
    if (!currentSong) {
      setIsVisible(false);
      return;
    }

    if (mainPlayerVisible || isDismissed) {
      setIsVisible(false);
    } else {
      setIsVisible(true);
    }
  }, [currentSong, mainPlayerVisible, isDismissed]);

  // Reset dismissed state when song changes
  useEffect(() => {
    setIsDismissed(false);
  }, [currentSong?.id]);

  if (!isVisible || !currentSong) return null;

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300"
      style={{ maxWidth: '320px' }}
    >
      <div className="bg-[var(--bg-card)] border-4 border-theme shadow-retro flex items-center gap-3 p-2 pr-3">
        {/* Album Art */}
        <div className="relative flex-shrink-0">
          <img 
            src={currentSong.coverUrl} 
            alt={currentSong.title}
            className="w-14 h-14 object-cover border-2 border-theme"
          />
          {isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="flex gap-0.5">
                <div className="w-1 h-4 bg-[var(--primary)] animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-3 bg-[var(--primary)] animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-5 bg-[var(--primary)] animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        {/* Song Info */}
        <div className="flex-1 min-w-0">
          <p className="font-mono font-bold text-sm truncate text-[var(--text-main)]">
            {currentSong.title}
          </p>
          <p className="text-xs text-[var(--text-muted)] truncate">
            {currentSong.artist}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onPrev}
            className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors"
            title="Previous"
          >
            <ICONS.SkipBack size={16} />
          </button>
          
          <button
            onClick={onPlayPause}
            className="p-2 bg-[var(--primary)] text-black rounded-full hover:opacity-90 transition-opacity"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <ICONS.Pause size={16} fill="currentColor" />
            ) : (
              <ICONS.Play size={16} fill="currentColor" />
            )}
          </button>
          
          <button
            onClick={onNext}
            className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors"
            title="Next"
          >
            <ICONS.SkipForward size={16} />
          </button>
        </div>

        {/* Expand / Close */}
        <div className="flex flex-col gap-0.5 flex-shrink-0 ml-1">
          <button
            onClick={onExpand}
            className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors"
            title="Expand"
          >
            <ICONS.ArrowUp size={12} />
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors"
            title="Dismiss"
          >
            <ICONS.X size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MiniPlayer;
