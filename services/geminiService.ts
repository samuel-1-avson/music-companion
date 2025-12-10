
import { GoogleGenAI, Type } from "@google/genai";
import { Song, DashboardInsight, MoodData, MusicProvider } from '../types';
import { searchSpotifyTrack } from './spotifyService';
import { searchUnified } from './musicService';

// Ensure API Key is available
const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

export const generatePlaylistFromContext = async (
  context: string,
  provider: MusicProvider = 'YOUTUBE',
  imageBase64?: string,
  spotifyToken?: string
): Promise<{ explanation: string; songs: Song[]; downloadTrack?: string }> => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const model = "gemini-2.5-flash";
  
  const parts: any[] = [];
  
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg', 
        data: imageBase64
      }
    });
    parts.push({
      text: "Analyze this screen or environment. Determine the user's activity and mood."
    });
  }

  // Unified Prompt Structure: Always ask for search queries
  parts.push({
    text: `Based on the following context: "${context}", recommend 5 songs.
    If the user explicitly asks to DOWNLOAD a specific song or artist, put the song name in 'downloadTrack'.
    
    Return a JSON object with:
    1. 'explanation': A short friendly string explaining why you chose this vibe.
    2. 'searchQueries': An array of strings, where each string is "Artist Name - Song Title" for the recommended songs.
    3. 'downloadTrack': (Optional) String name of the track to download if requested.
    `
  });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            searchQueries: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            downloadTrack: { type: Type.STRING }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    const queries = result.searchQueries || [];
    let songs: Song[] = [];

    if (queries.length > 0) {
        // Resolve songs using the appropriate provider
        const songPromises = queries.map(async (q: string) => {
            try {
                // If Spotify is selected and we have a token, use Spotify directly
                if (provider === 'SPOTIFY' && spotifyToken) {
                    return await searchSpotifyTrack(spotifyToken, q);
                } 
                // Otherwise use the unified search (handles YT, Apple, Deezer)
                else {
                    const results = await searchUnified(provider, q, spotifyToken);
                    return results.length > 0 ? results[0] : null;
                }
            } catch (e) {
                return null;
            }
        });

        const resolvedSongs = await Promise.all(songPromises);
        songs = resolvedSongs.filter((s: Song | null) => s !== null) as Song[];
    }

    return {
      explanation: result.explanation || "Here is some music for you.",
      songs,
      downloadTrack: result.downloadTrack
    };

  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const consultFocusAgent = async (
    userQuery: string, 
    currentMode: 'FOCUS' | 'BREAK'
): Promise<{ reply: string; suggestedAction: 'NONE' | 'CHANGE_MUSIC' | 'TAKE_BREAK'; musicQuery?: string }> => {
    if (!apiKey) return { reply: "API Key missing", suggestedAction: 'NONE' };
    
    const model = "gemini-2.5-flash";
    const prompt = `
        You are a minimalist Focus Coach AI. The user is in ${currentMode} mode.
        User says: "${userQuery}".
        
        Respond with a JSON object:
        1. 'reply': A very short, punchy, lower-case motivational response or acknowledgment (max 10 words). style: terminal/hacker.
        2. 'suggestedAction': One of 'NONE', 'CHANGE_MUSIC' (if they ask for different vibes), 'TAKE_BREAK'.
        3. 'musicQuery': If action is CHANGE_MUSIC, provide a search string for the new vibe (e.g. "Pink Floyd").
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        reply: { type: Type.STRING },
                        suggestedAction: { type: Type.STRING },
                        musicQuery: { type: Type.STRING }
                    }
                }
            }
        });
        return JSON.parse(response.text || "{}");
    } catch (e) {
        return { reply: "connection_error", suggestedAction: 'NONE' };
    }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string = 'audio/webm'): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const model = "gemini-2.5-flash";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64
            }
          },
          {
            text: "Transcribe the spoken language in this audio exactly. Do not add any conversational filler or descriptions. Just return the text."
          }
        ]
      }
    });

    return response.text?.trim() || "";
  } catch (error) {
    console.error("Transcription Error:", error);
    throw error;
  }
};

export const getSongLyrics = async (artist: string, title: string): Promise<string> => {
  if (!apiKey) {
    return "API Key is missing";
  }
  const model = "gemini-2.5-flash";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Get the lyrics for the song "${title}" by "${artist}". 
      Return the lyrics in LRC format with timestamps (e.g. [00:12.34] Lyric line) if possible.
      If timestamps are not available or difficult to estimate, return plain text with stanza breaks.
      Do not include any intro text like "Here are the lyrics". 
      If the song is instrumental, return "[Instrumental]".`
    });

    return response.text?.trim() || "Lyrics not found.";
  } catch (e) {
    console.error("Lyrics fetch error", e);
    return "Could not load lyrics at this time.";
  }
};

export const recommendNextSong = async (currentSong: Song, recentHistory: Song[], spotifyToken?: string): Promise<Song | null> => {
  if (!apiKey) return null;
  const model = "gemini-2.5-flash";

  const historyStr = recentHistory.map(s => `"${s.title}" by ${s.artist} (${s.mood || 'Unknown'})`).join(" -> ");
  const currentStr = `"${currentSong.title}" by ${currentSong.artist} (${currentSong.mood || 'Unknown'})`;

  const prompt = `
    The user is listening to music. 
    History: ${historyStr}.
    Currently Playing: ${currentStr}.
    
    Recommend ONE single song to play next that maintains the flow but keeps it interesting. 
    Act like a professional DJ.
    
    ${spotifyToken ? 
      'Return a JSON object with "searchQuery" (string: "Artist - Title").' : 
      'Return a JSON object with "song" object containing: title, artist, mood, duration.'
    }
  `;

  try {
     const response = await ai.models.generateContent({
       model,
       contents: prompt,
       config: {
         responseMimeType: "application/json",
         responseSchema: spotifyToken ? {
           type: Type.OBJECT,
           properties: {
             searchQuery: { type: Type.STRING }
           }
         } : {
           type: Type.OBJECT,
           properties: {
             song: {
               type: Type.OBJECT,
               properties: {
                 title: { type: Type.STRING },
                 artist: { type: Type.STRING },
                 mood: { type: Type.STRING },
                 duration: { type: Type.STRING }
               }
             }
           }
         }
       }
     });

     const result = JSON.parse(response.text || "{}");

     if (spotifyToken && result.searchQuery) {
        return await searchSpotifyTrack(spotifyToken, result.searchQuery);
     } else if (result.song) {
        // Fallback or Hallucination if no spotify token
        try {
            const q = `${result.song.artist} - ${result.song.title}`;
            const searchRes = await searchUnified('YOUTUBE', q);
            if (searchRes.length > 0) return searchRes[0];
        } catch(e) {}

        return {
           ...result.song,
           id: `gen-next-${Date.now()}`,
           coverUrl: `https://picsum.photos/200/200?random=${Math.floor(Math.random() * 1000)}`
        };
     }
     return null;

  } catch (e) {
    console.error("Auto-DJ Error", e);
    return null;
  }
};

export const generateDJTransition = async (prevSong: Song, nextSong: Song): Promise<string> => {
  if (!apiKey) return "";
  const model = "gemini-2.5-flash";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `You are a cool, charismatic radio DJ. 
      The song "${prevSong.title}" by ${prevSong.artist} just finished.
      The next song is "${nextSong.title}" by ${nextSong.artist}.
      Write a VERY short (max 2 sentences) transition script to say between these songs. 
      Keep it casual, maybe mention the vibe change or connection. 
      Do not include "Host:" or "DJ:" prefixes. Just the spoken text.`
    });
    return response.text?.trim() || "";
  } catch (e) {
    return "";
  }
};

export const analyzeSongMeaning = async (artist: string, title: string, lyrics: string): Promise<string> => {
  if (!apiKey) return "Unable to analyze.";
  const model = "gemini-2.5-flash";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Analyze the deeper meaning and themes of the song "${title}" by "${artist}".
      Lyrics snippet: "${lyrics.substring(0, 200)}...".
      Provide a concise, interesting "Behind the Music" style breakdown (max 100 words).
      Focus on emotions, hidden meanings, or cultural context.`
    });
    return response.text?.trim() || "Analysis unavailable.";
  } catch (e) {
    return "Analysis unavailable.";
  }
};

export const generateDashboardInsights = async (moodHistory: MoodData[]): Promise<DashboardInsight> => {
  if (!apiKey) throw new Error("API Key missing");
  const model = "gemini-2.5-flash";
  
  const now = new Date();
  const timeOfDay = now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening";
  const recentVibes = moodHistory.slice(-5).map(m => `${m.time}: ${m.label} (${m.score}%)`).join(", ");

  const prompt = `
    Analyze this listener's recent music/mood history and the current time of day (${timeOfDay}).
    History: ${recentVibes}.
    
    1. Grade their "Sonic Identity" from S (highest) to C based on mood consistency and flow (A for focused flow, C for erratic skipping).
    2. Provide a 3-5 word "Title" for their current state (e.g. "Deep Flow State", "Erratic Explorer").
    3. Suggest a specific recommendation or routine change to optimize their day (e.g. "Switch to high tempo to avoid afternoon slump").
    4. Suggest a specific next genre.
    
    Return JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
             grade: { type: Type.STRING },
             title: { type: Type.STRING },
             recommendation: { type: Type.STRING },
             actionLabel: { type: Type.STRING },
             nextGenre: { type: Type.STRING }
          }
        }
      }
    });
    
    const data = JSON.parse(response.text || "{}");
    return {
      grade: data.grade || "B",
      title: data.title || "Casual Listener",
      recommendation: data.recommendation || "Keep listening to refine your profile.",
      actionLabel: data.actionLabel || "Optimize Vibe",
      nextGenre: data.nextGenre || "Lo-Fi"
    };
  } catch (e) {
    return {
      grade: "B",
      title: "Data Analyzing...",
      recommendation: "Collect more listening data to unlock insights.",
      actionLabel: "Refresh",
      nextGenre: "Pop"
    };
  }
};
