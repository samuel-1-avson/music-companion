import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';
import { useCollaborativePlaylists, CollaborativePlaylist, Collaborator } from '../hooks/useCollaborativePlaylists';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface CollaborativePlaylistsProps {
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onClose?: () => void;
}

const CollaborativePlaylists: React.FC<CollaborativePlaylistsProps> = ({ onPlaySong, onClose }) => {
  const { isAuthenticated, user } = useAuth();
  const { 
    playlists, 
    isLoading, 
    error,
    isRealtimeConnected,
    createPlaylist, 
    joinPlaylist, 
    addSong,
    removeSong,
    deletePlaylist,
    refresh 
  } = useCollaborativePlaylists();
  
  const { success, error: showError } = useToast();
  
  const [selectedPlaylist, setSelectedPlaylist] = useState<CollaborativePlaylist | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Update selected playlist when playlists change
  useEffect(() => {
    if (selectedPlaylist) {
      const updated = playlists.find(p => p.id === selectedPlaylist.id);
      if (updated) {
        setSelectedPlaylist(updated);
      }
    }
  }, [playlists]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    
    setActionLoading(true);
    setActionError(null);
    
    const result = await createPlaylist(newName, newDescription || undefined);
    
    if (result) {
      setNewName('');
      setNewDescription('');
      setShowCreate(false);
      success(`Created "${newName}" playlist!`);
    } else {
      setActionError('Failed to create playlist');
      showError('Failed to create playlist');
    }
    setActionLoading(false);
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    
    setActionLoading(true);
    setActionError(null);
    
    const joined = await joinPlaylist(inviteCode);
    
    if (joined) {
      setInviteCode('');
      setShowInvite(false);
      success('Joined playlist successfully!');
    } else {
      setActionError('Invalid invite code or already a member');
      showError('Failed to join playlist');
    }
    setActionLoading(false);
  };

  const handleDelete = async (playlistId: string) => {
    if (!confirm('Delete this playlist?')) return;
    
    const deleted = await deletePlaylist(playlistId);
    if (deleted) {
      setSelectedPlaylist(null);
      success('Playlist deleted');
    } else {
      showError('Failed to delete playlist');
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    success(`Copied invite code: ${code}`);
  };

  const playAll = (playlist: CollaborativePlaylist) => {
    if (playlist.songs.length > 0) {
      onPlaySong(playlist.songs[0], playlist.songs);
    }
  };

  // Not authenticated message
  if (!isAuthenticated) {
    return (
      <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro h-full flex flex-col">
        <div className="p-4 border-b-2 border-theme bg-gradient-to-r from-indigo-500 to-purple-500 flex justify-between items-center">
          <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2 text-white">
            👥 Collaborative Playlists
          </h2>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded text-white">
              <ICONS.Close size={16} />
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <ICONS.User size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-mono text-[var(--text-muted)] mb-2">Sign in to create collaborative playlists</p>
            <p className="text-xs text-[var(--text-muted)]">Create, join, and share playlists with friends!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b-2 border-theme bg-gradient-to-r from-indigo-500 to-purple-500 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2 text-white">
            👥 Collaborative Playlists
          </h2>
          {/* Live indicator */}
          {isRealtimeConnected && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-400/50 rounded-full">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] text-green-300 font-mono uppercase">Live</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowInvite(true)}
            className="px-3 py-1 bg-white/20 text-white text-xs font-mono hover:bg-white/30 transition-colors"
          >
            Join
          </button>
          <button 
            onClick={() => setShowCreate(true)}
            className="px-3 py-1 bg-white text-black text-xs font-mono font-bold hover:bg-white/90 transition-colors"
          >
            + Create
          </button>
          <button onClick={refresh} className="p-1 hover:bg-white/20 rounded text-white transition-colors" title="Refresh">
            <ICONS.Loader size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded text-white transition-colors">
              <ICONS.Close size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && playlists.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <ICONS.Loader size={32} className="animate-spin opacity-50" />
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <div className="flex-1 flex overflow-hidden">
          {/* Playlist List */}
          <div className={`border-r border-theme overflow-y-auto ${selectedPlaylist ? 'w-1/3' : 'w-full'}`}>
            {playlists.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)]">
                <ICONS.ListMusic size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-mono">No collaborative playlists</p>
                <button 
                  onClick={() => setShowCreate(true)}
                  className="mt-4 text-xs text-[var(--primary)]"
                >
                  Create your first one
                </button>
              </div>
            ) : (
              playlists.map(pl => (
                <div
                  key={pl.id}
                  onClick={() => setSelectedPlaylist(pl)}
                  className={`p-4 border-b border-theme cursor-pointer hover:bg-[var(--bg-hover)] transition-colors ${
                    selectedPlaylist?.id === pl.id ? 'bg-[var(--bg-hover)]' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-mono font-bold">{pl.name}</h3>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {pl.songs.length} songs
                    </span>
                  </div>
                  
                  {/* Collaborator avatars */}
                  <div className="flex items-center gap-1">
                    {pl.collaborators.slice(0, 5).map((c, i) => (
                      <div
                        key={c.id}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 ${
                          c.role === 'owner' ? 'border-yellow-500 bg-yellow-100' :
                          c.online ? 'border-green-500 bg-green-100' : 'border-gray-300 bg-gray-100'
                        } text-gray-800`}
                        style={{ marginLeft: i > 0 ? '-8px' : 0 }}
                        title={`${c.name} (${c.role})`}
                      >
                        {c.avatar ? (
                          <img src={c.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          c.name[0].toUpperCase()
                        )}
                      </div>
                    ))}
                    {pl.collaborators.length > 5 && (
                      <span className="text-[10px] text-[var(--text-muted)] ml-1">
                        +{pl.collaborators.length - 5}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Selected Playlist Detail */}
          {selectedPlaylist && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Playlist Header */}
              <div className="p-4 border-b border-theme bg-[var(--bg-hover)]">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-mono font-bold text-lg">{selectedPlaylist.name}</h3>
                    {selectedPlaylist.description && (
                      <p className="text-xs text-[var(--text-muted)]">{selectedPlaylist.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => playAll(selectedPlaylist)}
                      disabled={selectedPlaylist.songs.length === 0}
                      className="px-4 py-2 bg-[var(--primary)] text-black font-mono font-bold text-xs flex items-center gap-2 disabled:opacity-50"
                    >
                      <ICONS.Play size={14} /> Play All
                    </button>
                    {selectedPlaylist.owner_id === user?.id && (
                      <button
                        onClick={() => handleDelete(selectedPlaylist.id)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded"
                        title="Delete playlist"
                      >
                        <ICONS.Trash size={14} />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Invite Code */}
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-[10px] text-[var(--text-muted)]">Invite:</span>
                  <code className="px-2 py-1 bg-[var(--bg-main)] text-xs font-mono select-all">{selectedPlaylist.invite_code}</code>
                  <button
                    onClick={() => copyInviteCode(selectedPlaylist.invite_code)}
                    className="text-[10px] text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    <ICONS.Copy size={10} /> Copy
                  </button>
                </div>
              </div>

              {/* Song List */}
              <div className="flex-1 overflow-y-auto">
                {selectedPlaylist.songs.length === 0 ? (
                  <div className="p-8 text-center text-[var(--text-muted)]">
                    <p className="text-sm font-mono">No songs yet</p>
                    <p className="text-xs mt-1">Add songs from the search or dashboard!</p>
                  </div>
                ) : (
                  selectedPlaylist.songs.map((song, i) => (
                    <div
                      key={song.id}
                      className="p-3 border-b border-theme hover:bg-[var(--bg-hover)] cursor-pointer flex items-center gap-3 group"
                    >
                      <span className="text-xs text-[var(--text-muted)] w-6">{i + 1}</span>
                      <div 
                        className="flex-1 min-w-0"
                        onClick={() => onPlaySong(song, selectedPlaylist.songs.slice(i))}
                      >
                        <p className="font-mono text-sm truncate">{song.title}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{song.artist}</p>
                      </div>
                      <button
                        onClick={() => onPlaySong(song, selectedPlaylist.songs.slice(i))}
                        className="text-[var(--text-muted)] hover:text-[var(--primary)]"
                      >
                        <ICONS.Play size={14} />
                      </button>
                      <button
                        onClick={() => removeSong(selectedPlaylist.id, song.id)}
                        className="text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100"
                      >
                        <ICONS.Trash size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Collaborators */}
              <div className="p-3 border-t border-theme bg-[var(--bg-hover)]">
                <h4 className="text-[10px] font-mono font-bold uppercase text-[var(--text-muted)] mb-2">
                  Collaborators ({selectedPlaylist.collaborators.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedPlaylist.collaborators.map(c => (
                    <div key={c.id} className="flex items-center gap-1 text-xs">
                      <span className={`w-2 h-2 rounded-full ${
                        c.role === 'owner' ? 'bg-yellow-500' : 
                        c.online ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <span>{c.name}</span>
                      {c.role === 'owner' && (
                        <span className="text-[8px] text-yellow-600 font-bold">👑</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-card)] border-2 border-theme p-6 w-full max-w-sm">
            <h3 className="font-mono font-bold mb-4">Create Playlist</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Playlist name..."
              className="w-full px-3 py-2 bg-[var(--bg-main)] border border-theme font-mono text-sm mb-3"
            />
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)..."
              className="w-full px-3 py-2 bg-[var(--bg-main)] border border-theme font-mono text-sm mb-4"
            />
            {actionError && (
              <p className="text-xs text-red-400 mb-3">{actionError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => { setShowCreate(false); setActionError(null); }} 
                className="px-3 py-1 text-xs font-mono"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate} 
                disabled={actionLoading || !newName.trim()}
                className="px-3 py-1 text-xs font-mono bg-[var(--primary)] text-black disabled:opacity-50"
              >
                {actionLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {showInvite && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-card)] border-2 border-theme p-6 w-full max-w-sm">
            <h3 className="font-mono font-bold mb-4">Join Playlist</h3>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Enter invite code..."
              className="w-full px-3 py-2 bg-[var(--bg-main)] border border-theme font-mono text-sm mb-4 uppercase"
            />
            {actionError && (
              <p className="text-xs text-red-400 mb-3">{actionError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => { setShowInvite(false); setActionError(null); }} 
                className="px-3 py-1 text-xs font-mono"
              >
                Cancel
              </button>
              <button 
                onClick={handleJoin}
                disabled={actionLoading || !inviteCode.trim()}
                className="px-3 py-1 text-xs font-mono bg-[var(--primary)] text-black disabled:opacity-50"
              >
                {actionLoading ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborativePlaylists;
