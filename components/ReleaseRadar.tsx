import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';
import { searchUnified } from '../services/musicService';

interface Release {
  id: string;
  title: string;
  artist: string;
  type: 'single' | 'album' | 'ep';
  releaseDate: string;
  coverUrl: string;
}

interface ReleaseRadarProps {
  favoriteArtists: string[];
  onPlaySong: (song: Song) => void;
  onClose?: () => void;
}

// Simulated new releases (in production, this would come from Spotify/Last.fm API)
const MOCK_RELEASES: Release[] = [
  { id: '1', title: 'New Horizons', artist: 'The Weeknd', type: 'single', releaseDate: '2024-12-15', coverUrl: 'https://picsum.photos/200/200?random=101' },
  { id: '2', title: 'Electric Dreams', artist: 'Dua Lipa', type: 'album', releaseDate: '2024-12-12', coverUrl: 'https://picsum.photos/200/200?random=102' },
  { id: '3', title: 'Midnight Tales', artist: 'Taylor Swift', type: 'ep', releaseDate: '2024-12-10', coverUrl: 'https://picsum.photos/200/200?random=103' },
  { id: '4', title: 'Neon Pulse', artist: 'Daft Punk', type: 'single', releaseDate: '2024-12-08', coverUrl: 'https://picsum.photos/200/200?random=104' },
  { id: '5', title: 'Crystal Waves', artist: 'Billie Eilish', type: 'album', releaseDate: '2024-12-05', coverUrl: 'https://picsum.photos/200/200?random=105' },
];

const ReleaseRadar: React.FC<ReleaseRadarProps> = ({ favoriteArtists, onPlaySong, onClose }) => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'single' | 'album' | 'ep'>('all');

  useEffect(() => {
    loadReleases();
  }, []);

  const loadReleases = async () => {
    setLoading(true);
    // Simulated API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    setReleases(MOCK_RELEASES);
    setLoading(false);
  };

  const handlePlay = async (release: Release) => {
    try {
      const results = await searchUnified('YOUTUBE', `${release.artist} ${release.title}`);
      if (results.length > 0) {
        onPlaySong(results[0]);
      }
    } catch (e) {
      console.error('[ReleaseRadar] Failed to play:', e);
    }
  };

  const filteredReleases = filter === 'all' 
    ? releases 
    : releases.filter(r => r.type === filter);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro">
      {/* Header */}
      <div className="p-4 border-b-2 border-theme bg-gradient-to-r from-purple-500 to-pink-500 flex justify-between items-center">
        <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2 text-white">
          📡 Release Radar
        </h2>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded text-white">
            <ICONS.Close size={16} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-theme flex gap-2">
        {['all', 'single', 'album', 'ep'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-3 py-1 text-xs font-mono font-bold uppercase ${
              filter === f 
                ? 'bg-[var(--primary)] text-black' 
                : 'bg-[var(--bg-hover)] hover:bg-[var(--bg-main)]'
            }`}
          >
            {f === 'ep' ? 'EP' : f}
          </button>
        ))}
      </div>

      {/* Releases */}
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <ICONS.Loader size={24} className="animate-spin text-[var(--primary)]" />
          </div>
        ) : filteredReleases.length > 0 ? (
          filteredReleases.map(release => (
            <div 
              key={release.id}
              className="flex items-center gap-3 p-3 bg-[var(--bg-hover)] border border-theme hover:border-[var(--primary)] transition-colors cursor-pointer group"
              onClick={() => handlePlay(release)}
            >
              <img src={release.coverUrl} className="w-14 h-14 object-cover border border-theme" alt="" />
              <div className="flex-1 min-w-0">
                <p className="font-mono font-bold text-sm truncate">{release.title}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{release.artist}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-1.5 py-0.5 text-[9px] font-mono uppercase ${
                    release.type === 'album' ? 'bg-blue-500 text-white' :
                    release.type === 'ep' ? 'bg-purple-500 text-white' : 'bg-green-500 text-white'
                  }`}>
                    {release.type}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">{formatDate(release.releaseDate)}</span>
                </div>
              </div>
              <ICONS.Play size={20} className="text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <p className="font-mono text-sm">No releases found</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-theme bg-[var(--bg-hover)] text-center">
        <p className="text-[10px] font-mono text-[var(--text-muted)]">
          New releases from your favorite artists • Updated daily
        </p>
      </div>
    </div>
  );
};

export default ReleaseRadar;
