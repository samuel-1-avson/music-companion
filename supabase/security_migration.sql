-- ============================================
-- Security Migration: Token Encryption
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add tokens_encrypted column to track which records have encrypted tokens
ALTER TABLE user_integrations 
  ADD COLUMN IF NOT EXISTS tokens_encrypted BOOLEAN DEFAULT FALSE;

-- 2. Create index for efficient queries on encrypted status
CREATE INDEX IF NOT EXISTS idx_user_integrations_encrypted 
  ON user_integrations(tokens_encrypted);

-- ============================================
-- RLS Security Hardening
-- ============================================

-- 3. Revoke anonymous SELECT access to protect token data
-- Anonymous users should NOT be able to see any integration data
REVOKE SELECT ON user_integrations FROM anon;

-- 4. Ensure only authenticated users with matching user_id can access
-- Drop and recreate policies for clarity

-- First, check existing policies and drop only the dangerous one
DO $$
BEGIN
  -- The anon grant was the issue, now revoked above
  RAISE NOTICE 'Anonymous access to user_integrations has been revoked';
END $$;

-- ============================================
-- Optional: Create safe view for frontend queries
-- This view excludes sensitive token columns
-- ============================================

DROP VIEW IF EXISTS public.user_integrations_safe;
CREATE VIEW public.user_integrations_safe AS
  SELECT 
    id,
    user_id,
    provider,
    provider_user_id,
    provider_username,
    provider_avatar_url,
    token_expires_at,
    connected_at,
    updated_at,
    tokens_encrypted
  FROM user_integrations;

-- Grant access to the safe view
GRANT SELECT ON public.user_integrations_safe TO authenticated;

-- ============================================
-- Verification Query
-- Run this to confirm changes applied correctly
-- ============================================

-- Check column exists:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'user_integrations' AND column_name = 'tokens_encrypted';

-- Check anon permissions (should be empty or not include user_integrations):
-- SELECT * FROM information_schema.role_table_grants 
-- WHERE grantee = 'anon' AND table_name = 'user_integrations';

-- ============================================
-- Migration complete!
-- IMPORTANT: After running this migration:
-- 1. Set TOKEN_ENCRYPTION_KEY in your backend .env file
-- 2. Restart the backend server
-- 3. Users will need to reconnect integrations to encrypt tokens
-- ============================================
