import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Mock browser APIs not available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Web Audio API
const mockAudioContext = {
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  })),
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    type: 'sine',
    frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  })),
  createBiquadFilter: vi.fn(() => ({
    connect: vi.fn(),
    type: 'lowpass',
    frequency: { value: 1000 },
    gain: { value: 0 }
  })),
  createAnalyser: vi.fn(() => ({
    connect: vi.fn(),
    fftSize: 256,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn()
  })),
  createMediaElementSource: vi.fn(() => ({
    connect: vi.fn()
  })),
  destination: {},
  state: 'running',
  resume: vi.fn(),
  close: vi.fn(),
  currentTime: 0,
};

(window as any).AudioContext = vi.fn(() => mockAudioContext);
(window as any).webkitAudioContext = vi.fn(() => mockAudioContext);

// Mock IndexedDB
const mockIDBDatabase = {
  transaction: vi.fn(() => ({
    objectStore: vi.fn(() => ({
      put: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(() => ({ 
        onsuccess: null, 
        onerror: null,
        result: [] 
      })),
      delete: vi.fn(),
      add: vi.fn(),
    })),
    oncomplete: null,
    onerror: null,
  })),
  objectStoreNames: { contains: vi.fn(() => true) },
  createObjectStore: vi.fn(),
};

(window as any).indexedDB = {
  open: vi.fn(() => ({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: mockIDBDatabase,
  })),
};

// Mock SpeechSynthesis
(window as any).speechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
};

// Mock fetch
global.fetch = vi.fn();

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
