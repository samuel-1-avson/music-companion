import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { generatePlaylistFromContext } from '../services/geminiService';
import { Song, MusicProvider } from '../types';

interface ExtensionsProps {
  onPlaySong: (song: Song, queue?: Song[]) => void;
  spotifyToken?: string | null;
  musicProvider?: MusicProvider;
}

interface LogEntry {
  id: number;
  source: string;
  event: string;
  time: string;
}

const Extensions: React.FC<ExtensionsProps> = ({ onPlaySong, spotifyToken, musicProvider = 'YOUTUBE' }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeSimulation, setActiveSimulation] = useState<string | null>(null);

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
      const { songs, explanation } = await generatePlaylistFromContext(fullPrompt, musicProvider as MusicProvider, undefined, spotifyToken || undefined);
      
      addLog('SYSTEM', `PROCESSED: Found ${songs.length} tracks from ${musicProvider}`);
      if (songs.length > 0) {
        onPlaySong(songs[0], songs);
      }
    } catch (e) {
      addLog('SYSTEM', 'ERROR: Failed to generate context');
    } finally {
      setActiveSimulation(null);
    }
  };

  const regenerateKey = () => {
    const newKey = 'mc_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('companion_api_key', newKey);
    setApiKey(newKey);
    addLog('SYSTEM', 'API_KEY_ROTATED');
  };

  return (
    <div className="p-8 space-y-8 pb-32">
      <div className="flex justify-between items-end border-b-4 border-black pb-4">
        <div>
          <h2 className="text-4xl font-bold text-black mb-2 font-mono">DEVELOPER_HUB</h2>
          <p className="text-gray-600 font-mono">EXTENSIONS_&_INTEGRATIONS</p>
        </div>
        <div className="hidden md:block">
           <div className="flex items-center space-x-2 bg-black text-white px-3 py-1 font-mono text-xs">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>SOCKET_SERVER: ONLINE (PORT: 6473)</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* VS CODE EXTENSION CARD */}
        <div className="lg:col-span-2 bg-white border-2 border-black p-6 shadow-retro relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <ICONS.Code size={120} />
           </div>
           
           <div className="flex items-start justify-between mb-6 relative z-10">
              <div className="flex items-center space-x-4">
                 <div className="w-16 h-16 bg-[#007acc] border-2 border-black flex items-center justify-center text-white shadow-retro-sm">
                    <ICONS.Code size={32} />
                 </div>
                 <div>
                    <h3 className="text-xl font-bold font-mono">VS Code Companion</h3>
                    <p className="text-xs text-gray-500 font-bold uppercase">v1.4.2 • Installed</p>
                 </div>
              </div>
              <div className="flex items-center space-x-2 px-2 py-1 bg-green-100 border-2 border-green-600 text-green-800 text-[10px] font-bold font-mono uppercase">
                 <ICONS.Zap size={12} fill="currentColor" />
                 <span>Connected</span>
              </div>
           </div>

           <p className="text-sm text-gray-700 mb-6 font-mono leading-relaxed max-w-lg">
              Automatically adjusts your soundscape based on your coding activity. Detects debugging sessions, merge conflicts, and deep work states to play the perfect background music.
           </p>

           <div className="bg-gray-100 border-2 border-black p-4 mb-6">
              <p className="text-xs font-bold font-mono text-gray-500 mb-3 uppercase">Simulate Local Events</p>
              <div className="flex flex-wrap gap-2">
                 <button 
                   onClick={() => simulateContext('VS_CODE', 'DEBUGGING_MODE', 'debugging a complex race condition in TypeScript. Need intense, focused, non-lyrical electronic music.')}
                   disabled={!!activeSimulation}
                   className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-black hover:bg-red-50 hover:border-red-500 hover:text-red-600 transition-all text-xs font-bold font-mono shadow-[2px_2px_0_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
                 >
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    TRIGGER: DEBUG_MODE
                 </button>
                 <button 
                   onClick={() => simulateContext('VS_CODE', 'DEEP_WORK', 'writing new feature code. In the flow state. Need rhythmic, propulsive lo-fi or synthwave.')}
                   disabled={!!activeSimulation}
                   className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-black hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600 transition-all text-xs font-bold font-mono shadow-[2px_2px_0_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
                 >
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    TRIGGER: FLOW_STATE
                 </button>
                 <button 
                   onClick={() => simulateContext('VS_CODE', 'SYNTAX_ERROR', 'fixing multiple syntax errors and getting frustrated. Need calming, reassuring ambient music.')}
                   disabled={!!activeSimulation}
                   className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-black hover:bg-yellow-50 hover:border-yellow-500 hover:text-yellow-600 transition-all text-xs font-bold font-mono shadow-[2px_2px_0_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
                 >
                    <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                    TRIGGER: ERROR_SPIKE
                 </button>
              </div>
           </div>

           <div className="flex gap-3">
              <button className="flex-1 bg-black text-white border-2 border-black py-3 font-bold font-mono text-sm hover:bg-gray-800 transition-colors">
                 CONFIGURE_EXTENSION
              </button>
              <button className="px-4 border-2 border-black hover:bg-gray-100 transition-colors" title="Documentation">
                 <ICONS.ScrollText size={20} />
              </button>
           </div>
        </div>

        {/* API KEY CARD */}
        <div className="bg-gray-50 border-2 border-black p-6 flex flex-col">
           <h3 className="text-lg font-bold font-mono mb-4 flex items-center gap-2">
              <ICONS.Terminal size={20} />
              API_ACCESS
           </h3>
           
           <div className="flex-1 space-y-4">
              <p className="text-xs text-gray-600 font-mono">
                 Use this token to authenticate your own scripts or custom integrations.
              </p>
              
              <div className="bg-white border-2 border-black p-3 relative group">
                 <code className="block font-mono text-sm break-all pr-8">
                    {showKey ? apiKey : '•'.repeat(apiKey.length)}
                 </code>
                 <button 
                   onClick={() => setShowKey(!showKey)}
                   className="absolute top-2 right-2 text-gray-400 hover:text-black"
                 >
                    {showKey ? <ICONS.MicOff size={16} /> : <ICONS.Search size={16} />}
                 </button>
              </div>

              <div className="flex gap-2">
                 <button 
                   onClick={() => { navigator.clipboard.writeText(apiKey); addLog('SYSTEM', 'API_KEY_COPIED'); }}
                   className="flex-1 py-2 border-2 border-black bg-white hover:bg-gray-100 text-xs font-bold font-mono"
                 >
                    COPY_TOKEN
                 </button>
                 <button 
                   onClick={regenerateKey}
                   className="px-3 py-2 border-2 border-black bg-white hover:bg-red-50 text-red-600 hover:border-red-600 transition-colors"
                   title="Rotate Key"
                 >
                    <ICONS.Zap size={16} />
                 </button>
              </div>
           </div>

           {/* Live Event Log */}
           <div className="mt-8 border-t-2 border-black pt-4 flex-1 flex flex-col min-h-[150px]">
              <p className="text-[10px] font-bold font-mono text-gray-400 uppercase mb-2">Incoming Webhook Stream</p>
              <div className="bg-black text-green-500 p-3 font-mono text-[10px] flex-1 overflow-hidden border-2 border-gray-800 relative">
                 <div className="absolute inset-0 p-3 overflow-y-auto space-y-1">
                    {logs.length === 0 && <span className="opacity-50">_waiting_for_events...</span>}
                    {logs.map(log => (
                       <div key={log.id} className="animate-in slide-in-from-left-2 duration-200">
                          <span className="opacity-50">[{log.time}]</span> <span className="text-white">{log.source}:</span> {log.event}
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>

        {/* TELEGRAM INTEGRATION */}
        <div className="bg-white border-2 border-black p-6 shadow-retro relative overflow-hidden group">
            <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-[#0088cc] border-2 border-black flex items-center justify-center text-white shadow-retro-sm">
                    <ICONS.Send size={24} className="-ml-1 mt-1 -rotate-12" />
                </div>
                <div>
                    <h3 className="text-lg font-bold font-mono">Telegram Bot</h3>
                    <p className="text-xs text-green-600 font-bold uppercase">● Active</p>
                </div>
            </div>
            <p className="text-xs text-gray-600 font-mono mb-4">
                Control playback and get vibe checks directly from your chat. Send voice notes for analysis.
            </p>
            <div className="space-y-2 mb-4">
                <button 
                    onClick={() => simulateContext('TELEGRAM', 'CMD_VIBE', 'asking for a vibe check via Telegram command /vibe.')}
                    disabled={!!activeSimulation}
                    className="w-full text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-mono transition-colors"
                >
                    <span className="font-bold text-blue-700">User:</span> /vibe check
                </button>
                <button 
                    onClick={() => simulateContext('TELEGRAM', 'VOICE_NOTE', 'sent a voice note describing a rainy day feeling. Need melancholy jazz.')}
                    disabled={!!activeSimulation}
                    className="w-full text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-mono transition-colors"
                >
                    <span className="font-bold text-blue-700">User:</span> [Voice Note 0:15]
                </button>
            </div>
            <button className="w-full py-2 border-2 border-black font-bold font-mono text-xs hover:bg-[#0088cc] hover:text-white transition-colors">
                OPEN_BOT
            </button>
        </div>

        {/* DISCORD INTEGRATION */}
        <div className="bg-white border-2 border-black p-6 shadow-retro relative overflow-hidden group">
            <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-[#5865F2] border-2 border-black flex items-center justify-center text-white shadow-retro-sm">
                    <ICONS.Game size={24} />
                </div>
                <div>
                    <h3 className="text-lg font-bold font-mono">Discord Jukebox</h3>
                    <p className="text-xs text-green-600 font-bold uppercase">● Active</p>
                </div>
            </div>
            <p className="text-xs text-gray-600 font-mono mb-4">
                Syncs music with your voice channel activity and game status rich presence.
            </p>
            <div className="space-y-2 mb-4">
                <button 
                    onClick={() => simulateContext('DISCORD', 'VC_JOIN', 'joined the "Lounge" voice channel late at night. Need chill lo-fi beats.')}
                    disabled={!!activeSimulation}
                    className="w-full text-left px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-mono transition-colors"
                >
                    <span className="font-bold text-indigo-700">Event:</span> User joined #Lounge
                </button>
                <button 
                    onClick={() => simulateContext('DISCORD', 'GAME_START', 'started playing "Elden Ring". Need epic, orchestral, dark fantasy music.')}
                    disabled={!!activeSimulation}
                    className="w-full text-left px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-mono transition-colors"
                >
                    <span className="font-bold text-indigo-700">Presence:</span> Playing Elden Ring
                </button>
            </div>
            <button className="w-full py-2 border-2 border-black font-bold font-mono text-xs hover:bg-[#5865F2] hover:text-white transition-colors">
                INVITE_BOT
            </button>
        </div>

        {/* BROWSER EXTENSION CARD (Condensed) */}
        <div className="bg-white border-2 border-black p-6 shadow-retro flex flex-col relative overflow-hidden group">
            <div className="flex items-center space-x-4 mb-4">
               <div className="w-12 h-12 bg-orange-500 border-2 border-black flex items-center justify-center text-white shadow-retro-sm flex-shrink-0">
                  <ICONS.Globe size={24} />
               </div>
               <div>
                  <h3 className="text-lg font-bold font-mono">Web Streamer</h3>
                  <p className="text-xs text-gray-500 font-bold">Chrome • Firefox</p>
               </div>
            </div>
            
            <p className="text-xs text-gray-600 font-mono mb-4 flex-1">
               Contextual music based on active tab content.
            </p>
            
            <div className="space-y-2 mb-4">
               <button 
                 onClick={() => simulateContext('BROWSER', 'PAGE_LOAD', 'reading React Docs. Need focus music.')}
                 disabled={!!activeSimulation}
                 className="w-full text-left px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-xs font-mono transition-colors"
               >
                  <span className="font-bold text-orange-700">Tab:</span> React Documentation
               </button>
               <button 
                 onClick={() => simulateContext('BROWSER', 'SOCIAL_MEDIA', 'scrolling Twitter. Need upbeat pop.')}
                 disabled={!!activeSimulation}
                 className="w-full text-left px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-xs font-mono transition-colors"
               >
                  <span className="font-bold text-orange-700">Tab:</span> Twitter / X
               </button>
            </div>

            <button className="w-full bg-white text-black border-2 border-black py-2 font-bold font-mono text-xs hover:bg-black hover:text-white transition-colors">
               INSTALL
            </button>
        </div>

      </div>
    </div>
  );
};

export default Extensions;