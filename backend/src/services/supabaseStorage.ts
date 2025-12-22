/**
 * Supabase Storage Service
 * Handles file uploads and downloads for user content
 */
import { getSupabaseClient } from './supabase.js';
import { config } from '../utils/config.js';
import fs from 'fs';
import path from 'path';

const BUCKET_NAME = 'user-uploads';
const DOWNLOADS_FOLDER = 'downloads';

interface UploadResult {
  success: boolean;
  path?: string;
  publicUrl?: string;
  error?: string;
}

interface DownloadMetadata {
  id?: string;
  userId: string;
  videoId: string;
  title: string;
  artist?: string;
  duration?: string;
  coverUrl?: string;
  storagePath: string;
  fileSize: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadToStorage(
  userId: string,
  videoId: string,
  filePath: string
): Promise<UploadResult> {
  if (!config.supabase.isConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Failed to get Supabase client' };
  }

  try {
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath) || '.mp3';
    const storagePath = `${DOWNLOADS_FOLDER}/${userId}/${videoId}${ext}`;

    console.log(`[SupabaseStorage] Uploading to: ${storagePath}`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (error) {
      console.error('[SupabaseStorage] Upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    console.log(`[SupabaseStorage] Upload successful: ${storagePath}`);

    return {
      success: true,
      path: storagePath,
      publicUrl: publicUrlData?.publicUrl,
    };
  } catch (err: any) {
    console.error('[SupabaseStorage] Upload exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Save download metadata to database
 */
export async function saveDownloadMetadata(
  metadata: DownloadMetadata
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!config.supabase.isConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Failed to get Supabase client' };
  }

  try {
    const { data, error } = await supabase
      .from('user_downloads')
      .upsert({
        user_id: metadata.userId,
        video_id: metadata.videoId,
        title: metadata.title,
        artist: metadata.artist,
        duration: metadata.duration,
        cover_url: metadata.coverUrl,
        storage_path: metadata.storagePath,
        file_size: metadata.fileSize,
        status: metadata.status,
        error: metadata.error,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,video_id',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[SupabaseStorage] Metadata save error:', error);
      console.error('[SupabaseStorage] Metadata was:', metadata);
      console.error('[SupabaseStorage] This is likely an RLS issue. Ensure SUPABASE_SERVICE_ROLE_KEY is set in backend environment to bypass RLS.');
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error('[SupabaseStorage] Metadata save exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get user's downloads from database
 */
export async function getUserDownloads(userId: string): Promise<DownloadMetadata[]> {
  if (!config.supabase.isConfigured) {
    return [];
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('user_downloads')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SupabaseStorage] Get downloads error:', error);
      return [];
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      videoId: d.video_id,
      title: d.title,
      artist: d.artist,
      duration: d.duration,
      coverUrl: d.cover_url,
      storagePath: d.storage_path,
      fileSize: d.file_size,
      status: d.status,
      error: d.error,
    }));
  } catch (err: any) {
    console.error('[SupabaseStorage] Get downloads exception:', err);
    return [];
  }
}

/**
 * Get a signed URL for streaming a download
 */
export async function getDownloadUrl(storagePath: string): Promise<string | null> {
  if (!config.supabase.isConfigured) {
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  try {
    // For public bucket, just return public URL
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return data?.publicUrl || null;
  } catch (err: any) {
    console.error('[SupabaseStorage] Get URL error:', err);
    return null;
  }
}

/**
 * Delete a download from storage and database
 */
export async function deleteUserDownload(
  userId: string,
  videoId: string
): Promise<boolean> {
  if (!config.supabase.isConfigured) {
    return false;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  try {
    // Get the storage path first
    const { data: download } = await supabase
      .from('user_downloads')
      .select('storage_path')
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .single();

    if (download?.storage_path) {
      // Delete from storage
      await supabase.storage
        .from(BUCKET_NAME)
        .remove([download.storage_path]);
    }

    // Delete from database
    const { error } = await supabase
      .from('user_downloads')
      .delete()
      .eq('user_id', userId)
      .eq('video_id', videoId);

    if (error) {
      console.error('[SupabaseStorage] Delete error:', error);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[SupabaseStorage] Delete exception:', err);
    return false;
  }
}

/**
 * Check if user has a specific download
 */
export async function hasUserDownload(
  userId: string,
  videoId: string
): Promise<DownloadMetadata | null> {
  if (!config.supabase.isConfigured) {
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('user_downloads')
      .select('*')
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .eq('status', 'completed')
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      videoId: data.video_id,
      title: data.title,
      artist: data.artist,
      duration: data.duration,
      coverUrl: data.cover_url,
      storagePath: data.storage_path,
      fileSize: data.file_size,
      status: data.status,
      error: data.error,
    };
  } catch (err: any) {
    return null;
  }
}
