import { getSupabaseClient } from '../src/services/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setupDatabase() {
  console.log('🚧 Starting Database Setup...');

  const supabase = getSupabaseClient();

  if (!supabase) {
    console.error('❌ Supabase is NOT configured. Please check your .env file.');
    console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('✓ Supabase Client initialized.');
  console.log('  URL:', process.env.SUPABASE_URL);

  // Read schema file
  const schemaPath = path.join(__dirname, '../src/db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('\n-----------------------------------------------------------');
  console.log('IMPORTANT: Supabase JS Client cannot create tables directly.');
  console.log('You must run the SQL schema manually in your Supabase Dashboard.');
  console.log('-----------------------------------------------------------\n');
  
  console.log('📋 Copy and run the following SQL in the Supabase SQL Editor:');
  console.log('   (https://supabase.com/dashboard/project/_/sql)\n');
  
  console.log(schemaSql);
  
  console.log('\n-----------------------------------------------------------');
  console.log('Checking connection by attempting to read tables...');
  
  try {
    const { error } = await supabase.from('downloads').select('count').limit(1);
    
    if (error && error.code === '42P01') { // undefined_table
      console.log('❌ Table "downloads" does NOT exist yet.');
    } else if (error) {
      console.log('❌ Connection Error:', error.message);
    } else {
      console.log('✓ Table "downloads" exists and is accessible.');
    }

    const { error: error2 } = await supabase.from('user_integrations').select('count').limit(1);
    if (error2 && error2.code === '42P01') {
      console.log('❌ Table "user_integrations" does NOT exist yet.');
    } else if (error2) {
      console.log('❌ Connection Error:', error2.message);
    } else {
      console.log('✓ Table "user_integrations" exists and is accessible.');
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

setupDatabase();
