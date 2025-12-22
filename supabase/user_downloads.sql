-- ============================================
-- User Downloads Table - Supabase Migration
-- Run in Supabase SQL Editor
-- ============================================

-- Create user_downloads table for per-user cloud downloads
CREATE TABLE IF NOT EXISTS user_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT,
  duration TEXT,
  cover_url TEXT,
  storage_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, video_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_downloads_user_id ON user_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_downloads_video_id ON user_downloads(video_id);
CREATE INDEX IF NOT EXISTS idx_user_downloads_status ON user_downloads(status);

-- Enable RLS
ALTER TABLE user_downloads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own downloads" ON user_downloads;
CREATE POLICY "Users can view own downloads" 
  ON user_downloads FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own downloads" ON user_downloads;
CREATE POLICY "Users can create own downloads" 
  ON user_downloads FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own downloads" ON user_downloads;
CREATE POLICY "Users can update own downloads" 
  ON user_downloads FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own downloads" ON user_downloads;
CREATE POLICY "Users can delete own downloads" 
  ON user_downloads FOR DELETE 
  USING (auth.uid() = user_id);

-- Storage bucket policies for downloads folder
-- (Run only if you need a separate bucket, otherwise use existing user-uploads)
DROP POLICY IF EXISTS "Users can upload downloads" ON storage.objects;
CREATE POLICY "Users can upload downloads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'downloads' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

DROP POLICY IF EXISTS "Users can read own downloads" ON storage.objects;
CREATE POLICY "Users can read own downloads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'downloads' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

DROP POLICY IF EXISTS "Users can delete own downloads" ON storage.objects;
CREATE POLICY "Users can delete own downloads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'downloads' AND
  auth.uid()::text = (storage.foldername(name))[2]
);
