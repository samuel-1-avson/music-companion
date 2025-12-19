import { describe, it, expect } from 'vitest';

// These tests verify the geminiService module can be imported and has expected exports
// Full AI testing would require mocking the Google GenAI SDK

describe('geminiService - Module Structure', () => {
  it('should export generateGreeting function', async () => {
    const mod = await import('../../services/geminiService');
    expect(typeof mod.generateGreeting).toBe('function');
  });

  it('should export generatePlaylistFromContext function', async () => {
    const mod = await import('../../services/geminiService');
    expect(typeof mod.generatePlaylistFromContext).toBe('function');
  });

  it('should export consultFocusAgent function', async () => {
    const mod = await import('../../services/geminiService');
    expect(typeof mod.consultFocusAgent).toBe('function');
  });

  it('should export getSongLyrics function', async () => {
    const mod = await import('../../services/geminiService');
    expect(typeof mod.getSongLyrics).toBe('function');
  });

  it('should export recommendNextSong function', async () => {
    const mod = await import('../../services/geminiService');
    expect(typeof mod.recommendNextSong).toBe('function');
  });

  it('should export generateSmartDJQueue function', async () => {
    const mod = await import('../../services/geminiService');
    expect(typeof mod.generateSmartDJQueue).toBe('function');
  });

  it('should export generateDJTransition function', async () => {
    const mod = await import('../../services/geminiService');
    expect(typeof mod.generateDJTransition).toBe('function');
  });

  it('should export analyzeSongMeaning function', async () => {
    const mod = await import('../../services/geminiService');
    expect(typeof mod.analyzeSongMeaning).toBe('function');
  });

  it('should export analyzeLyricsSentiment function', async () => {
    const mod = await import('../../services/geminiService');
    expect(typeof mod.analyzeLyricsSentiment).toBe('function');
  });

  it('should export generateRadioStation function', async () => {
    const mod = await import('../../services/geminiService');
    expect(typeof mod.generateRadioStation).toBe('function');
  });

  it('should export getRelatedArtists function', async () => {
    const mod = await import('../../services/geminiService');
    expect(typeof mod.getRelatedArtists).toBe('function');
  });

  it('should export generateDashboardInsights function', async () => {
    const mod = await import('../../services/geminiService');
    expect(typeof mod.generateDashboardInsights).toBe('function');
  });
});
