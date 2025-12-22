/**
 * Download API Routes
 * Endpoints for downloading and managing audio files
 * Updated for async Supabase database
 */
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import * as downloadService from '../services/download.js';

const router = Router();

/**
 * Start a new download
 * POST /api/downloads
 */
router.post('/', async (req, res) => {
  const { videoId, title, artist, duration, coverUrl } = req.body;
  
  if (!videoId || !title) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: videoId, title' 
    });
  }
  
  // Validate videoId format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid YouTube video ID' 
    });
  }
  
  try {
    console.log(`[Download Route] Starting download for: ${videoId}`);
    const result = await downloadService.startDownload(videoId, {
      title,
      artist,
      duration,
      coverUrl
    });
    
    console.log(`[Download Route] Success:`, result);
    res.json({
      success: true,
      data: {
        id: result.id,
        cached: result.cached,
        message: result.cached ? 'Song already downloaded' : 'Download started'
      }
    });
  } catch (error: any) {
    console.error(`[Download Route] ERROR:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to start download' 
    });
  }
});

/**
 * Get all downloads
 * GET /api/downloads
 */
router.get('/', async (req, res) => {
  try {
    const downloads = await downloadService.getAllDownloads();
    const stats = await downloadService.getStorageStats();
    
    res.json({
      success: true,
      data: {
        downloads,
        stats: {
          totalFiles: stats.totalFiles,
          totalSize: stats.totalSize,
          totalSizeMB: (stats.totalSize / 1024 / 1024).toFixed(2),
          totalDownloads: stats.totalDownloads
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get completed downloads only
 * GET /api/downloads/completed
 */
router.get('/completed', async (req, res) => {
  try {
    const downloads = await downloadService.getCompletedDownloads();
    res.json({ success: true, data: downloads });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Check if a video is already downloaded
 * GET /api/downloads/check/:videoId
 */
router.get('/check/:videoId', async (req, res) => {
  const { videoId } = req.params;
  
  try {
    const existing = await downloadService.isDownloaded(videoId);
    res.json({
      success: true,
      data: {
        downloaded: !!existing,
        download: existing
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get storage stats
 * GET /api/downloads/stats
 * NOTE: This must be before /:id to prevent "stats" being matched as an ID
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await downloadService.getStorageStats();
    res.json({
      success: true,
      data: {
        ...stats,
        totalSizeMB: (stats.totalSize / 1024 / 1024).toFixed(2)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get download status
 * GET /api/downloads/:id
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const download = await downloadService.getDownloadStatus(id);
    if (!download) {
      return res.status(404).json({ success: false, error: 'Download not found' });
    }
    res.json({ success: true, data: download });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Stream/download audio file
 * GET /api/downloads/:id/stream
 */
router.get('/:id/stream', async (req, res) => {
  const { id } = req.params;
  
  try {
    const filePath = await downloadService.getFilePath(id);
    if (!filePath) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    // Detect content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'audio/mpeg'; // default
    if (ext === '.m4a') contentType = 'audio/mp4';
    else if (ext === '.webm') contentType = 'audio/webm';
    else if (ext === '.ogg') contentType = 'audio/ogg';
    else if (ext === '.wav') contentType = 'audio/wav';
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      // Handle range requests for seeking
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      
      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });
      stream.pipe(res);
    } else {
      // Full file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Download file (force download)
 * GET /api/downloads/:id/file
 */
router.get('/:id/file', async (req, res) => {
  const { id } = req.params;
  
  try {
    const download = await downloadService.getDownloadStatus(id);
    const filePath = await downloadService.getFilePath(id);
    
    if (!download || !filePath) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    // Sanitize filename
    const filename = `${download.title.replace(/[^a-z0-9]/gi, '_')}.mp3`;
    
    res.download(filePath, filename);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Cancel a download
 * POST /api/downloads/:id/cancel
 */
router.post('/:id/cancel', (req, res) => {
  const { id } = req.params;
  
  try {
    const cancelled = downloadService.cancelDownload(id);
    res.json({ 
      success: true, 
      data: { cancelled } 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a download
 * DELETE /api/downloads/:id
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const deleted = await downloadService.deleteDownload(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Download not found' });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// USER-SPECIFIC CLOUD DOWNLOAD ROUTES
// =============================================
import * as supabaseStorage from '../services/supabaseStorage.js';

/**
 * Start a cloud download for a specific user
 * POST /api/downloads/user/:userId
 */
router.post('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { videoId, title, artist, duration, coverUrl } = req.body;
  
  if (!videoId || !title) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: videoId, title' 
    });
  }
  
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid YouTube video ID' 
    });
  }
  
  try {
    // Check if user already has this download in cloud
    const existing = await supabaseStorage.hasUserDownload(userId, videoId);
    if (existing) {
      return res.json({
        success: true,
        data: {
          id: existing.id,
          cached: true,
          cloudUrl: await supabaseStorage.getDownloadUrl(existing.storagePath),
          message: 'Song already in your cloud library'
        }
      });
    }
    
    // Start local download first
    console.log(`[Download Route] Starting cloud download for user ${userId}: ${videoId}`);
    const result = await downloadService.startDownload(videoId, {
      title,
      artist,
      duration,
      coverUrl
    });
    
    // After download completes, upload to Supabase Storage
    // This is done async - we return immediately
    uploadToCloudAfterDownload(userId, result.id, videoId, { title, artist, duration, coverUrl });
    
    res.json({
      success: true,
      data: {
        id: result.id,
        cached: result.cached,
        message: result.cached ? 'Uploading to cloud...' : 'Download started, will sync to cloud'
      }
    });
  } catch (error: any) {
    console.error(`[Download Route] Cloud download ERROR:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to start cloud download' 
    });
  }
});

/**
 * Helper: Upload to cloud after local download completes
 */
async function uploadToCloudAfterDownload(
  userId: string, 
  downloadId: string, 
  videoId: string,
  metadata: { title: string; artist?: string; duration?: string; coverUrl?: string }
) {
  // Wait for download to complete (poll every 2 seconds for up to 5 minutes)
  const maxAttempts = 150;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const status = await downloadService.getDownloadStatus(downloadId);
    if (!status) break;
    
    if (status.status === 'complete' && status.file_path) {
      console.log(`[Cloud Upload] Download complete, uploading to cloud: ${videoId}`);
      
      // Upload to Supabase Storage
      const uploadResult = await supabaseStorage.uploadToStorage(userId, videoId, status.file_path);
      
      if (uploadResult.success && uploadResult.path) {
        // Save metadata to user_downloads table
        await supabaseStorage.saveDownloadMetadata({
          userId,
          videoId,
          title: metadata.title,
          artist: metadata.artist,
          duration: metadata.duration,
          coverUrl: metadata.coverUrl,
          storagePath: uploadResult.path,
          fileSize: status.file_size || 0,
          status: 'completed'
        });
        console.log(`[Cloud Upload] Successfully uploaded to cloud: ${videoId}`);
      } else {
        console.error(`[Cloud Upload] Failed to upload: ${uploadResult.error}`);
        await supabaseStorage.saveDownloadMetadata({
          userId,
          videoId,
          title: metadata.title,
          storagePath: '',
          fileSize: 0,
          status: 'failed',
          error: uploadResult.error
        });
      }
      break;
    }
    
    if (status.status === 'error') {
      console.error(`[Cloud Upload] Download failed: ${status.error}`);
      break;
    }
  }
}

/**
 * Get user's cloud downloads
 * GET /api/downloads/user/:userId
 */
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const downloads = await supabaseStorage.getUserDownloads(userId);
    
    // Add cloud URLs to each download
    const downloadsWithUrls = await Promise.all(
      downloads.map(async (d) => ({
        ...d,
        cloudUrl: await supabaseStorage.getDownloadUrl(d.storagePath)
      }))
    );
    
    res.json({
      success: true,
      data: {
        downloads: downloadsWithUrls,
        count: downloadsWithUrls.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a user's cloud download
 * DELETE /api/downloads/user/:userId/:videoId
 */
router.delete('/user/:userId/:videoId', async (req, res) => {
  const { userId, videoId } = req.params;
  
  try {
    const deleted = await supabaseStorage.deleteUserDownload(userId, videoId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Download not found' });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Check if user has a specific download in cloud
 * GET /api/downloads/user/:userId/check/:videoId
 */
router.get('/user/:userId/check/:videoId', async (req, res) => {
  const { userId, videoId } = req.params;
  
  try {
    const download = await supabaseStorage.hasUserDownload(userId, videoId);
    if (download) {
      const cloudUrl = await supabaseStorage.getDownloadUrl(download.storagePath);
      res.json({
        success: true,
        data: {
          exists: true,
          download: { ...download, cloudUrl }
        }
      });
    } else {
      res.json({
        success: true,
        data: { exists: false }
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

