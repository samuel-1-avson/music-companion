/**
 * Download Service
 * Core service for downloading audio from YouTube using Python yt-dlp
 * Updated to use async Supabase database
 */
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import * as db from './downloadDb.js';

// Max concurrent downloads
const MAX_CONCURRENT = 3;

// Event emitter for progress updates
export const downloadEvents = new EventEmitter();

// Active downloads tracker
const activeDownloads = new Map<string, { cancel: () => void }>();

/**
 * Generate unique download ID
 */
function generateId(): string {
  return `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Start downloading audio from a YouTube video
 */
export async function startDownload(videoId: string, metadata: {
  title: string;
  artist?: string;
  duration?: string;
  coverUrl?: string;
}): Promise<{ id: string; cached: boolean }> {
  
  console.log(`[Download Service] startDownload called for: ${videoId}`);
  
  try {
    // Check if already downloaded
    console.log(`[Download Service] Checking cache...`);
    const existing = await db.findByVideoId(videoId);
    
    if (existing) {
      // If complete and file exists, reuse cached file
      if (existing.status === 'complete' && existing.file_path && fs.existsSync(existing.file_path)) {
        await db.incrementDownloadCount(videoId);
        console.log(`[Download] Using cached file for ${videoId}`);
        return { id: existing.id, cached: true };
      }
      
      // If currently downloading, return the existing record
      if (existing.status === 'downloading' || existing.status === 'pending') {
        console.log(`[Download] Already in progress for ${videoId}`);
        return { id: existing.id, cached: false };
      }
      
      // If failed or processing without a file, delete and retry
      console.log(`[Download] Cleaning up failed record for ${videoId}`);
      await db.deleteDownload(existing.id);
    }
    
    // Check concurrent download limit
    console.log(`[Download Service] Checking concurrent downloads...`);
    const activeDownloadsCount = (await db.getActiveDownloads()).length;
    if (activeDownloadsCount >= MAX_CONCURRENT) {
      throw new Error(`Maximum concurrent downloads (${MAX_CONCURRENT}) reached. Please wait.`);
    }
    
    // Create download record
    console.log(`[Download Service] Creating download record...`);
    const id = generateId();
    const record = await db.createDownload({
      id,
      videoId,
      title: metadata.title,
      artist: metadata.artist,
      duration: metadata.duration,
      coverUrl: metadata.coverUrl
    });
    
    console.log(`[Download Service] Record created: ${id}`);
    
    // Start download in background
    processDownload(id, videoId);
    
    return { id, cached: false };
  } catch (error: any) {
    console.error(`[Download Service] ERROR in startDownload:`, error);
    throw error;
  }
}

/**
 * Process the actual download using Python script (avoids path-with-spaces issues)
 */
async function processDownload(id: string, videoId: string): Promise<void> {
  let cancelled = false;
  
  try {
    await db.updateDownload(id, { status: 'downloading', progress: 0 });
    downloadEvents.emit('progress', { id, status: 'downloading', progress: 0 });
    
    console.log(`[Download] Starting download via Python: ${videoId}`);
    
    // Path to Python download script
    const scriptPath = path.join(process.cwd(), 'scripts', 'download.py');
    const outputDir = db.AUDIO_DIR;
    
    // Create cancel handler
    let childProcess: any = null;
    activeDownloads.set(id, { 
      cancel: () => { 
        cancelled = true; 
        if (childProcess) {
          childProcess.kill();
        }
      } 
    });
    
    // Run Python script and get JSON result
    const result = await new Promise<any>((resolve, reject) => {
      // Use spawn without shell to properly handle paths with spaces
      childProcess = spawn('python', [scriptPath, videoId, outputDir]);
      
      let stdout = '';
      let stderr = '';
      
      childProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      
      childProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        console.log(`[Download] Python stderr: ${data.toString()}`);
      });
      
      childProcess.on('close', (code: number) => {
        if (cancelled) {
          reject(new Error('Cancelled by user'));
          return;
        }
        
        try {
          // Parse JSON output from Python script
          const jsonOutput = stdout.trim();
          if (!jsonOutput) {
            reject(new Error(stderr || 'No output from download script'));
            return;
          }
          const result = JSON.parse(jsonOutput);
          resolve(result);
        } catch (e: any) {
          console.error('[Download] Failed to parse Python output:', stdout, stderr);
          reject(new Error(`Failed to parse result: ${e.message}`));
        }
      });
      
      childProcess.on('error', (err: Error) => {
        reject(err);
      });
    });
    
    if (cancelled) return;
    
    if (!result.success) {
      throw new Error(result.error || 'Download failed');
    }
    
    // Update database with result from Python
    await db.updateDownload(id, {
      status: 'complete',
      progress: 100,
      filePath: result.filePath,
      fileSize: result.fileSize
    });
    
    const fileSizeMB = (result.fileSize / (1024 * 1024)).toFixed(2);
    downloadEvents.emit('progress', { 
      id, 
      status: 'complete', 
      progress: 100,
      file_size: result.fileSize 
    });
    console.log(`[Download] Complete: ${videoId} (${fileSizeMB} MB)`);
    
  } catch (error: any) {
    if (cancelled) {
      await db.updateDownload(id, { status: 'error', error: 'Cancelled by user' });
      downloadEvents.emit('progress', { id, status: 'error', error: 'Cancelled' });
    } else {
      console.error(`[Download] Error for ${videoId}:`, error.message);
      
      let errorMsg = error.message || 'Unknown error';
      if (errorMsg.length > 100) errorMsg = errorMsg.substring(0, 100) + '...';
      
      await db.updateDownload(id, { status: 'error', error: errorMsg });
      downloadEvents.emit('progress', { id, status: 'error', error: errorMsg });
      console.error(`[Download] Failed: ${videoId}`, errorMsg);
    }
  } finally {
    activeDownloads.delete(id);
  }
}

/**
 * Cancel a download
 */
export function cancelDownload(id: string): boolean {
  const active = activeDownloads.get(id);
  if (active) {
    active.cancel();
    return true;
  }
  return false;
}

/**
 * Get download status
 */
export async function getDownloadStatus(id: string): Promise<db.DownloadRecord | null> {
  return await db.findById(id);
}

/**
 * Get all completed downloads
 */
export async function getCompletedDownloads(): Promise<db.DownloadRecord[]> {
  return await db.getAllCompleted();
}

/**
 * Get all downloads
 */
export async function getAllDownloads(): Promise<db.DownloadRecord[]> {
  return await db.getAllDownloads();
}

/**
 * Delete a download
 */
export async function deleteDownload(id: string): Promise<boolean> {
  return await db.deleteDownload(id);
}

/**
 * Get storage statistics
 */
export async function getStorageStats() {
  return await db.getStorageStats();
}

/**
 * Stream a downloaded file
 */
export async function getFilePath(id: string): Promise<string | null> {
  const record = await db.findById(id);
  if (record && record.file_path && fs.existsSync(record.file_path)) {
    return record.file_path;
  }
  return null;
}

/**
 * Check if a video is already downloaded
 */
export async function isDownloaded(videoId: string): Promise<db.DownloadRecord | null> {
  const record = await db.findByVideoId(videoId);
  if (record && record.status === 'complete' && record.file_path && fs.existsSync(record.file_path)) {
    return record;
  }
  return null;
}
