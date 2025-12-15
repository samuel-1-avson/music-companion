
import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { generatePlaylistFromContext } from '../services/geminiService';
import { Song, MusicProvider, SpotifyProfile } from '../types';
import { getSpotifyAuthUrl } from '../services/spotifyService';

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
  const [activeTab, setActiveTab] = useState<'SOURCES' | 'APPS' | 'DEV'>('SOURCES');
  
  // --- DEV / API STATE ---
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeSimulation, setActiveSimulation] = useState<string | null>(null);

  // --- SPOTIFY AUTH STATE ---
  const [clientId, setClientId] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [isEditingSpotify, setIsEditingSpotify] = useState(false);

  useEffect(() => {
    // Generate a fake API key if none exists
    const stored = localStorage.getItem('companion_api_key');
    if (stored) {
      setApiKey(stored);
    } else {
      const newKey = 'mc_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('companion_api_key', newKey);
      setApiKey(newKey);
    }

    // Load Spotify Config
    const savedId = localStorage.getItem('spotify_client_id');
    if (savedId) setClientId(savedId);
    
    const savedUri = localStorage.getItem('spotify_redirect_uri');
    if (savedUri) {
        setRedirectUri(savedUri);
    } else {
        let url = window.location.href.split('#')[0];
        if (url.endsWith('/')) url = url.slice(0, -1);
        setRedirectUri(url);
    }
  }, []);

  const addLog = (source: string, event: string) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs(prev => [{ id: Date.now(), source, event, time: timeStr }, ...prev.slice(0, 7)]);
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
      }
    } catch (e) {
      addLog('SYSTEM', 'ERROR: Failed to generate context');
    } finally {
      setActiveSimulation(null);
    }
  };

  const handleSpotifyConnect = () => {
      if (!clientId) return;
      localStorage.setItem('spotify_client_id', clientId);
      localStorage.setItem('spotify_redirect_uri', redirectUri);
      const url = getSpotifyAuthUrl(clientId, redirectUri);
      window.open(url, '_blank', 'width=600,height=800');
  };

  const regenerateKey = () => {
    const newKey = 'mc_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('companion_api_key', newKey);
    setApiKey(newKey);
    addLog('SYSTEM', 'API_KEY_ROTATED');
  };

  const PROVIDERS = [
      { id: 'YOUTUBE', label: 'YouTube Network', icon: ICONS.Play, desc: 'Global video database. No login required. Best for variety.' },
      { id: 'SPOTIFY', label: 'Spotify Connect', icon: ICONS.Music, desc: 'Premium streaming & device control. Requires Auth.' },
      { id: 'APPLE', label: 'Apple Music', icon: ICONS.Radio, desc: 'iTunes Store preview network. High quality snippets.' },
      { id: 'DEEZER', label: 'Deezer Flow', icon: ICONS.Activity, desc: 'Dynamic flow recommendations and previews.' },
  ];

  return (
    <div className="p-8 space-y-8 pb-32 max-w-6xl mx-auto">
      <div className="flex justify-between items-end border-b-4 border-black pb-4">
        <div>
          <h2 className="text-4xl font-bold text-black mb-2 font-mono">INTEGRATIONS</h2>
          <p className="text-gray-600 font-mono">SOURCES_&_EXTERNAL_LINKS</p>
        </div>
        <div className="flex space-x-2">
            {[
                { id: 'SOURCES', icon: ICONS.HardDrive, label: 'MUSIC_SOURCES' },
                { id: 'APPS', icon: ICONS.Cpu, label: 'EXTERNAL_APPS' },
                { id: 'DEV', icon: ICONS.Terminal, label: 'DEVELOPER_API' }
            ].map(tab => (
                <button 
                    key={tab.id} 
                    onClick={() => setActiveTab(tab.id as any)} 
                    className={`px-4 py-2 font-bold font-mono text-xs flex items-center gap-2 border-2 border-black transition-all ${activeTab === tab.id ? 'bg-black text-white shadow-retro-sm' : 'bg-white text-black hover:bg-gray-100'}`}
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
                                      <div className={`p-3 border-2 ${isActive ? 'border-white bg-gray-800' : 'border-gray-200 bg-gray-50 group-hover:border-black'}`}>
                                          <p.icon size={24} />
                                      </div>
                                      <div>
                                          <h4 className="font-bold font-mono text-sm uppercase">{p.label}</h4>
                                          <p className="text-xs opacity-70 font-mono mt-1">{p.desc}</p>
                                      </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                      {isActive && <ICONS.CheckCircle className="text-green-400" size={24} />}
                                      {p.id === 'SPOTIFY' && !spotifyToken && <span className="text-[10px] font-bold border border-red-500 text-red-500 px-2 py-0.5 uppercase">Auth Required</span>}
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>

              {/* Spotify Configuration Panel */}
              <div className="bg-green-50 border-2 border-green-600 p-6 shadow-retro relative">
                  <div className="absolute top-0 right-0 bg-green-600 text-white px-3 py-1 text-xs font-bold font-mono uppercase">
                      Spotify Connect
                  </div>
                  
                  {spotifyToken ? (
                      <div className="text-center py-8">
                          <div className="w-20 h-20 mx-auto bg-green-200 rounded-full flex items-center justify-center border-4 border-green-600 mb-4 relative">
                              {spotifyProfile?.images?.[0]?.url ? (
                                  <img src={spotifyProfile.images[0].url} className="w-full h-full rounded-full object-cover" />
                              ) : <ICONS.User size={32} className="text-green-800" />}
                              <div className="absolute bottom-0 right-0 bg-green-600 p-1 rounded-full border-2 border-white">
                                  <ICONS.Check size={12} className="text-white" />
                              </div>
                          </div>
                          <h3 className="font-bold text-xl mb-1">{spotifyProfile?.display_name || 'Spotify User'}</h3>
                          <p className="text-xs font-mono text-green-800 mb-6">{spotifyProfile?.email}</p>
                          
                          <button 
                            onClick={onDisconnectSpotify}
                            className="bg-white border-2 border-red-500 text-red-600 px-6 py-2 text-xs font-bold font-mono uppercase hover:bg-red-500 hover:text-white transition-colors"
                          >
                              Disconnect Session
                          </button>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          <div className="flex justify-between items-center mb-2">
                              <h4 className="font-bold font-mono text-sm">CONFIGURATION</h4>
                              <button onClick={() => setIsEditingSpotify(!isEditingSpotify)} className="text-[10px] underline text-gray-500 hover:text-black">
                                  {isEditingSpotify ? 'Cancel' : 'Edit Config'}
                              </button>
                          </div>
                          
                          {isEditingSpotify || !clientId ? (
                              <div className="space-y-3 bg-white p-4 border-2 border-green-200">
                                  <div>
                                      <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Redirect URI</label>
                                      <code className="block w-full bg-gray-100 p-2 text-xs border border-gray-300 break-all">{redirectUri}</code>
                                      <p className="text-[9px] text-gray-400 mt-1">Add this to your Spotify Dashboard.</p>
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Client ID</label>
                                      <input 
                                        type="text" 
                                        value={clientId} 
                                        onChange={e => setClientId(e.target.value)}
                                        placeholder="Paste Client ID..."
                                        className="w-full border-2 border-gray-300 p-2 text-xs font-mono focus:border-green-600 outline-none"
                                      />
                                  </div>
                              </div>
                          ) : (
                              <div className="flex items-center gap-2 text-xs font-mono text-green-800 bg-green-100 p-2">
                                  <ICONS.Check size={14} /> Client ID Configured
                              </div>
                          )}

                          <button 
                            onClick={handleSpotifyConnect}
                            disabled={!clientId}
                            className={`w-full py-4 font-bold font-mono uppercase text-sm border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 ${!clientId ? 'bg-gray-200 text-gray-400' : 'bg-[#1DB954] text-black hover:bg-[#1ed760]'}`}
                          >
                              <ICONS.ExternalLink size={16} /> Authenticate
                          </button>
                          <p className="text-[10px] text-center text-green-800 opacity-60">Opens Spotify Login in a popup.</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* --- TAB: APPS (SIMULATIONS) --- */}
      {activeTab === 'APPS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-right-4">
              {/* VS Code */}
              <div className="bg-white border-2 border-black p-6 shadow-retro relative overflow-hidden group hover:border-[#007acc] transition-colors">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-[#007acc] text-white border-2 border-black shadow-sm"><ICONS.Code size={24} /></div>
                      <div className="px-2 py-1 bg-green-100 border border-green-500 text-[10px] font-bold text-green-700 uppercase">Active</div>
                  </div>
                  <h3 className="text-lg font-bold font-mono">VS Code</h3>
                  <p className="text-xs text-gray-500 mb-4">Contextual coding companion.</p>
                  
                  <div className="space-y-2">
                      <button onClick={() => simulateContext('VS_CODE', 'DEBUG_MODE', 'debugging complex code. Need focus.')} className="w-full text-left text-xs font-mono border border-gray-200 p-2 hover:bg-gray-50 hover:border-[#007acc] transition-colors">
                          ▶ Trigger: Debugging
                      </button>
                      <button onClick={() => simulateContext('VS_CODE', 'FLOW_STATE', 'writing new features rapidly. High energy.')} className="w-full text-left text-xs font-mono border border-gray-200 p-2 hover:bg-gray-50 hover:border-[#007acc] transition-colors">
                          ▶ Trigger: Flow State
                      </button>
                  </div>
              </div>

              {/* Discord */}
              <div className="bg-white border-2 border-black p-6 shadow-retro relative overflow-hidden group hover:border-[#5865F2] transition-colors">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-[#5865F2] text-white border-2 border-black shadow-sm"><ICONS.Game size={24} /></div>
                      <div className="px-2 py-1 bg-green-100 border border-green-500 text-[10px] font-bold text-green-700 uppercase">Active</div>
                  </div>
                  <h3 className="text-lg font-bold font-mono">Discord</h3>
                  <p className="text-xs text-gray-500 mb-4">Voice channel & game presence.</p>
                  
                  <div className="space-y-2">
                      <button onClick={() => simulateContext('DISCORD', 'VC_JOIN', 'just joined a chill voice channel.')} className="w-full text-left text-xs font-mono border border-gray-200 p-2 hover:bg-gray-50 hover:border-[#5865F2] transition-colors">
                          ▶ Trigger: Join VC
                      </button>
                      <button onClick={() => simulateContext('DISCORD', 'GAME_START', 'started playing an RPG game.')} className="w-full text-left text-xs font-mono border border-gray-200 p-2 hover:bg-gray-50 hover:border-[#5865F2] transition-colors">
                          ▶ Trigger: Game Launch
                      </button>
                  </div>
              </div>

              {/* Browser */}
              <div className="bg-white border-2 border-black p-6 shadow-retro relative overflow-hidden group hover:border-orange-500 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-orange-500 text-white border-2 border-black shadow-sm"><ICONS.Globe size={24} /></div>
                      <div className="px-2 py-1 bg-green-100 border border-green-500 text-[10px] font-bold text-green-700 uppercase">Active</div>
                  </div>
                  <h3 className="text-lg font-bold font-mono">Browser</h3>
                  <p className="text-xs text-gray-500 mb-4">Tab-based context sensing.</p>
                  
                  <div className="space-y-2">
                      <button onClick={() => simulateContext('BROWSER', 'READING', 'reading long-form articles. Need calm background.')} className="w-full text-left text-xs font-mono border border-gray-200 p-2 hover:bg-gray-50 hover:border-orange-500 transition-colors">
                          ▶ Trigger: Reading Mode
                      </button>
                      <button onClick={() => simulateContext('BROWSER', 'SOCIAL', 'browsing social media. Need upbeat pop.')} className="w-full text-left text-xs font-mono border border-gray-200 p-2 hover:bg-gray-50 hover:border-orange-500 transition-colors">
                          ▶ Trigger: Social Feed
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- TAB: DEV (API) --- */}
      {activeTab === 'DEV' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-left-4">
              <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white border-2 border-black p-6 shadow-retro">
                      <h3 className="text-lg font-bold font-mono mb-4 flex items-center gap-2">
                          <ICONS.Key size={20} /> API Access
                      </h3>
                      <p className="text-xs text-gray-600 font-mono mb-4">
                          Authenticate custom scripts to control the companion remotely.
                      </p>
                      
                      <div className="bg-gray-100 border-2 border-black p-3 relative mb-4">
                          <code className="block font-mono text-sm break-all pr-8">
                              {showKey ? apiKey : '•'.repeat(apiKey.length)}
                          </code>
                          <button onClick={() => setShowKey(!showKey)} className="absolute top-2 right-2 text-gray-400 hover:text-black">
                              {showKey ? <ICONS.MicOff size={16} /> : <ICONS.Eye size={16} />}
                          </button>
                      </div>

                      <div className="flex gap-2">
                          <button onClick={() => navigator.clipboard.writeText(apiKey)} className="flex-1 py-2 border-2 border-black bg-white hover:bg-gray-100 text-xs font-bold font-mono">COPY</button>
                          <button onClick={regenerateKey} className="px-3 py-2 border-2 border-black hover:bg-red-50 text-red-600"><ICONS.Zap size={16} /></button>
                      </div>
                  </div>
              </div>

              <div className="lg:col-span-2">
                  <div className="bg-[#1a1a1a] border-2 border-black p-0 shadow-retro h-full min-h-[300px] flex flex-col">
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
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Extensions;
