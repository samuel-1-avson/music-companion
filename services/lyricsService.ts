/**
 * Lyrics Service using LRCLIB API
 * Free, no API key required, supports synchronized lyrics
 * https://lrclib.net/docs
 */

const LRCLIB_BASE_URL = 'https://lrclib.net/api';

export interface LyricsResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface LyricLine {
  time: number; // in seconds
  text: string;
}

/**
 * Fetch lyrics for a song
 */
export async function getLyrics(
  trackName: string,
  artistName: string,
  albumName?: string,
  duration?: number
): Promise<LyricsResult | null> {
  try {
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
    });
    
    if (albumName) {
      params.append('album_name', albumName);
    }
    if (duration) {
      params.append('duration', Math.round(duration).toString());
    }

    const response = await fetch(`${LRCLIB_BASE_URL}/get?${params}`, {
      headers: {
        'User-Agent': 'MusicCompanion/1.0.0 (https://music-companion-seven.vercel.app)',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[Lyrics] No lyrics found for:', trackName, '-', artistName);
        return null;
      }
      throw new Error(`LRCLIB API error: ${response.status}`);
    }

    const data: LyricsResult = await response.json();
    console.log('[Lyrics] Found lyrics for:', trackName, data.syncedLyrics ? '(synced)' : '(plain)');
    return data;
  } catch (error) {
    console.error('[Lyrics] Failed to fetch:', error);
    return null;
  }
}

/**
 * Search for lyrics (returns multiple results)
 */
export async function searchLyrics(query: string): Promise<LyricsResult[]> {
  try {
    const response = await fetch(`${LRCLIB_BASE_URL}/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'MusicCompanion/1.0.0 (https://music-companion-seven.vercel.app)',
      },
    });

    if (!response.ok) {
      throw new Error(`LRCLIB search error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Lyrics] Search failed:', error);
    return [];
  }
}

/**
 * Parse LRC format synced lyrics into array of {time, text}
 * LRC format: [mm:ss.xx]text
 */
export function parseSyncedLyrics(lrcContent: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const line of lrcContent.split('\n')) {
    const match = line.match(regex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
      const time = minutes * 60 + seconds + milliseconds / 1000;
      const text = match[4].trim();
      
      if (text) {
        lines.push({ time, text });
      }
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

/**
 * Parse plain lyrics into lines
 */
export function parsePlainLyrics(content: string): string[] {
  return content.split('\n').filter(line => line.trim());
}

/**
 * Get the current lyric line based on playback time
 */
export function getCurrentLyricIndex(lyrics: LyricLine[], currentTime: number): number {
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time) {
      return i;
    }
  }
  return -1;
}
