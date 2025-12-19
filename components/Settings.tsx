
import React from 'react';
import { ICONS } from '../constants';
import { Theme } from '../types';
import { useTranslation, Language, languageNames } from '../i18n';

interface SettingsProps {
  currentTheme: Theme;
  onSetTheme: (t: Theme) => void;
  isSmartTheme: boolean;
  onToggleSmartTheme: () => void;
  crossfadeDuration: number;
  onSetCrossfadeDuration: (d: number) => void;
}


const Settings: React.FC<SettingsProps> = ({ 
    currentTheme, 
    onSetTheme,
    isSmartTheme,
    onToggleSmartTheme,
    crossfadeDuration,
    onSetCrossfadeDuration
}) => {

  // i18n
  const { language, setLanguage, t } = useTranslation();
  

  const themes: { id: Theme; label: string; bg: string; color: string; tags: string[] }[] = [
      { id: 'minimal', label: 'Minimal', bg: '#ffffff', color: '#18181b', tags: ['Focus', 'Clean'] },
      { id: 'classic', label: 'Classic', bg: '#fcfbf9', color: '#fb923c', tags: ['Retro', 'Light'] },
      { id: 'solar', label: 'Solar', bg: '#fff7ed', color: '#f97316', tags: ['Warm', 'Energy'] },
      { id: 'forest', label: 'Forest', bg: '#f0fdf4', color: '#4ade80', tags: ['Nature', 'Fresh'] },
      { id: 'glacier', label: 'Glacier', bg: '#f0f9ff', color: '#38bdf8', tags: ['Cool', 'Calm'] },
      { id: 'lavender', label: 'Lavender', bg: '#faf5ff', color: '#d8b4fe', tags: ['Soft', 'Creative'] },
      { id: 'sakura', label: 'Sakura', bg: '#fff1f2', color: '#fb7185', tags: ['Pink', 'Gentle'] },
      { id: 'cyber', label: 'Cyber', bg: '#09090b', color: '#22d3ee', tags: ['Dark', 'Tech'] },
      { id: 'midnight', label: 'Midnight', bg: '#0f172a', color: '#38bdf8', tags: ['Deep', 'Blue'] },
      { id: 'obsidian', label: 'Obsidian', bg: '#050505', color: '#ffffff', tags: ['OLED', 'Focus'] },
      { id: 'matrix', label: 'Matrix', bg: '#000000', color: '#00ff41', tags: ['Hacker', 'Green'] },
      { id: 'terminal', label: 'Terminal', bg: '#0c0c0c', color: '#10b981', tags: ['Code', 'Mono'] },
      { id: 'synthwave', label: 'Synthwave', bg: '#2e022d', color: '#f0abfc', tags: ['Neon', 'Vibe'] },
      { id: 'nebula', label: 'Nebula', bg: '#1e1b4b', color: '#f472b6', tags: ['Space', 'Dream'] },
      { id: 'oceanic', label: 'Oceanic', bg: '#042f2e', color: '#2dd4bf', tags: ['Teal', 'Deep'] },
      { id: 'ember', label: 'Ember', bg: '#1c1917', color: '#ef4444', tags: ['Intense', 'Red'] },
      { id: 'sunset', label: 'Sunset', bg: '#4a0d0d', color: '#fbbf24', tags: ['Warm', 'Dark'] },
  ];

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-12 pb-32 animate-in slide-in-from-bottom-4">
      
      {/* Header */}
      <div className="flex items-end justify-between border-b-4 border-theme pb-4">
        <div>
            <h2 className="text-4xl font-bold text-[var(--text-main)] mb-2 font-mono">SETTINGS</h2>
            <p className="text-[var(--text-muted)] font-mono">SYSTEM_CONFIGURATION_&_PREFERENCES</p>
        </div>
        <div className="text-[10px] font-mono text-[var(--text-muted)] text-right">
            <p>BUILD_VER: 2.5.0</p>
            <p>STATUS: OPTIMAL</p>
        </div>
      </div>
      
      {/* Smart Theme Toggle */}
      <div className="bg-[var(--bg-card)] border-2 border-theme p-8 shadow-retro flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-start gap-4">
              <div className={`p-3 border-2 border-theme ${isSmartTheme ? 'bg-[var(--primary)] text-black' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'}`}>
                  <ICONS.Cpu size={32} />
              </div>
              <div>
                  <h3 className="text-xl font-bold font-mono text-[var(--text-main)] uppercase">Smart Adaptation</h3>
                  <p className="text-xs text-[var(--text-muted)] font-mono mt-1 max-w-md leading-relaxed">
                      Enable the AI to automatically switch UI themes based on your current activity (Arcade, Lab, Focus) and the mood of the music playing.
                  </p>
              </div>
          </div>
          <button 
            onClick={onToggleSmartTheme}
            className={`
                relative w-20 h-10 border-2 border-theme transition-colors duration-300
                ${isSmartTheme ? 'bg-[var(--primary)]' : 'bg-[var(--bg-hover)]'}
            `}
          >
              <div className={`
                  absolute top-1 bottom-1 w-7 bg-white border-2 border-black transition-transform duration-300
                  ${isSmartTheme ? 'left-[calc(100%-2rem-4px)]' : 'left-1'}
              `}></div>
          </button>
      </div>

      {/* Appearance Section */}
      <div>
          <div className="flex items-center gap-2 mb-6">
              <ICONS.Eye className="text-[var(--primary)]" size={20} />
              <h3 className="text-lg font-bold font-mono uppercase text-[var(--text-main)]">Visual Interface</h3>
          </div>
          
          <div className={`bg-[var(--bg-card)] border-2 border-theme p-8 shadow-retro transition-opacity duration-300 ${isSmartTheme ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              {isSmartTheme && (
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                      <div className="bg-black/80 text-white px-6 py-3 font-mono font-bold text-sm uppercase backdrop-blur-sm border-2 border-white shadow-xl">
                          Smart Mode Active
                      </div>
                  </div>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {themes.map(t => {
                      const isDark = ['cyber', 'midnight', 'matrix', 'synthwave', 'obsidian', 'nebula', 'oceanic', 'terminal', 'ember', 'sunset'].includes(t.id);
                      const isActive = currentTheme === t.id;
                      
                      return (
                          <button
                            key={t.id}
                            onClick={() => onSetTheme(t.id)}
                            className={`
                                relative p-4 border-2 transition-all group overflow-hidden flex flex-col justify-between h-32
                                ${isActive 
                                    ? 'border-theme ring-2 ring-[var(--primary)] shadow-retro-sm scale-[1.02]' 
                                    : 'border-transparent hover:border-theme hover:shadow-sm bg-[var(--bg-hover)]'
                                }
                            `}
                            style={{ backgroundColor: isActive ? t.bg : undefined }}
                          >
                              <div className="flex justify-between items-start w-full relative z-10">
                                  <div className="w-6 h-6 rounded-full border border-black shadow-sm" style={{ backgroundColor: t.color }}></div>
                                  {isActive && <ICONS.CheckCircle size={16} className={isDark ? 'text-white' : 'text-black'} />}
                              </div>
                              
                              <div className="relative z-10 text-left">
                                  <span className={`font-bold font-mono text-xs uppercase block ${isActive && isDark ? 'text-white' : 'text-[var(--text-main)]'}`}>
                                      {t.label}
                                  </span>
                                  <span className={`text-[9px] font-mono opacity-60 ${isActive && isDark ? 'text-gray-300' : 'text-[var(--text-muted)]'}`}>
                                      {t.tags.join(' / ')}
                                  </span>
                              </div>
                          </button>
                      );
                  })}
              </div>
          </div>
      </div>

      {/* Crossfade Section */}
      <div>
          <div className="flex items-center gap-2 mb-6">
              <ICONS.Music className="text-[var(--primary)]" size={20} />
              <h3 className="text-lg font-bold font-mono uppercase text-[var(--text-main)]">Crossfade</h3>
          </div>
          
          <div className="bg-[var(--bg-card)] border-2 border-theme p-8 shadow-retro">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1">
                      <p className="text-sm font-mono text-[var(--text-muted)] mb-4">
                          Smoothly blend between songs for seamless transitions. Set to 0 for instant transitions.
                      </p>
                      <div className="flex items-center gap-4">
                          <span className="text-xs font-mono text-[var(--text-muted)] w-8">0s</span>
                          <input
                            type="range"
                            min="0"
                            max="12"
                            step="1"
                            value={crossfadeDuration}
                            onChange={(e) => onSetCrossfadeDuration(Number(e.target.value))}
                            className="flex-1 h-2 bg-[var(--bg-hover)] rounded-full appearance-none cursor-pointer accent-[var(--primary)]"
                          />
                          <span className="text-xs font-mono text-[var(--text-muted)] w-8">12s</span>
                      </div>
                  </div>
                  <div className="flex flex-col items-center justify-center min-w-[100px]">
                      <div className="text-4xl font-bold font-mono text-[var(--primary)]">
                          {crossfadeDuration}s
                      </div>
                      <span className="text-xs font-mono text-[var(--text-muted)] uppercase">Duration</span>
                  </div>
              </div>
          </div>
      </div>

      {/* Language Section */}
      <div>
          <div className="flex items-center gap-2 mb-6">
              <ICONS.Globe className="text-[var(--primary)]" size={20} />
              <h3 className="text-lg font-bold font-mono uppercase text-[var(--text-main)]">{t.language}</h3>
          </div>
          
          <div className="bg-[var(--bg-card)] border-2 border-theme p-8 shadow-retro">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1">
                      <p className="text-sm font-mono text-[var(--text-muted)] mb-4">
                          Select your preferred language for the interface.
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          {(Object.keys(languageNames) as Language[]).map((lang) => (
                              <button
                                key={lang}
                                onClick={() => setLanguage(lang)}
                                className={`p-3 border-2 transition-all text-center ${
                                  language === lang 
                                    ? 'border-[var(--primary)] bg-[var(--primary)] text-black' 
                                    : 'border-theme hover:border-[var(--primary)] bg-[var(--bg-hover)]'
                                }`}
                              >
                                <span className="text-lg block mb-1">
                                  {lang === 'en' ? '🇺🇸' : lang === 'es' ? '🇪🇸' : lang === 'fr' ? '🇫🇷' : lang === 'de' ? '🇩🇪' : '🇯🇵'}
                                </span>
                                <span className="text-xs font-mono font-bold uppercase">{languageNames[lang]}</span>
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* System Section */}
      <div>


         <div className="flex items-center gap-2 mb-6">
              <ICONS.HardDrive className="text-[var(--primary)]" size={20} />
              <h3 className="text-lg font-bold font-mono uppercase text-[var(--text-main)]">System Data</h3>
         </div>

         <div className="bg-[var(--bg-card)] border-2 border-theme p-8 shadow-retro flex flex-col md:flex-row gap-8">
             <div className="flex-1 space-y-4">
                 <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)]">LOCAL_CACHE</span>
                    <span className="text-xs font-mono text-[var(--text-main)]">Active</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)]">API_LATENCY</span>
                    <span className="text-xs font-mono text-[var(--text-main)]">24ms</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)]">VOICE_ENGINE</span>
                    <span className="text-xs font-mono text-[var(--text-main)]">Gemini Live</span>
                 </div>
             </div>
             
             <div className="flex flex-col justify-end">
                <button 
                    onClick={() => { localStorage.clear(); window.location.reload(); }}
                    className="bg-red-50 text-red-600 px-6 py-3 font-bold font-mono text-xs border-2 border-red-100 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors uppercase flex items-center gap-2"
                >
                    <ICONS.Trash size={16} /> Factory Reset
                </button>
                <p className="text-[9px] text-gray-400 mt-2 text-center">Clears all settings, history, and offline data.</p>
             </div>
         </div>
      </div>

    </div>
  );
};

export default Settings;
