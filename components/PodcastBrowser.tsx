/**
 * PodcastBrowser - Component for discovering and playing podcasts
 */
import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import {
  searchPodcasts,
  getTopPodcasts,
  getPodcastEpisodes,
  Podcast,
  PodcastEpisode,
  PODCAST_GENRES,
  formatDuration,
} from '../services/podcastService';

interface PodcastBrowserProps {
  onPlayEpisode?: (episode: PodcastEpisode, podcast: Podcast) => void;
  onClose?: () => void;
}

const PodcastBrowser: React.FC<PodcastBrowserProps> = ({ onPlayEpisode, onClose }) => {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [subscriptions, setSubscriptions] = useState<Podcast[]>([]);

  // Load subscriptions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('podcast_subscriptions');
    if (saved) {
      try {
        setSubscriptions(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load subscriptions');
      }
    }
  }, []);

  // Load top podcasts on mount
  useEffect(() => {
    loadTopPodcasts();
  }, [selectedGenre]);

  const loadTopPodcasts = async () => {
    setLoading(true);
    const results = await getTopPodcasts(selectedGenre || undefined, 12);
    setPodcasts(results);
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSelectedPodcast(null);
    const results = await searchPodcasts(searchQuery);
    setPodcasts(results);
    setLoading(false);
  };

  const handleSelectPodcast = async (podcast: Podcast) => {
    setSelectedPodcast(podcast);
    setLoadingEpisodes(true);
    const eps = await getPodcastEpisodes(podcast.feedUrl);
    setEpisodes(eps);
    setLoadingEpisodes(false);
  };

  const toggleSubscription = (podcast: Podcast) => {
    let updated: Podcast[];
    if (subscriptions.some(s => s.id === podcast.id)) {
      updated = subscriptions.filter(s => s.id !== podcast.id);
    } else {
      updated = [...subscriptions, podcast];
    }
    setSubscriptions(updated);
    localStorage.setItem('podcast_subscriptions', JSON.stringify(updated));
  };

  const isSubscribed = (podcastId: string) => subscriptions.some(s => s.id === podcastId);

  return (
    <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b-2 border-theme bg-[var(--bg-hover)] flex justify-between items-center">
        <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2">
          {selectedPodcast ? (
            <button onClick={() => setSelectedPodcast(null)} className="p-1 hover:bg-[var(--bg-main)]">
              <ICONS.ArrowLeft size={16} />
            </button>
          ) : (
            <span>🎙️</span>
          )}
          {selectedPodcast ? selectedPodcast.title : 'Podcasts'}
        </h2>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-main)] rounded">
            <ICONS.Close size={16} />
          </button>
        )}
      </div>

      {!selectedPodcast ? (
        <>
          {/* Search */}
          <div className="p-3 border-b border-theme">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search podcasts..."
                className="flex-1 p-2 border-2 border-theme bg-[var(--bg-main)] font-mono text-sm"
              />
              <button
                onClick={handleSearch}
                className="px-4 bg-[var(--primary)] text-black border-2 border-theme font-mono"
              >
                <ICONS.Search size={16} />
              </button>
            </div>
          </div>

          {/* Genres */}
          <div className="p-3 border-b border-theme">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedGenre(null)}
                className={`px-2 py-1 text-xs font-mono border ${
                  selectedGenre === null
                    ? 'bg-[var(--primary)] text-black border-theme'
                    : 'bg-[var(--bg-main)] border-transparent'
                }`}
              >
                All
              </button>
              {PODCAST_GENRES.map(genre => (
                <button
                  key={genre.id}
                  onClick={() => setSelectedGenre(genre.id)}
                  className={`px-2 py-1 text-xs font-mono border ${
                    selectedGenre === genre.id
                      ? 'bg-[var(--primary)] text-black border-theme'
                      : 'bg-[var(--bg-main)] border-transparent'
                  }`}
                >
                  {genre.name}
                </button>
              ))}
            </div>
          </div>

          {/* Subscriptions */}
          {subscriptions.length > 0 && (
            <div className="p-3 border-b border-theme">
              <label className="text-xs font-mono text-[var(--text-muted)] uppercase block mb-2">
                Your Subscriptions
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {subscriptions.map(podcast => (
                  <button
                    key={podcast.id}
                    onClick={() => handleSelectPodcast(podcast)}
                    className="w-16 flex-shrink-0"
                  >
                    <img
                      src={podcast.imageUrl}
                      alt={podcast.title}
                      className="w-16 h-16 border-2 border-theme object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Podcast Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <ICONS.Loader size={24} className="animate-spin" />
              </div>
            ) : podcasts.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <p className="text-4xl mb-2">🎙️</p>
                <p className="font-mono text-sm">No podcasts found</p>
                <p className="text-xs mt-1">Try searching for a topic!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {podcasts.map(podcast => (
                  <button
                    key={podcast.id}
                    onClick={() => handleSelectPodcast(podcast)}
                    className="text-left hover:bg-[var(--bg-hover)] p-2 border border-transparent hover:border-theme transition-colors"
                  >
                    <img
                      src={podcast.imageUrl}
                      alt={podcast.title}
                      className="w-full aspect-square object-cover border-2 border-theme mb-2"
                    />
                    <p className="font-mono text-sm font-bold truncate">{podcast.title}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{podcast.author}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Podcast Detail */}
          <div className="p-4 border-b border-theme flex gap-4">
            <img
              src={selectedPodcast.imageUrl}
              alt={selectedPodcast.title}
              className="w-24 h-24 border-2 border-theme object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs text-[var(--text-muted)]">{selectedPodcast.author}</p>
              <p className="text-sm mt-1 line-clamp-2">{selectedPodcast.description}</p>
              <button
                onClick={() => toggleSubscription(selectedPodcast)}
                className={`mt-2 px-3 py-1 text-xs font-mono border-2 ${
                  isSubscribed(selectedPodcast.id)
                    ? 'bg-[var(--primary)] text-black border-theme'
                    : 'bg-[var(--bg-main)] border-theme'
                }`}
              >
                {isSubscribed(selectedPodcast.id) ? '✓ Subscribed' : '+ Subscribe'}
              </button>
            </div>
          </div>

          {/* Episodes */}
          <div className="flex-1 overflow-y-auto">
            {loadingEpisodes ? (
              <div className="flex items-center justify-center h-32">
                <ICONS.Loader size={24} className="animate-spin" />
              </div>
            ) : episodes.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <p className="font-mono text-sm">No episodes available</p>
              </div>
            ) : (
              <div className="divide-y divide-theme">
                {episodes.map((episode, index) => (
                  <button
                    key={episode.id}
                    onClick={() => onPlayEpisode?.(episode, selectedPodcast)}
                    className="w-full p-4 text-left hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-[var(--primary)] text-black flex items-center justify-center font-mono font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-bold truncate">{episode.title}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          {formatDuration(episode.duration)} • {episode.publishDate.toLocaleDateString()}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                          {episode.description.replace(/<[^>]*>/g, '')}
                        </p>
                      </div>
                      <ICONS.Play size={16} className="text-[var(--primary)] flex-shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PodcastBrowser;
