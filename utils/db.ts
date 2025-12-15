
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
