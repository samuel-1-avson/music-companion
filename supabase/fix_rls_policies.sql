-- ============================================
-- Fix for Infinite Recursion in RLS Policies
-- Run this in Supabase SQL Editor to fix the issue
-- ============================================

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Users can view collaborators" ON playlist_collaborators;
DROP POLICY IF EXISTS "Owners can manage collaborators" ON playlist_collaborators;
DROP POLICY IF EXISTS "Users can view own playlists" ON collaborative_playlists;
DROP POLICY IF EXISTS "Collaborators can view playlist songs" ON playlist_songs;
DROP POLICY IF EXISTS "Collaborators can add songs" ON playlist_songs;

-- ============================================
-- Fixed RLS Policies (no circular references)
-- ============================================

-- 1. collaborative_playlists: SELECT policy without subquery to playlist_collaborators
CREATE POLICY "Users can view own playlists" 
  ON collaborative_playlists FOR SELECT
  USING (
    owner_id = auth.uid() 
    OR is_public = true
  );

-- 2. playlist_collaborators: Simple policies without circular refs
CREATE POLICY "Users can view their collaborations"
  ON playlist_collaborators FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owners can view all collaborators"
  ON playlist_collaborators FOR SELECT
  USING (
    playlist_id IN (SELECT id FROM collaborative_playlists WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can insert own collaboration"
  ON playlist_collaborators FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can manage collaborators"
  ON playlist_collaborators FOR DELETE
  USING (
    playlist_id IN (SELECT id FROM collaborative_playlists WHERE owner_id = auth.uid())
  );

-- 3. playlist_songs: Simplified policies
CREATE POLICY "Collaborators can view playlist songs"
  ON playlist_songs FOR SELECT
  USING (
    playlist_id IN (SELECT id FROM collaborative_playlists WHERE owner_id = auth.uid())
    OR playlist_id IN (SELECT id FROM collaborative_playlists WHERE is_public = true)
    OR playlist_id IN (SELECT playlist_id FROM playlist_collaborators WHERE user_id = auth.uid())
  );

CREATE POLICY "Collaborators can add songs"
  ON playlist_songs FOR INSERT
  TO authenticated
  WITH CHECK (
    playlist_id IN (SELECT id FROM collaborative_playlists WHERE owner_id = auth.uid())
    OR playlist_id IN (SELECT playlist_id FROM playlist_collaborators WHERE user_id = auth.uid() AND role IN ('owner', 'editor'))
  );

-- ============================================
-- Done! The circular reference has been fixed.
-- ============================================
