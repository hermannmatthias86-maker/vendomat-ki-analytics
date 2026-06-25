import { createClient } from '@supabase/supabase-js'

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string) || ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

// Strip trailing slash – Supabase client throws "Invalid path" if present
const supabaseUrl = rawUrl.replace(/\/$/, '')

if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
  console.warn('[supabase] VITE_SUPABASE_URL nicht gesetzt – bitte .env konfigurieren.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
)

export const isSupabaseConfigured =
  !!supabaseUrl &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('your-project-id')

export default supabase
