/**
 * AI Routes
 * Proxy for Gemini AI API
 */
import { Router } from 'express';
import { config } from '../utils/config.js';
import type { Song } from '../types/index.js';

const router = Router();

// Gemini API configuration
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface GeminiRequest {
  contents: Array<{
    parts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }>;
  }>;
  generationConfig?: {
    responseMimeType?: string;
    responseSchema?: any;
  };
}

/**
 * Generate playlist from prompt
 * POST /api/ai/playlist
 */
router.post('/playlist', async (req, res) => {
  const { prompt, provider = 'YOUTUBE', imageBase64 } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'Missing prompt' });
  }

  if (!config.gemini.isConfigured) {
    return res.status(503).json({ success: false, error: 'Gemini API not configured' });
  }

  try {
    const songs = await generatePlaylist(prompt, provider, imageBase64);
    res.json({ success: true, data: songs });
  } catch (err: any) {
    console.error('Playlist generation error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to generate playlist' });
  }
});

/**
 * Analyze song meaning
 * POST /api/ai/analyze
 */
router.post('/analyze', async (req, res) => {
  const { title, artist, lyrics } = req.body;

  if (!title || !artist) {
    return res.status(400).json({ success: false, error: 'Missing title or artist' });
  }

  if (!config.gemini.isConfigured) {
    return res.status(503).json({ success: false, error: 'Gemini API not configured' });
  }

  try {
    const analysis = await analyzeSong(title, artist, lyrics);
    res.json({ success: true, data: analysis });
  } catch (err: any) {
    console.error('Song analysis error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to analyze song' });
  }
});

/**
 * Get song lyrics
 * POST /api/ai/lyrics
 */
router.post('/lyrics', async (req, res) => {
  const { title, artist } = req.body;

  if (!title || !artist) {
    return res.status(400).json({ success: false, error: 'Missing title or artist' });
  }

  if (!config.gemini.isConfigured) {
    return res.status(503).json({ success: false, error: 'Gemini API not configured' });
  }

  try {
    const lyrics = await getLyrics(title, artist);
    res.json({ success: true, data: { lyrics } });
  } catch (err: any) {
    console.error('Lyrics error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get lyrics' });
  }
});

/**
 * Generate greeting
 * GET /api/ai/greeting?name=User
 */
router.get('/greeting', async (req, res) => {
  const { name = 'User' } = req.query;

  if (!config.gemini.isConfigured) {
    return res.status(503).json({ success: false, error: 'Gemini API not configured' });
  }

  try {
    const greeting = await generateGreeting(name as string);
    res.json({ success: true, data: { greeting } });
  } catch (err: any) {
    console.error('Greeting error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to generate greeting' });
  }
});

// --- GEMINI API CALLS ---

async function callGemini(request: GeminiRequest): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${config.gemini.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function generatePlaylist(prompt: string, provider: string, imageBase64?: string): Promise<{ explanation: string; songs: Song[] }> {
  const systemPrompt = `You are a music recommendation AI. Generate a playlist of 5-8 songs based on the user's request.
Return ONLY valid JSON in this format:
{
  "explanation": "Brief explanation of why these songs match",
  "songs": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "mood": "one word mood"
    }
  ]
}`;

  const parts: any[] = [{ text: systemPrompt + '\n\nUser request: ' + prompt }];
  
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64
      }
    });
  }

  const text = await callGemini({
    contents: [{ parts }]
  });

  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      explanation: parsed.explanation || 'Here are your songs!',
      songs: (parsed.songs || []).map((s: any, i: number) => ({
        id: `ai-${Date.now()}-${i}`,
        title: s.title,
        artist: s.artist,
        album: s.album || 'AI Generated',
        duration: '3:30',
        coverUrl: `https://picsum.photos/200/200?random=${Date.now() + i}`,
        mood: s.mood || 'AI Pick'
      }))
    };
  } catch (e) {
    console.error('Failed to parse Gemini response:', text);
    throw new Error('Failed to parse AI response');
  }
}

async function analyzeSong(title: string, artist: string, lyrics?: string): Promise<{ meaning: string; themes: string[]; mood: string }> {
  const prompt = `Analyze the song "${title}" by ${artist}.
${lyrics ? `Lyrics:\n${lyrics}\n` : ''}
Return ONLY valid JSON:
{
  "meaning": "Brief explanation of the song's meaning",
  "themes": ["theme1", "theme2", "theme3"],
  "mood": "overall mood"
}`;

  const text = await callGemini({
    contents: [{ parts: [{ text: prompt }] }]
  });

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    return {
      meaning: 'Could not analyze this song.',
      themes: [],
      mood: 'Unknown'
    };
  }
}

async function getLyrics(title: string, artist: string): Promise<string> {
  const prompt = `Write or recall the lyrics for "${title}" by ${artist}. 
If you don't know the exact lyrics, say "Lyrics not available for this song."
Return ONLY the lyrics text, no JSON, no additional commentary.`;

  return await callGemini({
    contents: [{ parts: [{ text: prompt }] }]
  });
}

async function generateGreeting(name: string): Promise<string> {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const prompt = `Generate a short, friendly, music-themed greeting for ${name} on this ${timeOfDay}. 
One sentence only. Be creative and mention music/listening.`;

  return await callGemini({
    contents: [{ parts: [{ text: prompt }] }]
  });
}

export default router;
