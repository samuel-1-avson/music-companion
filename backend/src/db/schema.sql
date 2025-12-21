-- Create user_integrations table
-- This table stores OAuth tokens for Spotify, Discord, etc.

CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  provider_user_id TEXT,
  provider_username TEXT,
  provider_avatar_url TEXT,
  provider_email TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_code TEXT,
  verification_expires_at TIMESTAMPTZ,
  tokens_encrypted BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate integrations for the same user+provider
  UNIQUE(user_id, provider)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_provider 
ON user_integrations(user_id, provider);

-- Create downloads table
-- This table tracks cached songs/videos

CREATE TABLE IF NOT EXISTS downloads (
  id TEXT PRIMARY KEY,
  video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  artist TEXT,
  duration TEXT,
  cover_url TEXT,
  file_path TEXT,
  file_size INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, downloading, processing, complete, error
  progress INTEGER DEFAULT 0,
  error TEXT,
  download_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for downloads
CREATE INDEX IF NOT EXISTS idx_downloads_video_id ON downloads(video_id);
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);

-- Enable Row Level Security (RLS)
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;

-- Create policies (Open for now as backend uses Service Role, but good practice)
-- You can restrict these further based on your auth needs via Supabase Dashboard
CREATE POLICY "Enable read access for all users" ON user_integrations FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON user_integrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON user_integrations FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON downloads FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON downloads FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON downloads FOR UPDATE USING (true);
