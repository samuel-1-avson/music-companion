/**
 * IntegrationsPanel - Simplified platform connections
 * 
 * One-click OAuth buttons for connecting music and social platforms.
 * No more manual API key configuration!
 */

import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { useIntegrations } from '../hooks/useIntegrations';
import { useSpotifyData } from '../hooks/useSpotifyData';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import EmailVerificationModal from './EmailVerificationModal';

interface IntegrationCardProps {
  provider: string;
  name: string;
  description: string;
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isConnected: boolean;
  username?: string;
  avatarUrl?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  comingSoon?: boolean;
  isSystemMode?: boolean;
}

const IntegrationCard: React.FC<IntegrationCardProps> = ({
  provider,
  name,
  description,
  color,
  icon: Icon,
  isConnected,
  isSystemMode,
  username,
  avatarUrl,
  onConnect,
  onDisconnect,
  comingSoon,
}) => {
  return (
    <div 
      className={`border-2 p-4 transition-all relative overflow-hidden ${
        isConnected && !isSystemMode 
          ? 'border-green-500 bg-green-50' 
          : comingSoon 
            ? 'border-gray-200 bg-gray-50 opacity-60' 
            : 'border-gray-300 bg-white hover:border-gray-400'
      }`}
    >
      {/* Status badge */}
      {isConnected && !isSystemMode && (
        <div className="absolute top-2 right-2">
          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold uppercase rounded-full">
            <span className="w-1.5 h-1.5 bg-white rounded-full" />
            Connected
          </span>
        </div>
      )}
      {isSystemMode && (
        <div className="absolute top-2 right-2">
           <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500 text-white text-[10px] font-bold uppercase rounded-full">
            <span className="w-1.5 h-1.5 bg-white rounded-full" />
            System Mode
          </span>
        </div>
      )}
      {comingSoon && (
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 bg-gray-300 text-gray-600 text-[10px] font-bold uppercase">
            Coming Soon
          </span>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div 
          className="p-3 border-2 border-black"
          style={{ backgroundColor: isConnected && !isSystemMode ? color : '#f3f4f6' }}
        >
          <Icon size={24} className={isConnected && !isSystemMode ? 'text-white' : 'text-gray-600'} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold font-mono text-sm">{name}</h4>
          {isConnected && username ? (
            <div className="flex items-center gap-2 mt-1">
              {avatarUrl && (
                <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full" />
              )}
              <span className="text-xs text-gray-600 truncate">@{username}</span>
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
      </div>

      {/* Action button */}
      <div className="mt-4">
        {isConnected && !isSystemMode ? (
          <button
            onClick={onDisconnect}
            className="w-full py-2 text-xs font-bold font-mono border-2 border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          >
            Disconnect Personal
          </button>
        ) : comingSoon ? (
          <button
            disabled
            className="w-full py-2 text-xs font-bold font-mono border-2 border-gray-200 text-gray-400 cursor-not-allowed"
          >
            Not Available
          </button>
        ) : (
          <button
            onClick={onConnect}
            className="w-full py-2 text-xs font-bold font-mono border-2 border-black text-black hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            style={{ borderColor: color }}
          >
            <ICONS.ExternalLink size={12} />
            {isSystemMode ? 'Connect Personal Account' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  );
};

interface IntegrationsPanelProps {
  onSpotifyConnect?: () => void;
  spotifyConnected?: boolean;
  spotifyProfile?: { display_name?: string; images?: { url: string }[] } | null;
  onSpotifyDisconnect?: () => void;
}

const IntegrationsPanel: React.FC<IntegrationsPanelProps> = ({
  onSpotifyConnect,
  spotifyConnected,
  spotifyProfile,
  onSpotifyDisconnect,
}) => {
  const { user, isAuthenticated, hasSpotifyAccess } = useAuth();
  const { integrations, isConnected, connectOAuth, disconnect, connectTelegram, verifyIntegration } = useIntegrations();
  const { success, error: showError, info } = useToast();
  
  // Telegram connection state (new simplified flow)
  const [telegramConnecting, setTelegramConnecting] = useState(false);
  const [telegramDeepLink, setTelegramDeepLink] = useState('');
  const [telegramCode, setTelegramCode] = useState('');
  
  // Verification modal state
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationProvider, setVerificationProvider] = useState('');
  const [verificationProviderEmail, setVerificationProviderEmail] = useState('');
  
  // Spotify data from OAuth
  const { 
    recentlyPlayed, 
    topTracks, 
    playlists, 
    currentlyPlaying,
    isLoading: spotifyLoading 
  } = useSpotifyData();
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);

  // Check URL params for verification requirement
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const verificationRequired = urlParams.get('verification_required');
    const provider = urlParams.get('provider');
    const providerEmail = urlParams.get('provider_email');
    
    if (verificationRequired === 'true' && provider && providerEmail) {
      setVerificationProvider(provider);
      setVerificationProviderEmail(decodeURIComponent(providerEmail));
      setShowVerificationModal(true);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    // Check for success messages
    const spotifyConnectedParam = urlParams.get('spotify_connected');
    if (spotifyConnectedParam === 'true') {
      success('Spotify connected successfully!');
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    const discordConnectedParam = urlParams.get('discord_connected');
    if (discordConnectedParam === 'true') {
      success('Discord connected successfully!');
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    const youtubeConnectedParam = urlParams.get('youtube_connected');
    if (youtubeConnectedParam === 'true') {
      success('YouTube connected successfully!');
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    const lastfmConnectedParam = urlParams.get('lastfm_connected');
    if (lastfmConnectedParam === 'true') {
      success('Last.fm connected successfully!');
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    // Check for error params
    const errorParam = urlParams.get('error');
    if (errorParam) {
      showError(`Connection failed: ${errorParam}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [success, showError]);

  const handleVerify = async (code: string): Promise<boolean> => {
    const result = await verifyIntegration(verificationProvider, code);
    if (result) {
      setShowVerificationModal(false);
      success(`${verificationProvider.charAt(0).toUpperCase() + verificationProvider.slice(1)} verified and connected!`);
    }
    return result;
  };

    const handleConnect = async (provider: 'spotify' | 'discord' | 'twitch' | 'youtube' | 'lastfm') => {
    if (!isAuthenticated) {
      showError('Please sign in to connect integrations');
      return;
    }

    try {
      info(`Connecting to ${provider}...`);
      await connectOAuth(provider);
    } catch (err: any) {
      showError(`Failed to connect to ${provider}: ${err.message}`);
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (provider === 'spotify' && onSpotifyDisconnect) {
      onSpotifyDisconnect();
    } else {
      const disconnected = await disconnect(provider);
      if (disconnected) {
        success(`Disconnected from ${provider}`);
      }
    }
  };

  const handleTelegramConnect = async () => {
    if (!isAuthenticated || !user) {
      showError('Please sign in to connect Telegram');
      return;
    }

    setTelegramConnecting(true);
    setShowTelegramSetup(true);

    try {
      // Generate verification code from backend
      const response = await fetch('http://localhost:3001/auth/telegram/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate code');
      }

      setTelegramCode(data.data.code);
      setTelegramDeepLink(data.data.deepLink);

      // Open Telegram deep link
      window.open(data.data.deepLink, '_blank');

      // Start polling for completion
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max (every 5 seconds)
      
      const pollInterval = setInterval(async () => {
        attempts++;
        
        // Trigger backend to poll Telegram updates
        try {
          await fetch('http://localhost:3001/auth/telegram/poll-updates', {
            method: 'POST'
          });
        } catch (e) {
          // Ignore poll errors
        }

        // Check if integration was saved
        // Reload integrations to check status
        const statusResponse = await fetch(`http://localhost:3001/auth/telegram/verify/${data.data.code}`);
        const statusData = await statusResponse.json();

        if (statusData.data?.status === 'completed' || isConnected('telegram')) {
          clearInterval(pollInterval);
          setTelegramConnecting(false);
          setShowTelegramSetup(false);
          success('Telegram connected successfully!');
          // Refresh integrations list
          window.location.reload();
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setTelegramConnecting(false);
          showError('Connection timed out. Please try again.');
        }
      }, 5000);

    } catch (err: any) {
      console.error('[Telegram] Connection error:', err);
      showError(err.message || 'Failed to connect Telegram');
      setTelegramConnecting(false);
      setShowTelegramSetup(false);
    }
  };

  const getDiscordIntegration = integrations.find(i => i.provider === 'discord');
  const getSpotifyIntegration = integrations.find(i => i.provider === 'spotify');
  const getTelegramIntegration = integrations.find(i => i.provider === 'telegram');
  const getTwitchIntegration = integrations.find(i => i.provider === 'twitch');
  const getYoutubeIntegration = integrations.find(i => i.provider === 'youtube');
  const getLastfmIntegration = integrations.find(i => i.provider === 'lastfm');

  // Check if Spotify is connected via OAuth identities only (not stale props)
  // This ensures the status is always based on the current user's Supabase auth data
  const spotifyIsConnected = isConnected('spotify') || hasSpotifyAccess;
  const spotifyUsername = getSpotifyIntegration?.provider_username || spotifyProfile?.display_name;
  const spotifyAvatar = getSpotifyIntegration?.provider_avatar_url || spotifyProfile?.images?.[0]?.url;

  // Music Platforms
  const musicPlatforms = [
    {
      provider: 'spotify',
      name: 'Spotify',
      description: spotifyIsConnected ? 'Stream & control playback' : 'System Search Active (Connect for Playback)',
      color: '#1DB954',
      icon: ICONS.Music,
      isConnected: true, // Always show as connected (System or User)
      isSystemMode: !spotifyIsConnected, // New flag to distinguish
      username: spotifyUsername || 'System Integration',
      avatarUrl: spotifyAvatar,
    },
    {
      provider: 'youtube',
      name: 'YouTube',
      description: 'Access your playlists',
      color: '#FF0000',
      icon: ICONS.Play,
      isConnected: isConnected('youtube'),
      username: getYoutubeIntegration?.provider_username,
      avatarUrl: getYoutubeIntegration?.provider_avatar_url,
    },
  ];

  // Discovery & Scrobbling
  const discoveryPlatforms = [
    {
      provider: 'lastfm',
      name: 'Last.fm',
      description: 'Scrobble & track history',
      color: '#d51007',
      icon: ICONS.Radio,
      isConnected: isConnected('lastfm'),
      username: getLastfmIntegration?.provider_username,
    },
    {
      provider: 'apple',
      name: 'Apple Music',
      description: 'Search & preview tracks',
      color: '#FA243C',
      icon: ICONS.Music,
      isConnected: true, // Always available for search
      username: 'Integrated',
      comingSoon: false,
      isStatic: true, // Cannot be disconnected
    }
  ];

  // Social Platforms
  const socialPlatforms = [
    {
      provider: 'discord',
      name: 'Discord',
      description: 'Share listening activity',
      color: '#5865F2',
      icon: ICONS.Game,
      isConnected: isConnected('discord'),
      username: getDiscordIntegration?.provider_username,
      avatarUrl: getDiscordIntegration?.provider_avatar_url,
    },
    {
      provider: 'telegram',
      name: 'Telegram',
      description: 'Get song notifications',
      color: '#0088cc',
      icon: ICONS.MessageSquare,
      isConnected: isConnected('telegram'),
      username: getTelegramIntegration?.provider_username,
    },
    {
      provider: 'twitch',
      name: 'Twitch',
      description: 'Sync with streams',
      color: '#9146FF',
      icon: ICONS.Live,
      isConnected: isConnected('twitch'),
      username: getTwitchIntegration?.provider_username,
      comingSoon: true, // Enable when Twitch credentials are provided
    },
  ];

  // Developer Integration
  const devTools = [
    {
      provider: 'vscode',
      name: 'VS Code',
      description: 'Sync coding context',
      color: '#007ACC',
      icon: ICONS.Code,
      isConnected: false, // Updated via status
      username: 'Extension',
      comingSoon: false,
      isStatic: true,
      customAction: () => window.open('vscode:extension/music-companion', '_blank')
    }
  ];

  return (
    <div className="space-y-8">
      {/* Music Platforms */}
      <div>
        <h3 className="text-sm font-bold font-mono uppercase mb-4 flex items-center gap-2">
          <ICONS.Music size={16} /> Music Services
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {musicPlatforms.map(platform => (
            <IntegrationCard
              key={platform.provider}
              {...platform}
              onConnect={() => handleConnect(platform.provider as any)}
              onDisconnect={() => handleDisconnect(platform.provider)}
            />
          ))}
        </div>
      </div>

      {/* Spotify Data (shown when connected) */}
      {hasSpotifyAccess && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 p-4 rounded-lg">
          <h3 className="text-sm font-bold font-mono uppercase mb-4 flex items-center gap-2 text-green-800">
            <ICONS.Music size={16} /> Your Spotify
          </h3>
          
          {spotifyLoading ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full" />
              <p className="text-xs text-green-600 mt-2">Loading your Spotify data...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Currently Playing */}
              {currentlyPlaying?.item && (
                <div className="bg-white border border-green-200 p-3 rounded">
                  <p className="text-[10px] text-green-600 uppercase font-bold mb-2">
                    {currentlyPlaying.is_playing ? '▶ Now Playing' : '⏸ Paused'}
                  </p>
                  <div className="flex items-center gap-3">
                    {currentlyPlaying.item.album.images[0] && (
                      <img 
                        src={currentlyPlaying.item.album.images[0].url} 
                        alt="" 
                        className="w-10 h-10 rounded border"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{currentlyPlaying.item.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {currentlyPlaying.item.artists.map(a => a.name).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Playlists Preview */}
              {playlists.length > 0 && (
                <div>
                  <p className="text-[10px] text-green-700 uppercase font-bold mb-2">
                    Your Playlists
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-green-200">
                    {playlists.slice(0, 6).map((playlist) => (
                      <a 
                        key={playlist.id} 
                        href={playlist.external_urls.spotify}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 w-20 text-center hover:bg-green-100 p-1 rounded transition-colors"
                      >
                        {playlist.images[0] ? (
                          <img 
                            src={playlist.images[0].url} 
                            alt="" 
                            className="w-full aspect-square object-cover rounded mb-1 shadow-sm"
                          />
                        ) : (
                          <div className="w-full aspect-square bg-gray-200 rounded mb-1 flex items-center justify-center">
                            <ICONS.Music size={20} className="text-gray-400" />
                          </div>
                        )}
                        <p className="text-[9px] font-medium truncate">{playlist.name}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Discovery & Scrobbling */}
      <div>
        <h3 className="text-sm font-bold font-mono uppercase mb-4 flex items-center gap-2">
          <ICONS.Radio size={16} /> Discovery & History
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {discoveryPlatforms.map(platform => (
            <IntegrationCard
              key={platform.provider}
              {...platform}
              onConnect={!(platform as any).isStatic ? () => handleConnect(platform.provider as any) : () => {}}
              onDisconnect={!(platform as any).isStatic ? () => handleDisconnect(platform.provider) : () => {}}
              // @ts-ignore - Apple Music special property
              comingSoon={platform.comingSoon}
              // @ts-ignore
              isStatic={platform.isStatic}
            />
          ))}
        </div>
      </div>

      {/* Social Platforms */}
      <div>
        <h3 className="text-sm font-bold font-mono uppercase mb-4 flex items-center gap-2">
          <ICONS.MessageSquare size={16} /> Social & Notifications
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {socialPlatforms.map(platform => (
            platform.provider === 'telegram' ? (
              <div key="telegram" className="border-2 border-gray-300 bg-white p-4">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 border-2 border-black" style={{ backgroundColor: isConnected('telegram') ? '#0088cc' : '#f3f4f6' }}>
                    <ICONS.MessageSquare size={24} className={isConnected('telegram') ? 'text-white' : 'text-gray-600'} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold font-mono text-sm">Telegram</h4>
                    <p className="text-xs text-gray-500 mt-1">Get song notifications</p>
                  </div>
                  {isConnected('telegram') && (
                    <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold uppercase rounded-full">
                      Connected
                    </span>
                  )}
                </div>

                {isConnected('telegram') ? (
                  <button
                    onClick={() => handleDisconnect('telegram')}
                    className="w-full py-2 text-xs font-bold font-mono border-2 border-red-300 text-red-600 hover:bg-red-50"
                  >
                    Disconnect
                  </button>
                ) : telegramConnecting ? (
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-blue-800">Waiting for connection...</span>
                      </div>
                      <p className="text-[10px] text-blue-700 font-mono">
                        Open Telegram and press <strong>Start</strong> to connect.
                      </p>
                      {telegramDeepLink && (
                        <a 
                          href={telegramDeepLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 block w-full py-2 text-xs font-bold font-mono bg-[#0088cc] text-white text-center hover:opacity-90 rounded"
                        >
                          Open in Telegram
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setTelegramConnecting(false);
                        setShowTelegramSetup(false);
                      }}
                      className="w-full px-3 py-2 text-xs font-mono border border-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleTelegramConnect}
                    className="w-full py-2 text-xs font-bold font-mono border-2 border-black text-black hover:bg-gray-100 flex items-center justify-center gap-2"
                  >
                    <ICONS.ExternalLink size={12} />
                    Connect Telegram
                  </button>
                )}
              </div>
            ) : (
              <IntegrationCard
                key={platform.provider}
                {...platform}
                onConnect={() => handleConnect(platform.provider as any)}
                onDisconnect={() => handleDisconnect(platform.provider)}
                comingSoon={platform.comingSoon}
              />
            )
          ))}
        </div>
      </div>

       {/* Developer Tools */}
       <div>
        <h3 className="text-sm font-bold font-mono uppercase mb-4 flex items-center gap-2">
          <ICONS.Code size={16} /> Developer Tools
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devTools.map(platform => (
            <IntegrationCard
              key={platform.provider}
              {...platform}
              onConnect={(platform as any).customAction || (() => {})}
              onDisconnect={() => {}}
              // @ts-ignore
              isStatic={true}
            />
          ))}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg">
        <p className="text-xs text-blue-800 font-mono">
          <strong>🔒 Privacy First:</strong> Your connections are stored securely. 
          We only access the data we need to provide music recommendations and playback control.
        </p>
      </div>

      {/* Email Verification Modal */}
      <EmailVerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        onVerify={handleVerify}
        provider={verificationProvider}
        providerEmail={verificationProviderEmail}
        userEmail={user?.email || ''}
      />
    </div>
  );
};

export default IntegrationsPanel;
