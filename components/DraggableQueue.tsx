import React, { useState, useRef } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';

interface DraggableQueueProps {
  queue: Song[];
  currentSongId: string | null;
  onReorder: (newQueue: Song[]) => void;
  onPlaySong: (song: Song) => void;
  onRemoveFromQueue: (songId: string) => void;
}

const DraggableQueue: React.FC<DraggableQueueProps> = ({
  queue,
  currentSongId,
  onReorder,
  onPlaySong,
  onRemoveFromQueue,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // Create custom drag image
    const elem = e.currentTarget as HTMLElement;
    const rect = elem.getBoundingClientRect();
    e.dataTransfer.setDragImage(elem, rect.width / 2, rect.height / 2);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragCounter.current++;
    setDragOverIndex(index);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    const newQueue = [...queue];
    const [draggedItem] = newQueue.splice(draggedIndex, 1);
    newQueue.splice(dropIndex, 0, draggedItem);
    
    onReorder(newQueue);
    handleDragEnd();
  };

  // Touch support
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchedIndex = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    touchedIndex.current = index;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    
    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartPos.current.y;
    
    // Determine if we should show drag indicator
    if (Math.abs(deltaY) > 20) {
      const items = document.querySelectorAll('[data-queue-item]');
      items.forEach((item, idx) => {
        const rect = item.getBoundingClientRect();
        if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          setDragOverIndex(idx);
        }
      });
    }
  };

  const handleTouchEnd = () => {
    if (touchedIndex.current !== null && dragOverIndex !== null && touchedIndex.current !== dragOverIndex) {
      const newQueue = [...queue];
      const [draggedItem] = newQueue.splice(touchedIndex.current, 1);
      newQueue.splice(dragOverIndex, 0, draggedItem);
      onReorder(newQueue);
    }
    
    touchStartPos.current = null;
    touchedIndex.current = null;
    setDragOverIndex(null);
  };

  if (queue.length === 0) {
    return (
      <div className="p-8 text-center">
        <ICONS.ListMusic size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
        <p className="font-mono text-[var(--text-muted)]">Queue is empty</p>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          Search for songs or play from your library
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-3 py-2 border-b border-theme">
        <h3 className="font-mono font-bold text-sm uppercase flex items-center gap-2">
          <ICONS.ListMusic size={16} />
          Queue ({queue.length})
        </h3>
        <p className="text-xs font-mono text-[var(--text-muted)]">
          Drag to reorder
        </p>
      </div>
      
      {queue.map((song, index) => {
        const isCurrent = song.id === currentSongId;
        const isDragging = draggedIndex === index;
        const isDragOver = dragOverIndex === index && draggedIndex !== index;
        
        return (
          <div
            key={`${song.id}-${index}`}
            data-queue-item
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onTouchStart={(e) => handleTouchStart(e, index)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`
              flex items-center gap-3 p-2 mx-2 rounded cursor-grab active:cursor-grabbing
              transition-all duration-150
              ${isCurrent ? 'bg-[var(--primary)]/20 border-l-4 border-[var(--primary)]' : 'hover:bg-[var(--bg-hover)]'}
              ${isDragging ? 'opacity-50 scale-95' : ''}
              ${isDragOver ? 'border-t-2 border-[var(--primary)] mt-1' : ''}
            `}
          >
            {/* Drag Handle */}
            <div className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-main)]">
              <ICONS.ArrowUp size={14} className="rotate-90" />
            </div>
            
            {/* Song Info */}
            <img 
              src={song.coverUrl} 
              alt="" 
              className="w-10 h-10 object-cover border border-theme flex-shrink-0"
            />
            <div className="flex-1 min-w-0" onClick={() => onPlaySong(song)}>
              <p className={`font-mono text-sm truncate ${isCurrent ? 'font-bold text-[var(--primary)]' : ''}`}>
                {song.title}
              </p>
              <p className="text-xs text-[var(--text-muted)] truncate">
                {song.artist}
              </p>
            </div>
            
            {/* Now Playing Indicator */}
            {isCurrent && (
              <div className="flex gap-0.5 mr-2">
                <div className="w-1 h-3 bg-[var(--primary)] animate-pulse" />
                <div className="w-1 h-4 bg-[var(--primary)] animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-2 bg-[var(--primary)] animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            
            {/* Remove Button */}
            {!isCurrent && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromQueue(song.id);
                }}
                className="p-1 hover:bg-red-500/20 rounded transition-colors flex-shrink-0"
                title="Remove from queue"
              >
                <ICONS.X size={14} className="text-[var(--text-muted)] hover:text-red-500" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DraggableQueue;
