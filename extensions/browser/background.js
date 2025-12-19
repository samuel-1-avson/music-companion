/**
 * Music Companion Browser Extension - Background Service Worker
 * Detects browsing context and sends to Music Companion
 */

const CONFIG = {
  serverUrl: 'http://localhost:3001',
  appUrl: 'http://localhost:3005',
  syncInterval: 30000, // 30 seconds
  enabled: true
};

// Domain categorization
const DOMAIN_CATEGORIES = {
  coding: [
    'github.com', 'gitlab.com', 'bitbucket.org',
    'stackoverflow.com', 'stackexchange.com',
    'developer.mozilla.org', 'docs.microsoft.com',
    'npmjs.com', 'pypi.org', 'crates.io',
    'codepen.io', 'codesandbox.io', 'replit.com',
    'leetcode.com', 'hackerrank.com'
  ],
  reading: [
    'medium.com', 'dev.to', 'hashnode.dev',
    'reddit.com', 'news.ycombinator.com',
    'wikipedia.org', 'notion.so',
    'substack.com', 'pocket.com'
  ],
  social: [
    'twitter.com', 'x.com', 'instagram.com',
    'facebook.com', 'linkedin.com', 'threads.net',
    'tiktok.com', 'snapchat.com'
  ],
  video: [
    'youtube.com', 'netflix.com', 'twitch.tv',
    'vimeo.com', 'primevideo.com', 'hulu.com',
    'disneyplus.com', 'hbomax.com'
  ],
  music: [
    'spotify.com', 'music.apple.com', 'soundcloud.com',
    'pandora.com', 'deezer.com', 'tidal.com',
    'music.youtube.com', 'bandcamp.com'
  ],
  productivity: [
    'docs.google.com', 'sheets.google.com', 'slides.google.com',
    'office.com', 'figma.com', 'canva.com',
    'trello.com', 'asana.com', 'monday.com',
    'slack.com', 'discord.com', 'teams.microsoft.com'
  ],
  shopping: [
    'amazon.com', 'ebay.com', 'etsy.com',
    'aliexpress.com', 'walmart.com', 'target.com'
  ]
};

// Category to mood mapping
const CATEGORY_MOODS = {
  coding: { mood: 'focused', energy: 'high', description: 'Deep focus for coding' },
  reading: { mood: 'calm', energy: 'low', description: 'Calm background for reading' },
  social: { mood: 'upbeat', energy: 'high', description: 'Fun, energetic vibes' },
  video: { mood: 'skip', energy: 'none', description: 'Already has audio' },
  music: { mood: 'skip', energy: 'none', description: 'Already playing music' },
  productivity: { mood: 'steady', energy: 'medium', description: 'Steady focus music' },
  shopping: { mood: 'casual', energy: 'medium', description: 'Light background music' },
  default: { mood: 'ambient', energy: 'low', description: 'General browsing' }
};

let lastContext = '';
let syncTimer = null;

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log('Music Companion browser extension installed');
  chrome.storage.local.set({ enabled: true, lastSync: null });
  startSync();
});

chrome.runtime.onStartup.addListener(() => {
  startSync();
});

// Tab change listener
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    await analyzeAndSend(tab.url, tab.title || '');
  }
});

// Tab update listener
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab.url) {
    await analyzeAndSend(tab.url, tab.title || '');
  }
});

// Message handler from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    getStatus().then(sendResponse);
    return true;
  }
  
  if (message.type === 'TOGGLE_ENABLED') {
    toggleEnabled().then(sendResponse);
    return true;
  }
  
  if (message.type === 'SEND_NOW') {
    sendCurrentContext().then(sendResponse);
    return true;
  }
  
  if (message.type === 'OPEN_APP') {
    chrome.tabs.create({ url: CONFIG.appUrl });
    sendResponse({ success: true });
  }
});

async function getStatus() {
  const data = await chrome.storage.local.get(['enabled', 'lastSync', 'lastCategory']);
  return {
    enabled: data.enabled !== false,
    lastSync: data.lastSync,
    lastCategory: data.lastCategory || 'none'
  };
}

async function toggleEnabled() {
  const data = await chrome.storage.local.get(['enabled']);
  const newState = !data.enabled;
  await chrome.storage.local.set({ enabled: newState });
  
  if (newState) {
    startSync();
  } else {
    stopSync();
  }
  
  return { enabled: newState };
}

async function sendCurrentContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    return await analyzeAndSend(tab.url, tab.title || '', true);
  }
  return { success: false, error: 'No active tab' };
}

function startSync() {
  stopSync();
  syncTimer = setInterval(async () => {
    const data = await chrome.storage.local.get(['enabled']);
    if (data.enabled !== false) {
      await sendCurrentContext();
    }
  }, CONFIG.syncInterval);
}

function stopSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

function categorizeUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    
    for (const [category, domains] of Object.entries(DOMAIN_CATEGORIES)) {
      if (domains.some(domain => hostname.includes(domain))) {
        return category;
      }
    }
    
    return 'default';
  } catch {
    return 'default';
  }
}

async function analyzeAndSend(url, title, manual = false) {
  const data = await chrome.storage.local.get(['enabled']);
  if (data.enabled === false && !manual) {
    return { success: false, error: 'Extension disabled' };
  }
  
  const category = categorizeUrl(url);
  const moodInfo = CATEGORY_MOODS[category] || CATEGORY_MOODS.default;
  
  // Skip if it's a music/video site
  if (moodInfo.mood === 'skip') {
    return { success: true, skipped: true, reason: moodInfo.description };
  }
  
  const context = {
    source: 'browser',
    category,
    mood: moodInfo.mood,
    energy: moodInfo.energy,
    url: url,
    title: title,
    timestamp: Date.now()
  };
  
  // Avoid duplicate sends
  const contextKey = `${category}-${moodInfo.mood}`;
  if (!manual && contextKey === lastContext) {
    return { success: true, cached: true };
  }
  lastContext = contextKey;
  
  try {
    const response = await fetch(`${CONFIG.serverUrl}/api/dev/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context)
    });
    
    if (response.ok) {
      await chrome.storage.local.set({
        lastSync: new Date().toISOString(),
        lastCategory: category
      });
      return { success: true, category, mood: moodInfo.mood };
    } else {
      return { success: false, error: `Server error: ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: 'Could not connect to Music Companion' };
  }
}
