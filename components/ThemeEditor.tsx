/**
 * ThemeEditor - Component for creating and customizing themes
 * 
 * Features:
 * - Color pickers for CSS variables
 * - Live preview
 * - Save custom themes
 * - Export/import themes
 */
import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { Theme } from '../types';

interface CustomTheme {
  id: string;
  name: string;
  baseTheme: Theme;
  colors: {
    primary: string;
    primaryHover: string;
    bgMain: string;
    bgCard: string;
    bgHover: string;
    textMain: string;
    textMuted: string;
    accent: string;
  };
  createdAt: number;
}

interface ThemeEditorProps {
  currentTheme: Theme;
  onApplyTheme: (theme: Theme) => void;
  onClose?: () => void;
}

// Default color palettes for each base theme
const DEFAULT_PALETTES: Record<Theme, CustomTheme['colors']> = {
  minimal: {
    primary: '#000000',
    primaryHover: '#333333',
    bgMain: '#ffffff',
    bgCard: '#f8f8f8',
    bgHover: '#f0f0f0',
    textMain: '#111111',
    textMuted: '#666666',
    accent: '#0066cc',
  },
  material: {
    primary: '#6200ee',
    primaryHover: '#7c4dff',
    bgMain: '#ffffff',
    bgCard: '#f5f5f5',
    bgHover: '#eeeeee',
    textMain: '#212121',
    textMuted: '#757575',
    accent: '#03dac6',
  },
  neumorphism: {
    primary: '#6d5dfc',
    primaryHover: '#8b7eff',
    bgMain: '#e0e0e0',
    bgCard: '#e0e0e0',
    bgHover: '#d0d0d0',
    textMain: '#333333',
    textMuted: '#888888',
    accent: '#ff6b6b',
  },
  glass: {
    primary: '#00d9ff',
    primaryHover: '#00b8d9',
    bgMain: 'rgba(0, 0, 0, 0.8)',
    bgCard: 'rgba(255, 255, 255, 0.1)',
    bgHover: 'rgba(255, 255, 255, 0.15)',
    textMain: '#ffffff',
    textMuted: 'rgba(255, 255, 255, 0.6)',
    accent: '#ff00ff',
  },
  neobrutalism: {
    primary: '#ffdd00',
    primaryHover: '#ffee00',
    bgMain: '#ffffff',
    bgCard: '#ffffff',
    bgHover: '#f0f0f0',
    textMain: '#000000',
    textMuted: '#444444',
    accent: '#ff3366',
  },
  retro: {
    primary: '#00ff00',
    primaryHover: '#00cc00',
    bgMain: '#0a0a0a',
    bgCard: '#1a1a1a',
    bgHover: '#252525',
    textMain: '#00ff00',
    textMuted: '#008800',
    accent: '#ff00ff',
  },
};

const STORAGE_KEY = 'custom_themes';

const ThemeEditor: React.FC<ThemeEditorProps> = ({ currentTheme, onApplyTheme, onClose }) => {
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null);
  const [name, setName] = useState('My Custom Theme');
  const [baseTheme, setBaseTheme] = useState<Theme>(currentTheme);
  const [colors, setColors] = useState<CustomTheme['colors']>(DEFAULT_PALETTES[currentTheme]);
  const [showPreview, setShowPreview] = useState(true);

  // Load saved themes
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setCustomThemes(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load custom themes');
      }
    }
  }, []);

  // Apply preview colors
  useEffect(() => {
    if (showPreview) {
      applyColors(colors);
    }
    return () => {
      // Reset to base theme on unmount
      document.body.dataset.theme = currentTheme;
    };
  }, [colors, showPreview]);

  const applyColors = (c: CustomTheme['colors']) => {
    const root = document.documentElement;
    root.style.setProperty('--primary', c.primary);
    root.style.setProperty('--primary-hover', c.primaryHover);
    root.style.setProperty('--bg-main', c.bgMain);
    root.style.setProperty('--bg-card', c.bgCard);
    root.style.setProperty('--bg-hover', c.bgHover);
    root.style.setProperty('--text-main', c.textMain);
    root.style.setProperty('--text-muted', c.textMuted);
    root.style.setProperty('--accent', c.accent);
  };

  const handleBaseThemeChange = (theme: Theme) => {
    setBaseTheme(theme);
    setColors(DEFAULT_PALETTES[theme]);
  };

  const handleColorChange = (key: keyof CustomTheme['colors'], value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const saveTheme = () => {
    const theme: CustomTheme = {
      id: editingTheme?.id || `custom_${Date.now()}`,
      name,
      baseTheme,
      colors,
      createdAt: editingTheme?.createdAt || Date.now(),
    };

    const updated = editingTheme
      ? customThemes.map(t => t.id === editingTheme.id ? theme : t)
      : [...customThemes, theme];

    setCustomThemes(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setEditingTheme(null);
  };

  const deleteTheme = (id: string) => {
    const updated = customThemes.filter(t => t.id !== id);
    setCustomThemes(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const loadTheme = (theme: CustomTheme) => {
    setEditingTheme(theme);
    setName(theme.name);
    setBaseTheme(theme.baseTheme);
    setColors(theme.colors);
  };

  const applyCustomTheme = (theme: CustomTheme) => {
    document.body.dataset.theme = theme.baseTheme;
    applyColors(theme.colors);
  };

  const exportTheme = () => {
    const data = JSON.stringify({ name, baseTheme, colors }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.name && data.colors) {
          setName(data.name);
          setBaseTheme(data.baseTheme || 'minimal');
          setColors(data.colors);
        }
      } catch (err) {
        console.error('Invalid theme file');
      }
    };
    reader.readAsText(file);
  };

  const colorFields: { key: keyof CustomTheme['colors']; label: string }[] = [
    { key: 'primary', label: 'Primary' },
    { key: 'primaryHover', label: 'Primary Hover' },
    { key: 'bgMain', label: 'Background' },
    { key: 'bgCard', label: 'Card Background' },
    { key: 'bgHover', label: 'Hover Background' },
    { key: 'textMain', label: 'Text' },
    { key: 'textMuted', label: 'Muted Text' },
    { key: 'accent', label: 'Accent' },
  ];

  return (
    <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b-2 border-theme bg-[var(--bg-hover)] flex justify-between items-center sticky top-0 z-10">
        <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2">
          🎨 Theme Editor
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showPreview}
              onChange={e => setShowPreview(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="font-mono">Live Preview</span>
          </label>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-[var(--bg-main)] rounded">
              <ICONS.Close size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Theme Name */}
        <div>
          <label className="text-xs font-mono text-[var(--text-muted)] uppercase block mb-1">Theme Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full p-2 border-2 border-theme bg-[var(--bg-main)] font-mono"
          />
        </div>

        {/* Base Theme */}
        <div>
          <label className="text-xs font-mono text-[var(--text-muted)] uppercase block mb-2">Base Theme</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.keys(DEFAULT_PALETTES).map(theme => (
              <button
                key={theme}
                onClick={() => handleBaseThemeChange(theme as Theme)}
                className={`p-2 font-mono text-sm border-2 capitalize ${
                  baseTheme === theme
                    ? 'bg-[var(--primary)] text-black border-theme'
                    : 'bg-[var(--bg-main)] border-transparent hover:border-theme'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>

        {/* Color Pickers */}
        <div>
          <label className="text-xs font-mono text-[var(--text-muted)] uppercase block mb-2">Colors</label>
          <div className="grid grid-cols-2 gap-3">
            {colorFields.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors[key].startsWith('rgba') ? '#ffffff' : colors[key]}
                  onChange={e => handleColorChange(key, e.target.value)}
                  className="w-10 h-10 border-2 border-theme cursor-pointer"
                  disabled={colors[key].startsWith('rgba')}
                />
                <div className="flex-1">
                  <p className="text-xs font-mono text-[var(--text-muted)]">{label}</p>
                  <input
                    type="text"
                    value={colors[key]}
                    onChange={e => handleColorChange(key, e.target.value)}
                    className="w-full text-xs font-mono p-1 border border-theme bg-[var(--bg-main)]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Import/Export */}
        <div className="flex gap-2">
          <button
            onClick={exportTheme}
            className="flex-1 p-2 border-2 border-theme font-mono text-sm flex items-center justify-center gap-2"
          >
            <ICONS.Download size={16} /> Export
          </button>
          <label className="flex-1 p-2 border-2 border-theme font-mono text-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-[var(--bg-hover)]">
            <ICONS.Upload size={16} /> Import
            <input
              type="file"
              accept=".json"
              onChange={importTheme}
              className="hidden"
            />
          </label>
        </div>

        {/* Save Button */}
        <button
          onClick={saveTheme}
          className="w-full p-3 bg-[var(--primary)] text-black border-2 border-theme font-mono font-bold flex items-center justify-center gap-2"
        >
          <ICONS.Check size={16} />
          {editingTheme ? 'Update Theme' : 'Save Theme'}
        </button>

        {/* Saved Themes */}
        {customThemes.length > 0 && (
          <div>
            <label className="text-xs font-mono text-[var(--text-muted)] uppercase block mb-2">
              Saved Themes ({customThemes.length})
            </label>
            <div className="space-y-2">
              {customThemes.map(theme => (
                <div
                  key={theme.id}
                  className="p-3 border-2 border-theme flex items-center justify-between bg-[var(--bg-main)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[theme.colors.primary, theme.colors.bgMain, theme.colors.accent].map((c, i) => (
                        <div
                          key={i}
                          className="w-4 h-4 border border-theme"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <span className="font-mono text-sm">{theme.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => applyCustomTheme(theme)}
                      className="p-1 hover:bg-[var(--bg-hover)]"
                      title="Apply"
                    >
                      <ICONS.Play size={14} />
                    </button>
                    <button
                      onClick={() => loadTheme(theme)}
                      className="p-1 hover:bg-[var(--bg-hover)]"
                      title="Edit"
                    >
                      <ICONS.Settings size={14} />
                    </button>
                    <button
                      onClick={() => deleteTheme(theme.id)}
                      className="p-1 hover:bg-[var(--bg-hover)] text-red-500"
                      title="Delete"
                    >
                      <ICONS.Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThemeEditor;
