import { useState, useCallback } from 'react';
import { Song } from '../types';

interface UseQueueReturn {
  // State
  queue: Song[];
  currentIndex: number;
  currentSong: Song | null;
  
  // Navigation
  next: () => Song | null;
  previous: () => Song | null;
  goTo: (index: number) => Song | null;
  
  // Queue management
  addToQueue: (song: Song) => void;
  addMultiple: (songs: Song[]) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setQueue: (songs: Song[], startIndex?: number) => void;
  
  // Reorder
  moveUp: (index: number) => void;
  moveDown: (index: number) => void;
  shuffle: () => void;
  
  // Utils
  hasNext: boolean;
  hasPrevious: boolean;
  queueLength: number;
}

export const useQueue = (initialQueue: Song[] = []): UseQueueReturn => {
  const [queue, setQueueState] = useState<Song[]>(initialQueue);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentSong = queue[currentIndex] || null;
  const hasNext = currentIndex < queue.length - 1;
  const hasPrevious = currentIndex > 0;
  const queueLength = queue.length;

  // Navigation
  const next = useCallback((): Song | null => {
    if (!hasNext) return null;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    return queue[newIndex];
  }, [currentIndex, hasNext, queue]);

  const previous = useCallback((): Song | null => {
    if (!hasPrevious) return null;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    return queue[newIndex];
  }, [currentIndex, hasPrevious, queue]);

  const goTo = useCallback((index: number): Song | null => {
    if (index < 0 || index >= queue.length) return null;
    setCurrentIndex(index);
    return queue[index];
  }, [queue]);

  // Queue management
  const addToQueue = useCallback((song: Song) => {
    setQueueState(prev => [...prev, song]);
  }, []);

  const addMultiple = useCallback((songs: Song[]) => {
    setQueueState(prev => [...prev, ...songs]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueueState(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
    // Adjust current index if needed
    if (index < currentIndex) {
      setCurrentIndex(prev => prev - 1);
    } else if (index === currentIndex && currentIndex >= queue.length - 1) {
      setCurrentIndex(prev => Math.max(0, prev - 1));
    }
  }, [currentIndex, queue.length]);

  const clearQueue = useCallback(() => {
    setQueueState([]);
    setCurrentIndex(0);
  }, []);

  const setQueue = useCallback((songs: Song[], startIndex: number = 0) => {
    setQueueState(songs);
    setCurrentIndex(Math.min(startIndex, songs.length - 1));
  }, []);

  // Reorder
  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setQueueState(prev => {
      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
    if (index === currentIndex) {
      setCurrentIndex(currentIndex - 1);
    } else if (index - 1 === currentIndex) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex]);

  const moveDown = useCallback((index: number) => {
    if (index >= queue.length - 1) return;
    setQueueState(prev => {
      const updated = [...prev];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated;
    });
    if (index === currentIndex) {
      setCurrentIndex(currentIndex + 1);
    } else if (index + 1 === currentIndex) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex, queue.length]);

  const shuffle = useCallback(() => {
    setQueueState(prev => {
      // Keep current song at position 0, shuffle rest
      const current = prev[currentIndex];
      const rest = prev.filter((_, i) => i !== currentIndex);
      
      // Fisher-Yates shuffle
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      
      return [current, ...rest];
    });
    setCurrentIndex(0);
  }, [currentIndex]);

  return {
    queue,
    currentIndex,
    currentSong,
    next,
    previous,
    goTo,
    addToQueue,
    addMultiple,
    removeFromQueue,
    clearQueue,
    setQueue,
    moveUp,
    moveDown,
    shuffle,
    hasNext,
    hasPrevious,
    queueLength,
  };
};

export default useQueue;
