
import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';
import { searchMusic } from '../services/musicService';
import { savePlaylist, getPlaylists, Playlist, deletePlaylist } from '../utils/db';

interface QueuePanelProps {
  queue: Song[];
  currentSong: Song | null;
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAdd: (song: Song) => void;
  onPlay: (song: Song) => void;
  onClose: () => void;
  onLoadPlaylist: (songs: Song[]) => void;
}

const QueuePanel: React.FC<QueuePanelProps> = ({ 
  queue, 
  currentSong, 
  onRemove, 
  onReorder, 
  onAdd,
  onPlay,
  onClose,
  onLoadPlaylist
}) => {
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'PLAYLISTS'>('QUEUE');
  
  // Add Song State
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Playlist State
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isSavingPlaylist, setIsSavingPlaylist] = useState(false);

  useEffect(() => {
      if (activeTab === 'PLAYLISTS') {
          loadPlaylists();
      }
  }, [activeTab]);

  const loadPlaylists = async () => {
      const pl = await getPlaylists();
      setPlaylists(pl.sort((a,b) => b.createdAt - a.createdAt));
  };

  const handleSavePlaylist = async () => {
      if (!newPlaylistName.trim() || queue.length === 0) return;
      await savePlaylist(newPlaylistName, queue);
      setNewPlaylistName('');
      setIsSavingPlaylist(false);
      alert('Playlist Saved!');
      // If we are on playlists tab, reload
      if (activeTab === 'PLAYLISTS') loadPlaylists();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await searchMusic(searchQuery);
      // Convert MusicResult to Song
      const songResults: Song[] = results.map(r => ({
          id: `q-add-${Date.now()}-${r.id}`,
          title: r.title,
          artist: r.artist,
          album: r.album,
          duration: '3:00', // Approx
          coverUrl: r.artworkUrl,
          mood: 'Queue Add',
          previewUrl: r.downloadUrl, // Using preview URL if available
          addedAt: Date.now()
      }));
      setSearchResults(songResults);
    } catch (e) {
      console.error("Queue search failed", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSong = (song: Song) => {
      onAdd(song);
      setSearchQuery('');
      setSearchResults([]);
      setIsAdding(false);
  };

  const currentIndex = queue.findIndex(s => s.id === currentSong?.id);

  return (
    <div className="fixed bottom-24 right-4 md:right-8 w-80 md:w-96 max-h-[70vh] h-[600px] bg-white border-2 border-black shadow-retro z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
       {/* Header */}
       <div className="p-3 border-b-2 border-black flex justify-between items-center bg-gray-50 flex-shrink-0">
          <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('QUEUE')}
                className={`text-xs font-bold font-mono px-2 py-1 border border-black ${activeTab === 'QUEUE' ? 'bg-black text-white' : 'bg-white text-black'}`}
              >
                  CURRENT_QUEUE
              </button>
              <button 
                onClick={() => setActiveTab('PLAYLISTS')}
                className={`text-xs font-bold font-mono px-2 py-1 border border-black ${activeTab === 'PLAYLISTS' ? 'bg-black text-white' : 'bg-white text-black'}`}
              >
                  SAVED_LISTS
              </button>
          </div>
          <button onClick={onClose} className="hover:bg-red-500 hover:text-white border-2 border-transparent hover:border-black transition-colors p-1">
             <ICONS.Close size={16} />
          </button>
       </div>

       {activeTab === 'QUEUE' && (
           <>
               {/* Add Song / Save Playlist Section */}
               <div className="p-3 border-b-2 border-black bg-white space-y-2">
                  {!isAdding && !isSavingPlaylist ? (
                     <div className="flex gap-2">
                        <button 
                            onClick={() => setIsAdding(true)}
                            className="flex-1 py-2 border-2 border-dashed border-gray-300 hover:border-orange-500 hover:text-orange-500 flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase transition-colors"
                        >
                            <ICONS.Plus size={14} /> Add Track
                        </button>
                        <button 
                            onClick={() => setIsSavingPlaylist(true)}
                            className="px-3 py-2 border-2 border-black bg-black text-white hover:bg-gray-800 flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase transition-colors"
                            title="Save Queue as Playlist"
                        >
                            <ICONS.Save size={14} />
                        </button>
                     </div>
                  ) : isSavingPlaylist ? (
                      <div className="flex gap-2">
                          <input 
                             autoFocus
                             type="text"
                             placeholder="Playlist Name..."
                             className="flex-1 border-2 border-black px-2 py-1 text-xs font-mono focus:outline-none"
                             value={newPlaylistName}
                             onChange={e => setNewPlaylistName(e.target.value)}
                          />
                          <button onClick={handleSavePlaylist} className="bg-black text-white px-3 text-xs font-bold">SAVE</button>
                          <button onClick={() => setIsSavingPlaylist(false)}><ICONS.Close size={14}/></button>
                      </div>
                  ) : (
                     <div className="space-y-2">
                        <form onSubmit={handleSearch} className="flex gap-2">
                           <input 
                              autoFocus
                              type="text" 
                              placeholder="Search tracks..." 
                              className="flex-1 border-2 border-black px-2 py-1 text-xs font-mono focus:outline-none"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                           />
                           <button 
                              type="submit" 
                              disabled={isSearching}
                              className="bg-black text-white px-2 py-1"
                           >
                              {isSearching ? <ICONS.Loader className="animate-spin" size={12} /> : <ICONS.Search size={12} />}
                           </button>
                           <button 
                              type="button" 
                              onClick={() => { setIsAdding(false); setSearchResults([]); setSearchQuery(''); }}
                              className="border-2 border-black px-2 hover:bg-gray-100"
                           >
                              <ICONS.Close size={12} />
                           </button>
                        </form>
                        
                        {searchResults.length > 0 && (
                           <div className="max-h-32 overflow-y-auto border border-gray-200 bg-gray-50">
                              {searchResults.map(song => (
                                 <div key={song.id} className="flex items-center justify-between p-2 hover:bg-orange-100 cursor-pointer" onClick={() => handleAddSong(song)}>
                                    <div className="truncate text-xs">
                                       <span className="font-bold">{song.title}</span> <span className="text-gray-500">- {song.artist}</span>
                                    </div>
                                    <ICONS.Plus size={12} />
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  )}
               </div>

               {/* Queue List */}
               <div className="flex-1 overflow-y-auto p-0 scroll-smooth bg-[#fcfbf9]">
                  {queue.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50 space-y-2">
                        <ICONS.ListMusic size={32} />
                        <p className="font-mono text-xs">QUEUE_EMPTY</p>
                     </div>
                  ) : (
                     <div>
                        {/* Now Playing */}
                        {currentSong && (
                           <div className="sticky top-0 bg-white border-b-2 border-black z-10">
                              <div className="px-3 py-1 text-[10px] font-bold font-mono uppercase bg-orange-100 text-orange-800">Now Playing</div>
                              <div className="p-3 flex items-center gap-3">
                                 <img src={currentSong.coverUrl} className="w-10 h-10 border border-black object-cover" alt="cover" />
                                 <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm truncate">{currentSong.title}</div>
                                    <div className="text-xs text-gray-500 truncate">{currentSong.artist}</div>
                                 </div>
                                 <div className="w-4 h-4 relative flex items-center justify-center">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping absolute"></div>
                                    <div className="w-2 h-2 bg-orange-500 rounded-full relative"></div>
                                 </div>
                              </div>
                           </div>
                        )}

                        {/* Up Next */}
                        <div className="px-3 py-1 text-[10px] font-bold font-mono uppercase bg-gray-100 border-b border-gray-200">Up Next</div>
                        <div className="divide-y divide-gray-100">
                            {queue.map((song, index) => {
                               const isCurrent = index === currentIndex;
                               return (
                                  <div 
                                     key={song.id} 
                                     className={`flex items-center gap-2 p-2 group hover:bg-gray-50 transition-colors ${isCurrent ? 'bg-orange-50/50' : ''}`}
                                  >
                                     <div className="w-6 text-center text-[10px] font-mono text-gray-400">
                                        {index + 1}
                                     </div>
                                     <div 
                                        className="flex-1 min-w-0 cursor-pointer"
                                        onClick={() => onPlay(song)}
                                     >
                                        <div className={`text-xs font-bold truncate ${isCurrent ? 'text-orange-600' : 'text-black'}`}>
                                            {song.title}
                                        </div>
                                        <div className="text-[10px] text-gray-500 truncate">{song.artist}</div>
                                     </div>

                                     {!isCurrent && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="flex flex-col">
                                               <button disabled={index <= 0} onClick={() => onReorder(index, index - 1)} className="p-1 hover:bg-gray-200 text-gray-500 disabled:opacity-20"><ICONS.ArrowUp size={10} /></button>
                                               <button disabled={index >= queue.length - 1} onClick={() => onReorder(index, index + 1)} className="p-1 hover:bg-gray-200 text-gray-500 disabled:opacity-20"><ICONS.ArrowDown size={10} /></button>
                                            </div>
                                            <button onClick={() => onRemove(index)} className="p-2 hover:bg-red-100 text-gray-400 hover:text-red-500 rounded"><ICONS.Trash size={14} /></button>
                                        </div>
                                     )}
                                  </div>
                               );
                            })}
                        </div>
                     </div>
                  )}
               </div>
           </>
       )}

       {activeTab === 'PLAYLISTS' && (
           <div className="flex-1 overflow-y-auto bg-[#fcfbf9] p-4 space-y-3">
               {playlists.length === 0 && (
                   <div className="text-center text-gray-400 mt-12">
                       <p className="font-mono text-xs">NO_PLAYLISTS_SAVED</p>
                       <p className="text-[10px] mt-1">Create one from the Queue tab.</p>
                   </div>
               )}
               {playlists.map(pl => (
                   <div key={pl.id} className="bg-white border-2 border-black p-3 hover:shadow-retro-sm transition-all group">
                       <div className="flex justify-between items-start mb-2">
                           <div>
                               <h4 className="font-bold font-mono text-sm uppercase">{pl.name}</h4>
                               <p className="text-[10px] text-gray-500">{pl.songs.length} Tracks • {new Date(pl.createdAt).toLocaleDateString()}</p>
                           </div>
                           <button 
                             onClick={() => {
                                 deletePlaylist(pl.id).then(loadPlaylists);
                             }}
                             className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                           >
                               <ICONS.Trash size={14}/>
                           </button>
                       </div>
                       <button 
                         onClick={() => onLoadPlaylist(pl.songs)}
                         className="w-full bg-black text-white py-2 text-xs font-bold font-mono uppercase hover:bg-orange-500 hover:text-black transition-colors"
                       >
                           LOAD PLAYLIST
                       </button>
                   </div>
               ))}
           </div>
       )}
    </div>
  );
};

export default QueuePanel;
