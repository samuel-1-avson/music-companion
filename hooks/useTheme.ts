import { useState, useEffect, useCallback } from 'react';
import { Theme } from '../types';

const THEMES = [
  'minimal', 'classic', 'solar', 'ocean', 'neon', 'forest',
  'sunset', 'midnight', 'lavender', 'cherry', 'coffee', 'terminal',
  'highContrast', 'vaporwave', 'nord', 'solarizedDark', 'retroWave'
] as const;

interface UseThemeOptions {
  defaultTheme?: Theme;
  storageKey?: string;
  smartThemeEnabled?: boolean;
}

interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isSmartTheme: boolean;
  setSmartTheme: (enabled: boolean) => void;
  themes: readonly string[];
  cycleTheme: () => void;
}

export const useTheme = (options: UseThemeOptions = {}): UseThemeReturn => {
  const {
    defaultTheme = 'classic',
    storageKey = 'theme',
    smartThemeEnabled = false
  } = options;

  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(storageKey);
    return (saved as Theme) || defaultTheme;
  });
  
  const [isSmartTheme, setSmartThemeState] = useState(() => {
    return localStorage.getItem('smartTheme') === 'true';
  });

  // Apply theme to document
  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem(storageKey, theme);
  }, [theme, storageKey]);

  // Smart theme based on time of day
  useEffect(() => {
    if (!isSmartTheme) return;

    const updateSmartTheme = () => {
      const hour = new Date().getHours();
      let smartTheme: Theme;
      
      if (hour >= 6 && hour < 12) {
        smartTheme = 'solar'; // Morning
      } else if (hour >= 12 && hour < 17) {
        smartTheme = 'classic'; // Afternoon
      } else if (hour >= 17 && hour < 20) {
        smartTheme = 'sunset'; // Evening
      } else {
        smartTheme = 'midnight'; // Night
      }
      
      setThemeState(smartTheme);
    };

    updateSmartTheme();
    const interval = setInterval(updateSmartTheme, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isSmartTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    // Disable smart theme when manually setting
    if (isSmartTheme) {
      setSmartThemeState(false);
      localStorage.setItem('smartTheme', 'false');
    }
  }, [isSmartTheme]);

  const setSmartTheme = useCallback((enabled: boolean) => {
    setSmartThemeState(enabled);
    localStorage.setItem('smartTheme', String(enabled));
  }, []);

  const cycleTheme = useCallback(() => {
    const currentIndex = THEMES.indexOf(theme as typeof THEMES[number]);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    setTheme(THEMES[nextIndex] as Theme);
  }, [theme, setTheme]);

  return {
    theme,
    setTheme,
    isSmartTheme,
    setSmartTheme,
    themes: THEMES,
    cycleTheme,
  };
};

export default useTheme;
