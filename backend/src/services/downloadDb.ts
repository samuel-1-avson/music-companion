/**
 * Download Database Service - Supabase Edition
 * PostgreSQL database for caching downloaded songs
 * Avoids re-downloading the same song multiple times
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';

// Create Supabase client
let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('[DownloadDB] Connected to Supabase');
} else {
  console.warn('[DownloadDB] Supabase not configured, using in-memory storage');
}

// Ensure downloads directory exists (for audio files)
const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads');
const AUDIO_DIR = path.join(DOWNLOADS_DIR, 'audio');

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// In-memory fallback storage
const inMemoryStore = new Map<string, DownloadRecord>();

export type DownloadStatus = 'pending' | 'downloading' | 'processing' | 'complete' | 'error';

export interface DownloadRecord {
  id: string;
  video_id: string;
  title: string;
  artist: string | null;
  duration: string | null;
  cover_url: string | null;
  file_path: string | null;
  file_size: number;
  status: DownloadStatus;
  progress: number;
  error: string | null;
  download_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize the downloads table in Supabase
 * Run this once to set up the table
 */
export async function initializeTable(): Promise<void> {
  if (!supabase) return;
  
  // Note: Table should be created via Supabase Dashboard or migrations
  // This is just a placeholder for the SQL you'd run:
  /*
  CREATE TABLE IF NOT EXISTS downloads (
    id TEXT PRIMARY KEY,
    video_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    artist TEXT,
    duration TEXT,
    cover_url TEXT,
    file_path TEXT,
    file_size INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    error TEXT,
    download_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE INDEX IF NOT EXISTS idx_video_id ON downloads(video_id);
  CREATE INDEX IF NOT EXISTS idx_status ON downloads(status);
  */
}

/**
 * Check if a song is already downloaded
 */
export async function findByVideoId(videoId: string): Promise<DownloadRecord | null> {
  if (!supabase) {
    for (const record of inMemoryStore.values()) {
      if (record.video_id === videoId) return record;
    }
    return null;
  }

  const { data, error } = await supabase
    .from('downloads')
    .select('*')
    .eq('video_id', videoId)
    .single();

  if (error || !data) return null;
  return data as DownloadRecord;
}

/**
 * Get a download by ID
 */
export async function findById(id: string): Promise<DownloadRecord | null> {
  if (!supabase) {
    return inMemoryStore.get(id) || null;
  }

  const { data, error } = await supabase
    .from('downloads')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as DownloadRecord;
}

/**
 * Create a new download record
 */
export async function createDownload(data: {
  id: string;
  videoId: string;
  title: string;
  artist?: string;
  duration?: string;
  coverUrl?: string;
}): Promise<DownloadRecord> {
  const now = new Date().toISOString();
  const record: DownloadRecord = {
    id: data.id,
    video_id: data.videoId,
    title: data.title,
    artist: data.artist || null,
    duration: data.duration || null,
    cover_url: data.coverUrl || null,
    file_path: null,
    file_size: 0,
    status: 'pending',
    progress: 0,
    error: null,
    download_count: 1,
    created_at: now,
    updated_at: now
  };

  if (!supabase) {
    inMemoryStore.set(data.id, record);
    return record;
  }

  const { data: inserted, error } = await supabase
    .from('downloads')
    .insert(record)
    .select()
    .single();

  if (error) {
    console.error('[DownloadDB] Insert error:', error);
    // Fallback to memory
    inMemoryStore.set(data.id, record);
    return record;
  }

  return inserted as DownloadRecord;
}

/**
 * Update download status and progress
 */
export async function updateDownload(id: string, updates: Partial<{
  status: DownloadStatus;
  progress: number;
  filePath: string;
  fileSize: number;
  error: string;
}>): Promise<void> {
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString()
  };

  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.progress !== undefined) updateData.progress = updates.progress;
  if (updates.filePath !== undefined) updateData.file_path = updates.filePath;
  if (updates.fileSize !== undefined) updateData.file_size = updates.fileSize;
  if (updates.error !== undefined) updateData.error = updates.error;

  if (!supabase) {
    const record = inMemoryStore.get(id);
    if (record) {
      Object.assign(record, updateData);
    }
    return;
  }

  await supabase
    .from('downloads')
    .update(updateData)
    .eq('id', id);
}

/**
 * Increment download count (when cached file is reused)
 */
export async function incrementDownloadCount(videoId: string): Promise<void> {
  if (!supabase) {
    for (const record of inMemoryStore.values()) {
      if (record.video_id === videoId) {
        record.download_count++;
        record.updated_at = new Date().toISOString();
        break;
      }
    }
    return;
  }

  // Use RPC or raw SQL for increment
  const existing = await findByVideoId(videoId);
  if (existing) {
    await supabase
      .from('downloads')
      .update({ 
        download_count: existing.download_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('video_id', videoId);
  }
}

/**
 * Get all completed downloads
 */
export async function getAllCompleted(): Promise<DownloadRecord[]> {
  if (!supabase) {
    return Array.from(inMemoryStore.values()).filter(r => r.status === 'complete');
  }

  const { data, error } = await supabase
    .from('downloads')
    .select('*')
    .eq('status', 'complete')
    .order('updated_at', { ascending: false });

  return (data || []) as DownloadRecord[];
}

/**
 * Get all downloads (for admin/debug)
 */
export async function getAllDownloads(): Promise<DownloadRecord[]> {
  if (!supabase) {
    return Array.from(inMemoryStore.values());
  }

  const { data, error } = await supabase
    .from('downloads')
    .select('*')
    .order('updated_at', { ascending: false });

  return (data || []) as DownloadRecord[];
}

/**
 * Get active downloads (pending/downloading/processing)
 */
export async function getActiveDownloads(): Promise<DownloadRecord[]> {
  if (!supabase) {
    return Array.from(inMemoryStore.values()).filter(r => 
      ['pending', 'downloading', 'processing'].includes(r.status)
    );
  }

  const { data, error } = await supabase
    .from('downloads')
    .select('*')
    .in('status', ['pending', 'downloading', 'processing'])
    .order('created_at', { ascending: true });

  return (data || []) as DownloadRecord[];
}

/**
 * Delete a download record and its file
 */
export async function deleteDownload(id: string): Promise<boolean> {
  const record = await findById(id);
  if (!record) return false;
  
  // Delete file if exists
  if (record.file_path && fs.existsSync(record.file_path)) {
    fs.unlinkSync(record.file_path);
  }
  
  if (!supabase) {
    inMemoryStore.delete(id);
    return true;
  }

  const { error } = await supabase
    .from('downloads')
    .delete()
    .eq('id', id);

  return !error;
}

/**
 * Get storage stats
 */
export async function getStorageStats(): Promise<{ totalFiles: number; totalSize: number; totalDownloads: number }> {
  if (!supabase) {
    const completed = Array.from(inMemoryStore.values()).filter(r => r.status === 'complete');
    const totalSize = completed.reduce((sum, r) => sum + r.file_size, 0);
    const totalDownloads = Array.from(inMemoryStore.values()).reduce((sum, r) => sum + r.download_count, 0);
    return { totalFiles: completed.length, totalSize, totalDownloads };
  }

  const { data: completed } = await supabase
    .from('downloads')
    .select('file_size, download_count')
    .eq('status', 'complete');

  const { data: allDownloads } = await supabase
    .from('downloads')
    .select('download_count');

  const totalFiles = completed?.length || 0;
  const totalSize = completed?.reduce((sum, r) => sum + (r.file_size || 0), 0) || 0;
  const totalDownloads = allDownloads?.reduce((sum, r) => sum + (r.download_count || 0), 0) || 0;

  return { totalFiles, totalSize, totalDownloads };
}

export { DOWNLOADS_DIR, AUDIO_DIR };
