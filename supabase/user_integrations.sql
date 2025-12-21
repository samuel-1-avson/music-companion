-- ============================================
-- User Integrations Table
-- Stores OAuth tokens for connected platforms
-- ============================================

-- Create user_integrations table
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL, -- 'spotify', 'discord', 'lastfm', 'telegram', 'twitch'
  
  -- OAuth tokens (should be encrypted in production)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Provider user info
  provider_user_id TEXT,
  provider_username TEXT,
  provider_avatar_url TEXT,
  
  -- Provider-specific metadata (e.g., scopes, premium status)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one connection per user per provider
  UNIQUE(user_id, provider)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON user_integrations(provider);

-- Enable RLS
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- Users can only access their own integrations
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own integrations" ON user_integrations;
DROP POLICY IF EXISTS "Users can insert own integrations" ON user_integrations;
DROP POLICY IF EXISTS "Users can update own integrations" ON user_integrations;
DROP POLICY IF EXISTS "Users can delete own integrations" ON user_integrations;

-- SELECT: Users can view their own integrations
CREATE POLICY "Users can view own integrations"
  ON user_integrations
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can add their own integrations
CREATE POLICY "Users can insert own integrations"
  ON user_integrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own integrations
CREATE POLICY "Users can update own integrations"
  ON user_integrations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own integrations
CREATE POLICY "Users can delete own integrations"
  ON user_integrations
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Trigger to update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_user_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_integrations_updated_at ON user_integrations;
CREATE TRIGGER trigger_user_integrations_updated_at
  BEFORE UPDATE ON user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_integrations_updated_at();

-- ============================================
-- Grant permissions
-- ============================================
GRANT ALL ON user_integrations TO authenticated;
-- NOTE: Anonymous access removed for security (tokens should not be exposed)
-- GRANT SELECT ON user_integrations TO anon;
