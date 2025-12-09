
import { Song } from '../types';

const DB_NAME = 'MusicCompanionDB';
const DB_VERSION = 2; // Incremented version

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
    request.onsuccess = () => resolve(request.result);
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
        request.onsuccess = () => resolve(request.result);
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
