import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';

interface Concert {
  id: string;
  artist: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  ticketUrl?: string;
  price?: string;
}

interface ConcertFinderProps {
  favoriteArtists: string[];
  location?: string;
  onClose?: () => void;
}

// Mock concerts (in production, would use Songkick/Bandsintown API)
const MOCK_CONCERTS: Concert[] = [
  { id: '1', artist: 'The Weeknd', venue: 'Madison Square Garden', city: 'New York, NY', date: '2025-03-15', time: '8:00 PM', price: '$89+' },
  { id: '2', artist: 'Taylor Swift', venue: 'SoFi Stadium', city: 'Los Angeles, CA', date: '2025-04-20', time: '7:30 PM', price: '$150+' },
  { id: '3', artist: 'Billie Eilish', venue: 'United Center', city: 'Chicago, IL', date: '2025-02-28', time: '7:00 PM', price: '$65+' },
  { id: '4', artist: 'Kendrick Lamar', venue: 'Crypto.com Arena', city: 'Los Angeles, CA', date: '2025-05-10', time: '8:00 PM', price: '$120+' },
  { id: '5', artist: 'Dua Lipa', venue: 'O2 Arena', city: 'London, UK', date: '2025-06-05', time: '7:30 PM', price: '£75+' },
];

const ConcertFinder: React.FC<ConcertFinderProps> = ({ favoriteArtists, location, onClose }) => {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadConcerts();
  }, []);

  const loadConcerts = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setConcerts(MOCK_CONCERTS);
    setLoading(false);
  };

  const filteredConcerts = concerts.filter(c => 
    c.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.venue.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getDaysUntil = (dateStr: string) => {
    const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Past';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `${days} days`;
    if (days <= 30) return `${Math.ceil(days / 7)} weeks`;
    return `${Math.ceil(days / 30)} months`;
  };

  return (
    <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro">
      {/* Header */}
      <div className="p-4 border-b-2 border-theme bg-gradient-to-r from-orange-500 to-red-500 flex justify-between items-center">
        <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2 text-white">
          🎤 Concert Finder
        </h2>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded text-white">
            <ICONS.Close size={16} />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-3 border-b border-theme">
        <div className="relative">
          <ICONS.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search artist, venue, or city..."
            className="w-full pl-9 pr-3 py-2 text-sm font-mono bg-[var(--bg-main)] border border-theme focus:border-[var(--primary)] outline-none"
          />
        </div>
      </div>

      {/* Concerts */}
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <ICONS.Loader size={24} className="animate-spin text-[var(--primary)]" />
          </div>
        ) : filteredConcerts.length > 0 ? (
          filteredConcerts.map(concert => (
            <div 
              key={concert.id}
              className="p-4 bg-[var(--bg-hover)] border border-theme hover:border-[var(--primary)] transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-mono font-bold text-sm">{concert.artist}</h3>
                  <p className="text-xs text-[var(--text-muted)]">{concert.venue}</p>
                </div>
                <span className="text-[10px] font-mono bg-[var(--primary)] text-black px-2 py-0.5">
                  {getDaysUntil(concert.date)}
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] mb-3">
                <span className="flex items-center gap-1">
                  <ICONS.Globe size={12} /> {concert.city}
                </span>
                <span>{formatDate(concert.date)} • {concert.time}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-[var(--primary)]">{concert.price}</span>
                <button className="px-3 py-1 bg-black text-white text-xs font-mono font-bold hover:bg-[var(--primary)] hover:text-black transition-colors">
                  GET TICKETS →
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <ICONS.Music size={32} className="mx-auto mb-2 opacity-30" />
            <p className="font-mono text-sm">No concerts found</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-theme bg-[var(--bg-hover)] text-center">
        <p className="text-[10px] font-mono text-[var(--text-muted)]">
          Live events near you • Powered by your favorite artists
        </p>
      </div>
    </div>
  );
};

export default ConcertFinder;
