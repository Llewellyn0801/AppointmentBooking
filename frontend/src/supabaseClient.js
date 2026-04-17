import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing Supabase credentials in .env file. The application will not connect to the database.");
}

export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseAnonKey || 'dummykey')
