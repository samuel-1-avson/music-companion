/**
 * LiveChatPanel - Toggle-able chat panel for Live Mode
 * 
 * Features:
 * - Collapsible/expandable panel
 * - Text input with enter to send
 * - Image upload support
 * - Message history (silent - no voice response)
 */
import React, { useState, useRef, useEffect } from 'react';
import { ICONS } from '../constants';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: Date;
}

interface LiveChatPanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  onSendMessage: (text: string, image?: string) => void;
  messages: ChatMessage[];
  isProcessing?: boolean;
  primaryColor?: string;
}

const LiveChatPanel: React.FC<LiveChatPanelProps> = ({
  isExpanded,
  onToggle,
  onSendMessage,
  messages,
  isProcessing = false,
  primaryColor = 'rose',
}) => {
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() && !attachedImage) return;
    onSendMessage(inputText.trim(), attachedImage || undefined);
    setInputText('');
    setAttachedImage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className={`
        fixed bottom-24 right-6 z-30
        transition-all duration-300 ease-out
        ${isExpanded ? 'w-80' : 'w-12'}
      `}
    >
      {/* Collapsed Button */}
      <button
        onClick={onToggle}
        className={`
          absolute -top-2 -right-2 z-40
          w-10 h-10 rounded-full
          flex items-center justify-center
          bg-${primaryColor}-500 text-black
          shadow-lg hover:scale-110
          transition-transform duration-200
        `}
        title={isExpanded ? 'Collapse chat' : 'Open chat'}
      >
        {isExpanded ? <ICONS.ChevronRight size={18} /> : <ICONS.MessageSquare size={18} />}
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className={`
          bg-black/90 backdrop-blur-xl
          border border-${primaryColor}-500/30
          rounded-2xl
          shadow-2xl
          overflow-hidden
          animate-in slide-in-from-right-4 duration-300
        `}>
          {/* Header */}
          <div className={`
            px-4 py-3
            border-b border-${primaryColor}-500/20
            bg-${primaryColor}-900/20
            flex items-center justify-between
          `}>
            <div className="flex items-center gap-2">
              <ICONS.MessageSquare size={14} className={`text-${primaryColor}-400`} />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/80">
                Text Chat
              </span>
            </div>
            <span className="text-[10px] text-white/40 font-mono">
              {messages.length} msgs
            </span>
          </div>

          {/* Messages Area */}
          <div className="h-64 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-white/30 text-xs font-mono py-8">
                <ICONS.MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                <p>Type a message or command</p>
                <p className="mt-1 text-[10px]">e.g., "Play some jazz"</p>
              </div>
            )}
            
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`
                  flex flex-col
                  ${msg.role === 'user' ? 'items-end' : 'items-start'}
                `}
              >
                {msg.image && (
                  <img 
                    src={msg.image} 
                    alt="Attached" 
                    className="w-24 h-24 object-cover rounded-lg mb-1 border border-white/10"
                  />
                )}
                <div className={`
                  max-w-[85%] px-3 py-2 rounded-xl text-sm
                  ${msg.role === 'user' 
                    ? `bg-${primaryColor}-500/20 text-${primaryColor}-100 border border-${primaryColor}-500/30` 
                    : 'bg-white/10 text-white/90 border border-white/10'
                  }
                `}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-white/30 mt-1 px-1">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            ))}
            
            {isProcessing && (
              <div className="flex items-start">
                <div className="bg-white/10 text-white/90 px-3 py-2 rounded-xl text-sm border border-white/10">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Image Preview */}
          {attachedImage && (
            <div className={`px-3 pb-2 border-t border-${primaryColor}-500/20`}>
              <div className="relative inline-block">
                <img 
                  src={attachedImage} 
                  alt="Attached" 
                  className="w-16 h-16 object-cover rounded-lg border border-white/20"
                />
                <button
                  onClick={() => setAttachedImage(null)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"
                >
                  <ICONS.Close size={10} />
                </button>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className={`p-3 border-t border-${primaryColor}-500/20 bg-black/50`}>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Attach image"
              >
                <ICONS.Image size={16} />
              </button>
              
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command..."
                disabled={isProcessing}
                className={`
                  flex-1 bg-white/5 border border-white/10
                  rounded-lg px-3 py-2 text-sm text-white
                  placeholder-white/30
                  focus:outline-none focus:border-${primaryColor}-500/50
                  disabled:opacity-50
                `}
              />
              
              <button
                onClick={handleSend}
                disabled={(!inputText.trim() && !attachedImage) || isProcessing}
                className={`
                  p-2 rounded-lg transition-all
                  ${inputText.trim() || attachedImage
                    ? `bg-${primaryColor}-500 text-black hover:bg-${primaryColor}-400`
                    : 'bg-white/10 text-white/30'
                  }
                  disabled:opacity-50
                `}
              >
                <ICONS.Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveChatPanel;
