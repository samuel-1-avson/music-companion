import React, { useState } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';

interface SocialShareProps {
  song: Song;
  onClose?: () => void;
}

interface SharePlatform {
  id: string;
  name: string;
  icon: string;
  color: string;
  getUrl: (song: Song, message: string) => string;
}

const PLATFORMS: SharePlatform[] = [
  {
    id: 'twitter',
    name: 'Twitter/X',
    icon: '𝕏',
    color: '#000000',
    getUrl: (song, msg) => 
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${msg}\n🎵 ${song.title} by ${song.artist}`)}`
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '📘',
    color: '#1877F2',
    getUrl: (song, msg) => 
      `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(`${msg} 🎵 ${song.title} by ${song.artist}`)}`
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: '📱',
    color: '#25D366',
    getUrl: (song, msg) => 
      `https://wa.me/?text=${encodeURIComponent(`${msg}\n🎵 ${song.title} by ${song.artist}`)}`
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '✈️',
    color: '#0088CC',
    getUrl: (song, msg) => 
      `https://t.me/share/url?text=${encodeURIComponent(`${msg}\n🎵 ${song.title} by ${song.artist}`)}`
  },
  {
    id: 'copy',
    name: 'Copy Link',
    icon: '📋',
    color: '#6B7280',
    getUrl: (song) => `${song.title} by ${song.artist}`
  },
];

const SHARE_MESSAGES = [
  "Currently vibing to 🎧",
  "Can't stop listening to 🔥",
  "This song is on repeat 🔁",
  "Check out what I'm playing 🎶",
  "My new obsession 💜",
];

const SocialShare: React.FC<SocialShareProps> = ({ song, onClose }) => {
  const [message, setMessage] = useState(SHARE_MESSAGES[0]);
  const [copied, setCopied] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  const handleShare = async (platform: SharePlatform) => {
    const finalMessage = customMessage || message;
    
    if (platform.id === 'copy') {
      const text = `${finalMessage}\n🎵 ${song.title} by ${song.artist}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    const url = platform.getUrl(song, finalMessage);
    window.open(url, '_blank', 'width=600,height=400');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro w-full max-w-md">
        {/* Header */}
        <div className="p-4 border-b-2 border-theme bg-gradient-to-r from-pink-500 to-purple-500 flex justify-between items-center">
          <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2 text-white">
            📤 Share Song
          </h2>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded text-white">
              <ICONS.Close size={16} />
            </button>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Song Preview */}
          <div className="flex items-center gap-4 bg-[var(--bg-hover)] p-4 border border-theme">
            {song.coverUrl ? (
              <img src={song.coverUrl} className="w-16 h-16 object-cover border border-theme" alt="" />
            ) : (
              <div className="w-16 h-16 bg-[var(--primary)] flex items-center justify-center">
                <ICONS.Music size={24} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-mono font-bold truncate">{song.title}</p>
              <p className="text-sm text-[var(--text-muted)] truncate">{song.artist}</p>
            </div>
          </div>

          {/* Quick Messages */}
          <div>
            <label className="block text-xs font-mono text-[var(--text-muted)] uppercase mb-2">Quick Message</label>
            <div className="flex flex-wrap gap-2">
              {SHARE_MESSAGES.map(msg => (
                <button
                  key={msg}
                  onClick={() => { setMessage(msg); setCustomMessage(''); }}
                  className={`px-3 py-1 text-xs font-mono ${
                    message === msg && !customMessage
                      ? 'bg-[var(--primary)] text-black'
                      : 'bg-[var(--bg-hover)] hover:bg-[var(--bg-main)]'
                  }`}
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <label className="block text-xs font-mono text-[var(--text-muted)] uppercase mb-2">Or Custom</label>
            <input
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Write your own..."
              className="w-full px-3 py-2 bg-[var(--bg-main)] border-2 border-theme font-mono text-sm focus:border-[var(--primary)] outline-none"
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-xs font-mono text-[var(--text-muted)] uppercase mb-2">Share To</label>
            <div className="grid grid-cols-5 gap-2">
              {PLATFORMS.map(platform => (
                <button
                  key={platform.id}
                  onClick={() => handleShare(platform)}
                  className="flex flex-col items-center gap-1 p-3 border-2 border-theme hover:border-[var(--primary)] transition-colors"
                  style={{ '--hover-color': platform.color } as React.CSSProperties}
                >
                  <span className="text-2xl">{platform.icon}</span>
                  <span className="text-[9px] font-mono font-bold uppercase text-[var(--text-muted)]">
                    {platform.id === 'copy' && copied ? 'Copied!' : platform.name.split('/')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialShare;
