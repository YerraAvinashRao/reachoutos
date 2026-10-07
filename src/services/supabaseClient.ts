import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
const supabaseUrl = rawUrl && !rawUrl.includes('your-project-ref')
  ? rawUrl
  : 'https://cxzynykcdxadhhkjsmgs.supabase.co';

const rawKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';
const supabaseAnonKey = rawKey && !rawKey.includes('your-supabase-anon-key') && rawKey.length > 20
  ? rawKey
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4enlueWtjZHhhZGhoa2pzbWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNjU3ODQsImV4cCI6MjEwNjg0MTc4NH0.agjrQeFqscfKF5aN9rUkl4sgL1J_mjU7il3sL6olTjI';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});
