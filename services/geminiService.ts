import { GoogleGenAI, Type } from "@google/genai";
import { Song } from '../types';
import { searchSpotifyTrack } from './spotifyService';

// Ensure API Key is available
const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

export const generatePlaylistFromContext = async (
  context: string,
  imageBase64?: string,
  spotifyToken?: string
): Promise<{ explanation: string; songs: Song[] }> => {
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

  // Different prompt depending on if we have Spotify access
  if (spotifyToken) {
    parts.push({
      text: `Based on the following context: "${context}", recommend 5 songs.
      Return a JSON object with:
      1. 'explanation': A short friendly string explaining why you chose this vibe.
      2. 'searchQueries': An array of strings, where each string is "Artist Name - Song Title" for the recommended songs.
      `
    });
  } else {
    parts.push({
      text: `Based on the following context: "${context}", recommend 3-5 songs. 
      Return a JSON object with an 'explanation' string and a 'songs' array. 
      Each song should have 'title', 'artist', 'mood' (one word), and a rough 'duration' (e.g. '3:45').`
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: spotifyToken ? {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            searchQueries: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        } : {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            songs: {
              type: Type.ARRAY,
              items: {
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
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    if (spotifyToken && result.searchQueries) {
      // Fetch real data from Spotify
      const songPromises = result.searchQueries.map((q: string) => searchSpotifyTrack(spotifyToken, q));
      const spotifySongs = await Promise.all(songPromises);
      
      // Filter out nulls (failed searches)
      const songs = spotifySongs.filter((s: Song | null) => s !== null) as Song[];

      return {
        explanation: result.explanation || "Here are some Spotify tracks for you.",
        songs
      };

    } else {
      // Fallback to hallucinates songs
      const songs: Song[] = (result.songs || []).map((s: any, idx: number) => ({
        ...s,
        id: `gen-${Date.now()}-${idx}`,
        coverUrl: `https://picsum.photos/200/200?random=${Math.floor(Math.random() * 1000)}`
      }));

      return {
        explanation: result.explanation || "Here is some music for you.",
        songs
      };
    }

  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
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

export const searchSongs = async (query: string): Promise<Song[]> => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const model = "gemini-2.5-flash";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Search for 5 songs that match the query: "${query}". 
      Return a JSON object with a 'songs' array. 
      Each song should have 'title', 'artist', 'album', 'mood' (one word), and a rough 'duration' (e.g. '3:45').`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            songs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  artist: { type: Type.STRING },
                  album: { type: Type.STRING },
                  mood: { type: Type.STRING },
                  duration: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    // Enrich with dummy IDs and cover URLs
    return (result.songs || []).map((s: any, idx: number) => ({
      ...s,
      id: `gen-search-${Date.now()}-${idx}`,
      coverUrl: `https://picsum.photos/200/200?random=${Math.floor(Math.random() * 1000)}`
    }));

  } catch (error) {
    console.error("Gemini Search Error:", error);
    return [];
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
