/**
 * Supabase Database Diagnostic Script
 * 
 * Checks database connection and displays all data in each table
 * Run with: npx tsx scripts/db-diagnostic.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Use service role key for full access, fall back to anon key
const supabaseKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

// Tables to check
const TABLES = [
  'profiles',
  'downloads',
  'user_favorites', 
  'user_history',
  'user_integrations',
  'collaborative_playlists',
  'playlist_songs',
  'playlist_collaborators',
  'user_preferences',
];

interface TableStats {
  name: string;
  rowCount: number;
  status: 'OK' | 'EMPTY' | 'ERROR' | 'NOT_FOUND';
  error?: string;
  data?: any[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function printHeader(title: string) {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold(`   ${title}`));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════════════════════\n'));
}

function printSubHeader(title: string) {
  console.log(chalk.yellow(`\n📁 ${title}`));
  console.log(chalk.gray('─'.repeat(75)));
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return chalk.gray('null');
  if (typeof value === 'boolean') return value ? chalk.green('true') : chalk.red('false');
  if (typeof value === 'object') return chalk.gray(JSON.stringify(value).slice(0, 50) + '...');
  if (typeof value === 'string' && value.length > 40) return value.slice(0, 37) + '...';
  return String(value);
}

function printTable(data: any[], maxRows: number = 10) {
  if (!data || data.length === 0) {
    console.log(chalk.gray('  (no data)'));
    return;
  }

  const columns = Object.keys(data[0]);
  const displayData = data.slice(0, maxRows);

  // Print each row
  displayData.forEach((row, i) => {
    console.log(chalk.white.bold(`\n  Row ${i + 1}:`));
    columns.forEach(col => {
      const value = formatValue(row[col]);
      console.log(`    ${chalk.blue(col.padEnd(25))} ${value}`);
    });
  });

  if (data.length > maxRows) {
    console.log(chalk.gray(`\n  ... and ${data.length - maxRows} more rows`));
  }
}

// ============================================================================
// DATABASE CONNECTION TEST
// ============================================================================

async function testConnection(supabase: SupabaseClient): Promise<boolean> {
  printHeader('🔌 DATABASE CONNECTION TEST');

  console.log(chalk.gray(`Supabase URL: ${SUPABASE_URL}`));
  console.log(chalk.gray(`Using Key: ${SUPABASE_SERVICE_KEY ? 'Service Role Key' : 'Anon Key'}`));

  try {
    // Try a simple query to test connection
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error && error.code !== 'PGRST116') { // PGRST116 = table empty or doesn't exist
      throw error;
    }

    console.log(chalk.green('\n✅ Successfully connected to Supabase!'));
    return true;
  } catch (err: any) {
    console.log(chalk.red(`\n❌ Connection failed: ${err.message}`));
    return false;
  }
}

// ============================================================================
// TABLE QUERIES
// ============================================================================

async function queryTable(supabase: SupabaseClient, tableName: string): Promise<TableStats> {
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .limit(20);

    if (error) {
      if (error.code === '42P01') { // Table doesn't exist
        return { name: tableName, rowCount: 0, status: 'NOT_FOUND', error: 'Table does not exist' };
      }
      throw error;
    }

    return {
      name: tableName,
      rowCount: count || data?.length || 0,
      status: (count || 0) > 0 ? 'OK' : 'EMPTY',
      data: data || []
    };
  } catch (err: any) {
    return {
      name: tableName,
      rowCount: 0,
      status: 'ERROR',
      error: err.message
    };
  }
}

// ============================================================================
// AUTH USERS QUERY (requires service role key)
// ============================================================================

async function queryAuthUsers(supabase: SupabaseClient): Promise<any[]> {
  if (!SUPABASE_SERVICE_KEY) {
    console.log(chalk.yellow('  ⚠️ Service role key required to view auth.users'));
    return [];
  }

  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) throw error;
    return data.users || [];
  } catch (err: any) {
    console.log(chalk.red(`  ❌ Failed to query auth.users: ${err.message}`));
    return [];
  }
}

// ============================================================================
// MAIN DIAGNOSTICS
// ============================================================================

async function runDiagnostics() {
  console.log(chalk.bold.magenta('\n╔═══════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.magenta('║           🗄️  SUPABASE DATABASE DIAGNOSTIC REPORT  🗄️                     ║'));
  console.log(chalk.bold.magenta('╚═══════════════════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.gray(`Time: ${new Date().toISOString()}`));
  console.log(chalk.gray(`Project: Music Companion\n`));

  // Check configuration
  if (!SUPABASE_URL || !supabaseKey) {
    console.log(chalk.red('❌ ERROR: Supabase not configured!'));
    console.log(chalk.gray('   Set SUPABASE_URL and SUPABASE_ANON_KEY in .env'));
    process.exit(1);
  }

  // Create client
  const supabase = createClient(SUPABASE_URL, supabaseKey, {
    auth: { persistSession: false }
  });

  // Test connection
  const connected = await testConnection(supabase);
  if (!connected) {
    process.exit(1);
  }

  // Query all tables
  printHeader('📊 TABLE STATISTICS');

  const tableStats: TableStats[] = [];
  for (const table of TABLES) {
    const stats = await queryTable(supabase, table);
    tableStats.push(stats);

    const icon = stats.status === 'OK' ? '✅' : 
                 stats.status === 'EMPTY' ? '📭' : 
                 stats.status === 'NOT_FOUND' ? '❓' : '❌';
    const color = stats.status === 'OK' ? chalk.green :
                  stats.status === 'EMPTY' ? chalk.yellow :
                  stats.status === 'NOT_FOUND' ? chalk.gray : chalk.red;
    
    console.log(color(`${icon} ${table.padEnd(28)} ${stats.rowCount.toString().padStart(5)} rows  ${stats.status}`));
    if (stats.error) {
      console.log(chalk.gray(`   └─ ${stats.error}`));
    }
  }

  // Show auth.users count
  printHeader('👤 AUTHENTICATED USERS');
  const users = await queryAuthUsers(supabase);
  if (users.length > 0) {
    console.log(chalk.green(`✅ Total users: ${users.length}`));
    users.forEach((user, i) => {
      const providers = user.identities?.map((id: any) => id.provider).join(', ') || 'email';
      console.log(chalk.white(`\n  User ${i + 1}:`));
      console.log(`    ${chalk.blue('ID:'.padEnd(20))} ${user.id}`);
      console.log(`    ${chalk.blue('Email:'.padEnd(20))} ${user.email}`);
      console.log(`    ${chalk.blue('Providers:'.padEnd(20))} ${providers}`);
      console.log(`    ${chalk.blue('Created:'.padEnd(20))} ${new Date(user.created_at).toLocaleString()}`);
      console.log(`    ${chalk.blue('Last Sign In:'.padEnd(20))} ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`);
      
      // Show linked identities
      if (user.identities && user.identities.length > 0) {
        console.log(chalk.blue('    Linked Identities:'));
        user.identities.forEach((identity: any) => {
          console.log(`      - ${identity.provider}: ${identity.identity_data?.email || identity.identity_data?.full_name || identity.id}`);
        });
      }
    });
  } else {
    console.log(chalk.yellow('📭 No registered users'));
  }

  // Show data for each non-empty table
  printHeader('📋 TABLE CONTENTS');

  for (const stats of tableStats) {
    if (stats.status === 'OK' && stats.data && stats.data.length > 0) {
      printSubHeader(`${stats.name} (${stats.rowCount} rows)`);
      printTable(stats.data, 5);
    }
  }

  // Summary
  printHeader('📈 SUMMARY');
  
  const okTables = tableStats.filter(t => t.status === 'OK').length;
  const emptyTables = tableStats.filter(t => t.status === 'EMPTY').length;
  const errorTables = tableStats.filter(t => t.status === 'ERROR' || t.status === 'NOT_FOUND').length;
  const totalRows = tableStats.reduce((sum, t) => sum + t.rowCount, 0);

  console.log(`  ${chalk.green('✅ Tables with data:')}     ${okTables}`);
  console.log(`  ${chalk.yellow('📭 Empty tables:')}         ${emptyTables}`);
  console.log(`  ${chalk.red('❌ Error/Not found:')}      ${errorTables}`);
  console.log(`  ${chalk.blue('📊 Total rows:')}           ${totalRows}`);
  console.log(`  ${chalk.blue('👤 Total users:')}          ${users.length}`);

  // Data flow info
  printHeader('🔄 DATA FLOW');
  
  console.log(chalk.white('  Data stored in Supabase:'));
  console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────────'));
  console.log(`  ${chalk.blue('profiles')}           → User display names, avatars, preferences`);
  console.log(`  ${chalk.blue('user_favorites')}     → Favorited songs per user`);
  console.log(`  ${chalk.blue('user_history')}       → Listening history per user`);
  console.log(`  ${chalk.blue('user_integrations')} → OAuth tokens (Spotify, Discord, Last.fm, etc.)`);
  console.log(`  ${chalk.blue('downloads')}          → Cached song files (metadata)`);
  console.log(`  ${chalk.blue('collaborative_playlists')} → Shared playlists`);
  console.log(`  ${chalk.blue('playlist_songs')}     → Songs in collaborative playlists`);
  console.log(`  ${chalk.blue('playlist_collaborators')} → Playlist permissions`);

  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════════════════'));
  console.log(chalk.green('✅ Database diagnostic complete!'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════════════════════\n'));
}

// Run
runDiagnostics().catch(console.error);
