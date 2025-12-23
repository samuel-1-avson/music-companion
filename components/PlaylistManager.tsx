import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';

interface Playlist {
  id: string;
  name: string;
  songs: Song[];
  createdAt: number;
  updatedAt: number;
  coverUrl?: string;
}

interface PlaylistManagerProps {
  onPlayPlaylist: (songs: Song[]) => void;
  onAddToQueue: (songs: Song[]) => void;
  currentSong?: Song | null;
}

const STORAGE_KEY = 'music_companion_playlists';

const PlaylistManager: React.FC<PlaylistManagerProps> = ({
  onPlayPlaylist,
  onAddToQueue,
  currentSong,
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Load playlists from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setPlaylists(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse playlists:', e);
      }
    }
  }, []);

  // Save playlists to localStorage
  const savePlaylists = (updated: Playlist[]) => {
    setPlaylists(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const createPlaylist = () => {
    if (!newPlaylistName.trim()) return;

    const newPlaylist: Playlist = {
      id: `pl_${Date.now()}`,
      name: newPlaylistName.trim(),
      songs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    savePlaylists([...playlists, newPlaylist]);
    setNewPlaylistName('');
    setIsCreating(false);
  };

  const deletePlaylist = (id: string) => {
    if (!confirm('Delete this playlist?')) return;
    savePlaylists(playlists.filter(p => p.id !== id));
    if (selectedPlaylist?.id === id) {
      setSelectedPlaylist(null);
    }
  };

  const renamePlaylist = (id: string) => {
    if (!editName.trim()) return;
    savePlaylists(playlists.map(p => 
      p.id === id ? { ...p, name: editName.trim(), updatedAt: Date.now() } : p
    ));
    setEditingId(null);
    setEditName('');
  };

  const addCurrentSongToPlaylist = (playlistId: string) => {
    if (!currentSong) return;

    savePlaylists(playlists.map(p => {
      if (p.id !== playlistId) return p;
      if (p.songs.some(s => s.id === currentSong.id)) return p; // Already exists
      return {
        ...p,
        songs: [...p.songs, currentSong],
        coverUrl: p.songs.length === 0 ? currentSong.coverUrl : p.coverUrl,
        updatedAt: Date.now(),
      };
    }));
  };

  const removeSongFromPlaylist = (playlistId: string, songId: string) => {
    savePlaylists(playlists.map(p => {
      if (p.id !== playlistId) return p;
      const newSongs = p.songs.filter(s => s.id !== songId);
      return {
        ...p,
        songs: newSongs,
        coverUrl: newSongs.length > 0 ? newSongs[0].coverUrl : undefined,
        updatedAt: Date.now(),
      };
    }));
    
    // Update selected playlist view
    if (selectedPlaylist?.id === playlistId) {
      setSelectedPlaylist(prev => prev ? {
        ...prev,
        songs: prev.songs.filter(s => s.id !== songId)
      } : null);
    }
  };

  const exportPlaylist = (playlist: Playlist) => {
    const data = JSON.stringify(playlist, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playlist.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importPlaylist = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text) as Playlist;
        imported.id = `pl_${Date.now()}`; // Generate new ID
        imported.createdAt = Date.now();
        imported.updatedAt = Date.now();
        savePlaylists([...playlists, imported]);
      } catch (err) {
        console.error('Failed to import playlist:', err);
        alert('Failed to import playlist. Please check the file format.');
      }
    };
    input.click();
  };

  // Playlist detail view
  if (selectedPlaylist) {
    const playlist = playlists.find(p => p.id === selectedPlaylist.id) || selectedPlaylist;
    
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 border-b-2 border-theme bg-[var(--bg-hover)]">
          <button
            onClick={() => setSelectedPlaylist(null)}
            className="p-2 hover:bg-[var(--bg-main)] rounded"
          >
            <ICONS.SkipBack size={18} />
          </button>
          
          <img 
            src={playlist.coverUrl || 'https://via.placeholder.com/60'} 
            alt="" 
            className="w-16 h-16 object-cover border-2 border-theme"
          />
          
          <div className="flex-1">
            <h2 className="font-mono font-bold text-lg">{playlist.name}</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {playlist.songs.length} songs
            </p>
          </div>
          
          <button
            onClick={() => onPlayPlaylist(playlist.songs)}
            disabled={playlist.songs.length === 0}
            className="px-4 py-2 bg-[var(--primary)] text-black font-mono font-bold disabled:opacity-50"
          >
            <ICONS.Play size={16} className="inline mr-2" />
            Play All
          </button>
          
          <button
            onClick={() => onAddToQueue(playlist.songs)}
            disabled={playlist.songs.length === 0}
            className="p-2 hover:bg-[var(--bg-main)] rounded"
            title="Add to Queue"
          >
            <ICONS.ListMusic size={18} />
          </button>
        </div>

        {/* Songs */}
        <div className="flex-1 overflow-y-auto p-2">
          {playlist.songs.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <ICONS.Music size={32} className="mx-auto mb-4" />
              <p className="font-mono">No songs in this playlist</p>
              <p className="text-sm mt-2">Add songs while playing music</p>
            </div>
          ) : (
            <div className="space-y-1">
              {playlist.songs.map((song, idx) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 p-2 hover:bg-[var(--bg-hover)] rounded group"
                >
                  <span className="w-6 text-center text-sm text-[var(--text-muted)]">
                    {idx + 1}
                  </span>
                  <img 
                    src={song.coverUrl} 
                    alt="" 
                    className="w-10 h-10 object-cover border border-theme"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm truncate">{song.title}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{song.artist}</p>
                  </div>
                  <button
                    onClick={() => removeSongFromPlaylist(playlist.id, song.id)}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded"
                    title="Remove"
                  >
                    <ICONS.X size={14} className="text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Playlists list view
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-theme bg-[var(--bg-hover)]">
        <h3 className="font-mono font-bold uppercase flex items-center gap-2">
          <ICONS.ListMusic size={18} />
          Playlists
        </h3>
        <div className="flex gap-2">
          <button
            onClick={importPlaylist}
            className="p-2 hover:bg-[var(--bg-main)] rounded"
            title="Import Playlist"
          >
            <ICONS.ArrowDown size={16} />
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="px-3 py-1 bg-[var(--primary)] text-black font-mono font-bold text-sm"
          >
            + New
          </button>
        </div>
      </div>

      {/* Create new playlist form */}
      {isCreating && (
        <div className="p-3 border-b border-theme bg-[var(--bg-hover)]">
          <div className="flex gap-2">
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name..."
              className="flex-1 px-3 py-2 bg-[var(--bg-main)] border-2 border-theme font-mono text-sm"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && createPlaylist()}
            />
            <button
              onClick={createPlaylist}
              className="px-3 py-2 bg-[var(--primary)] text-black font-mono text-sm"
            >
              Create
            </button>
            <button
              onClick={() => { setIsCreating(false); setNewPlaylistName(''); }}
              className="p-2 hover:bg-[var(--bg-main)] rounded"
            >
              <ICONS.X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Add current song section */}
      {currentSong && playlists.length > 0 && (
        <div className="p-3 border-b border-theme bg-[var(--primary)]/10">
          <p className="text-xs font-mono text-[var(--text-muted)] mb-2">
            Add current song to:
          </p>
          <div className="flex flex-wrap gap-2">
            {playlists.map(p => (
              <button
                key={p.id}
                onClick={() => addCurrentSongToPlaylist(p.id)}
                className="px-3 py-1 border-2 border-theme bg-[var(--bg-main)] hover:bg-[var(--bg-hover)] font-mono text-xs"
              >
                + {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Playlists grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {playlists.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <ICONS.ListMusic size={48} className="mx-auto mb-4" />
            <p className="font-mono">No playlists yet</p>
            <p className="text-sm mt-2">Create your first playlist to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {playlists.map(playlist => (
              <div
                key={playlist.id}
                className="border-2 border-theme hover:border-[var(--primary)] transition-colors cursor-pointer group"
              >
                <div 
                  onClick={() => setSelectedPlaylist(playlist)}
                  className="aspect-square relative"
                >
                  {playlist.coverUrl ? (
                    <img 
                      src={playlist.coverUrl} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[var(--bg-hover)] flex items-center justify-center">
                      <ICONS.Music size={32} className="text-[var(--text-muted)]" />
                    </div>
                  )}
                  
                  {/* Play button overlay */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayPlaylist(playlist.songs);
                    }}
                    className="absolute bottom-2 right-2 p-2 bg-[var(--primary)] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ICONS.Play size={16} fill="black" />
                  </button>
                </div>
                
                <div className="p-2 flex items-center justify-between">
                  {editingId === playlist.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => renamePlaylist(playlist.id)}
                      onKeyDown={(e) => e.key === 'Enter' && renamePlaylist(playlist.id)}
                      className="flex-1 px-1 bg-transparent border-b border-[var(--primary)] font-mono text-sm"
                      autoFocus
                    />
                  ) : (
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-bold text-sm truncate">{playlist.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {playlist.songs.length} songs
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(playlist.id);
                        setEditName(playlist.name);
                      }}
                      className="p-1 hover:bg-[var(--bg-hover)] rounded"
                      title="Rename"
                    >
                      <ICONS.Settings size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        exportPlaylist(playlist);
                      }}
                      className="p-1 hover:bg-[var(--bg-hover)] rounded"
                      title="Export"
                    >
                      <ICONS.ArrowUp size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePlaylist(playlist.id);
                      }}
                      className="p-1 hover:bg-red-500/20 rounded"
                      title="Delete"
                    >
                      <ICONS.X size={12} className="text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistManager;
