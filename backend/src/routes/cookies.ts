/**
 * Routes for managing YouTube cookies for yt-dlp authentication
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

const COOKIES_PATH = process.env.COOKIES_PATH || '/app/data/youtube_cookies.txt';

/**
 * Upload YouTube cookies file
 * POST /api/cookies/youtube
 * Body: { cookies: string (content of cookies.txt) }
 */
router.post('/youtube', async (req, res) => {
  try {
    const { cookies } = req.body;
    
    if (!cookies || typeof cookies !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing cookies content. Expected { cookies: "..." }' 
      });
    }

    // Validate cookies format (Netscape format starts with # or domain)
    const lines = cookies.trim().split('\n');
    const validLines = lines.filter(line => 
      line.startsWith('#') || 
      line.startsWith('.') || 
      line.includes('\t')
    );

    if (validLines.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Invalid cookies format. Please export cookies in Netscape format using a browser extension.'
      });
    }

    // Ensure data directory exists
    const dataDir = path.dirname(COOKIES_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write cookies file
    fs.writeFileSync(COOKIES_PATH, cookies, 'utf-8');
    
    console.log(`[Cookies] YouTube cookies saved to ${COOKIES_PATH} (${lines.length} lines)`);

    res.json({
      success: true,
      message: 'YouTube cookies saved successfully',
      data: {
        linesCount: lines.length,
        path: COOKIES_PATH
      }
    });
  } catch (error: any) {
    console.error('[Cookies] Error saving cookies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Check if YouTube cookies are configured
 * GET /api/cookies/youtube/status
 */
router.get('/youtube/status', (req, res) => {
  try {
    const exists = fs.existsSync(COOKIES_PATH);
    let lastModified = null;
    let size = 0;

    if (exists) {
      const stats = fs.statSync(COOKIES_PATH);
      lastModified = stats.mtime.toISOString();
      size = stats.size;
    }

    res.json({
      success: true,
      data: {
        configured: exists,
        lastModified,
        size
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete YouTube cookies
 * DELETE /api/cookies/youtube
 */
router.delete('/youtube', (req, res) => {
  try {
    if (fs.existsSync(COOKIES_PATH)) {
      fs.unlinkSync(COOKIES_PATH);
      console.log('[Cookies] YouTube cookies deleted');
    }

    res.json({
      success: true,
      message: 'YouTube cookies removed'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
