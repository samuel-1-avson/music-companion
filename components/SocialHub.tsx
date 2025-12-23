/**
 * SocialHub - Main component for social features
 * 
 * Features:
 * - Activity feed
 * - User search
 * - Follow suggestions
 * - Following list
 */
import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { useSocial, UserProfile, Activity } from '../hooks/useSocial';
import { useAuth } from '../contexts/AuthContext';

interface SocialHubProps {
  onClose?: () => void;
}

const SocialHub: React.FC<SocialHubProps> = ({ onClose }) => {
  const { isAuthenticated } = useAuth();
  const {
    followers,
    following,
    isFollowing,
    follow,
    unfollow,
    activities,
    loadActivities,
    suggestedUsers,
    searchUsers,
    loading,
  } = useSocial();

  const [selectedTab, setSelectedTab] = useState<'feed' | 'following' | 'search'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadActivities('following');
    }
  }, [isAuthenticated]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await searchUsers(searchQuery);
    setSearchResults(results);
    setSearching(false);
  };

  const formatActivity = (activity: Activity): string => {
    switch (activity.action) {
      case 'played':
        return `played "${activity.content.song_title}" by ${activity.content.artist}`;
      case 'favorited':
        return `favorited "${activity.content.song_title}"`;
      case 'created_playlist':
        return `created playlist "${activity.content.playlist_name}"`;
      case 'followed':
        return `started following ${activity.content.target_user_name}`;
      case 'shared':
        return `shared "${activity.content.song_title}"`;
      default:
        return '';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro p-8 text-center">
        <p className="text-4xl mb-4">👥</p>
        <p className="font-mono font-bold">Sign in to access social features</p>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Follow friends, see what they're listening to, and share your music!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b-2 border-theme bg-[var(--bg-hover)] flex justify-between items-center">
        <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2">
          👥 Social
        </h2>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span>{followers.length} followers</span>
          <span>•</span>
          <span>{following.length} following</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-main)] rounded">
            <ICONS.Close size={16} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-theme">
        {(['feed', 'following', 'search'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`flex-1 p-3 font-mono text-sm font-bold uppercase ${
              selectedTab === tab
                ? 'bg-[var(--primary)] text-black'
                : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Activity Feed */}
        {selectedTab === 'feed' && (
          <div className="space-y-3">
            {/* Suggestions */}
            {suggestedUsers.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-mono text-[var(--text-muted)] uppercase mb-2">
                  Suggested for you
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {suggestedUsers
                    .filter(u => !isFollowing(u.id))
                    .slice(0, 5)
                    .map(user => (
                      <div 
                        key={user.id}
                        className="flex-shrink-0 w-24 text-center border-2 border-theme p-2"
                      >
                        <div className="w-12 h-12 mx-auto bg-gray-200 rounded-full overflow-hidden mb-2">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-300">
                              <ICONS.User size={20} />
                            </div>
                          )}
                        </div>
                        <p className="text-xs font-mono truncate">{user.display_name}</p>
                        <button
                          onClick={() => follow(user.id)}
                          className="mt-1 px-2 py-0.5 text-[10px] bg-[var(--primary)] text-black font-bold"
                        >
                          Follow
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Activity Items */}
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <ICONS.Loader size={24} className="animate-spin" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <p className="text-4xl mb-2">🎵</p>
                <p className="font-mono text-sm">No activity yet</p>
                <p className="text-xs mt-1">Follow some people to see their activity!</p>
              </div>
            ) : (
              activities.map(activity => (
                <div key={activity.id} className="flex gap-3 p-3 bg-[var(--bg-main)] border border-theme">
                  <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                    {activity.user?.avatar_url ? (
                      <img src={activity.user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-300">
                        <ICONS.User size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <strong>{activity.user?.display_name || 'User'}</strong>{' '}
                      <span className="text-[var(--text-muted)]">{formatActivity(activity)}</span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {formatTime(activity.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Following List */}
        {selectedTab === 'following' && (
          <div className="space-y-2">
            {following.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <p className="font-mono text-sm">You're not following anyone yet</p>
                <p className="text-xs mt-1">Search for users to follow!</p>
              </div>
            ) : (
              following.map(user => (
                <div key={user.id} className="flex items-center gap-3 p-3 bg-[var(--bg-main)] border border-theme">
                  <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-300">
                        <ICONS.User size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-mono font-bold text-sm">{user.display_name}</p>
                  </div>
                  <button
                    onClick={() => unfollow(user.id)}
                    className="px-3 py-1 text-xs font-mono border-2 border-theme"
                  >
                    Unfollow
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* User Search */}
        {selectedTab === 'search' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search users..."
                className="flex-1 p-2 border-2 border-theme bg-[var(--bg-main)] font-mono text-sm"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 bg-[var(--primary)] text-black border-2 border-theme font-mono"
              >
                {searching ? <ICONS.Loader size={16} className="animate-spin" /> : <ICONS.Search size={16} />}
              </button>
            </div>

            <div className="space-y-2">
              {searchResults.map(user => (
                <div key={user.id} className="flex items-center gap-3 p-3 bg-[var(--bg-main)] border border-theme">
                  <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-300">
                        <ICONS.User size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-mono font-bold text-sm">{user.display_name}</p>
                  </div>
                  {isFollowing(user.id) ? (
                    <button
                      onClick={() => unfollow(user.id)}
                      className="px-3 py-1 text-xs font-mono border-2 border-theme"
                    >
                      Unfollow
                    </button>
                  ) : (
                    <button
                      onClick={() => follow(user.id)}
                      className="px-3 py-1 text-xs font-mono bg-[var(--primary)] text-black border-2 border-theme"
                    >
                      Follow
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialHub;
