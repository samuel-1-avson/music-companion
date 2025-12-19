/**
 * Download Service (Frontend)
 * Handles downloading songs and managing offline library
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export interface DownloadRecord {
  id: string;
  video_id: string;
  title: string;
  artist: string | null;
  duration: string | null;
  cover_url: string | null;
  file_path: string | null;
  file_size: number;
  status: 'pending' | 'downloading' | 'processing' | 'complete' | 'error';
  progress: number;
  error: string | null;
  download_count: number;
  created_at: string;
  updated_at: string;
}

export interface DownloadStats {
  totalFiles: number;
  totalSize: number;
  totalSizeMB: string;
  totalDownloads: number;
}

/**
 * Start downloading a song
 */
export async function startDownload(song: {
  videoId: string;
  title: string;
  artist?: string;
  duration?: string;
  coverUrl?: string;
}): Promise<{ success: boolean; id?: string; cached?: boolean; error?: string }> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/downloads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: song.videoId,
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        coverUrl: song.coverUrl
      })
    });
    
    const data = await response.json();
    if (data.success) {
      return { success: true, id: data.data.id, cached: data.data.cached };
    }
    return { success: false, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Get all downloads with stats
 */
export async function getAllDownloads(): Promise<{ downloads: DownloadRecord[]; stats: DownloadStats } | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/downloads`);
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error('Failed to get downloads:', error);
    return null;
  }
}

/**
 * Get completed downloads only
 */
export async function getCompletedDownloads(): Promise<DownloadRecord[]> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/downloads/completed`);
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    return [];
  } catch (error) {
    console.error('Failed to get completed downloads:', error);
    return [];
  }
}

/**
 * Check if a song is already downloaded
 */
export async function isDownloaded(videoId: string): Promise<DownloadRecord | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/downloads/check/${videoId}`);
    const data = await response.json();
    if (data.success && data.data.downloaded) {
      return data.data.download;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get download status
 */
export async function getDownloadStatus(id: string): Promise<DownloadRecord | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/downloads/${id}`);
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get the stream URL for a downloaded song
 */
export function getStreamUrl(id: string): string {
  return `${BACKEND_URL}/api/downloads/${id}/stream`;
}

/**
 * Get the download URL for saving a song
 */
export function getDownloadUrl(id: string): string {
  return `${BACKEND_URL}/api/downloads/${id}/file`;
}

/**
 * Cancel a download
 */
export async function cancelDownload(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/downloads/${id}/cancel`, {
      method: 'POST'
    });
    const data = await response.json();
    return data.success && data.data.cancelled;
  } catch (error) {
    return false;
  }
}

/**
 * Delete a download
 */
export async function deleteDownload(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/downloads/${id}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    return false;
  }
}

/**
 * Extract YouTube video ID from a song object
 */
export function extractVideoId(songId: string): string | null {
  // Handle yt-VIDEOID format
  if (songId.startsWith('yt-')) {
    return songId.substring(3);
  }
  return null;
}

/**
 * Start polling for download progress
 */
export function pollDownloadProgress(
  id: string, 
  onProgress: (status: DownloadRecord) => void,
  intervalMs: number = 1000
): () => void {
  let active = true;
  
  const poll = async () => {
    if (!active) return;
    
    const status = await getDownloadStatus(id);
    if (status) {
      onProgress(status);
      
      // Stop polling if complete or error
      if (status.status === 'complete' || status.status === 'error') {
        active = false;
        return;
      }
    }
    
    if (active) {
      setTimeout(poll, intervalMs);
    }
  };
  
  poll();
  
  // Return cancel function
  return () => { active = false; };
}
