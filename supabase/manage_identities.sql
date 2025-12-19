-- ============================================
-- Supabase Identity Management Script
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================

-- ============================================
-- 1. VIEW ALL LINKED IDENTITIES
-- See which users have Spotify/Discord linked
-- ============================================
SELECT 
  u.id as user_id,
  u.email as user_email,
  u.created_at as account_created,
  i.provider,
  i.identity_data->>'email' as provider_email,
  i.identity_data->>'name' as provider_name,
  i.created_at as linked_at
FROM auth.users u
LEFT JOIN auth.identities i ON u.id = i.user_id
ORDER BY u.created_at DESC;


-- ============================================
-- 2. VIEW SPOTIFY IDENTITIES ONLY
-- Shows all Spotify-linked accounts
-- ============================================
SELECT 
  u.email as user_email,
  i.identity_data->>'email' as spotify_email,
  i.identity_data->>'name' as spotify_name,
  i.id as identity_id,
  i.provider_id as spotify_user_id,
  i.created_at as linked_at
FROM auth.identities i
JOIN auth.users u ON u.id = i.user_id
WHERE i.provider = 'spotify';


-- ============================================
-- 3. VIEW DISCORD IDENTITIES ONLY
-- ============================================
SELECT 
  u.email as user_email,
  i.identity_data->>'email' as discord_email,
  i.identity_data->>'username' as discord_username,
  i.id as identity_id,
  i.provider_id as discord_user_id,
  i.created_at as linked_at
FROM auth.identities i
JOIN auth.users u ON u.id = i.user_id
WHERE i.provider = 'discord';


-- ============================================
-- 4. UNLINK SPOTIFY FROM A SPECIFIC USER
-- Replace 'USER_EMAIL_HERE' with actual email
-- ============================================
-- First, find the user:
-- SELECT id, email FROM auth.users WHERE email = 'USER_EMAIL_HERE';

-- Then delete their Spotify identity:
-- DELETE FROM auth.identities 
-- WHERE provider = 'spotify' 
-- AND user_id = (SELECT id FROM auth.users WHERE email = 'USER_EMAIL_HERE');


-- ============================================
-- 5. UNLINK ALL SPOTIFY IDENTITIES
-- ⚠️ CAUTION: This removes ALL Spotify links!
-- ============================================
-- Uncomment to run:
-- DELETE FROM auth.identities WHERE provider = 'spotify';


-- ============================================
-- 6. UNLINK ALL DISCORD IDENTITIES
-- ⚠️ CAUTION: This removes ALL Discord links!
-- ============================================
-- Uncomment to run:
-- DELETE FROM auth.identities WHERE provider = 'discord';


-- ============================================
-- 7. DELETE A USER COMPLETELY
-- This removes user and ALL their data
-- ⚠️ CAUTION: Cannot be undone!
-- ============================================
-- Replace 'USER_EMAIL_HERE' with actual email:
-- DELETE FROM auth.users WHERE email = 'USER_EMAIL_HERE';


-- ============================================
-- 8. VIEW user_integrations TABLE
-- Custom integrations (Telegram, Last.fm, etc.)
-- ============================================
SELECT 
  u.email,
  ui.provider,
  ui.provider_username,
  ui.connected_at
FROM user_integrations ui
JOIN auth.users u ON u.id = ui.user_id;


-- ============================================
-- 9. CLEAR user_integrations FOR A USER
-- ============================================
-- DELETE FROM user_integrations 
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'USER_EMAIL_HERE');


-- ============================================
-- 10. RESET FOR CLEAN TESTING
-- ⚠️ DANGER: Removes ALL users and data!
-- Only use in development!
-- ============================================
-- Uncomment ALL lines below to run:

-- DELETE FROM user_integrations;
-- DELETE FROM favorites;
-- DELETE FROM history;
-- DELETE FROM playlist_songs;
-- DELETE FROM playlist_collaborators;
-- DELETE FROM collaborative_playlists;
-- DELETE FROM profiles;
-- DELETE FROM auth.identities;
-- DELETE FROM auth.users;
