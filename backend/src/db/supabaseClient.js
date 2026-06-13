/**
 * supabaseClient.js
 * ─────────────────
 * Initializes and exports a singleton Supabase JS v2 client.
 * Used by all services and schedulers that need database access.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[Supabase] Missing environment variables: SUPABASE_URL or SUPABASE_ANON_KEY.\n' +
    'Check your .env file.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Server-side: disable auto-refresh and session persistence
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  db: {
    schema: 'public',
  },
});

console.log('[Supabase] Client initialized →', SUPABASE_URL);
