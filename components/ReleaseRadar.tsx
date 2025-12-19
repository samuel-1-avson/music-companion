import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';
import { searchUnified } from '../services/musicService';
import { useAuth } from '../contexts/AuthContext';

interface Release {
  id: string;
  title: string;
  artist: string;
  type: 'single' | 'album' | 'compilation';
  releaseDate: string;
  coverUrl: string;
  spotifyUri?: string;
  totalTracks: number;
}

interface ReleaseRadarProps {
  favoriteArtists: string[];
  onPlaySong: (song: Song) => void;
  onClose?: () => void;
}

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

const ReleaseRadar: React.FC<ReleaseRadarProps> = ({ favoriteArtists, onPlaySong, onClose }) => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'single' | 'album' | 'compilation'>('all');
  
  const { spotifyTokens, hasSpotifyAccess, signInWithSpotify } = useAuth();

  useEffect(() => {
    if (hasSpotifyAccess && spotifyTokens?.accessToken) {
      loadReleases();
    } else {
      setLoading(false);
    }
  }, [hasSpotifyAccess, spotifyTokens?.accessToken]);

  const loadReleases = async () => {
    if (!spotifyTokens?.accessToken) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch new releases from Spotify
      const response = await fetch(`${SPOTIFY_API_BASE}/browse/new-releases?limit=20&country=US`, {
        headers: { Authorization: `Bearer ${spotifyTokens.accessToken}` }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Session expired. Please reconnect Spotify.');
        } else {
          setError('Failed to load releases');
        }
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      const albums = data.albums?.items || [];
      
      const mappedReleases: Release[] = albums.map((album: any) => ({
        id: album.id,
        title: album.name,
        artist: album.artists.map((a: any) => a.name).join(', '),
        type: album.album_type === 'single' ? 'single' : album.album_type === 'compilation' ? 'compilation' : 'album',
        releaseDate: album.release_date,
        coverUrl: album.images[0]?.url || '',
        spotifyUri: album.uri,
        totalTracks: album.total_tracks,
      }));
      
      setReleases(mappedReleases);
    } catch (e) {
      console.error('[ReleaseRadar] Error loading releases:', e);
      setError('Failed to fetch new releases');
    } finally {
      setLoading(false);
    }
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
        <div className="flex items-center gap-2">
          <button onClick={loadReleases} disabled={loading || !hasSpotifyAccess} className="p-1 hover:bg-white/20 rounded text-white disabled:opacity-50">
            <ICONS.Loader size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded text-white">
              <ICONS.Close size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Not Connected State */}
      {!hasSpotifyAccess ? (
        <div className="p-8 text-center">
          <ICONS.Music size={40} className="mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
          <p className="text-sm text-[var(--text-muted)] mb-4">Connect Spotify to see new releases</p>
          <button 
            onClick={() => signInWithSpotify()}
            className="px-4 py-2 bg-green-500 text-white font-bold text-sm rounded hover:bg-green-600 transition-colors"
          >
            Connect Spotify
          </button>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="p-3 border-b border-theme flex gap-2">
            {(['all', 'single', 'album', 'compilation'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-mono font-bold uppercase ${
                  filter === f 
                    ? 'bg-[var(--primary)] text-black' 
                    : 'bg-[var(--bg-hover)] hover:bg-[var(--bg-main)]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Releases */}
          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <ICONS.Loader size={24} className="animate-spin text-[var(--primary)]" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                <p className="font-mono text-sm">{error}</p>
                <button onClick={loadReleases} className="mt-2 text-xs underline">Try again</button>
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
                        release.type === 'compilation' ? 'bg-purple-500 text-white' : 'bg-green-500 text-white'
                      }`}>
                        {release.type}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">{formatDate(release.releaseDate)}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{release.totalTracks} tracks</span>
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
        </>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-theme bg-[var(--bg-hover)] text-center">
        <p className="text-[10px] font-mono text-[var(--text-muted)]">
          {hasSpotifyAccess ? 'New releases from Spotify • Real-time data' : 'Connect Spotify to see new releases'}
        </p>
      </div>
    </div>
  );
};

export default ReleaseRadar;

