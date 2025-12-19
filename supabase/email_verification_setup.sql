-- ============================================
-- Email Verification System - Database Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- STEP 1: Clean existing identities
DELETE FROM auth.identities WHERE provider IN ('spotify', 'discord');

-- STEP 2: Clean user_integrations table
DELETE FROM user_integrations;

-- STEP 3: Add new columns for email verification
ALTER TABLE user_integrations 
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider_email TEXT,
  ADD COLUMN IF NOT EXISTS verification_code TEXT,
  ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;

-- STEP 4: Create index for verification lookups
CREATE INDEX IF NOT EXISTS idx_user_integrations_verification 
  ON user_integrations(user_id, provider, verification_code);

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_integrations'
ORDER BY ordinal_position;
