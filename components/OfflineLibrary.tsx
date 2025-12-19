
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';
import { saveSong, getOfflineSongs, deleteSong } from '../utils/db';
import { searchMusic, downloadAudioAsBlob, getYouTubeAudioStream, MusicResult } from '../services/musicService';
import * as downloadService from '../services/downloadService';

interface OfflineLibraryProps {
  onPlaySong: (song: Song) => void;
}

const OfflineLibrary: React.FC<OfflineLibraryProps> = ({ onPlaySong }) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [serverDownloads, setServerDownloads] = useState<downloadService.DownloadRecord[]>([]);
  const [storageStats, setStorageStats] = useState<downloadService.DownloadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'LIBRARY' | 'DOWNLOADER' | 'SERVER'>('LIBRARY');
  
  // Library Management State
  const [localFilter, setLocalFilter] = useState('');
  const [sortOption, setSortOption] = useState<'DATE' | 'TITLE' | 'ARTIST'>('DATE');

  // Downloader State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MusicResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadLogs, setDownloadLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSongs();
    loadServerDownloads();
  }, []);

  useEffect(() => {
      if (logEndRef.current) {
          logEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [downloadLogs]);

  const loadSongs = async () => {
    try {
      const stored = await getOfflineSongs();
      setSongs(stored);
    } catch (e) {
      console.error("Failed to load offline songs", e);
    } finally {
      setLoading(false);
    }
  };

  const loadServerDownloads = async () => {
    const data = await downloadService.getAllDownloads();
    if (data) {
      setServerDownloads(data.downloads.filter(d => d.status === 'complete'));
      setStorageStats(data.stats);
    }
  };

  const filteredSongs = useMemo(() => {
      let filtered = songs.filter(s => 
          s.title.toLowerCase().includes(localFilter.toLowerCase()) || 
          s.artist.toLowerCase().includes(localFilter.toLowerCase())
      );

      return filtered.sort((a, b) => {
          if (sortOption === 'TITLE') return a.title.localeCompare(b.title);
          if (sortOption === 'ARTIST') return a.artist.localeCompare(b.artist);
          // Default DATE (Newest first)
          return (b.addedAt || 0) - (a.addedAt || 0);
      });
  }, [songs, localFilter, sortOption]);

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create Song Object from File
    const song: Song = {
      id: `local-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: 'Local Import',
      album: 'Offline Library',
      duration: '--:--',
      coverUrl: 'https://picsum.photos/200/200?grayscale', // Placeholder for local files
      mood: 'Offline',
      fileBlob: file,
      isOffline: true,
      addedAt: Date.now()
    };

    await saveSong(song);
    await loadSongs();
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm("Are you sure you want to delete this track?")) {
          await deleteSong(id);
          await loadSongs();
      }
  };

  const performSearch = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!searchQuery.trim()) return;
      
      setIsSearching(true);
      setSearchResults([]);
      setHasSearched(true);
      
      const results = await searchMusic(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
  };

  const formatDuration = (seconds: number) => {
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const downloadTrack = async (track: MusicResult) => {
      setIsDownloading(true);
      setDownloadLogs([]);
      
      const addLog = (msg: string) => setDownloadLogs(prev => [...prev, msg]);

      addLog(`[system] initializing secure connection...`);
      addLog(`[source] ${track.source === 'YOUTUBE' ? 'YouTube Network' : 'iTunes Network'}`);
      addLog(`[target] ${track.title} - ${track.artist}`);
      
      try {
          let downloadUrl = track.downloadUrl;

          if (track.source === 'YOUTUBE' && track.videoId) {
              addLog(`[extract] resolving audio stream from video ID: ${track.videoId}...`);
              const streamUrl = await getYouTubeAudioStream(track.videoId);
              if (streamUrl) {
                  downloadUrl = streamUrl;
                  addLog(`[success] stream resolved. format: webm/opus`);
              } else {
                  throw new Error("Could not extract audio stream from YouTube");
              }
          }

          if (!downloadUrl) throw new Error("No download URL available");

          addLog(`[download] buffering stream data...`);
          
          const start = Date.now();
          const blob = await downloadAudioAsBlob(downloadUrl);
          
          if (!blob) {
             throw new Error("Failed to fetch audio stream (CORS/Network)");
          }

          const duration = ((Date.now() - start) / 1000).toFixed(2);
          addLog(`[download] received ${(blob.size / 1024 / 1024).toFixed(2)} MB in ${duration}s`);
          addLog(`[write] saving to IndexedDB storage...`);

          const song: Song = {
              id: `dl-${Date.now()}`,
              title: track.title,
              artist: track.artist,
              album: track.album,
              duration: formatDuration(track.duration),
              coverUrl: track.artworkUrl,
              mood: 'Downloaded',
              fileBlob: blob,
              isOffline: true,
              addedAt: Date.now(),
              externalUrl: downloadUrl
          };
          
          await saveSong(song);
          await loadSongs();
          addLog(`[success] Track added to library.`);
          
          setSearchQuery('');
          setHasSearched(false);
          
          setTimeout(() => {
              setIsDownloading(false);
              setActiveTab('LIBRARY');
          }, 1500);

      } catch (err) {
          addLog(`[error] Download failed: ${err}`);
          setIsDownloading(false);
      }
  };

  // Server-side download using yt-dlp (more reliable)
  const serverDownloadTrack = async (track: MusicResult) => {
      if (!track.videoId) {
          alert('This track cannot be downloaded (no video ID)');
          return;
      }
      
      const addLog = (msg: string) => setDownloadLogs(prev => [...prev, msg]);
      setDownloadLogs([]);
      
      // Add to downloading set
      setDownloadingIds(prev => new Set(prev).add(track.videoId!));
      
      addLog(`[system] Starting server-side download via yt-dlp...`);
      addLog(`[target] ${track.title} - ${track.artist}`);
      addLog(`[video] ${track.videoId}`);
      
      try {
          const result = await downloadService.startDownload({
              videoId: track.videoId,
              title: track.title,
              artist: track.artist,
              duration: formatDuration(track.duration),
              coverUrl: track.artworkUrl
          });
          
          if (!result.success) {
              throw new Error(result.error || 'Download failed');
          }
          
          if (result.cached) {
              addLog(`[cache] Song already in server library!`);
              addLog(`[success] Ready to play from server.`);
              setDownloadingIds(prev => {
                  const next = new Set(prev);
                  next.delete(track.videoId!);
                  return next;
              });
              await loadServerDownloads();
              return;
          }
          
          addLog(`[queue] Download started (ID: ${result.id})`);
          addLog(`[yt-dlp] Extracting audio from YouTube...`);
          
          // Poll for progress
          const cancelPoll = downloadService.pollDownloadProgress(result.id!, async (status) => {
              if (status.status === 'downloading') {
                  addLog(`[progress] Downloading... ${status.progress}%`);
              } else if (status.status === 'processing') {
                  addLog(`[ffmpeg] Converting to MP3...`);
              } else if (status.status === 'complete') {
                  addLog(`[success] Download complete! File saved to server.`);
                  addLog(`[size] ${(status.file_size / 1024 / 1024).toFixed(2)} MB`);
                  
                  // Auto-save to local library
                  addLog(`[sync] Syncing to local library...`);
                  try {
                      const streamUrl = downloadService.getStreamUrl(status.id);
                      const response = await fetch(streamUrl);
                      const blob = await response.blob();
                      
                      const localSong: Song = {
                          id: `server-local-${status.id}-${Date.now()}`,
                          title: status.title,
                          artist: status.artist || 'Unknown Artist',
                          album: 'Server Download',
                          duration: status.duration || '0:00',
                          coverUrl: status.cover_url || track.artworkUrl || 'https://picsum.photos/200/200?grayscale',
                          mood: 'Downloaded',
                          fileBlob: blob,
                          isOffline: true,
                          addedAt: Date.now()
                      };
                      
                      await saveSong(localSong);
                      await loadSongs();
                      addLog(`[sync] ✓ Added to local library!`);
                  } catch (syncErr) {
                      addLog(`[sync] Failed to sync to local library`);
                      console.error('Auto-sync failed:', syncErr);
                  }
                  
                  setDownloadingIds(prev => {
                      const next = new Set(prev);
                      next.delete(track.videoId!);
                      return next;
                  });
                  loadServerDownloads();
              } else if (status.status === 'error') {
                  addLog(`[error] ${status.error}`);
                  setDownloadingIds(prev => {
                      const next = new Set(prev);
                      next.delete(track.videoId!);
                      return next;
                  });
              }
          }, 2000);
          
      } catch (err: any) {
          addLog(`[error] ${err.message || err}`);
          setDownloadingIds(prev => {
              const next = new Set(prev);
              next.delete(track.videoId!);
              return next;
          });
      }
  };

  // Play a server-side downloaded track
  const playServerTrack = (record: downloadService.DownloadRecord) => {
      const song: Song = {
          id: `server-${record.id}`,
          title: record.title,
          artist: record.artist || 'Unknown Artist',
          album: 'Server Download',
          duration: record.duration || '0:00',
          coverUrl: record.cover_url || 'https://picsum.photos/200/200?grayscale',
          mood: 'Downloaded',
          isOffline: true,
          externalUrl: downloadService.getStreamUrl(record.id)
      };
      onPlaySong(song);
  };

  // Delete a server download
  const deleteServerTrack = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm("Delete this download from the server?")) {
          await downloadService.deleteDownload(id);
          await loadServerDownloads();
      }
  };

  // Save a server download to local library
  const [savingToLibrary, setSavingToLibrary] = useState<Set<string>>(new Set());
  
  const saveToLibrary = async (record: downloadService.DownloadRecord, e: React.MouseEvent) => {
      e.stopPropagation();
      
      setSavingToLibrary(prev => new Set(prev).add(record.id));
      
      try {
          // Fetch audio blob from server stream
          const streamUrl = downloadService.getStreamUrl(record.id);
          const response = await fetch(streamUrl);
          const blob = await response.blob();
          
          // Create song object for local storage
          const song: Song = {
              id: `server-local-${record.id}-${Date.now()}`,
              title: record.title,
              artist: record.artist || 'Unknown Artist',
              album: 'Server Download',
              duration: record.duration || '0:00',
              coverUrl: record.cover_url || 'https://picsum.photos/200/200?grayscale',
              mood: 'Downloaded',
              fileBlob: blob,
              isOffline: true,
              addedAt: Date.now()
          };
          
          await saveSong(song);
          await loadSongs();
          
          alert(`"${record.title}" added to local library!`);
      } catch (err) {
          console.error('Failed to save to library:', err);
          alert('Failed to save to library. Please try again.');
      } finally {
          setSavingToLibrary(prev => {
              const next = new Set(prev);
              next.delete(record.id);
              return next;
          });
      }
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-[var(--bg-main)]">
       
       {/* HEADER */}
       <div className="px-8 pt-8 pb-4 border-b border-[var(--border)] flex flex-col md:flex-row justify-between items-end gap-4 bg-[var(--bg-card)]/50 backdrop-blur-md z-10 sticky top-0">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-black text-white rounded-lg"><ICONS.HardDrive size={24} /></div>
                <h2 className="text-3xl font-black tracking-tight text-[var(--text-main)] uppercase">Offline Hub</h2>
            </div>
            <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest">
                Local: {songs.length} Tracks • Server: {serverDownloads.length} Tracks {storageStats && `• ${storageStats.totalSizeMB} MB`}
            </p>
          </div>
          
          <div className="flex bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border)] shadow-sm">
              <button 
                onClick={() => setActiveTab('LIBRARY')}
                className={`px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-2 ${activeTab === 'LIBRARY' ? 'bg-[var(--text-main)] text-[var(--bg-main)] shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}`}
              >
                  <ICONS.ListMusic size={14} /> LOCAL
              </button>
              <button 
                onClick={() => setActiveTab('SERVER')}
                className={`px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-2 ${activeTab === 'SERVER' ? 'bg-[var(--text-main)] text-[var(--bg-main)] shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}`}
              >
                  <ICONS.Server size={14} /> SERVER
              </button>
              <button 
                onClick={() => setActiveTab('DOWNLOADER')}
                className={`px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-2 ${activeTab === 'DOWNLOADER' ? 'bg-[var(--text-main)] text-[var(--bg-main)] shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}`}
              >
                  <ICONS.DownloadCloud size={14} /> DOWNLOAD
              </button>
          </div>
       </div>

       {/* CONTENT AREA */}
       <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
          
          {/* --- LIBRARY VIEW --- */}
          {activeTab === 'LIBRARY' && (
              <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  {/* Toolbar */}
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                      <div className="relative w-full md:w-96 group">
                          <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                          <input 
                              type="text" 
                              placeholder="Filter local tracks..." 
                              value={localFilter}
                              onChange={(e) => setLocalFilter(e.target.value)}
                              className="w-full pl-10 pr-4 py-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all shadow-sm"
                          />
                      </div>
                      
                      <div className="flex gap-2 w-full md:w-auto">
                          <select 
                              value={sortOption}
                              onChange={(e) => setSortOption(e.target.value as any)}
                              className="px-4 py-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-xs font-bold uppercase focus:outline-none cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                          >
                              <option value="DATE">Date Added</option>
                              <option value="TITLE">Title (A-Z)</option>
                              <option value="ARTIST">Artist (A-Z)</option>
                          </select>

                          <div className="relative overflow-hidden group">
                              <input 
                                  type="file" 
                                  accept="audio/*" 
                                  className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                  onChange={handleFileImport}
                                  ref={fileInputRef}
                              />
                              <button className="h-full px-6 bg-[var(--text-main)] text-[var(--bg-main)] rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:opacity-90 transition-opacity shadow-sm">
                                  <ICONS.Upload size={16} /> Import File
                              </button>
                          </div>
                      </div>
                  </div>

                  {/* Empty State */}
                  {!loading && songs.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] border-2 border-dashed border-[var(--border)] rounded-3xl bg-[var(--bg-card)]/30">
                          <div className="bg-[var(--bg-card)] p-4 rounded-full mb-4 shadow-sm">
                              <ICONS.HardDrive size={48} className="opacity-50" />
                          </div>
                          <h3 className="text-lg font-bold font-mono uppercase">Library Empty</h3>
                          <p className="text-sm mt-2 opacity-70">Import a file or download from the network.</p>
                      </div>
                  )}

                  {/* Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredSongs.map(song => (
                          <div 
                              key={song.id} 
                              onClick={() => onPlaySong(song)}
                              className="group bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3 flex gap-3 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden"
                          >
                              <div className="w-20 h-20 rounded-xl overflow-hidden relative flex-shrink-0 bg-gray-200">
                                  <img src={song.coverUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="art" />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                      <ICONS.Play size={24} className="text-white fill-current" />
                                  </div>
                              </div>
                              
                              <div className="flex-1 flex flex-col justify-center min-w-0">
                                  <h4 className="font-bold text-sm text-[var(--text-main)] truncate leading-tight mb-1">{song.title}</h4>
                                  <p className="text-xs text-[var(--text-muted)] truncate mb-2">{song.artist}</p>
                                  <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border)]">
                                          {song.mood === 'Downloaded' ? 'DL' : 'LOCAL'}
                                      </span>
                                      <span className="text-[10px] font-mono text-[var(--text-muted)] opacity-60">
                                          {new Date(song.addedAt || 0).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                                      </span>
                                  </div>
                              </div>

                              <button 
                                  onClick={(e) => handleDelete(song.id, e)}
                                  className="absolute top-2 right-2 p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                              >
                                  <ICONS.Trash size={14} />
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* --- SERVER DOWNLOADS VIEW --- */}
          {activeTab === 'SERVER' && (
              <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  {/* Stats Banner */}
                  {storageStats && (
                      <div className="grid grid-cols-3 gap-4">
                          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 text-center">
                              <div className="text-2xl font-bold text-[var(--text-main)]">{storageStats.totalFiles}</div>
                              <div className="text-xs font-mono text-[var(--text-muted)] uppercase">Tracks Cached</div>
                          </div>
                          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 text-center">
                              <div className="text-2xl font-bold text-[var(--text-main)]">{storageStats.totalSizeMB} MB</div>
                              <div className="text-xs font-mono text-[var(--text-muted)] uppercase">Storage Used</div>
                          </div>
                          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 text-center">
                              <div className="text-2xl font-bold text-[var(--text-main)]">{storageStats.totalDownloads}</div>
                              <div className="text-xs font-mono text-[var(--text-muted)] uppercase">Total Plays</div>
                          </div>
                      </div>
                  )}

                  {/* Info Banner */}
                  <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center gap-4">
                      <ICONS.Server size={24} className="text-green-500" />
                      <div>
                          <h4 className="font-bold text-[var(--text-main)]">Server-Side Downloads (yt-dlp)</h4>
                          <p className="text-xs text-[var(--text-muted)]">
                              Songs are extracted from YouTube using yt-dlp and cached on the server. 
                              Same songs won't be re-downloaded, saving bandwidth and time.
                          </p>
                      </div>
                  </div>

                  {/* Empty State */}
                  {serverDownloads.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] border-2 border-dashed border-[var(--border)] rounded-3xl bg-[var(--bg-card)]/30">
                          <div className="bg-[var(--bg-card)] p-4 rounded-full mb-4 shadow-sm">
                              <ICONS.Server size={48} className="opacity-50" />
                          </div>
                          <h3 className="text-lg font-bold font-mono uppercase">No Server Downloads</h3>
                          <p className="text-sm mt-2 opacity-70">Go to the DOWNLOAD tab to save tracks.</p>
                      </div>
                  )}

                  {/* Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {serverDownloads.map(record => (
                          <div 
                              key={record.id} 
                              onClick={() => playServerTrack(record)}
                              className="group bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3 flex gap-3 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden"
                          >
                              <div className="w-20 h-20 rounded-xl overflow-hidden relative flex-shrink-0 bg-gray-200">
                                  <img src={record.cover_url || 'https://picsum.photos/200/200?grayscale'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="art" />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                      <ICONS.Play size={24} className="text-white fill-current" />
                                  </div>
                              </div>
                              
                              <div className="flex-1 flex flex-col justify-center min-w-0">
                                  <h4 className="font-bold text-sm text-[var(--text-main)] truncate leading-tight mb-1">{record.title}</h4>
                                  <p className="text-xs text-[var(--text-muted)] truncate mb-2">{record.artist || 'Unknown'}</p>
                                  <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 border border-green-500/30">
                                          SERVER
                                      </span>
                                      <span className="text-[10px] font-mono text-[var(--text-muted)] opacity-60">
                                          {(record.file_size / 1024 / 1024).toFixed(1)} MB
                                      </span>
                                  </div>
                              </div>

                              <button 
                                  onClick={(e) => saveToLibrary(record, e)}
                                  disabled={savingToLibrary.has(record.id)}
                                  className="absolute top-2 right-10 p-2 text-[var(--text-muted)] hover:text-green-600 hover:bg-green-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                  title="Add to Local Library"
                              >
                                  {savingToLibrary.has(record.id) ? (
                                      <ICONS.Loader size={14} className="animate-spin" />
                                  ) : (
                                      <ICONS.Download size={14} />
                                  )}
                              </button>

                              <button 
                                  onClick={(e) => deleteServerTrack(record.id, e)}
                                  className="absolute top-2 right-2 p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                              >
                                  <ICONS.Trash size={14} />
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* --- DOWNLOADER VIEW --- */}
          {activeTab === 'DOWNLOADER' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  
                  {/* Search Box */}
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-8 shadow-sm">
                      <div className="text-center mb-6">
                          <h3 className="text-xl font-bold font-mono uppercase mb-2">Global Network Search</h3>
                          <p className="text-xs text-[var(--text-muted)]">Search YouTube & iTunes via secure proxy gateways.</p>
                      </div>
                      
                      <form onSubmit={performSearch} className="flex gap-2 max-w-xl mx-auto relative">
                          <div className="relative flex-1">
                              <ICONS.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                              <input 
                                 type="text" 
                                 className="w-full pl-12 pr-4 py-4 bg-[var(--bg-main)] border border-[var(--border)] rounded-2xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all shadow-inner"
                                 placeholder="Song title or artist..."
                                 value={searchQuery}
                                 onChange={(e) => setSearchQuery(e.target.value)}
                                 disabled={isDownloading || isSearching}
                              />
                          </div>
                          <button 
                             type="submit"
                             disabled={isDownloading || !searchQuery || isSearching}
                             className={`px-8 rounded-2xl font-bold font-mono text-sm uppercase transition-all ${isDownloading || !searchQuery ? 'bg-[var(--bg-hover)] text-[var(--text-muted)]' : 'bg-[var(--text-main)] text-[var(--bg-main)] hover:scale-105 shadow-lg'}`}
                          >
                             {isSearching ? <ICONS.Loader className="animate-spin" size={18} /> : 'SEARCH'}
                          </button>
                      </form>
                  </div>

                  {/* Results & Terminal Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Results List */}
                      <div className="lg:col-span-2 min-h-[300px]">
                          {isSearching ? (
                              <div className="flex flex-col items-center justify-center h-48 opacity-50 space-y-4">
                                  <div className="relative">
                                      <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
                                  </div>
                                  <span className="font-mono text-xs font-bold tracking-widest animate-pulse">SCANNING_NETWORKS...</span>
                              </div>
                          ) : hasSearched && searchResults.length === 0 ? (
                              <div className="text-center py-12 border-2 border-dashed border-[var(--border)] rounded-2xl opacity-60">
                                  <p className="font-mono text-sm font-bold">NO_RESULTS_FOUND</p>
                              </div>
                          ) : searchResults.length > 0 ? (
                              <div className="space-y-3">
                                  <div className="flex justify-between items-center px-2">
                                      <span className="text-xs font-bold font-mono text-[var(--text-muted)] uppercase">Found {searchResults.length} Matches</span>
                                  </div>
                                  {searchResults.map((result) => (
                                      <div key={result.id} className="flex items-center justify-between p-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl hover:border-[var(--primary)] hover:shadow-md transition-all group">
                                          <div className="flex items-center gap-4 overflow-hidden">
                                              <div className="w-14 h-14 rounded-lg overflow-hidden relative flex-shrink-0 border border-[var(--border)]">
                                                <img src={result.artworkUrl} className="w-full h-full object-cover" alt="thumb" />
                                                <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1.5 py-0.5 font-bold font-mono backdrop-blur-sm">
                                                   {result.source === 'YOUTUBE' ? 'YT' : 'IT'}
                                                </div>
                                              </div>
                                              <div className="min-w-0">
                                                  <div className="font-bold text-sm truncate text-[var(--text-main)]">{result.title}</div>
                                                  <div className="text-xs text-[var(--text-muted)] font-mono truncate">{result.artist} • {formatDuration(result.duration)}</div>
                                              </div>
                                          </div>
                                          
                                          {/* Show yt-dlp button for YouTube, browser download for iTunes */}
                                          {result.source === 'YOUTUBE' && result.videoId ? (
                                            <button 
                                               onClick={() => serverDownloadTrack(result)}
                                               disabled={downloadingIds.has(result.videoId)}
                                               className={`ml-4 h-10 px-4 rounded-lg font-bold text-xs font-mono uppercase transition-colors flex items-center gap-2 ${
                                                 downloadingIds.has(result.videoId) 
                                                   ? 'bg-green-500 text-white cursor-wait' 
                                                   : 'bg-[var(--bg-hover)] hover:bg-green-500 hover:text-white text-[var(--text-main)]'
                                               }`}
                                            >
                                                {downloadingIds.has(result.videoId) ? (
                                                  <><ICONS.Loader className="animate-spin" size={14} /> DL...</>
                                                ) : (
                                                  <><ICONS.Server size={14} /> <span className="hidden sm:inline">yt-dlp</span></>
                                                )}
                                            </button>
                                          ) : (
                                            <button 
                                               onClick={() => downloadTrack(result)}
                                               disabled={isDownloading}
                                               className="ml-4 h-10 px-4 bg-[var(--bg-hover)] hover:bg-purple-500 hover:text-white text-[var(--text-main)] rounded-lg font-bold text-xs font-mono uppercase transition-colors flex items-center gap-2 disabled:opacity-50"
                                            >
                                                <ICONS.DownloadCloud size={14} /> <span className="hidden sm:inline">{result.source === 'ITUNES' ? 'iTunes' : 'Get'}</span>
                                            </button>
                                          )}
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="flex flex-col items-center justify-center h-48 text-[var(--text-muted)] opacity-40">
                                  <ICONS.Globe size={48} className="mb-4 stroke-1" />
                                  <p className="font-mono text-xs uppercase tracking-widest">Global Index Ready</p>
                              </div>
                          )}
                      </div>

                      {/* Terminal Log */}
                      <div className="lg:col-span-1">
                          <div className="bg-[#0c0c0c] border border-gray-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-full max-h-[500px]">
                              <div className="bg-[#1a1a1a] px-3 py-2 border-b border-gray-800 flex justify-between items-center">
                                  <div className="flex gap-1.5">
                                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                                  </div>
                                  <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">sys_log</span>
                              </div>
                              <div className="flex-1 p-4 overflow-y-auto font-mono text-[10px] space-y-1.5 scrollbar-hide">
                                  {downloadLogs.length === 0 && !isDownloading && (
                                      <div className="text-gray-600 italic">_waiting for tasks...</div>
                                  )}
                                  {downloadLogs.map((log, i) => {
                                      const isError = log.includes('[error]');
                                      const isSuccess = log.includes('[success]');
                                      return (
                                          <div key={i} className={`break-all ${isError ? 'text-red-400' : isSuccess ? 'text-green-400' : 'text-gray-400'}`}>
                                              <span className="opacity-50 mr-2">{new Date().toLocaleTimeString([],{hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}</span>
                                              {log}
                                          </div>
                                      );
                                  })}
                                  {isDownloading && (
                                      <div className="text-blue-400 animate-pulse">_ processing request...</div>
                                  )}
                                  <div ref={logEndRef} />
                              </div>
                          </div>
                      </div>

                  </div>
              </div>
          )}

       </div>
    </div>
  );
};

export default OfflineLibrary;
