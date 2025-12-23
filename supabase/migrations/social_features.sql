-- Social Features Database Migrations
-- This file creates the necessary tables for social features

-- User Follows table
CREATE TABLE IF NOT EXISTS user_follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  -- Prevent self-follows
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON user_follows(following_id);

-- Activity Feed table
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  -- Action types: 'played', 'favorited', 'created_playlist', 'followed', 'shared'
  content JSONB DEFAULT '{}',
  -- Content includes: song_id, song_title, artist, playlist_id, target_user_id, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for activity queries
CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity(created_at DESC);

-- Row Level Security for user_follows
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all follows"
  ON user_follows FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own follows"
  ON user_follows FOR ALL
  USING (auth.uid() = follower_id);

-- Row Level Security for user_activity
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public activity"
  ON user_activity FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own activity"
  ON user_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Helper function to get follower count
CREATE OR REPLACE FUNCTION get_follower_count(user_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM user_follows WHERE following_id = user_uuid;
$$ LANGUAGE SQL STABLE;

-- Helper function to get following count
CREATE OR REPLACE FUNCTION get_following_count(user_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM user_follows WHERE follower_id = user_uuid;
$$ LANGUAGE SQL STABLE;

-- Helper function to check if user A follows user B
CREATE OR REPLACE FUNCTION is_following(follower UUID, following UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM user_follows 
    WHERE follower_id = follower AND following_id = following
  );
$$ LANGUAGE SQL STABLE;
