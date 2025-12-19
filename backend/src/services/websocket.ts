/**
 * WebSocket Service
 * Handles real-time communication with frontend
 */
import { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, Song, PlaybackState, MoodData } from '../types/index.js';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Store for current state (in production, use Redis)
let currentState: {
  song: Song | null;
  playback: PlaybackState;
  queue: Song[];
  mood: MoodData[];
} = {
  song: null,
  playback: {
    isPlaying: false,
    currentSong: null,
    position: 0,
    duration: 0,
    volume: 100
  },
  queue: [],
  mood: []
};

// Track connected clients
const connectedClients = new Map<string, { socketId: string; connectedAt: Date }>();

let ioInstance: IOServer | null = null;

export function setupWebSocket(io: IOServer): void {
  ioInstance = io;

  io.on('connection', (socket: IOSocket) => {
    console.log(`[WS] Client connected: ${socket.id}`);
    connectedClients.set(socket.id, { socketId: socket.id, connectedAt: new Date() });

    // Send current state on connect
    socket.emit('playback:state', currentState.playback);
    if (currentState.song) {
      socket.emit('song:changed', currentState.song);
    }
    socket.emit('queue:updated', currentState.queue);

    // --- CLIENT TO SERVER EVENTS ---

    socket.on('player:play', (songId?: string) => {
      console.log(`[WS] player:play from ${socket.id}`, songId || 'resume');
      // This will be handled by the player service
      // Broadcast to all clients
      currentState.playback.isPlaying = true;
      io.emit('playback:state', currentState.playback);
    });

    socket.on('player:pause', () => {
      console.log(`[WS] player:pause from ${socket.id}`);
      currentState.playback.isPlaying = false;
      io.emit('playback:state', currentState.playback);
    });

    socket.on('player:next', () => {
      console.log(`[WS] player:next from ${socket.id}`);
      // Will be handled by player service
    });

    socket.on('player:previous', () => {
      console.log(`[WS] player:previous from ${socket.id}`);
      // Will be handled by player service
    });

    socket.on('player:volume', (percent: number) => {
      console.log(`[WS] player:volume from ${socket.id}:`, percent);
      currentState.playback.volume = percent;
      io.emit('playback:state', currentState.playback);
    });

    socket.on('queue:add', (song: Song) => {
      console.log(`[WS] queue:add from ${socket.id}:`, song.title);
      currentState.queue.push(song);
      io.emit('queue:updated', currentState.queue);
    });

    socket.on('queue:remove', (songId: string) => {
      console.log(`[WS] queue:remove from ${socket.id}:`, songId);
      currentState.queue = currentState.queue.filter(s => s.id !== songId);
      io.emit('queue:updated', currentState.queue);
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
      connectedClients.delete(socket.id);
    });
  });

  console.log('[WS] WebSocket server initialized');
}

// --- BROADCAST FUNCTIONS ---

export function broadcastSongChange(song: Song | null): void {
  currentState.song = song;
  currentState.playback.currentSong = song;
  ioInstance?.emit('song:changed', song);
}

export function broadcastPlaybackState(state: Partial<PlaybackState>): void {
  currentState.playback = { ...currentState.playback, ...state };
  ioInstance?.emit('playback:state', currentState.playback);
}

export function broadcastQueueUpdate(queue: Song[]): void {
  currentState.queue = queue;
  ioInstance?.emit('queue:updated', queue);
}

export function broadcastMoodChange(mood: MoodData): void {
  currentState.mood.push(mood);
  if (currentState.mood.length > 50) currentState.mood.shift();
  ioInstance?.emit('mood:changed', mood);
}

export function broadcastError(message: string): void {
  ioInstance?.emit('error', message);
}

// --- STATE GETTERS ---

export function getCurrentState() {
  return { ...currentState };
}

export function getConnectedClients() {
  return Array.from(connectedClients.values());
}

export function getIO(): IOServer | null {
  return ioInstance;
}
