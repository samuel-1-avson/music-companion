import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { getSpotifyAuthUrl } from '../services/spotifyService';
import { SpotifyProfile } from '../types';

interface SettingsProps {
  spotifyToken: string | null;
  spotifyProfile?: SpotifyProfile | null;
  onDisconnect: () => void;
}

const Settings: React.FC<SettingsProps> = ({ spotifyToken, spotifyProfile, onDisconnect }) => {
  const [clientId, setClientId] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [copied, setCopied] = useState(false);
  const [connectPhase, setConnectPhase] = useState<'idle' | 'saving' | 'redirecting'>('idle');
  const [isSaved, setIsSaved] = useState(false);
  const [showManualCheck, setShowManualCheck] = useState(false);
  
  // Manual Token State
  const [manualToken, setManualToken] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Edit URI State
  const [isEditingUri, setIsEditingUri] = useState(false);

  useEffect(() => {
    // Load saved client ID
    const savedId = localStorage.getItem('spotify_client_id');
    if (savedId) {
        setClientId(savedId);
        setIsSaved(true);
    }

    // Load saved URI or auto-detect
    const savedUri = localStorage.getItem('spotify_redirect_uri');
    if (savedUri) {
        setRedirectUri(savedUri);
    } else {
        let url = window.location.href.split('#')[0];
        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }
        setRedirectUri(url);
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = async () => {
    if (!clientId) return;
    
    setConnectPhase('saving');
    
    // Save Config
    localStorage.setItem('spotify_client_id', clientId);
    localStorage.setItem('spotify_redirect_uri', redirectUri);
    
    // Visual delay to show "Saving" state
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsSaved(true);

    setConnectPhase('redirecting');
    
    // Visual delay to show "Redirecting" state
    await new Promise(resolve => setTimeout(resolve, 800));

    const url = getSpotifyAuthUrl(clientId, redirectUri);
    
    // FORCE NEW TAB: This avoids the "Refused to connect" X-Frame-Options error
    window.open(url, '_blank', 'width=600,height=800');
    
    setConnectPhase('idle');
    setShowManualCheck(true);
  };

  const checkConnection = () => {
     // Manually trigger a check of local storage
     const token = localStorage.getItem('spotify_token');
     if (token) {
        window.dispatchEvent(new Event('storage')); // Force update in App.tsx
        window.location.reload(); 
     } else {
        alert("No token found yet. Please complete the login in the popup window.");
     }
  };

  const handleManualTokenSave = () => {
    if (!manualToken.trim()) return;
    // Basic validation
    localStorage.setItem('spotify_token', manualToken.trim());
    window.dispatchEvent(new Event('storage'));
    window.location.reload();
  };

  const resetUri = () => {
    let url = window.location.href.split('#')[0];
    if (url.endsWith('/')) url = url.slice(0, -1);
    setRedirectUri(url);
    localStorage.removeItem('spotify_redirect_uri');
    setIsEditingUri(false);
  };

  const isInsecure = redirectUri.startsWith('http://') && !redirectUri.includes('localhost') && !redirectUri.includes('127.0.0.1');
  const isConnecting = connectPhase !== 'idle';

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8 pb-32">
      <div>
        <h2 className="text-4xl font-bold text-black mb-2 font-mono border-b-4 border-black inline-block">SETTINGS</h2>
        <p className="text-gray-600 font-mono mt-2">SYSTEM_CONFIGURATION</p>
      </div>

      <div className="bg-white border-2 border-black p-8 space-y-8 shadow-retro">
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <div className="flex items-center space-x-4">
            <div className="bg-[#1DB954] border-2 border-black p-2 flex items-center justify-center shadow-retro-sm">
               <ICONS.Music size={24} className="text-black" />
            </div>
            <div>
               <h3 className="text-2xl font-bold font-mono">SPOTIFY_LINK</h3>
               <p className="text-xs text-gray-500 font-mono">Unlock full song access and personalized AI DJ</p>
            </div>
          </div>
          {spotifyToken && (
             <div className="bg-green-100 text-green-800 px-3 py-1 font-bold font-mono text-sm border-2 border-green-600">
                ACTIVE
             </div>
          )}
        </div>

        {spotifyToken ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-green-50 border-2 border-green-600 p-6 shadow-retro-sm">
                <div className="flex items-start justify-between">
                   <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 border-2 border-black rounded-full overflow-hidden bg-gray-200">
                         {spotifyProfile?.images?.[0]?.url ? (
                            <img src={spotifyProfile.images[0].url} alt="Avatar" className="w-full h-full object-cover" />
                         ) : (
                            <div className="w-full h-full flex items-center justify-center"><ICONS.User /></div>
                         )}
                      </div>
                      <div>
                         <p className="text-xs font-bold text-green-800 font-mono uppercase mb-1">Authenticated As</p>
                         <h4 className="text-xl font-bold">{spotifyProfile?.display_name || "Spotify User"}</h4>
                         <p className="text-sm text-gray-600">{spotifyProfile?.email}</p>
                      </div>
                   </div>
                   <button 
                    onClick={onDisconnect}
                    className="text-sm font-bold text-red-600 hover:text-white hover:bg-red-600 border-2 border-transparent hover:border-black px-3 py-1 transition-all"
                   >
                    DISCONNECT_SESSION
                   </button>
                </div>
             </div>
             <p className="text-center text-sm font-mono text-gray-500">
                AI Agent now has read-access to your library and listening history.
             </p>
          </div>
        ) : (
          <div className="space-y-8">
             {/* Step 1 */}
             <div className="flex flex-col md:flex-row gap-6">
                <div className="w-12 h-12 bg-black text-white flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-retro-sm border-2 border-white outline outline-2 outline-black">1</div>
                <div className="flex-1 space-y-3">
                   <div className="flex justify-between items-start">
                       <div>
                         <h4 className="font-bold text-lg">Set Redirect URI</h4>
                         <p className="text-sm text-gray-600">
                            Add this <strong>EXACTLY</strong> to your <a href="https://developer.spotify.com/dashboard" target="_blank" className="font-bold underline hover:text-orange-600 inline-flex items-center">Spotify Dashboard <ICONS.ExternalLink size={12} className="ml-1" /></a>.
                         </p>
                       </div>
                       {!isEditingUri ? (
                         <button onClick={() => setIsEditingUri(true)} className="text-xs text-blue-600 underline font-mono">EDIT</button>
                       ) : (
                         <button onClick={resetUri} className="text-xs text-red-500 underline font-mono">RESET</button>
                       )}
                   </div>

                   <div className="flex items-center gap-2">
                      {isEditingUri ? (
                        <input 
                          type="text" 
                          value={redirectUri} 
                          onChange={(e) => setRedirectUri(e.target.value)}
                          className="flex-1 bg-white border-2 border-black p-3 font-mono text-sm focus:outline-none focus:shadow-retro"
                        />
                      ) : (
                        <code className="flex-1 bg-gray-100 border-2 border-black p-3 font-mono text-sm truncate block">
                            {redirectUri}
                        </code>
                      )}
                      
                      <button 
                        onClick={handleCopy}
                        className={`p-3 border-2 border-black transition-all ${copied ? 'bg-green-500 text-white' : 'bg-white hover:bg-gray-100'}`}
                        title="Copy to Clipboard"
                      >
                         {copied ? <ICONS.Check size={20} /> : <ICONS.Copy size={20} />}
                      </button>
                   </div>
                   
                   {isInsecure && (
                      <div className="flex items-start space-x-2 text-red-600 bg-red-50 p-2 border border-red-200">
                         <ICONS.Close size={16} className="mt-0.5 flex-shrink-0" />
                         <p className="text-xs font-bold font-mono">
                            WARNING: 'http' URI detected. Spotify usually requires 'https' for Redirect URIs unless using localhost. Try editing the URI to 'https' if your environment supports it.
                         </p>
                      </div>
                   )}
                   
                   <p className="text-xs text-gray-500 font-bold font-mono">
                      * Ensure NO trailing slash in the Dashboard.
                   </p>
                </div>
             </div>

             {/* Step 2 */}
             <div className="flex flex-col md:flex-row gap-6">
                <div className="w-12 h-12 bg-black text-white flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-retro-sm border-2 border-white outline outline-2 outline-black">2</div>
                <div className="flex-1 space-y-3">
                   <h4 className="font-bold text-lg">Enter Client ID</h4>
                   <p className="text-sm text-gray-600">
                      Paste the <strong>Client ID</strong> from your Spotify App here.
                   </p>
                   <div className="relative">
                      <input 
                        type="text" 
                        value={clientId}
                        onChange={(e) => {
                           setClientId(e.target.value);
                           setIsSaved(false);
                        }}
                        disabled={isConnecting}
                        className="w-full bg-white border-2 border-black px-4 py-3 text-black focus:shadow-retro focus:outline-none transition-all font-mono placeholder-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
                        placeholder="e.g. 8a93b2..."
                      />
                      {clientId.length > 25 && (
                         <div className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors ${isSaved ? 'text-green-600 scale-110' : 'text-gray-400'}`}>
                            <ICONS.Check size={20} strokeWidth={isSaved ? 3 : 2} />
                         </div>
                      )}
                   </div>
                   {isSaved && (
                      <div className="mt-2 w-full bg-green-100 border-2 border-green-500 p-2 flex items-center justify-center space-x-2 animate-in fade-in zoom-in duration-300">
                         <ICONS.Check size={16} className="text-green-600" strokeWidth={3} />
                         <span className="text-xs font-bold font-mono text-green-800">CLIENT ID SECURELY SAVED</span>
                      </div>
                   )}
                </div>
             </div>

             <div className="pt-4 border-t-2 border-gray-200">
               <button 
                 onClick={handleConnect}
                 disabled={!clientId || isConnecting}
                 className={`w-full py-4 font-bold border-2 border-black shadow-retro transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center space-x-2 font-mono uppercase text-lg relative overflow-hidden ${
                   clientId && !isConnecting
                     ? 'bg-[#1DB954] text-black hover:bg-[#1ed760]' 
                     : (isConnecting ? 'bg-[#1ed760] text-black' : 'bg-gray-200 text-gray-500 cursor-not-allowed')
                 }`}
               >
                 <div className="relative z-10 flex items-center gap-2">
                     {connectPhase === 'saving' && (
                        <>
                           <ICONS.Save className="animate-bounce" size={24} />
                           <span>SAVING CONFIG...</span>
                        </>
                     )}
                     {connectPhase === 'redirecting' && (
                        <>
                           <ICONS.ExternalLink className="animate-pulse" size={24} />
                           <span>REDIRECTING...</span>
                        </>
                     )}
                     {connectPhase === 'idle' && (
                        <span>AUTHENTICATE WITH SPOTIFY</span>
                     )}
                 </div>
                 
                 {/* Progress Bar Overlay */}
                 {isConnecting && (
                    <div 
                      className="absolute bottom-0 left-0 h-1.5 bg-black transition-all duration-[800ms] ease-out" 
                      style={{ width: connectPhase === 'saving' ? '50%' : '100%' }}
                    />
                 )}
               </button>
               
               {showManualCheck && (
                  <div className="mt-4 flex flex-col items-center space-y-3 animate-in fade-in">
                      <p className="text-xs font-mono text-gray-600">Popup closed or blocked?</p>
                      <button 
                        onClick={checkConnection}
                        className="px-6 py-3 bg-black text-white font-bold font-mono text-sm animate-pulse border-2 border-transparent hover:border-black hover:bg-white hover:text-black shadow-retro-sm"
                      >
                         I'VE LOGGED IN, CONNECT NOW
                      </button>
                  </div>
               )}
             </div>

             {/* Manual Override Section */}
             <div className="pt-8 border-t-2 border-gray-200">
                <button 
                  onClick={() => setShowManualEntry(!showManualEntry)}
                  className="text-xs font-bold text-gray-400 hover:text-black font-mono underline uppercase"
                >
                   {showManualEntry ? '- Hide Developer Override' : '+ Developer Override (Manual Token)'}
                </button>
                
                {showManualEntry && (
                   <div className="mt-4 bg-gray-50 border-2 border-dashed border-gray-300 p-4 space-y-3">
                      <p className="text-xs text-gray-600 font-mono">
                         If the popup fails, you can generate a token externally and paste it here.
                      </p>
                      <div className="flex gap-2">
                         <input 
                           type="text" 
                           value={manualToken}
                           onChange={(e) => setManualToken(e.target.value)}
                           className="flex-1 border-2 border-gray-300 p-2 text-xs font-mono focus:border-black focus:outline-none"
                           placeholder="Paste 'access_token' here..."
                         />
                         <button 
                           onClick={handleManualTokenSave}
                           disabled={!manualToken}
                           className="bg-black text-white px-4 py-2 text-xs font-bold font-mono hover:bg-gray-800 disabled:opacity-50"
                         >
                            SAVE_FORCE
                         </button>
                      </div>
                   </div>
                )}
             </div>

             {/* Troubleshooting Section */}
             <div className="bg-gray-100 border-2 border-gray-300 p-4 text-xs font-mono text-gray-600 space-y-2">
                <p className="font-bold text-gray-800">TROUBLESHOOTING:</p>
                <ul className="list-disc pl-4 space-y-1">
                   <li>If "Invalid Client: Insecure redirect URI" appears, click <strong>EDIT</strong> above and change 'http' to 'https'.</li>
                   <li>Ensure <strong>Redirect URI</strong> in Spotify Dashboard matches the code above exactly.</li>
                   <li>Check that you have added the User under "Users and Access" in Spotify Dashboard if your app is in <strong>Development Mode</strong>.</li>
                   <li>Ensure no trailing slashes at the end of the Redirect URI in Spotify settings.</li>
                </ul>
             </div>
          </div>
        )}
      </div>

      <div className="bg-white border-2 border-black p-8 shadow-retro opacity-75 hover:opacity-100 transition-opacity">
         <h3 className="text-xl font-bold mb-4 font-mono uppercase">System Info</h3>
         <p className="text-sm text-gray-600 mb-2 font-mono">GEMINI_API_KEY_STATUS</p>
         <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <code className="text-sm font-mono font-bold">DETECTED_IN_ENV</code>
         </div>
      </div>
    </div>
  );
};

export default Settings;