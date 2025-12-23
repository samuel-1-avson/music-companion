import React, { useState } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';

interface ShareButtonProps {
  song?: Song | null;
  playlistName?: string;
  songs?: Song[];
}

const ShareButton: React.FC<ShareButtonProps> = ({
  song,
  playlistName,
  songs,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateShareText = (): string => {
    if (song) {
      return `🎵 Now Playing: ${song.title} by ${song.artist}\n\nListening on Music Companion`;
    }
    if (playlistName && songs) {
      return `🎶 Check out my playlist: ${playlistName}\n\n${songs.slice(0, 5).map(s => `• ${s.title} - ${s.artist}`).join('\n')}${songs.length > 5 ? `\n... and ${songs.length - 5} more!` : ''}\n\nCreated with Music Companion`;
    }
    return 'Check out Music Companion!';
  };

  const generateShareUrl = (): string => {
    const baseUrl = window.location.origin;
    if (song) {
      return `${baseUrl}?song=${encodeURIComponent(song.id)}`;
    }
    return baseUrl;
  };

  const handleCopyLink = async () => {
    const url = generateShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateShareText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleTwitterShare = () => {
    const text = encodeURIComponent(generateShareText());
    const url = encodeURIComponent(generateShareUrl());
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    setShowMenu(false);
  };

  const handleFacebookShare = () => {
    const url = encodeURIComponent(generateShareUrl());
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
    setShowMenu(false);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`${generateShareText()}\n\n${generateShareUrl()}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setShowMenu(false);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: song ? `${song.title} by ${song.artist}` : 'Music Companion',
          text: generateShareText(),
          url: generateShareUrl(),
        });
      } catch (err) {
        console.log('Share cancelled or failed');
      }
    }
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 hover:bg-[var(--bg-hover)] rounded transition-colors"
        title="Share"
      >
        <ICONS.ExternalLink size={16} />
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          />
          
          {/* Menu */}
          <div className="absolute bottom-full right-0 mb-2 bg-[var(--bg-card)] border-2 border-theme shadow-retro min-w-[200px] z-50">
            <div className="p-2 border-b border-theme">
              <p className="text-xs font-mono font-bold uppercase text-[var(--text-muted)]">
                📤 Share
              </p>
            </div>
            
            <div className="p-1">
              {/* Native Share (if supported) */}
              {'share' in navigator && (
                <button
                  onClick={handleNativeShare}
                  className="w-full flex items-center gap-3 p-2 hover:bg-[var(--bg-hover)] text-left transition-colors"
                >
                  <ICONS.ExternalLink size={16} className="text-[var(--primary)]" />
                  <span className="text-sm font-mono">Share...</span>
                </button>
              )}
              
              {/* Separator */}
              <div className="border-t border-theme my-1" />
              
              {/* Social Platforms */}
              <button
                onClick={handleTwitterShare}
                className="w-full flex items-center gap-3 p-2 hover:bg-[var(--bg-hover)] text-left transition-colors"
              >
                <span className="w-4 h-4 flex items-center justify-center text-sm font-bold">𝕏</span>
                <span className="text-sm font-mono">Post on X</span>
              </button>
              
              <button
                onClick={handleFacebookShare}
                className="w-full flex items-center gap-3 p-2 hover:bg-[var(--bg-hover)] text-left transition-colors"
              >
                <span className="w-4 h-4 flex items-center justify-center text-sm text-blue-500">f</span>
                <span className="text-sm font-mono">Facebook</span>
              </button>
              
              <button
                onClick={handleWhatsAppShare}
                className="w-full flex items-center gap-3 p-2 hover:bg-[var(--bg-hover)] text-left transition-colors"
              >
                <span className="w-4 h-4 flex items-center justify-center text-sm text-green-500">📱</span>
                <span className="text-sm font-mono">WhatsApp</span>
              </button>
              
              {/* Separator */}
              <div className="border-t border-theme my-1" />
              
              {/* Copy Options */}
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-3 p-2 hover:bg-[var(--bg-hover)] text-left transition-colors"
              >
                {copied ? <ICONS.Check size={16} className="text-green-500" /> : <ICONS.Link size={16} />}
                <span className="text-sm font-mono">{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
              
              <button
                onClick={handleCopyText}
                className="w-full flex items-center gap-3 p-2 hover:bg-[var(--bg-hover)] text-left transition-colors"
              >
                <ICONS.Copy size={16} />
                <span className="text-sm font-mono">Copy Text</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ShareButton;

