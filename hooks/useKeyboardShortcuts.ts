import { useEffect, useCallback } from 'react';

interface KeyboardShortcuts {
  // Playback
  togglePlay?: () => void;
  nextTrack?: () => void;
  previousTrack?: () => void;
  volumeUp?: () => void;
  volumeDown?: () => void;
  toggleMute?: () => void;
  seekForward?: () => void;
  seekBackward?: () => void;
  toggleShuffle?: () => void;
  cycleRepeatMode?: () => void;
  
  // UI
  toggleFullscreen?: () => void;
  toggleQueue?: () => void;
  toggleLyrics?: () => void;
  toggleHelp?: () => void;
  search?: () => void;
  
  // View Navigation (1-9 keys)
  navigateToView?: (viewIndex: number) => void;
  
  // Focus Mode
  toggleFocusMode?: () => void;
  
  // Custom
  custom?: Record<string, () => void>;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  /** Current view for context-aware shortcuts */
  currentView?: string;
}

export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcuts,
  options: UseKeyboardShortcutsOptions = {}
): void => {
  const { enabled = true, preventDefault = true } = options;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in input/textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Build key combo string
    const key = e.key.toLowerCase();
    const combo = [
      e.ctrlKey ? 'ctrl' : '',
      e.shiftKey ? 'shift' : '',
      e.altKey ? 'alt' : '',
      e.metaKey ? 'meta' : '',
      key
    ].filter(Boolean).join('+');

    let handled = false;

    // Playback shortcuts
    switch (key) {
      case ' ':
        shortcuts.togglePlay?.();
        handled = true;
        break;
      case 'arrowright':
        if (e.ctrlKey || e.metaKey) {
          shortcuts.nextTrack?.();
        } else {
          shortcuts.seekForward?.();
        }
        handled = true;
        break;
      case 'arrowleft':
        if (e.ctrlKey || e.metaKey) {
          shortcuts.previousTrack?.();
        } else {
          shortcuts.seekBackward?.();
        }
        handled = true;
        break;
      case 'arrowup':
        shortcuts.volumeUp?.();
        handled = true;
        break;
      case 'arrowdown':
        shortcuts.volumeDown?.();
        handled = true;
        break;
      case 'm':
        shortcuts.toggleMute?.();
        handled = true;
        break;
      case 's':
        // Only toggle shuffle if not using Ctrl+S (save shortcut)
        if (!e.ctrlKey && !e.metaKey) {
          shortcuts.toggleShuffle?.();
          handled = true;
        }
        break;
      case 'r':
        // Only cycle repeat if not using Ctrl+R (refresh shortcut)
        if (!e.ctrlKey && !e.metaKey) {
          shortcuts.cycleRepeatMode?.();
          handled = true;
        }
        break;
      case 'f':
        if (!e.ctrlKey && !e.metaKey) {
          shortcuts.toggleFocusMode?.() ?? shortcuts.toggleFullscreen?.();
          handled = true;
        }
        break;
      case 'q':
        shortcuts.toggleQueue?.();
        handled = true;
        break;
      case 'l':
        shortcuts.toggleLyrics?.();
        handled = true;
        break;
      case '?':
        shortcuts.toggleHelp?.();
        handled = true;
        break;
      case 'escape':
        shortcuts.toggleHelp?.(); // Close help if open
        handled = true;
        break;
      case '/':
        shortcuts.search?.();
        handled = true;
        break;
      // View Navigation (1-9)
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        const viewIndex = parseInt(key, 10);
        shortcuts.navigateToView?.(viewIndex);
        handled = true;
        break;
    }

    // Custom shortcuts
    if (shortcuts.custom?.[combo]) {
      shortcuts.custom[combo]();
      handled = true;
    }

    if (handled && preventDefault) {
      e.preventDefault();
    }
  }, [shortcuts, preventDefault]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
};

export default useKeyboardShortcuts;
