import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// FIX: Hardcoded keys with proper configuration for mobile
// ------------------------------------------------------------------

const supabaseUrl = 'https://wrclowgixhueaeywnlsn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyY2xvd2dpeGh1ZWFleXdubHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODE5NTUsImV4cCI6MjA4MzU1Nzk1NX0.X16Tm6Hw-v_soSxM7igaD7iKNzu2KhslCY_NYCKxx5Y';

// ------------------------------------------------------------------

if (supabaseUrl.includes('placeholder') || supabaseKey.includes('placeholder')) {
  console.error("CRITICAL: Keys are still missing!");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for mobile apps
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'celestial-voice-auth',
    flowType: 'pkce' // More secure for mobile
  },
  global: {
    headers: {
      'X-Client-Info': 'celestial-voice-mobile'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Add connection health check
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('Supabase connection check failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase connection error:', err);
    return false;
  }
};
