import React, { useState } from 'react';
import MoodChart from './MoodChart';
import VibeSnap from './VibeSnap';
import { ICONS, MOCK_SONGS } from '../constants';
import { Song, AppView, MoodData } from '../types';
import { searchSpotifyTracks } from '../services/spotifyService';
import { searchSongs } from '../services/geminiService';

interface DashboardProps {
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onChangeView: (view: AppView) => void;
  spotifyToken?: string | null;
  moodData: MoodData[];
}

const Dashboard: React.FC<DashboardProps> = ({ onPlaySong, onChangeView, spotifyToken, moodData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [moodTimeRange, setMoodTimeRange] = useState('Today');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchPerformed(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchPerformed(true);
    try {
      let results: Song[] = [];
      if (spotifyToken) {
        results = await searchSpotifyTracks(spotifyToken, searchQuery);
      } else {
        results = await searchSongs(searchQuery);
      }
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchPerformed(false);
  };

  // Calculate current vibe from last mood entry
  const currentVibe = moodData.length > 0 ? moodData[moodData.length - 1].label : "NEUTRAL";
  const currentScore = moodData.length > 0 ? moodData[moodData.length - 1].score : 50;
  
  // Dynamic greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const renderSongCard = (song: Song, contextQueue: Song[]) => (
    <div key={song.id} className="bg-white border-2 border-black p-4 flex items-center space-x-4 hover:shadow-retro transition-all group cursor-pointer" onClick={() => onPlaySong(song, contextQueue)}>
      <div className="relative w-16 h-16 border-2 border-black flex-shrink-0 bg-gray-100">
        {song.coverUrl && <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300" />}
      </div>
      <div className="flex-1 min-w-0">
          <h4 className="font-bold text-black truncate font-mono uppercase text-sm">{song.title}</h4>
          <p className="text-xs text-gray-600 truncate font-bold">
            {song.artist}{song.album && <span className="font-normal"> • {song.album}</span>}
          </p>
          <div className="flex items-center mt-2 space-x-2">
            <span className="text-xs text-black border border-black px-1 font-mono">{song.duration}</span>
            {song.mood && (
              <span className="text-[10px] text-black bg-orange-200 px-1 border border-black font-bold uppercase">
                  {song.mood}
              </span>
            )}
          </div>
      </div>
      <div className="flex flex-col space-y-2">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onPlaySong(song, contextQueue);
          }}
          title="Play Preview"
          className="w-10 h-10 border-2 border-black bg-orange-400 hover:bg-orange-500 text-black flex items-center justify-center transition-all shadow-retro-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
        >
            <ICONS.Play size={18} fill="currentColor" className="ml-0.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-8 space-y-8 pb-32">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 border-b-4 border-orange-400 inline-block">{greeting}</h2>
          <p className="text-gray-600 mt-2 font-mono text-sm">
             CURRENT VIBE: 
             <span className="ml-2 text-black font-bold bg-orange-200 px-2 py-0.5 border border-black uppercase">{currentVibe} ({Math.round(currentScore)}%)</span>
          </p>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full md:w-96">
          <form onSubmit={handleSearch}>
             <div className="relative group">
                <ICONS.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-900 z-10" size={18} strokeWidth={2.5} />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="SEARCH..."
                  className="w-full bg-white border-2 border-black py-3 pl-10 pr-10 text-black font-mono placeholder-gray-400 focus:outline-none focus:shadow-retro transition-all"
                />
                {searchQuery && (
                   <button 
                     type="button" 
                     onClick={clearSearch} 
                     className="absolute right-3 top-1/2 transform -translate-y-1/2 text-black hover:text-orange-600"
                   >
                     <ICONS.Square size={14} className="fill-black" />
                   </button>
                )}
             </div>
          </form>
        </div>

        <button 
          onClick={() => onChangeView(AppView.SETTINGS)} 
          className="p-3 bg-white border-2 border-black text-black hover:shadow-retro transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hidden md:block"
        >
           <ICONS.Settings size={20} strokeWidth={2.5} />
        </button>
      </div>

      {searchPerformed ? (
        <div className="space-y-6">
           <div className="flex items-center justify-between border-b-2 border-black pb-4">
              <h3 className="text-xl font-bold font-mono">
                 SEARCH RESULTS
                 <span className="ml-2 text-sm font-normal text-gray-500 font-sans">for "{searchQuery}"</span>
              </h3>
              <button onClick={clearSearch} className="text-sm font-bold text-black hover:underline decoration-2 underline-offset-4 decoration-orange-400">Back to Dashboard</button>
           </div>
           
           {isSearching ? (
             <div className="flex justify-center py-12">
                <ICONS.Loader className="animate-spin text-black" size={32} />
             </div>
           ) : searchResults.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {searchResults.map(song => renderSongCard(song, searchResults))}
             </div>
           ) : (
             <div className="text-center py-12 border-2 border-dashed border-gray-400">
                <p className="font-mono text-gray-500">NO_RESULTS_FOUND</p>
             </div>
           )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Mood Analysis Card */}
            <div className="lg:col-span-2 bg-white border-2 border-black p-6 shadow-retro">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="text-lg font-bold flex items-center space-x-2 font-mono uppercase">
                   <ICONS.Chart size={20} strokeWidth={2.5} />
                   <span>Live_Mood_Tracker</span>
                 </h3>
                 <div className="text-xs font-mono bg-gray-100 border border-black px-2 py-1 text-gray-500">
                    REALTIME_DATA
                 </div>
              </div>
              {moodData.length > 1 ? (
                 <MoodChart data={moodData} />
              ) : (
                 <div className="h-64 flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300">
                    <p className="font-mono text-gray-400 text-sm">PLAY MORE MUSIC TO GENERATE DATA</p>
                 </div>
              )}
            </div>

            {/* Quick Actions / Context */}
            <div className="space-y-6">
               <div className="bg-orange-400 border-2 border-black p-6 relative overflow-hidden group cursor-pointer shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-sm transition-all" onClick={() => onChangeView(AppView.CHAT)}>
                  <div className="absolute right-[-20px] top-[-20px] p-4 opacity-10 group-hover:opacity-20 transition">
                     <ICONS.MessageSquare size={120} className="text-black" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-black font-mono">NEED_REC?</h3>
                  <p className="text-black text-sm mb-4 font-medium border-l-2 border-black pl-3">Chat with your AI companion to find the perfect track.</p>
                  <button className="bg-black text-white px-4 py-2 text-sm font-bold font-mono hover:bg-white hover:text-black border-2 border-transparent hover:border-black transition-colors">START CHAT</button>
               </div>

               {/* Vibe Snap Widget */}
               <VibeSnap onPlaylistGenerated={(songs) => onPlaySong(songs[0], songs)} spotifyToken={spotifyToken} />

            </div>

            {/* Recent/Recommended */}
            <div className="lg:col-span-3">
              <h3 className="text-xl font-bold mb-6 font-mono border-b-2 border-black pb-2 inline-block">RECOMMENDED FOR YOU</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {MOCK_SONGS.map(song => renderSongCard(song, MOCK_SONGS))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
