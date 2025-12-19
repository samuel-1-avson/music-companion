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
  
  // UI
  toggleFullscreen?: () => void;
  toggleQueue?: () => void;
  toggleLyrics?: () => void;
  search?: () => void;
  
  // Custom
  custom?: Record<string, () => void>;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
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
      case 'f':
        shortcuts.toggleFullscreen?.();
        handled = true;
        break;
      case 'q':
        shortcuts.toggleQueue?.();
        handled = true;
        break;
      case 'l':
        shortcuts.toggleLyrics?.();
        handled = true;
        break;
      case '/':
        shortcuts.search?.();
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
