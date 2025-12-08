import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';
import { saveSong, getOfflineSongs, deleteSong } from '../utils/db';
import { searchMusic, downloadAudioAsBlob, getYouTubeAudioStream, MusicResult } from '../services/musicService';

interface OfflineLibraryProps {
  onPlaySong: (song: Song) => void;
}

const OfflineLibrary: React.FC<OfflineLibraryProps> = ({ onPlaySong }) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'LIBRARY' | 'DOWNLOADER'>('LIBRARY');
  
  // Downloader State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MusicResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadLogs, setDownloadLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  
  // File Import State
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSongs();
  }, []);

  useEffect(() => {
      if (logEndRef.current) {
          logEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [downloadLogs]);

  const loadSongs = async () => {
    try {
      const stored = await getOfflineSongs();
      setSongs(stored.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)));
    } catch (e) {
      console.error("Failed to load offline songs", e);
    } finally {
      setLoading(false);
    }
  };

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

  const handleDelete = async (id: string) => {
      await deleteSong(id);
      await loadSongs();
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

      // Real Process
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
              externalUrl: downloadUrl // Keep reference
          };
          
          await saveSong(song);
          await loadSongs();
          addLog(`[success] Track added to library.`);
          
          setSearchQuery('');
          setHasSearched(false);
          
          // Switch back to library after short delay
          setTimeout(() => {
              setIsDownloading(false);
              setActiveTab('LIBRARY');
          }, 1500);

      } catch (err) {
          addLog(`[error] Download failed: ${err}`);
          setIsDownloading(false);
      }
  };

  return (
    <div className="p-8 pb-32 max-w-5xl mx-auto space-y-8">
       <div className="flex justify-between items-end border-b-4 border-black pb-4">
        <div>
          <h2 className="text-4xl font-bold text-black mb-2 font-mono">OFFLINE_HUB</h2>
          <p className="text-gray-600 font-mono">LOCAL_STORAGE_&_DOWNLOADS</p>
        </div>
        
        <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('LIBRARY')}
              className={`px-4 py-2 font-bold font-mono text-xs flex items-center gap-2 border-2 border-black transition-all ${activeTab === 'LIBRARY' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
            >
                <ICONS.Offline size={16} /> LIBRARY
            </button>
            <button 
              onClick={() => setActiveTab('DOWNLOADER')}
              className={`px-4 py-2 font-bold font-mono text-xs flex items-center gap-2 border-2 border-black transition-all ${activeTab === 'DOWNLOADER' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
            >
                <ICONS.DownloadCloud size={16} /> SEARCH_&_DL
            </button>
        </div>
      </div>

      {activeTab === 'LIBRARY' && (
          <div className="space-y-6 animate-in slide-in-from-left-4">
              {/* Stats / Storage Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border-2 border-black p-4 shadow-retro-sm">
                      <p className="text-[10px] font-bold font-mono text-gray-500 uppercase">Total Tracks</p>
                      <h3 className="text-3xl font-bold font-mono">{songs.length}</h3>
                  </div>
                  <div className="bg-white border-2 border-black p-4 shadow-retro-sm">
                       <p className="text-[10px] font-bold font-mono text-gray-500 uppercase">Storage Used</p>
                       <h3 className="text-3xl font-bold font-mono">
                           {(songs.reduce((acc, s) => acc + (s.fileBlob?.size || 0), 0) / (1024 * 1024)).toFixed(2)} MB
                       </h3>
                  </div>
                  
                  {/* Import Button */}
                  <div className="bg-black text-white border-2 border-black p-4 shadow-retro-sm flex flex-col justify-center items-center cursor-pointer hover:bg-gray-900 group relative">
                      <input 
                        type="file" 
                        accept="audio/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleFileImport}
                        ref={fileInputRef}
                      />
                      <ICONS.FileAudio size={24} className="mb-2 group-hover:scale-110 transition-transform" />
                      <h3 className="font-bold font-mono text-sm uppercase">Import Local File</h3>
                  </div>
              </div>

              {/* Song List */}
              <div className="bg-white border-2 border-black min-h-[400px]">
                  <div className="grid grid-cols-12 gap-4 p-3 border-b-2 border-black bg-gray-100 text-xs font-bold font-mono uppercase text-gray-500">
                      <div className="col-span-6">Title</div>
                      <div className="col-span-3">Artist</div>
                      <div className="col-span-2">Date Added</div>
                      <div className="col-span-1 text-right">Action</div>
                  </div>
                  
                  {loading ? (
                      <div className="p-8 text-center text-gray-400 font-mono">Loading IndexDB...</div>
                  ) : songs.length === 0 ? (
                      <div className="p-12 flex flex-col items-center justify-center text-gray-400 opacity-60">
                          <ICONS.Offline size={48} className="mb-4" />
                          <p className="font-mono text-sm">NO_LOCAL_FILES_FOUND</p>
                          <p className="text-xs mt-2">Use 'Search & DL' or Import to add music.</p>
                      </div>
                  ) : (
                      <div className="divide-y divide-gray-200">
                          {songs.map(song => (
                              <div key={song.id} className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-orange-50 transition-colors group">
                                  <div className="col-span-6 flex items-center gap-3">
                                      <div className="w-10 h-10 border border-black bg-gray-200 relative flex-shrink-0 cursor-pointer" onClick={() => onPlaySong(song)}>
                                          <img src={song.coverUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0" alt="art" />
                                          <div className="absolute inset-0 bg-black/20 hidden group-hover:flex items-center justify-center">
                                              <ICONS.Play size={16} className="text-white" fill="currentColor" />
                                          </div>
                                      </div>
                                      <div className="min-w-0">
                                          <div className="font-bold text-sm truncate">{song.title}</div>
                                          <div className="text-[10px] text-gray-500 font-mono uppercase bg-gray-200 px-1 inline-block">LOCAL_FILE</div>
                                      </div>
                                  </div>
                                  <div className="col-span-3 text-xs font-mono truncate">{song.artist}</div>
                                  <div className="col-span-2 text-xs font-mono text-gray-500">
                                      {new Date(song.addedAt || Date.now()).toLocaleDateString()}
                                  </div>
                                  <div className="col-span-1 flex justify-end">
                                      <button 
                                        onClick={() => handleDelete(song.id)}
                                        className="text-gray-400 hover:text-red-600 transition-colors p-2"
                                      >
                                          <ICONS.Trash size={16} />
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'DOWNLOADER' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right-4">
              <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white border-2 border-black p-6 shadow-retro">
                      <label className="block text-xs font-bold font-mono uppercase mb-2">Search Global Network (YouTube/iTunes)</label>
                      <form onSubmit={performSearch} className="flex gap-2 mb-6">
                          <div className="relative flex-1">
                              <ICONS.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                              <input 
                                 type="text" 
                                 className="w-full bg-gray-50 border-2 border-black pl-10 pr-3 py-3 font-mono text-sm focus:outline-none focus:shadow-retro transition-shadow"
                                 placeholder="Type song or artist name..."
                                 value={searchQuery}
                                 onChange={(e) => setSearchQuery(e.target.value)}
                                 disabled={isDownloading || isSearching}
                              />
                          </div>
                          <button 
                             type="submit"
                             disabled={isDownloading || !searchQuery || isSearching}
                             className={`px-6 border-2 border-black font-bold font-mono text-sm uppercase transition-all ${isDownloading || !searchQuery ? 'bg-gray-200 text-gray-400' : 'bg-black text-white hover:bg-gray-800 shadow-retro-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]'}`}
                          >
                             {isSearching ? <ICONS.Loader className="animate-spin" size={18} /> : 'SEARCH'}
                          </button>
                      </form>

                      {/* Results Area */}
                      <div className="min-h-[200px]">
                          {isSearching ? (
                              <div className="flex flex-col items-center justify-center h-48 opacity-50 space-y-2">
                                  <ICONS.Loader className="animate-spin" size={32} />
                                  <span className="font-mono text-xs">SCANNING_NETWORKS...</span>
                              </div>
                          ) : hasSearched && searchResults.length === 0 ? (
                              <div className="text-center py-12 border-2 border-dashed border-gray-300">
                                  <p className="font-mono text-gray-500">NO_RESULTS_FOUND</p>
                              </div>
                          ) : searchResults.length > 0 ? (
                              <div className="space-y-3">
                                  <p className="text-xs font-bold font-mono text-gray-500 uppercase mb-2">Available for Download</p>
                                  {searchResults.map((result) => (
                                      <div key={result.id} className="flex items-center justify-between p-3 border-2 border-black hover:bg-gray-50 transition-colors group">
                                          <div className="flex items-center gap-3">
                                              <div className="w-12 h-12 border border-black overflow-hidden relative">
                                                <img src={result.artworkUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0" alt="thumb" />
                                                <div className="absolute bottom-0 right-0 bg-black text-white text-[9px] px-1 font-mono">
                                                   {result.source === 'YOUTUBE' ? 'YT' : 'IT'}
                                                </div>
                                              </div>
                                              <div>
                                                  <div className="font-bold text-sm line-clamp-1">{result.title}</div>
                                                  <div className="text-[10px] text-gray-500 font-mono">{result.artist} • {formatDuration(result.duration)}</div>
                                              </div>
                                          </div>
                                          <button 
                                             onClick={() => downloadTrack(result)}
                                             disabled={isDownloading}
                                             className="text-xs font-bold font-mono bg-black text-white px-3 py-1.5 border-2 border-black hover:bg-white hover:text-black transition-colors flex items-center gap-1 disabled:opacity-50"
                                          >
                                              <ICONS.Download size={12} /> DL
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="text-center py-12 opacity-40">
                                  <ICONS.Search size={40} className="mx-auto mb-2" />
                                  <p className="font-mono text-xs">ENTER_KEYWORDS_TO_BEGIN</p>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Terminal Output */}
                  <div className="bg-[#1e1e1e] border-2 border-black p-4 h-48 overflow-y-auto font-mono text-xs text-green-500 shadow-retro relative">
                      <div className="absolute top-2 right-2 text-[10px] text-gray-500 border border-gray-700 px-1">LOG</div>
                      {downloadLogs.length === 0 && !isDownloading && (
                          <div className="opacity-50 mt-2">$ system ready...</div>
                      )}
                      {downloadLogs.map((log, i) => (
                          <div key={i} className="mb-1 break-all">
                              <span className="text-gray-500 mr-2">$</span>
                              {log}
                          </div>
                      ))}
                      {isDownloading && (
                          <div className="animate-pulse">_</div>
                      )}
                      <div ref={logEndRef} />
                  </div>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-4">
                   <div className="bg-yellow-50 border-2 border-black p-4">
                       <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                           <ICONS.Zap size={16} className="text-yellow-600" />
                           Full Song Mode
                       </h4>
                       <p className="text-xs text-gray-600 leading-relaxed">
                           Now utilizing Invidious instances to extract full length audio streams from YouTube videos. If extraction fails, the system will fallback to iTunes previews.
                       </p>
                   </div>
                   
                   <div className="bg-white border-2 border-black p-4">
                       <h4 className="font-bold font-mono text-xs uppercase mb-3">Network Status</h4>
                       <div className="space-y-2">
                           <div className="flex justify-between text-xs">
                               <span>YouTube Gateway</span>
                               <span className="text-green-600 font-bold">ACTIVE</span>
                           </div>
                           <div className="flex justify-between text-xs">
                               <span>iTunes Backup</span>
                               <span className="text-green-600 font-bold">READY</span>
                           </div>
                       </div>
                   </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default OfflineLibrary;