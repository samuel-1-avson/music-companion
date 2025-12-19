import React, { useState, useRef, useEffect } from 'react';
import { ICONS } from '../constants';

interface PodcastEpisode {
  id: string;
  title: string;
  description: string;
  duration: string;
  publishDate: string;
  audioUrl: string;
  imageUrl?: string;
  played?: boolean;
}

interface Podcast {
  id: string;
  title: string;
  author: string;
  description: string;
  imageUrl: string;
  feedUrl: string;
  episodes: PodcastEpisode[];
}

interface PodcastPlayerProps {
  onClose?: () => void;
}

// Mock podcasts for demo
const MOCK_PODCASTS: Podcast[] = [
  {
    id: '1',
    title: 'Song Exploder',
    author: 'Hrishikesh Hirway',
    description: 'Musicians take apart their songs piece by piece',
    imageUrl: 'https://picsum.photos/200/200?random=201',
    feedUrl: '',
    episodes: [
      { id: 'e1', title: 'Billie Eilish - "everything i wanted"', description: 'Billie breaks down her Grammy-winning song', duration: '28:45', publishDate: '2024-12-10', audioUrl: '' },
      { id: 'e2', title: 'Daft Punk - "Get Lucky"', description: 'The story behind the summer anthem', duration: '32:12', publishDate: '2024-12-03', audioUrl: '' },
    ]
  },
  {
    id: '2',
    title: 'Dissect',
    author: 'Spotify Studios',
    description: 'A serialized music podcast analyzing classic albums',
    imageUrl: 'https://picsum.photos/200/200?random=202',
    feedUrl: '',
    episodes: [
      { id: 'e3', title: 'S1E1 - Kendrick Lamar: To Pimp a Butterfly', description: 'Deep dive into the opening track', duration: '45:30', publishDate: '2024-12-08', audioUrl: '' },
    ]
  }
];

const PodcastPlayer: React.FC<PodcastPlayerProps> = ({ onClose }) => {
  const [podcasts, setPodcasts] = useState<Podcast[]>(MOCK_PODCASTS);
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PodcastEpisode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleAddFeed = () => {
    // In production, would parse RSS here
    alert('RSS parsing would happen here. Feed: ' + feedUrl);
    setShowAddFeed(false);
    setFeedUrl('');
  };

  const playEpisode = (episode: PodcastEpisode) => {
    setCurrentEpisode(episode);
    setIsPlaying(true);
    // In production, would play actual audio
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b-2 border-theme bg-gradient-to-r from-green-500 to-teal-500 flex justify-between items-center">
        <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2 text-white">
          🎧 Podcasts
        </h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowAddFeed(true)}
            className="p-1 hover:bg-white/20 rounded text-white"
            title="Add Feed"
          >
            <ICONS.Plus size={16} />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded text-white">
              <ICONS.Close size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Podcast List */}
        <div className={`border-r border-theme overflow-y-auto ${selectedPodcast ? 'w-1/3' : 'w-full'}`}>
          {podcasts.map(podcast => (
            <div
              key={podcast.id}
              onClick={() => setSelectedPodcast(podcast)}
              className={`p-3 border-b border-theme cursor-pointer hover:bg-[var(--bg-hover)] transition-colors ${
                selectedPodcast?.id === podcast.id ? 'bg-[var(--bg-hover)]' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <img src={podcast.imageUrl} className="w-12 h-12 object-cover rounded border border-theme" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-sm truncate">{podcast.title}</p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{podcast.author}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{podcast.episodes.length} episodes</p>
                </div>
              </div>
            </div>
          ))}

          {podcasts.length === 0 && (
            <div className="p-8 text-center text-[var(--text-muted)]">
              <ICONS.Radio size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-mono">No podcasts yet</p>
              <button onClick={() => setShowAddFeed(true)} className="mt-2 text-xs text-[var(--primary)]">
                + Add RSS Feed
              </button>
            </div>
          )}
        </div>

        {/* Episode List */}
        {selectedPodcast && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-theme bg-[var(--bg-hover)]">
              <button 
                onClick={() => setSelectedPodcast(null)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] mb-2"
              >
                ← Back
              </button>
              <h3 className="font-mono font-bold">{selectedPodcast.title}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">{selectedPodcast.description}</p>
            </div>

            <div className="divide-y divide-theme">
              {selectedPodcast.episodes.map(episode => (
                <div 
                  key={episode.id}
                  className={`p-4 hover:bg-[var(--bg-hover)] transition-colors ${
                    currentEpisode?.id === episode.id ? 'bg-[var(--bg-hover)]' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-mono font-bold text-sm">{episode.title}</h4>
                    <button 
                      onClick={() => playEpisode(episode)}
                      className="p-2 bg-[var(--primary)] text-black rounded-full hover:opacity-80"
                    >
                      {currentEpisode?.id === episode.id && isPlaying 
                        ? <ICONS.Pause size={12} /> 
                        : <ICONS.Play size={12} />
                      }
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mb-2">{episode.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                    <span>{formatDate(episode.publishDate)}</span>
                    <span>•</span>
                    <span>{episode.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mini Player */}
      {currentEpisode && (
        <div className="p-3 border-t-2 border-theme bg-[var(--bg-hover)] flex items-center gap-4">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 bg-[var(--primary)] text-black rounded"
          >
            {isPlaying ? <ICONS.Pause size={16} /> : <ICONS.Play size={16} />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs font-bold truncate">{currentEpisode.title}</p>
            <div className="w-full h-1 bg-[var(--bg-main)] mt-1 rounded">
              <div className="h-full bg-[var(--primary)] rounded" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">{currentEpisode.duration}</span>
        </div>
      )}

      {/* Add Feed Modal */}
      {showAddFeed && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border-2 border-theme p-6 w-full max-w-sm">
            <h3 className="font-mono font-bold mb-4">Add Podcast Feed</h3>
            <input
              type="url"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="w-full px-3 py-2 bg-[var(--bg-main)] border border-theme font-mono text-sm mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddFeed(false)} className="px-3 py-1 text-xs font-mono">Cancel</button>
              <button onClick={handleAddFeed} className="px-3 py-1 text-xs font-mono bg-[var(--primary)] text-black">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PodcastPlayer;
