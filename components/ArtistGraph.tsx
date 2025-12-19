import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';
import { getRelatedArtists, RelatedArtist } from '../services/geminiService';
import { searchUnified } from '../services/musicService';

interface ArtistGraphProps {
  seedArtist: string;
  onPlaySong: (song: Song) => void;
  onClose: () => void;
}

const ArtistGraph: React.FC<ArtistGraphProps> = ({
  seedArtist,
  onPlaySong,
  onClose
}) => {
  const [centerArtist, setCenterArtist] = useState(seedArtist);
  const [relatedArtists, setRelatedArtists] = useState<RelatedArtist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<RelatedArtist | null>(null);
  const [artistSongs, setArtistSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [history, setHistory] = useState<string[]>([seedArtist]);

  useEffect(() => {
    loadRelatedArtists(centerArtist);
  }, [centerArtist]);

  const loadRelatedArtists = async (artist: string) => {
    setIsLoading(true);
    setSelectedArtist(null);
    setArtistSongs([]);
    
    try {
      const artists = await getRelatedArtists(artist, 8);
      setRelatedArtists(artists);
    } catch (e) {
      console.error('[ArtistGraph] Failed to load related artists:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToArtist = (artist: RelatedArtist) => {
    setHistory(prev => [...prev, artist.name]);
    setCenterArtist(artist.name);
  };

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      setHistory(newHistory);
      setCenterArtist(newHistory[newHistory.length - 1]);
    }
  };

  const loadArtistSongs = async (artist: RelatedArtist) => {
    setSelectedArtist(artist);
    setLoadingSongs(true);
    
    try {
      const songs = await searchUnified('YOUTUBE', artist.name);
      setArtistSongs(songs.slice(0, 5));
    } catch (e) {
      console.error('[ArtistGraph] Failed to load artist songs:', e);
    } finally {
      setLoadingSongs(false);
    }
  };

  // Calculate positions for circular layout
  const getPosition = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radius = 110;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    };
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b-2 border-theme bg-[var(--bg-hover)] flex justify-between items-center">
          <div className="flex items-center gap-3">
            {history.length > 1 && (
              <button onClick={goBack} className="p-1 hover:bg-[var(--bg-main)] rounded">
                <ICONS.ArrowUp size={16} className="rotate-[-90deg]" />
              </button>
            )}
            <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2">
              <ICONS.Music size={20} /> Similar Artists
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-500 hover:text-white rounded transition-colors">
            <ICONS.Close size={18} />
          </button>
        </div>

        {/* Graph Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Circular Graph */}
          <div className="flex-1 relative p-8 flex items-center justify-center bg-[var(--bg-main)]">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                <ICONS.Loader size={32} className="animate-spin" />
                <span className="text-xs font-mono">Discovering artists...</span>
              </div>
            ) : (
              <div className="relative w-[280px] h-[280px]">
                {/* Center Artist */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-[var(--primary)] text-black rounded-full flex items-center justify-center z-10 border-4 border-black shadow-lg">
                  <span className="text-xs font-mono font-bold text-center px-1 leading-tight truncate">
                    {centerArtist}
                  </span>
                </div>

                {/* Related Artists Nodes */}
                {relatedArtists.map((artist, index) => {
                  const pos = getPosition(index, relatedArtists.length);
                  const isSelected = selectedArtist?.name === artist.name;
                  
                  return (
                    <div
                      key={artist.name}
                      className={`absolute w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer border-2
                        ${isSelected 
                          ? 'bg-[var(--primary)] text-black border-black scale-110 z-10' 
                          : 'bg-[var(--bg-card)] border-theme hover:border-[var(--primary)] hover:scale-105'
                        }`}
                      style={{
                        left: `calc(50% + ${pos.x}px - 28px)`,
                        top: `calc(50% + ${pos.y}px - 28px)`,
                      }}
                      onClick={() => loadArtistSongs(artist)}
                      onDoubleClick={() => navigateToArtist(artist)}
                      title={`${artist.name} - ${artist.similarity}% similar\nDouble-click to explore`}
                    >
                      <span className="text-[9px] font-mono font-bold text-center px-1 leading-tight truncate">
                        {artist.name.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}

                {/* Connection Lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                  {relatedArtists.map((artist, index) => {
                    const pos = getPosition(index, relatedArtists.length);
                    return (
                      <line
                        key={artist.name}
                        x1="50%"
                        y1="50%"
                        x2={`calc(50% + ${pos.x}px)`}
                        y2={`calc(50% + ${pos.y}px)`}
                        stroke={selectedArtist?.name === artist.name ? 'var(--primary)' : '#888'}
                        strokeWidth={Math.max(1, artist.similarity / 30)}
                        strokeOpacity={0.3}
                      />
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          {/* Artist Details Panel */}
          <div className="w-64 border-l border-theme bg-[var(--bg-card)] flex flex-col">
            {selectedArtist ? (
              <>
                <div className="p-4 border-b border-theme">
                  <h3 className="font-mono font-bold text-sm uppercase">{selectedArtist.name}</h3>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {selectedArtist.genres.map(genre => (
                      <span key={genre} className="px-2 py-0.5 text-[9px] font-mono bg-[var(--bg-hover)] border border-theme rounded">
                        {genre}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-2">{selectedArtist.reason}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[var(--primary)]" 
                        style={{ width: `${selectedArtist.similarity}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold">{selectedArtist.similarity}%</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase mb-2 px-2">Top Tracks</p>
                  {loadingSongs ? (
                    <div className="flex items-center justify-center p-4">
                      <ICONS.Loader size={16} className="animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {artistSongs.map(song => (
                        <div
                          key={song.id}
                          onClick={() => onPlaySong(song)}
                          className="flex items-center gap-2 p-2 hover:bg-[var(--bg-hover)] cursor-pointer rounded transition-colors"
                        >
                          <img src={song.coverUrl} className="w-8 h-8 object-cover border border-theme" alt="" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold truncate">{song.title}</p>
                            <p className="text-[9px] text-[var(--text-muted)] truncate">{song.duration}</p>
                          </div>
                          <ICONS.Play size={12} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-2 border-t border-theme">
                  <button
                    onClick={() => navigateToArtist(selectedArtist)}
                    className="w-full py-2 text-xs font-mono font-bold bg-black text-white hover:bg-[var(--primary)] hover:text-black transition-colors"
                  >
                    Explore {selectedArtist.name} →
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-[var(--text-muted)]">
                <ICONS.Music size={32} className="opacity-30 mb-2" />
                <p className="text-xs font-mono text-center">
                  Click an artist to see details<br/>
                  Double-click to explore
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer with history */}
        <div className="p-2 border-t border-theme bg-[var(--bg-hover)] flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-mono text-[var(--text-muted)]">Path:</span>
          {history.map((artist, i) => (
            <span key={i} className="text-[10px] font-mono flex items-center gap-1">
              {i > 0 && <span className="text-[var(--text-muted)]">→</span>}
              <span className={i === history.length - 1 ? 'font-bold text-[var(--primary)]' : ''}>{artist}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ArtistGraph;
