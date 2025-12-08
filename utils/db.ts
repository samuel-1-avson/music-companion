
import { Song } from '../types';

const DB_NAME = 'MusicCompanionDB';
const STORE_NAME = 'offline_songs';
const DB_VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveSong = async (song: Song): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // We can't store Blob URLs, so we must store the Blob itself.
    // The Song object passed in might have a localUrl that is a Blob URL.
    // We should ensure we are storing the fileBlob if present.
    const request = store.put(song);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getOfflineSongs = async (): Promise<Song[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
        const songs = request.result as Song[];
        // Re-create Blob URLs for playback
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
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
