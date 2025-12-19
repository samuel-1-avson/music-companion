import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';
import { generateRadioStation } from '../services/geminiService';

interface RadioStationProps {
  currentSong: Song | null;
  queue: Song[];
  onPlaySong: (song: Song) => void;
  onAddToQueue: (songs: Song[]) => void;
  onClose: () => void;
}

// Station presets
const STATION_PRESETS = [
  { id: 'chill', name: 'Chill Vibes', icon: '🌊', seed: { type: 'mood' as const, value: 'relaxing, calm, peaceful' } },
  { id: 'energy', name: 'High Energy', icon: '⚡', seed: { type: 'mood' as const, value: 'energetic, upbeat, powerful' } },
  { id: 'focus', name: 'Deep Focus', icon: '🎯', seed: { type: 'mood' as const, value: 'ambient, instrumental, concentration' } },
  { id: 'throwback', name: 'Throwback', icon: '📼', seed: { type: 'mood' as const, value: '80s, 90s, nostalgic classics' } },
  { id: 'discover', name: 'Discovery', icon: '🔮', seed: { type: 'mood' as const, value: 'eclectic, indie, hidden gems' } },
];

const RadioStation: React.FC<RadioStationProps> = ({
  currentSong,
  queue,
  onPlaySong,
  onAddToQueue,
  onClose
}) => {
  const [activeStation, setActiveStation] = useState<string | null>(null);
  const [customSeed, setCustomSeed] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stationSongs, setStationSongs] = useState<Song[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate more songs when station is active and queue runs low
  useEffect(() => {
    if (activeStation && queue.length < 3 && !isLoading) {
      generateMoreSongs();
    }
  }, [queue.length, activeStation]);

  const startStation = async (preset: typeof STATION_PRESETS[0]) => {
    setIsLoading(true);
    setError(null);
    setActiveStation(preset.id);
    
    try {
      const songs = await generateRadioStation(preset.seed, queue, 5);
      if (songs.length > 0) {
        setStationSongs(songs);
        onAddToQueue(songs);
        if (!currentSong) {
          onPlaySong(songs[0]);
        }
      } else {
        setError('Failed to generate station. Try again.');
      }
    } catch (e) {
      setError('Station generation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const startCustomStation = async () => {
    if (!customSeed.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setActiveStation('custom');
    
    const isArtist = !customSeed.includes(' ') || customSeed.toLowerCase().includes('artist');
    const seed = {
      type: isArtist ? 'artist' as const : 'song' as const,
      value: customSeed
    };
    
    try {
      const songs = await generateRadioStation(seed, queue, 5);
      if (songs.length > 0) {
        setStationSongs(songs);
        onAddToQueue(songs);
        if (!currentSong) {
          onPlaySong(songs[0]);
        }
      } else {
        setError('No songs found. Try a different seed.');
      }
    } catch (e) {
      setError('Generation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateMoreSongs = async () => {
    if (isLoading || !activeStation) return;
    
    setIsLoading(true);
    const preset = STATION_PRESETS.find(p => p.id === activeStation);
    const seed = preset?.seed || { type: 'mood' as const, value: customSeed };
    
    try {
      const moreSongs = await generateRadioStation(seed, [...queue, ...stationSongs], 5);
      if (moreSongs.length > 0) {
        setStationSongs(prev => [...prev, ...moreSongs]);
        onAddToQueue(moreSongs);
      }
    } catch (e) {
      // Silent fail for auto-generation
    } finally {
      setIsLoading(false);
    }
  };

  const stopStation = () => {
    setActiveStation(null);
    setStationSongs([]);
  };

  return (
    <div className="fixed bottom-24 left-4 md:left-auto md:right-[420px] w-80 bg-[var(--bg-card)] border-2 border-theme shadow-retro z-40 animate-in slide-in-from-left-4 duration-300">
      {/* Header */}
      <div className="p-3 border-b-2 border-theme bg-[var(--bg-hover)] flex justify-between items-center">
        <h3 className="font-mono font-bold text-sm uppercase flex items-center gap-2 text-[var(--text-main)]">
          <ICONS.Radio size={16} /> Radio Stations
        </h3>
        <button onClick={onClose} className="hover:text-red-500">
          <ICONS.Close size={16} />
        </button>
      </div>

      {/* Active Station Banner */}
      {activeStation && (
        <div className="p-3 bg-[var(--primary)] text-black flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase">
              {activeStation === 'custom' ? `📻 ${customSeed}` : 
               STATION_PRESETS.find(p => p.id === activeStation)?.icon + ' ' +
               STATION_PRESETS.find(p => p.id === activeStation)?.name}
            </span>
          </div>
          <button 
            onClick={stopStation}
            className="text-[10px] font-mono font-bold px-2 py-1 bg-black text-white hover:bg-red-500"
          >
            STOP
          </button>
        </div>
      )}

      {/* Station Presets */}
      <div className="p-3 space-y-2">
        <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Quick Start</p>
        <div className="grid grid-cols-2 gap-2">
          {STATION_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => startStation(preset)}
              disabled={isLoading}
              className={`p-2 border border-theme text-xs font-mono font-bold flex items-center gap-2 transition-all hover:bg-[var(--bg-hover)] ${
                activeStation === preset.id ? 'bg-[var(--primary)] text-black border-black' : ''
              }`}
            >
              <span>{preset.icon}</span>
              <span className="truncate">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Station */}
      <div className="p-3 border-t border-theme">
        <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase mb-2">Create Station</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={customSeed}
            onChange={(e) => setCustomSeed(e.target.value)}
            placeholder="Artist, song, or mood..."
            className="flex-1 px-2 py-1 border border-theme bg-[var(--bg-main)] text-xs font-mono focus:outline-none focus:border-[var(--primary)]"
            onKeyDown={(e) => e.key === 'Enter' && startCustomStation()}
          />
          <button
            onClick={startCustomStation}
            disabled={isLoading || !customSeed.trim()}
            className="px-3 bg-black text-white text-xs font-bold disabled:opacity-50"
          >
            {isLoading ? <ICONS.Loader size={12} className="animate-spin" /> : 'GO'}
          </button>
        </div>
      </div>

      {/* Station Songs */}
      {stationSongs.length > 0 && (
        <div className="p-3 border-t border-theme max-h-40 overflow-y-auto">
          <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase mb-2">
            Generated ({stationSongs.length} tracks)
          </p>
          <div className="space-y-1">
            {stationSongs.slice(-5).map((song, i) => (
              <div 
                key={song.id + i}
                onClick={() => onPlaySong(song)}
                className="flex items-center gap-2 p-1 hover:bg-[var(--bg-hover)] cursor-pointer rounded"
              >
                <img src={song.coverUrl} className="w-6 h-6 object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold truncate">{song.title}</p>
                  <p className="text-[9px] text-[var(--text-muted)] truncate">{song.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-2 bg-red-100 text-red-600 text-[10px] font-mono text-center">
          {error}
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="p-2 flex items-center justify-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
          <ICONS.Loader size={12} className="animate-spin" />
          Generating station...
        </div>
      )}
    </div>
  );
};

export default RadioStation;
