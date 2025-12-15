
import { GoogleGenAI, Type } from "@google/genai";
import { Song, DashboardInsight, MoodData, MusicProvider, Message } from '../types';
import { searchSpotifyTrack } from './spotifyService';
import { searchUnified } from './musicService';

// Ensure API Key is available
const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

export const generateGreeting = async (
  userName: string,
  moodHistory: MoodData[]
): Promise<{ message: string; action: string }> => {
  if (!apiKey) return { message: "System Online.", action: "Start Listening" };

  const model = "gemini-2.5-flash";
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day = now.toLocaleDateString([], { weekday: 'long' });
  
  // Summarize recent mood
  const recentMoods = moodHistory.slice(-3).map(m => m.label).join(", ");

  const prompt = `
    You are a sentient, warm, and friendly music companion named Melody.
    Current Context:
    - User: ${userName || 'Friend'}
    - Time: ${timeStr} on ${day}
    - Recent Vibes: ${recentMoods || 'Unknown'}

    Generate a short, casual greeting (max 15 words). 
    It should sound like a close friend checking in. Be proactive about the time of day.
    Avoid robotic phrases. Be human.
    
    Examples:
    - "Morning [Name]! Coffee's brewing, need some jazz?"
    - "Hey [Name], looks like a long day. Let's unwind."
    - "Ready to crush some work this afternoon?"

    Also suggest a short, punchy Action Button Label (max 4 words) like "Play Morning Jazz" or "Focus Mode".

    Return JSON: { "message": string, "action": string }
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
            message: { type: Type.STRING },
            action: { type: Type.STRING }
          }
        }
      }
    });
    const res = JSON.parse(response.text || "{}");
    return {
      message: res.message || `Welcome back, ${userName}.`,
      action: res.action || "Play Music"
    };
  } catch (e) {
    return { message: "Good to see you.", action: "Play Flow" };
  }
};

export const generatePlaylistFromContext = async (
  context: string,
  provider: MusicProvider = 'YOUTUBE',
  imageBase64?: string,
  spotifyToken?: string,
  history: Message[] = []
): Promise<{ explanation: string; songs: Song[]; downloadTrack?: string }> => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const model = "gemini-2.5-flash";
  
  const parts: any[] = [];
  
  // 1. Add History Context
  if (history.length > 0) {
      const historyStr = history.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.text}`).join("\n");
      parts.push({
          text: `CONVERSATION HISTORY:\n${historyStr}\n\n---`
      });
  }

  // 2. Add Visual Context if present
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg', 
        data: imageBase64
      }
    });
    parts.push({
      text: "Analyze this image. What's the vibe? Where is the user?"
    });
  }

  // 3. Main Prompt
  parts.push({
    text: `User Request: "${context}"
    
    You are a music companion and a friend. Talk to the user warmly.
    Based on the context, recommend 5 songs.
    If the user asks to DOWNLOAD a specific song, put it in 'downloadTrack'.
    
    Return a JSON object with:
    1. 'explanation': A warm, friendly message (max 25 words) directly addressing the user. Don't just list genres. Say why these songs fit the moment.
    2. 'searchQueries': An array of strings, where each string is "Artist Name - Song Title".
    3. 'downloadTrack': (Optional) String name of the track to download.
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
): Promise<{ reply: string; suggestedAction: 'NONE' | 'CHANGE_MUSIC' | 'TAKE_BREAK' | 'ADD_TASK'; musicQuery?: string; task?: string }> => {
    if (!apiKey) return { reply: "API Key missing", suggestedAction: 'NONE' };
    
    const model = "gemini-2.5-flash";
    const prompt = `
        You are Melody, a supportive Focus Coach. The user is in ${currentMode} mode.
        User says: "${userQuery}".
        
        Respond with a JSON object:
        1. 'reply': A very short, motivational, human response (max 10 words). Lowercase aesthetic.
        2. 'suggestedAction': One of 'NONE', 'CHANGE_MUSIC', 'TAKE_BREAK', 'ADD_TASK'.
        3. 'musicQuery': If action is CHANGE_MUSIC, provide the search string.
        4. 'task': If action is ADD_TASK, provide the task description.
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
                        musicQuery: { type: Type.STRING },
                        task: { type: Type.STRING }
                    }
                }
            }
        });
        return JSON.parse(response.text || "{}");
    } catch (e) {
        return { reply: "connection error", suggestedAction: 'NONE' };
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
            text: "Transcribe the spoken language in this audio exactly."
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
      Return the lyrics in LRC format with timestamps if possible.
      `
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
    
    Recommend ONE single song to play next.
    Act like a close friend sharing a discovery that fits the vibe perfectly.
    
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
      contents: `You are a cool, friendly friend passing the aux cord. 
      The song "${prevSong.title}" by ${prevSong.artist} just finished.
      The next song is "${nextSong.title}" by ${nextSong.artist}.
      Write a VERY short (max 2 sentences) thing to say. Casual, no "DJ" voice. Just natural.
      `
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
      contents: `Analyze the meaning of "${title}" by "${artist}".
      Lyrics snippet: "${lyrics.substring(0, 200)}...".
      Provide a concise, interesting "Behind the Music" breakdown.
      `
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
  const recentVibes = moodHistory.slice(-5).map(m => `${m.time}: ${m.label} (${m.score}%)`).join(", ");

  const prompt = `
    Analyze this listener's recent music/mood history.
    History: ${recentVibes}.
    
    You are a helpful music companion.
    1. Grade their "Sonic Identity" from S (highest) to C.
    2. Provide a 3-5 word "Title" for their current vibe (e.g. "Chill Explorer", "Deep Focus Mode").
    3. Suggest a specific recommendation to help them today. Speak directly to them ("You should...").
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
