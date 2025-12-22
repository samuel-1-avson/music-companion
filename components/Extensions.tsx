
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ICONS } from '../constants';
import { generatePlaylistFromContext } from '../services/geminiService';
import { Song, MusicProvider, SpotifyProfile, ApiKey, ApiScope, Webhook, WebhookEvent } from '../types';
import { getSpotifyAuthUrl, getRecentlyPlayed } from '../services/spotifyService';
import * as lastfm from '../services/lastfmService';
import * as devApi from '../services/developerApiService';
import * as webhooks from '../services/webhookService';
import * as extensionBridge from '../services/extensionBridge';
import { useAuth } from '../contexts/AuthContext';
import { useSpotifyData } from '../hooks/useSpotifyData';

// Phase 5 Components - Lazy loaded for performance
const ReleaseRadar = lazy(() => import('./ReleaseRadar'));
const ConcertFinder = lazy(() => import('./ConcertFinder'));
const ListeningReport = lazy(() => import('./ListeningReport'));
const SmartPlaylistEditor = lazy(() => import('./SmartPlaylistEditor'));
const IntegrationsPanel = lazy(() => import('./IntegrationsPanel'));

// Loading fallback component
const TabLoadingFallback = () => (
  <div className="flex items-center justify-center py-20">
    <div className="flex flex-col items-center gap-4">
      <ICONS.Loader size={32} className="animate-spin text-gray-400" />
      <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Loading module...</p>
    </div>
  </div>
);

interface ExtensionsProps {
  onPlaySong: (song: Song, queue?: Song[]) => void;
  spotifyToken?: string | null;
  spotifyProfile?: SpotifyProfile | null;
  musicProvider: MusicProvider;
  onSetMusicProvider: (p: MusicProvider) => void;
  onDisconnectSpotify: () => void;
}

interface LogEntry {
  id: number;
  source: string;
  event: string;
  time: string;
}

const Extensions: React.FC<ExtensionsProps> = ({ 
    onPlaySong, 
    spotifyToken, 
    spotifyProfile,
    musicProvider,
    onSetMusicProvider,
    onDisconnectSpotify
}) => {
  const { user } = useAuth();
  const { hasSpotifyAccess, recentlyPlayed: spotifyRecentlyPlayed } = useSpotifyData();
  const [activeTab, setActiveTab] = useState<'SOURCES' | 'DISCOVER' | 'APPS' | 'DEV'>('SOURCES');
  const [showSmartPlaylist, setShowSmartPlaylist] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<'week' | 'month' | 'year'>('week');
  
  // --- DEV / API STATE ---
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<ApiScope[]>(['player:read']);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeSimulation, setActiveSimulation] = useState<string | null>(null);

  // --- SPOTIFY AUTH STATE ---
  const [clientId, setClientId] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [isEditingSpotify, setIsEditingSpotify] = useState(false);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);

  // --- LAST.FM STATE ---
  const [lastfmApiKey, setLastfmApiKey] = useState('');
  const [lastfmSecret, setLastfmSecret] = useState('');
  const [lastfmSession, setLastfmSession] = useState<{ name: string; key: string } | null>(null);
  const [isEditingLastfm, setIsEditingLastfm] = useState(false);

  // --- WEBHOOK STATE ---
  const [userWebhooks, setUserWebhooks] = useState<Webhook[]>([]);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<WebhookEvent[]>(['SONG_CHANGED']);
  const [webhookTestResult, setWebhookTestResult] = useState<{ id: string; success: boolean } | null>(null);

  // --- EXTENSION STATE ---
  const [connectedExtensions, setConnectedExtensions] = useState<string[]>([]);

  // Load initial state
  useEffect(() => {
    // Load API keys
    setApiKeys(devApi.loadApiKeys());
    
    // Load Spotify Config
    const savedId = localStorage.getItem('spotify_client_id');
    if (savedId) setClientId(savedId);
    
    const savedUri = localStorage.getItem('spotify_redirect_uri');
    if (savedUri) {
        setRedirectUri(savedUri);
    } else {
        // Default to HTTPS with /auth/spotify/callback path
        const baseUrl = window.location.origin;
        setRedirectUri(`${baseUrl}/auth/spotify/callback`);
    }

    // Load Last.fm config
    const lfmKey = localStorage.getItem('lastfm_api_key');
    if (lfmKey) setLastfmApiKey(lfmKey);
    const lfmSession = lastfm.getSession();
    if (lfmSession) setLastfmSession(lfmSession);

    // Load webhooks
    setUserWebhooks(webhooks.getWebhooks());

    // Initialize extension bridge
    extensionBridge.initializeExtensionBridge();
    setConnectedExtensions(extensionBridge.getConnectedExtensions());

    // Subscribe to API events for logging
    return devApi.onApiEvent('apiKeyUsed', (event) => {
      addLog('API', `${event.data.action}: ${event.data.name || event.data.keyId}`);
    });
  }, []);

  // Load Spotify recently played when token available
  useEffect(() => {
    if (spotifyToken) {
      getRecentlyPlayed(spotifyToken, 10).then(setRecentlyPlayed);
    }
  }, [spotifyToken]);

  const addLog = (source: string, event: string) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs(prev => [{ id: Date.now(), source, event, time: timeStr }, ...prev.slice(0, 19)]);
  };

  const simulateContext = async (source: string, eventName: string, promptContext: string) => {
    if (activeSimulation) return;
    setActiveSimulation(eventName);
    addLog(source, `EVENT_RECEIVED: [${eventName}]`);

    try {
      const fullPrompt = `The user is currently ${promptContext}. Suggest music for this activity.`;
      const { songs } = await generatePlaylistFromContext(fullPrompt, musicProvider, undefined, spotifyToken || undefined);
      
      addLog('SYSTEM', `PROCESSED: Found ${songs.length} tracks via ${musicProvider}`);
      if (songs.length > 0) {
        onPlaySong(songs[0], songs);
        // Dispatch webhook event
        webhooks.dispatchEvent('SONG_CHANGED', songs[0]);
      }
    } catch (e) {
      addLog('SYSTEM', 'ERROR: Failed to generate context');
    } finally {
      setActiveSimulation(null);
    }
  };

  const handleSpotifyConnect = () => {
      // Use backend OAuth flow - more secure, handles token exchange server-side
      // Backend redirects to Spotify, then back to backend callback, then to frontend with token
      if (!user) {
          console.error('[Extensions] Cannot connect Spotify: User not authenticated');
          return;
      }
      const backendAuthUrl = `http://localhost:3001/auth/spotify?user_id=${user.id}&user_email=${encodeURIComponent(user.email || '')}`;
      window.location.href = backendAuthUrl;
  };

  // --- API KEY HANDLERS ---
  const handleCreateApiKey = () => {
    if (!newKeyName.trim()) return;
    const key = devApi.createApiKey(newKeyName.trim(), newKeyScopes);
    setApiKeys(devApi.loadApiKeys());
    setNewKeyName('');
    setNewKeyScopes(['player:read']);
    setShowNewKeyModal(false);
    addLog('SYSTEM', `API Key created: ${key.name}`);
  };

  const handleRevokeKey = (keyId: string) => {
    devApi.revokeApiKey(keyId);
    setApiKeys(devApi.loadApiKeys());
    addLog('SYSTEM', `API Key revoked: ${keyId}`);
  };

  const handleCopyKey = (key: ApiKey) => {
    navigator.clipboard.writeText(key.key);
    setCopiedKeyId(key.id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // --- LAST.FM HANDLERS ---
  const handleLastfmSave = () => {
    lastfm.configureLastFm(lastfmApiKey, lastfmSecret);
    setIsEditingLastfm(false);
    addLog('LASTFM', 'API credentials saved');
  };

  const handleLastfmAuth = () => {
    const callbackUrl = window.location.href.split('#')[0].split('?')[0];
    const url = lastfm.getLastFmAuthUrl(callbackUrl);
    if (url) {
      // Use same-window redirect instead of popup to avoid browser security restrictions
      window.location.href = url;
    }
  };

  const handleLastfmLogout = () => {
    lastfm.logout();
    setLastfmSession(null);
    addLog('LASTFM', 'Logged out');
  };

  // --- WEBHOOK HANDLERS ---
  const handleCreateWebhook = () => {
    if (!newWebhookName.trim() || !newWebhookUrl.trim()) return;
    webhooks.createWebhook(newWebhookName, newWebhookUrl, newWebhookEvents);
    setUserWebhooks(webhooks.getWebhooks());
    setShowWebhookModal(false);
    setNewWebhookName('');
    setNewWebhookUrl('');
    setNewWebhookEvents(['SONG_CHANGED']);
    addLog('WEBHOOK', `Created: ${newWebhookName}`);
  };

  const handleTestWebhook = async (id: string) => {
    const result = await webhooks.testWebhook(id);
    setWebhookTestResult({ id, success: result.success });
    setTimeout(() => setWebhookTestResult(null), 3000);
    addLog('WEBHOOK', `Test ${result.success ? 'SUCCESS' : 'FAILED'}`);
  };

  const handleDeleteWebhook = (id: string) => {
    webhooks.deleteWebhook(id);
    setUserWebhooks(webhooks.getWebhooks());
    addLog('WEBHOOK', 'Deleted webhook');
  };

  const handleToggleWebhook = (id: string) => {
    webhooks.toggleWebhook(id);
    setUserWebhooks(webhooks.getWebhooks());
  };

  const PROVIDERS = [
      { id: 'YOUTUBE', label: 'YouTube Network', icon: ICONS.Play, desc: 'Global video database. No login required. Best for variety.', color: '#FF0000' },
      { id: 'SPOTIFY', label: 'Spotify Connect', icon: ICONS.Music, desc: 'Premium streaming & device control. Requires Auth.', color: '#1DB954' },
      { id: 'APPLE', label: 'Apple Music', icon: ICONS.Radio, desc: 'iTunes Store preview network. High quality snippets.', color: '#FA243C' },
      { id: 'DEEZER', label: 'Deezer Flow', icon: ICONS.Activity, desc: 'Dynamic flow recommendations and previews.', color: '#FEAA2D' },
  ];

  const SCOPES: { value: ApiScope; label: string; desc: string }[] = [
    { value: 'player:read', label: 'Read Player', desc: 'View current song, queue, mood' },
    { value: 'player:control', label: 'Control Player', desc: 'Play, pause, skip, volume' },
    { value: 'queue:manage', label: 'Manage Queue', desc: 'Add/remove from queue' },
    { value: 'ai:generate', label: 'AI Generate', desc: 'Generate playlists with AI' },
  ];

  return (
    <div className="p-8 space-y-8 pb-32 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end border-b-4 border-black pb-4">
        <div>
          <h2 className="text-4xl font-bold text-black mb-2 font-mono">INTEGRATIONS</h2>
          <p className="text-gray-600 font-mono">CONNECT_&_EXTEND</p>
        </div>
        <div className="flex space-x-2 flex-wrap gap-1">
            {[
                { id: 'SOURCES', icon: ICONS.HardDrive, label: 'SOURCES' },
                { id: 'DISCOVER', icon: ICONS.Zap, label: 'DISCOVER' },
                { id: 'APPS', icon: ICONS.Cpu, label: 'APPS' },
                { id: 'DEV', icon: ICONS.Terminal, label: 'DEV_API' }
            ].map(tab => (
                <button 
                    key={tab.id} 
                    onClick={() => setActiveTab(tab.id as any)} 
                    className={`px-3 py-2 font-bold font-mono text-xs flex items-center gap-2 border-2 border-black transition-all ${activeTab === tab.id ? 'bg-black text-white shadow-retro-sm' : 'bg-white text-black hover:bg-gray-100'}`}
                >
                    <tab.icon size={14} />{tab.label}
                </button>
            ))}
        </div>
      </div>

      {/* --- TAB: SOURCES --- */}
      {activeTab === 'SOURCES' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-left-4">
              {/* Provider Selection */}
              <div className="space-y-4">
                  <h3 className="text-lg font-bold font-mono uppercase mb-4 flex items-center gap-2">
                      <ICONS.Globe size={20} /> Active Provider
                  </h3>
                  {PROVIDERS.map(p => {
                      const isActive = musicProvider === p.id;
                      const isReady = p.id !== 'SPOTIFY' || !!spotifyToken;
                      
                      return (
                          <div 
                            key={p.id}
                            onClick={() => { if (isReady) onSetMusicProvider(p.id as MusicProvider); }}
                            className={`border-2 p-4 transition-all cursor-pointer group relative overflow-hidden ${isActive ? 'border-black bg-black text-white shadow-retro' : 'border-gray-200 bg-white text-gray-500 hover:border-black hover:text-black'}`}
                          >
                              <div className="flex justify-between items-start relative z-10">
                                  <div className="flex items-center gap-4">
                                      <div className={`p-3 border-2 ${isActive ? 'border-white bg-gray-800' : 'border-gray-200 bg-gray-50 group-hover:border-black'}`} style={{ backgroundColor: isActive ? p.color : undefined }}>
                                          <p.icon size={24} />
                                      </div>
                                      <div>
                                          <h4 className="font-bold font-mono text-sm uppercase">{p.label}</h4>
                                          <p className="text-xs opacity-70 font-mono mt-1">{p.desc}</p>
                                      </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                      {isActive && <ICONS.CheckCircle className="text-green-400" size={24} />}
                                      {p.id === 'SPOTIFY' && !hasSpotifyAccess && <span className="text-[10px] font-bold border border-red-500 text-red-500 px-2 py-0.5 uppercase">Auth Required</span>}
                                  </div>
                              </div>
                          </div>
                      );
                  })}

                  {/* Recently Played (Spotify only) */}
                  {hasSpotifyAccess && spotifyRecentlyPlayed.length > 0 && (
                    <div className="mt-6 bg-gray-50 border-2 border-gray-200 p-4">
                      <h4 className="font-bold font-mono text-xs uppercase mb-3 flex items-center gap-2">
                        <ICONS.History size={14} /> Recently Played (Spotify)
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {spotifyRecentlyPlayed.slice(0, 5).map(item => (
                          <div 
                            key={item.played_at}
                            className="flex items-center gap-3 p-2 hover:bg-white border border-transparent hover:border-gray-200 cursor-pointer transition-all"
                          >
                            <img src={item.track.album.images[0]?.url || ''} alt="" className="w-10 h-10 object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.track.name}</p>
                              <p className="text-xs text-gray-500 truncate">{item.track.artists.map(a => a.name).join(', ')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              {/* Simplified Integrations Panel */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold font-mono uppercase mb-4 flex items-center gap-2">
                  <ICONS.Link size={20} /> Connected Accounts
                </h3>
                <Suspense fallback={<TabLoadingFallback />}>
                  <IntegrationsPanel
                    onSpotifyConnect={handleSpotifyConnect}
                    spotifyConnected={hasSpotifyAccess}
                    spotifyProfile={spotifyProfile}
                    onSpotifyDisconnect={onDisconnectSpotify}
                  />
                </Suspense>
              </div>
          </div>
      )}

      {/* --- TAB: DISCOVER --- */}
      {activeTab === 'DISCOVER' && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold font-mono uppercase">Music Discovery</h3>
              <p className="text-xs text-gray-500">New releases, concerts, and stats</p>
            </div>
            <button 
              onClick={() => setShowSmartPlaylist(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold font-mono text-xs uppercase border-2 border-black shadow-retro-sm hover:opacity-90"
            >
              🔄 Smart Playlist
            </button>
          </div>

          {/* Listening Report */}
          <div>
            <div className="flex items-center gap-4 mb-4">
              <h4 className="font-bold font-mono text-sm uppercase">📊 Your Stats</h4>
              <div className="flex gap-2">
                {(['week', 'month', 'year'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setReportPeriod(p)}
                    className={`px-3 py-1 text-xs font-mono font-bold ${reportPeriod === p ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <Suspense fallback={<TabLoadingFallback />}>
              <ListeningReport period={reportPeriod} />
            </Suspense>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Release Radar */}
            <Suspense fallback={<TabLoadingFallback />}>
              <ReleaseRadar 
                favoriteArtists={[]} 
                onPlaySong={onPlaySong} 
              />
            </Suspense>

            {/* Concert Finder */}
            <Suspense fallback={<TabLoadingFallback />}>
              <ConcertFinder 
                favoriteArtists={[]} 
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* --- TAB: APPS --- */}
      {activeTab === 'APPS' && (
          <div className="space-y-8 animate-in slide-in-from-right-4">
            {/* Webhooks Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold font-mono uppercase flex items-center gap-2">
                  <ICONS.Activity size={20} /> Webhooks
                </h3>
                <button 
                  onClick={() => setShowWebhookModal(true)}
                  className="px-4 py-2 bg-black text-white font-bold font-mono text-xs uppercase border-2 border-black shadow-retro-sm hover:bg-gray-800"
                >
                  + Add Webhook
                </button>
              </div>

              {userWebhooks.length === 0 ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 p-8 text-center">
                  <ICONS.Link size={32} className="mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500 font-mono text-sm">No webhooks configured</p>
                  <p className="text-xs text-gray-400 mt-1">Connect to IFTTT, Zapier, or your own server</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userWebhooks.map(wh => (
                    <div key={wh.id} className={`border-2 ${wh.enabled ? 'border-black bg-white' : 'border-gray-300 bg-gray-50'} p-4 relative`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold font-mono">{wh.name}</h4>
                          <code className="text-[10px] text-gray-500 block truncate max-w-[200px]">{wh.url}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleToggleWebhook(wh.id)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${wh.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                          >
                            <span className={`absolute w-4 h-4 bg-white rounded-full top-0.5 transition-transform ${wh.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mb-3">
                        {wh.events.map(e => (
                          <span key={e} className="text-[9px] bg-gray-100 px-1.5 py-0.5 font-mono">{e}</span>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleTestWebhook(wh.id)}
                          className={`text-[10px] font-bold font-mono px-2 py-1 border ${webhookTestResult?.id === wh.id ? (webhookTestResult.success ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600') : 'border-gray-300 hover:border-black'}`}
                        >
                          {webhookTestResult?.id === wh.id ? (webhookTestResult.success ? '✓ OK' : '✗ FAIL') : 'TEST'}
                        </button>
                        <button 
                          onClick={() => handleDeleteWebhook(wh.id)}
                          className="text-[10px] font-bold font-mono px-2 py-1 border border-red-300 text-red-600 hover:bg-red-50"
                        >
                          DELETE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* External Apps (Simulations) */}
            <div>
              <h3 className="text-lg font-bold font-mono uppercase mb-4 flex items-center gap-2">
                <ICONS.Cpu size={20} /> Context Triggers
              </h3>
              <p className="text-xs text-gray-500 mb-4 font-mono">
                Simulate context events from external apps. Real integrations coming soon.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* VS Code */}
                <div className="bg-white border-2 border-black p-6 shadow-retro relative overflow-hidden group hover:border-[#007acc] transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-[#007acc] text-white border-2 border-black shadow-sm"><ICONS.Code size={24} /></div>
                        <div className="px-2 py-1 bg-yellow-100 border border-yellow-500 text-[10px] font-bold text-yellow-700 uppercase">Simulate</div>
                    </div>
                    <h3 className="text-lg font-bold font-mono">VS Code</h3>
                    <p className="text-xs text-gray-500 mb-4">Coding activity context</p>
                    
                    <div className="space-y-2">
                        <button onClick={() => simulateContext('VS_CODE', 'DEBUG_MODE', 'debugging complex code. Need focus.')} disabled={!!activeSimulation} className="w-full text-left text-xs font-mono border border-gray-200 p-2 hover:bg-gray-50 hover:border-[#007acc] transition-colors disabled:opacity-50">
                            ▶ Trigger: Debugging
                        </button>
                        <button onClick={() => simulateContext('VS_CODE', 'FLOW_STATE', 'writing new features rapidly. High energy.')} disabled={!!activeSimulation} className="w-full text-left text-xs font-mono border border-gray-200 p-2 hover:bg-gray-50 hover:border-[#007acc] transition-colors disabled:opacity-50">
                            ▶ Trigger: Flow State
                        </button>
                    </div>
                </div>

                {/* Discord */}
                <div className="bg-white border-2 border-black p-6 shadow-retro relative overflow-hidden group hover:border-[#5865F2] transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-[#5865F2] text-white border-2 border-black shadow-sm"><ICONS.Game size={24} /></div>
                        <div className="px-2 py-1 bg-yellow-100 border border-yellow-500 text-[10px] font-bold text-yellow-700 uppercase">Simulate</div>
                    </div>
                    <h3 className="text-lg font-bold font-mono">Discord</h3>
                    <p className="text-xs text-gray-500 mb-4">Voice & game activity</p>
                    
                    <div className="space-y-2">
                        <button onClick={() => simulateContext('DISCORD', 'VC_JOIN', 'just joined a chill voice channel.')} disabled={!!activeSimulation} className="w-full text-left text-xs font-mono border border-gray-200 p-2 hover:bg-gray-50 hover:border-[#5865F2] transition-colors disabled:opacity-50">
                            ▶ Trigger: Join VC
                        </button>
                        <button onClick={() => simulateContext('DISCORD', 'GAME_START', 'started playing an RPG game.')} disabled={!!activeSimulation} className="w-full text-left text-xs font-mono border border-gray-200 p-2 hover:bg-gray-50 hover:border-[#5865F2] transition-colors disabled:opacity-50">
                            ▶ Trigger: Game Launch
                        </button>
                    </div>
                </div>

                {/* Browser */}
                <div className="bg-white border-2 border-black p-6 shadow-retro relative overflow-hidden group hover:border-orange-500 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-orange-500 text-white border-2 border-black shadow-sm"><ICONS.Globe size={24} /></div>
                        <div className="px-2 py-1 bg-yellow-100 border border-yellow-500 text-[10px] font-bold text-yellow-700 uppercase">Simulate</div>
                    </div>
                    <h3 className="text-lg font-bold font-mono">Browser</h3>
                    <p className="text-xs text-gray-500 mb-4">Tab activity context</p>
                    
                    <div className="space-y-2">
                        <button onClick={() => simulateContext('BROWSER', 'READING', 'reading long-form articles. Need calm background.')} disabled={!!activeSimulation} className="w-full text-left text-xs font-mono border border-gray-200 p-2 hover:bg-gray-50 hover:border-orange-500 transition-colors disabled:opacity-50">
                            ▶ Trigger: Reading Mode
                        </button>
                        <button onClick={() => simulateContext('BROWSER', 'SOCIAL', 'browsing social media. Need upbeat pop.')} disabled={!!activeSimulation} className="w-full text-left text-xs font-mono border border-gray-200 p-2 hover:bg-gray-50 hover:border-orange-500 transition-colors disabled:opacity-50">
                            ▶ Trigger: Social Feed
                        </button>
                    </div>
                </div>
              </div>
            </div>

            {/* Extension Status */}
            <div className="bg-gray-50 border-2 border-gray-200 p-4">
              <h4 className="font-bold font-mono text-sm uppercase mb-3 flex items-center gap-2">
                <ICONS.Radio size={16} /> Extension Status
              </h4>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(extensionBridge.EXTENSION_GUIDES).map(([key, guide]) => (
                  <div key={key} className="text-center">
                    <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${connectedExtensions.includes(key as any) ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <p className="text-xs font-mono">{guide.title}</p>
                    <span className="text-[9px] text-gray-400">{guide.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
      )}

      {/* --- TAB: DEV (API) --- */}
      {activeTab === 'DEV' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-left-4">
              {/* API Keys Panel */}
              <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white border-2 border-black p-6 shadow-retro">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold font-mono flex items-center gap-2">
                            <ICONS.Key size={20} /> API Keys
                        </h3>
                        <button 
                          onClick={() => setShowNewKeyModal(true)}
                          className="text-xs font-bold font-mono bg-black text-white px-3 py-1 hover:bg-gray-800"
                        >
                          + NEW
                        </button>
                      </div>
                      
                      {apiKeys.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <ICONS.Key size={32} className="mx-auto mb-2 opacity-50" />
                          <p className="text-xs font-mono">No API keys created</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                          {apiKeys.map(key => (
                            <div key={key.id} className="border border-gray-200 p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h4 className="font-bold font-mono text-sm">{key.name}</h4>
                                  <code className="text-[10px] text-gray-400">{key.key.substring(0, 16)}...</code>
                                </div>
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => handleCopyKey(key)}
                                    className={`p-1 border ${copiedKeyId === key.id ? 'border-green-500 text-green-600' : 'border-gray-300 hover:border-black'}`}
                                  >
                                    {copiedKeyId === key.id ? <ICONS.Check size={12} /> : <ICONS.Copy size={12} />}
                                  </button>
                                  <button 
                                    onClick={() => handleRevokeKey(key.id)}
                                    className="p-1 border border-red-300 text-red-600 hover:bg-red-50"
                                  >
                                    <ICONS.Close size={12} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {key.scopes.map(scope => (
                                  <span key={scope} className="text-[9px] bg-gray-100 px-1.5 py-0.5 font-mono">{scope}</span>
                                ))}
                              </div>
                              {key.lastUsed && (
                                <p className="text-[9px] text-gray-400 mt-1">
                                  Last used: {new Date(key.lastUsed).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                  </div>

                  {/* Quick Start */}
                  <div className="bg-blue-50 border-2 border-blue-600 p-4">
                    <h4 className="font-bold font-mono text-sm mb-3">Quick Start</h4>
                    <pre className="bg-white border border-blue-200 p-3 text-[10px] font-mono overflow-x-auto">
{`// Browser Console
const api = window.MusicCompanionAPI;

// Authenticate
api.authenticate('your_key_here');

// Control playback
api.play();
api.pause();
api.next();

// Get current song
api.getCurrentSong();`}
                    </pre>
                  </div>
              </div>

              {/* Event Log */}
              <div className="lg:col-span-2">
                  <div className="bg-[#1a1a1a] border-2 border-black p-0 shadow-retro h-full min-h-[500px] flex flex-col">
                      <div className="bg-black text-white px-4 py-2 border-b border-gray-800 flex justify-between items-center">
                          <span className="text-xs font-mono font-bold uppercase">System Event Log</span>
                          <div className="flex items-center gap-2 text-[10px] text-green-500">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> LISTENING
                          </div>
                      </div>
                      <div className="flex-1 p-4 font-mono text-xs text-green-400 overflow-y-auto space-y-2">
                          {logs.length === 0 && <span className="opacity-30">_waiting_for_events...</span>}
                          {logs.map(log => (
                              <div key={log.id} className="border-l-2 border-green-800 pl-2">
                                  <span className="opacity-50">[{log.time}]</span> <span className="text-white font-bold">{log.source}:</span> {log.event}
                              </div>
                          ))}
                      </div>
                      
                      {/* API Endpoints Reference */}
                      <div className="border-t border-gray-800 p-4">
                        <h4 className="text-white font-bold font-mono text-xs mb-3">API REFERENCE</h4>
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                          <div className="text-gray-400">
                            <span className="text-cyan-400">GET</span> getCurrentSong()
                          </div>
                          <div className="text-gray-400">
                            <span className="text-cyan-400">GET</span> getPlaybackState()
                          </div>
                          <div className="text-gray-400">
                            <span className="text-yellow-400">POST</span> play(songId?)
                          </div>
                          <div className="text-gray-400">
                            <span className="text-yellow-400">POST</span> pause()
                          </div>
                          <div className="text-gray-400">
                            <span className="text-yellow-400">POST</span> next()
                          </div>
                          <div className="text-gray-400">
                            <span className="text-yellow-400">POST</span> previous()
                          </div>
                          <div className="text-gray-400">
                            <span className="text-cyan-400">GET</span> getQueue()
                          </div>
                          <div className="text-gray-400">
                            <span className="text-yellow-400">POST</span> addToQueue(song)
                          </div>
                          <div className="text-gray-400">
                            <span className="text-purple-400">AI</span> generatePlaylist(prompt)
                          </div>
                          <div className="text-gray-400">
                            <span className="text-green-400">EVENT</span> onSongChange(cb)
                          </div>
                        </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODALS --- */}
      
      {/* New API Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-black shadow-retro p-6 w-full max-w-md">
            <h3 className="text-lg font-bold font-mono mb-4">Create API Key</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Key Name</label>
                <input 
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="My Integration"
                  className="w-full border-2 border-gray-300 p-2 font-mono focus:border-black outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Scopes</label>
                <div className="space-y-2">
                  {SCOPES.map(scope => (
                    <label key={scope.value} className="flex items-start gap-3 p-2 border border-gray-200 hover:border-black cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={newKeyScopes.includes(scope.value)}
                        onChange={e => {
                          if (e.target.checked) {
                            setNewKeyScopes([...newKeyScopes, scope.value]);
                          } else {
                            setNewKeyScopes(newKeyScopes.filter(s => s !== scope.value));
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="font-bold font-mono text-sm">{scope.label}</span>
                        <p className="text-xs text-gray-500">{scope.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowNewKeyModal(false)}
                className="flex-1 py-2 border-2 border-gray-300 font-bold font-mono text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateApiKey}
                disabled={!newKeyName.trim() || newKeyScopes.length === 0}
                className="flex-1 py-2 bg-black text-white font-bold font-mono text-sm border-2 border-black disabled:opacity-50"
              >
                Create Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Webhook Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-black shadow-retro p-6 w-full max-w-md">
            <h3 className="text-lg font-bold font-mono mb-4">Add Webhook</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Name</label>
                <input 
                  type="text"
                  value={newWebhookName}
                  onChange={e => setNewWebhookName(e.target.value)}
                  placeholder="My Server"
                  className="w-full border-2 border-gray-300 p-2 font-mono focus:border-black outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Webhook URL</label>
                <input 
                  type="url"
                  value={newWebhookUrl}
                  onChange={e => setNewWebhookUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="w-full border-2 border-gray-300 p-2 font-mono text-sm focus:border-black outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Events</label>
                <div className="grid grid-cols-2 gap-2">
                  {webhooks.WEBHOOK_EVENTS.map(evt => (
                    <label key={evt.value} className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={newWebhookEvents.includes(evt.value)}
                        onChange={e => {
                          if (e.target.checked) {
                            setNewWebhookEvents([...newWebhookEvents, evt.value]);
                          } else {
                            setNewWebhookEvents(newWebhookEvents.filter(v => v !== evt.value));
                          }
                        }}
                      />
                      {evt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowWebhookModal(false)}
                className="flex-1 py-2 border-2 border-gray-300 font-bold font-mono text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateWebhook}
                disabled={!newWebhookName.trim() || !newWebhookUrl.trim() || newWebhookEvents.length === 0}
                className="flex-1 py-2 bg-black text-white font-bold font-mono text-sm border-2 border-black disabled:opacity-50"
              >
                Add Webhook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Playlist Modal */}
      {showSmartPlaylist && (
        <SmartPlaylistEditor
          onSave={(playlist) => {
            console.log('[Extensions] Smart playlist created:', playlist);
            setShowSmartPlaylist(false);
          }}
          onClose={() => setShowSmartPlaylist(false)}
        />
      )}
    </div>
  );
};

export default Extensions;
