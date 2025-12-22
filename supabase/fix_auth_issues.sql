-- ============================================
-- Auth System Fixes - Database Migration
-- Run in Supabase SQL Editor
-- ============================================

-- 1. Add INSERT policy for profiles table
-- This allows users to create their own profile on first login
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 2. Add composite index for user_integrations
-- Improves performance for token lookups
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_provider 
  ON user_integrations(user_id, provider);

-- 3. Add NOT NULL constraint to access_token (optional safety check)
-- Note: Only uncomment if you want to enforce this - existing nulls will cause error
-- ALTER TABLE user_integrations ALTER COLUMN access_token SET NOT NULL;

-- ============================================
-- Verification queries:
-- ============================================

-- Check policies on profiles table:
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Check indexes on user_integrations:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'user_integrations';
