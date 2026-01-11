import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// FIX: Hardcoded keys ensure the Android App can connect to the Database
// ------------------------------------------------------------------

const supabaseUrl = 'https://wrclowgixhueaeywnlsn.supabase.co';

const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyY2xvd2dpeGh1ZWFleXdubHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODE5NTUsImV4cCI6MjA4MzU1Nzk1NX0.X16Tm6Hw-v_soSxM7igaD7iKNzu2KhslCY_NYCKxx5Y';

// ------------------------------------------------------------------

if (supabaseUrl.includes('placeholder') || supabaseKey.includes('placeholder')) {
  console.error("CRITICAL: Keys are still missing!");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
