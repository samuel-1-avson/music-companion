
import { Song } from '../types';

const DB_NAME = 'MusicCompanionDB';
const DB_VERSION = 3; // Incremented version for Profile features

export interface UserMemory {
  id: number;
  text: string;
  type: 'PREFERENCE' | 'FACT';
  createdAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
  createdAt: number;
}

export interface HistoryItem {
  id: number; // timestamp
  song: Song;
  playedAt: number;
}

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // V1 Stores
      if (!db.objectStoreNames.contains('offline_songs')) {
        db.createObjectStore('offline_songs', { keyPath: 'id' });
      }

      // V2 Stores
      if (!db.objectStoreNames.contains('memories')) {
        const memoryStore = db.createObjectStore('memories', { keyPath: 'id', autoIncrement: true });
        memoryStore.createIndex('type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id' });
      }

      // V3 Stores (Profile System)
      if (!db.objectStoreNames.contains('favorites')) {
        db.createObjectStore('favorites', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { keyPath: 'id' });
        historyStore.createIndex('playedAt', 'playedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('user_settings')) {
        db.createObjectStore('user_settings', { keyPath: 'key' });
      }
    };
  });
};

// --- Songs ---
export const saveSong = async (song: Song): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline_songs'], 'readwrite');
    const store = transaction.objectStore('offline_songs');
    const request = store.put(song);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getOfflineSongs = async (): Promise<Song[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline_songs'], 'readonly');
    const store = transaction.objectStore('offline_songs');
    const request = store.getAll();
    request.onsuccess = () => {
        const songs = request.result as Song[];
        const songsWithUrls = songs.map(s => {
            if (s.fileBlob && !s.previewUrl) {
                return { ...s, previewUrl: URL.createObjectURL(s.fileBlob) };
            }
            return s;
        });
        resolve(songsWithUrls);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteSong = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline_songs'], 'readwrite');
    const store = transaction.objectStore('offline_songs');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- Memories ---
export const saveMemory = async (text: string, type: 'PREFERENCE' | 'FACT' = 'PREFERENCE'): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['memories'], 'readwrite');
    const store = transaction.objectStore('memories');
    store.add({ text, type, createdAt: Date.now() });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getMemories = async (): Promise<UserMemory[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['memories'], 'readonly');
    const store = transaction.objectStore('memories');
    const request = store.getAll();
    request.onsuccess = () => resolve([...(request.result as UserMemory[])]);
    request.onerror = () => reject(request.error);
  });
};

// --- Playlists ---
export const savePlaylist = async (name: string, songs: Song[]): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['playlists'], 'readwrite');
        const store = transaction.objectStore('playlists');
        const playlist: Playlist = {
            id: `pl-${Date.now()}`,
            name,
            songs: songs.map(s => ({...s, fileBlob: undefined})), // Don't duplicate blobs in playlists
            createdAt: Date.now()
        };
        store.put(playlist);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getPlaylists = async (): Promise<Playlist[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['playlists'], 'readonly');
        const store = transaction.objectStore('playlists');
        const request = store.getAll();
        request.onsuccess = () => resolve([...(request.result as Playlist[])]);
        request.onerror = () => reject(request.error);
    });
};

export const deletePlaylist = async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['playlists'], 'readwrite');
        const store = transaction.objectStore('playlists');
        store.delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

// --- Profile & Favorites ---

export const toggleFavoriteDB = async (song: Song): Promise<boolean> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('favorites', 'readwrite');
        const store = tx.objectStore('favorites');
        const req = store.get(song.id);
        req.onsuccess = () => {
            if (req.result) {
                store.delete(song.id);
                resolve(false); // Removed
            } else {
                // Ensure no blobs in favorites to keep lightweight
                const { fileBlob, ...safeSong } = song;
                store.put(safeSong);
                resolve(true); // Added
            }
        };
        req.onerror = () => reject(req.error);
    });
};

export const getFavoritesDB = async (): Promise<Song[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('favorites', 'readonly');
        const store = tx.objectStore('favorites');
        const req = store.getAll();
        req.onsuccess = () => resolve([...(req.result as Song[])]);
        req.onerror = () => reject(req.error);
    });
};

export const addToHistoryDB = async (song: Song): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('history', 'readwrite');
        const store = tx.objectStore('history');
        const { fileBlob, ...safeSong } = song;
        
        const item: HistoryItem = {
            id: Date.now(),
            song: safeSong,
            playedAt: Date.now()
        };
        store.add(item);
        
        // Limit history to 100 items (Optional cleanup)
        // For simplicity, we just add here.
        tx.oncomplete = () => resolve();
    });
};

export const getHistoryDB = async (): Promise<HistoryItem[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('history', 'readonly');
        const store = tx.objectStore('history');
        const req = store.getAll();
        req.onsuccess = () => {
            const res = req.result as HistoryItem[];
            // Create a mutable copy before sorting
            resolve([...res].sort((a, b) => b.playedAt - a.playedAt));
        };
        req.onerror = () => reject(req.error);
    });
};

export const saveSettingDB = async (key: string, value: any): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('user_settings', 'readwrite');
        const store = tx.objectStore('user_settings');
        store.put({ key, value });
        tx.oncomplete = () => resolve();
    });
};

export const getSettingDB = async (key: string): Promise<any> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('user_settings', 'readonly');
        const store = tx.objectStore('user_settings');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result?.value);
        req.onerror = () => reject(req.error);
    });
};

// --- PHASE 2: LISTENING STREAKS ---

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastListenDate: string; // YYYY-MM-DD
  totalListeningMinutes: number;
  listenedToday: boolean;
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const getListeningStreakDB = async (): Promise<StreakData> => {
  const history = await getHistoryDB();
  
  if (history.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastListenDate: '',
      totalListeningMinutes: 0,
      listenedToday: false
    };
  }

  // Get unique listening dates
  const listeningDates = new Set<string>();
  let totalMinutes = 0;

  history.forEach(item => {
    const date = new Date(item.playedAt);
    listeningDates.add(formatDateKey(date));
    // Estimate 3 minutes per song (will be more accurate with actual duration tracking)
    totalMinutes += 3;
  });

  const sortedDates = Array.from(listeningDates).sort().reverse();
  const today = formatDateKey(new Date());
  const yesterday = formatDateKey(new Date(Date.now() - 86400000));

  const listenedToday = sortedDates[0] === today;

  // Calculate current streak
  let currentStreak = 0;
  let checkDate = listenedToday ? today : yesterday;
  
  for (let i = 0; i < sortedDates.length; i++) {
    if (sortedDates[i] === checkDate) {
      currentStreak++;
      // Move to previous day
      const d = new Date(checkDate);
      d.setDate(d.getDate() - 1);
      checkDate = formatDateKey(d);
    } else if (i === 0 && sortedDates[0] !== today && sortedDates[0] !== yesterday) {
      // Streak broken
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;
  
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const current = new Date(sortedDates[i]);
    const next = new Date(sortedDates[i + 1]);
    const diffDays = Math.floor((current.getTime() - next.getTime()) / 86400000);
    
    if (diffDays === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    lastListenDate: sortedDates[0] || '',
    totalListeningMinutes: totalMinutes,
    listenedToday
  };
};

// --- PHASE 2: LISTENING STATISTICS ---

export interface ListeningStats {
  totalSongs: number;
  totalMinutes: number;
  topArtists: { name: string; count: number }[];
  topMoods: { name: string; count: number }[];
  listeningByHour: number[]; // 24 slots
  listeningByDay: number[]; // 7 slots (0=Sunday)
  recentDays: { date: string; count: number }[];
}

export const getListeningStatsDB = async (): Promise<ListeningStats> => {
  const history = await getHistoryDB();

  const artistCounts: Record<string, number> = {};
  const moodCounts: Record<string, number> = {};
  const hourCounts: number[] = new Array(24).fill(0);
  const dayCounts: number[] = new Array(7).fill(0);
  const dailyCounts: Record<string, number> = {};

  history.forEach(item => {
    const date = new Date(item.playedAt);
    
    // Count artists
    const artist = item.song.artist || 'Unknown';
    artistCounts[artist] = (artistCounts[artist] || 0) + 1;
    
    // Count moods
    const mood = item.song.mood || 'Unknown';
    moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    
    // Count by hour
    hourCounts[date.getHours()]++;
    
    // Count by day of week
    dayCounts[date.getDay()]++;
    
    // Count by date
    const dateKey = formatDateKey(date);
    dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
  });

  // Sort and get top items
  const topArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const topMoods = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Get recent 7 days
  const recentDays: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = formatDateKey(d);
    recentDays.push({ date: key, count: dailyCounts[key] || 0 });
  }

  return {
    totalSongs: history.length,
    totalMinutes: history.length * 3, // Estimate
    topArtists,
    topMoods,
    listeningByHour: hourCounts,
    listeningByDay: dayCounts,
    recentDays
  };
};

// --- PHASE 2: DAILY CHALLENGES ---

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'DISCOVERY' | 'LISTENING' | 'EXPLORATION' | 'SOCIAL';
  goal: number;
  progress: number;
  xpReward: number;
  completed: boolean;
  date: string; // YYYY-MM-DD
}

export const getDailyChallengesDB = async (): Promise<Challenge[]> => {
  const today = formatDateKey(new Date());
  const saved = await getSettingDB(`challenges_${today}`);
  
  if (saved) return saved;

  // Generate new challenges for today
  const challenges: Challenge[] = [
    {
      id: `${today}-discovery`,
      title: 'Discover 3 New Artists',
      description: 'Play songs from artists you haven\'t heard before',
      type: 'DISCOVERY',
      goal: 3,
      progress: 0,
      xpReward: 50,
      completed: false,
      date: today
    },
    {
      id: `${today}-listening`,
      title: 'Listen for 30 Minutes',
      description: 'Keep the music playing!',
      type: 'LISTENING',
      goal: 30,
      progress: 0,
      xpReward: 30,
      completed: false,
      date: today
    },
    {
      id: `${today}-exploration`,
      title: 'Try Focus Mode',
      description: 'Use Focus Mode for a productive session',
      type: 'EXPLORATION',
      goal: 1,
      progress: 0,
      xpReward: 25,
      completed: false,
      date: today
    }
  ];

  await saveSettingDB(`challenges_${today}`, challenges);
  return challenges;
};

export const updateChallengeProgressDB = async (challengeId: string, progress: number): Promise<void> => {
  const today = formatDateKey(new Date());
  const challenges = await getDailyChallengesDB();
  
  const updated = challenges.map(c => {
    if (c.id === challengeId) {
      const newProgress = Math.min(c.goal, c.progress + progress);
      return { ...c, progress: newProgress, completed: newProgress >= c.goal };
    }
    return c;
  });
  
  await saveSettingDB(`challenges_${today}`, updated);
};

export const getUserXPDB = async (): Promise<number> => {
  return (await getSettingDB('user_xp')) || 0;
};

export const addUserXPDB = async (amount: number): Promise<number> => {
  const current = await getUserXPDB();
  const newXP = current + amount;
  await saveSettingDB('user_xp', newXP);
  return newXP;
};
