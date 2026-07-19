import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const isConfigured =
  SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

function createStubClient() {
  return {
    from() {
      throw new Error('Supabase is not configured yet — edit js/config.js with your project URL and anon key.');
    },
  };
}

// Building the real client with a placeholder URL can throw synchronously,
// which would break this module's import (and the whole app) before the
// "not configured" banner ever gets a chance to show. Fall back to a stub
// that fails loudly but safely when an actual query is attempted.
export const supabase = isConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : createStubClient();
