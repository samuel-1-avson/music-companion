-- ============================================
-- Music Companion - Database Migrations
-- Run this in Supabase SQL Editor AFTER setup.sql
-- ============================================

-- 1. Add preferences column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- 2. Add user_id to downloads table for user association
ALTER TABLE downloads 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Create index for downloads by user
CREATE INDEX IF NOT EXISTS idx_downloads_user ON downloads(user_id);

-- 4. Create collaborative_playlists table
CREATE TABLE IF NOT EXISTS collaborative_playlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create playlist_songs junction table
CREATE TABLE IF NOT EXISTS playlist_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID REFERENCES collaborative_playlists(id) ON DELETE CASCADE NOT NULL,
  song_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT,
  cover_url TEXT,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  position INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create playlist_collaborators table
CREATE TABLE IF NOT EXISTS playlist_collaborators (
  playlist_id UUID REFERENCES collaborative_playlists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'editor', -- 'owner', 'editor', 'viewer'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (playlist_id, user_id)
);

-- 7. Create indexes
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_collaborators_user ON playlist_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_collab_playlists_owner ON collaborative_playlists(owner_id);
CREATE INDEX IF NOT EXISTS idx_collab_playlists_invite ON collaborative_playlists(invite_code);

-- 8. Enable RLS on new tables
ALTER TABLE collaborative_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_collaborators ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for collaborative_playlists
CREATE POLICY "Users can view own playlists" 
  ON collaborative_playlists FOR SELECT
  USING (owner_id = auth.uid() OR is_public = true OR id IN (
    SELECT playlist_id FROM playlist_collaborators WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create playlists"
  ON collaborative_playlists FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update playlists"
  ON collaborative_playlists FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete playlists"
  ON collaborative_playlists FOR DELETE
  USING (owner_id = auth.uid());

-- 10. RLS Policies for playlist_songs
CREATE POLICY "Collaborators can view playlist songs"
  ON playlist_songs FOR SELECT
  USING (playlist_id IN (
    SELECT id FROM collaborative_playlists 
    WHERE owner_id = auth.uid() OR is_public = true OR id IN (
      SELECT playlist_id FROM playlist_collaborators WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Collaborators can add songs"
  ON playlist_songs FOR INSERT
  TO authenticated
  WITH CHECK (playlist_id IN (
    SELECT id FROM collaborative_playlists WHERE owner_id = auth.uid()
    UNION
    SELECT playlist_id FROM playlist_collaborators WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
  ));

CREATE POLICY "Collaborators can delete songs"
  ON playlist_songs FOR DELETE
  USING (added_by = auth.uid() OR playlist_id IN (
    SELECT id FROM collaborative_playlists WHERE owner_id = auth.uid()
  ));

-- 11. RLS Policies for playlist_collaborators  
CREATE POLICY "Users can view collaborators"
  ON playlist_collaborators FOR SELECT
  USING (playlist_id IN (
    SELECT id FROM collaborative_playlists 
    WHERE owner_id = auth.uid() OR is_public = true OR id IN (
      SELECT playlist_id FROM playlist_collaborators WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Owners can manage collaborators"
  ON playlist_collaborators FOR ALL
  USING (playlist_id IN (
    SELECT id FROM collaborative_playlists WHERE owner_id = auth.uid()
  ));

-- ============================================
-- Migration complete!
-- ============================================
