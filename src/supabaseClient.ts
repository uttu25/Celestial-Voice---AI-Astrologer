import { createClient } from '@supabase/supabase-js'

// 1. Read keys safely
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 2. DEBUGGING: Check if keys exist
// If they are missing, we ALERT the user on the phone screen
if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg = 'CRITICAL ERROR: API Keys are missing! \n' +
                     'URL: ' + (supabaseUrl ? 'OK' : 'MISSING') + '\n' +
                     'KEY: ' + (supabaseAnonKey ? 'OK' : 'MISSING');
    
    alert(errorMsg); // This pops up on your phone
    console.error(errorMsg);
}

// 3. Initialize Supabase (even if keys missing, to prevent crash)
// Note: Requests will fail, but the App UI will at least load!
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseAnonKey || 'placeholder-key'
)
