// Mwuah — Supabase client (lazy-loaded). Falls back to demo mode when not configured.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let _sb = null;

export async function getSb() {
  if (!isConfigured) return null;
  if (_sb) return _sb;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mwuah-auth' },
  });
  return _sb;
}
