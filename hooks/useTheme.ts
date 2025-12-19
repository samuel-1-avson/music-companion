import { useState, useEffect, useCallback } from 'react';
import { Theme } from '../types';

const THEMES = [
  'minimal', 'material', 'neumorphism', 'glass', 'neobrutalism', 'retro'
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
    defaultTheme = 'minimal', // Use minimal as safe default
    storageKey = 'theme',
    smartThemeEnabled = false
  } = options;

  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(storageKey);
    // Validate saved theme is one of the allowed 6
    if (saved && THEMES.includes(saved as any)) {
        return saved as Theme;
    }
    return defaultTheme;
  });
  
  const [isSmartTheme, setSmartThemeState] = useState(() => {
    return localStorage.getItem('smartTheme') === 'true';
  });

  // Apply theme to document
  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem(storageKey, theme);
  }, [theme, storageKey]);

  // Smart theme based on time of day (Fallback if no music / specific context)
  useEffect(() => {
    if (!isSmartTheme) return;

    const updateSmartTheme = () => {
      // Logic handled primarily in App.tsx based on music, this is just a backup
      // But we can set a baseline here
      const hour = new Date().getHours();
      let smartTheme: Theme;
      
      if (hour >= 6 && hour < 18) {
        smartTheme = 'material'; // Bright, active day
      } else {
        smartTheme = 'glass'; // Dark, sleek night
      }
      
      // Only set if we don't have a more specific override from App.tsx (which runs more often)
      // Actually, relying on App.tsx is better to avoid fighting. 
      // We will leave this hook simple and let App.tsx drive the "Smart" decisions.
    };

    // updateSmartTheme(); 
    // const interval = setInterval(updateSmartTheme, 60000); 
    // return () => clearInterval(interval);
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
