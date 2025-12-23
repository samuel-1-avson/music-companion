/**
 * Podcast Service - Search and discover podcasts
 * 
 * Uses iTunes Podcast API (free, no key required)
 * Alternative: Podcast Index API (requires free key)
 */

export interface Podcast {
  id: string;
  title: string;
  author: string;
  description: string;
  imageUrl: string;
  feedUrl: string;
  genres: string[];
  episodeCount?: number;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  description: string;
  audioUrl: string;
  duration: number; // in seconds
  publishDate: Date;
  imageUrl?: string;
}

/**
 * Search podcasts using iTunes API
 */
export async function searchPodcasts(query: string, limit = 20): Promise<Podcast[]> {
  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&limit=${limit}`
    );
    
    if (!response.ok) throw new Error('Search failed');
    
    const data = await response.json();
    
    return data.results.map((item: any) => ({
      id: String(item.collectionId),
      title: item.collectionName,
      author: item.artistName,
      description: item.description || '',
      imageUrl: item.artworkUrl600 || item.artworkUrl100,
      feedUrl: item.feedUrl,
      genres: item.genres || [],
      episodeCount: item.trackCount,
    }));
  } catch (error) {
    console.error('[Podcast] Search error:', error);
    return [];
  }
}

/**
 * Get top podcasts by genre using iTunes API
 */
export async function getTopPodcasts(genreId?: number, limit = 20): Promise<Podcast[]> {
  try {
    const genreParam = genreId ? `&genreId=${genreId}` : '';
    const response = await fetch(
      `https://itunes.apple.com/search?term=podcast&media=podcast&limit=${limit}${genreParam}`
    );
    
    if (!response.ok) throw new Error('Failed to get top podcasts');
    
    const data = await response.json();
    
    return data.results.map((item: any) => ({
      id: String(item.collectionId),
      title: item.collectionName,
      author: item.artistName,
      description: item.description || '',
      imageUrl: item.artworkUrl600 || item.artworkUrl100,
      feedUrl: item.feedUrl,
      genres: item.genres || [],
      episodeCount: item.trackCount,
    }));
  } catch (error) {
    console.error('[Podcast] Top podcasts error:', error);
    return [];
  }
}

/**
 * Parse RSS feed to get episodes
 */
export async function getPodcastEpisodes(feedUrl: string): Promise<PodcastEpisode[]> {
  try {
    // Use a CORS proxy for RSS feeds
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) throw new Error('Failed to fetch RSS');
    
    const xml = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    
    const items = doc.querySelectorAll('item');
    const episodes: PodcastEpisode[] = [];
    
    items.forEach((item, index) => {
      const enclosure = item.querySelector('enclosure');
      const audioUrl = enclosure?.getAttribute('url');
      
      if (!audioUrl) return;
      
      const durationStr = item.querySelector('itunes\\:duration, duration')?.textContent || '0';
      const duration = parseDuration(durationStr);
      
      episodes.push({
        id: `episode_${index}`,
        title: item.querySelector('title')?.textContent || 'Untitled Episode',
        description: item.querySelector('description')?.textContent || '',
        audioUrl,
        duration,
        publishDate: new Date(item.querySelector('pubDate')?.textContent || Date.now()),
        imageUrl: item.querySelector('itunes\\:image')?.getAttribute('href') || undefined,
      });
    });
    
    return episodes;
  } catch (error) {
    console.error('[Podcast] Episodes error:', error);
    return [];
  }
}

/**
 * Parse duration string to seconds
 */
function parseDuration(duration: string): number {
  // Handle HH:MM:SS or MM:SS format
  if (duration.includes(':')) {
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }
  // Handle plain seconds
  return parseInt(duration) || 0;
}

// Podcast genres (iTunes)
export const PODCAST_GENRES = [
  { id: 1301, name: 'Arts' },
  { id: 1303, name: 'Comedy' },
  { id: 1304, name: 'Education' },
  { id: 1310, name: 'Music' },
  { id: 1311, name: 'News' },
  { id: 1314, name: 'Science' },
  { id: 1324, name: 'Technology' },
  { id: 1309, name: 'TV & Film' },
  { id: 1321, name: 'Business' },
  { id: 1323, name: 'True Crime' },
];

/**
 * Format episode duration for display
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}
