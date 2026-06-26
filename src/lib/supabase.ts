import { createClient } from '@supabase/supabase-js'

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string) || ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

// Strip trailing slash – Supabase client throws "Invalid path" if present
const supabaseUrl = rawUrl.replace(/\/$/, '')

const PLACEHOLDER_URL = ['your-project-id', 'placeholder', 'your-project']
const PLACEHOLDER_KEY = ['your-', 'placeholder']

const isValidUrl =
  !!supabaseUrl && !PLACEHOLDER_URL.some((p) => supabaseUrl.includes(p))

// Accepts both legacy JWT keys (eyJ...) and new publishable keys (sb_publishable_...)
const isValidKey =
  !!supabaseAnonKey && !PLACEHOLDER_KEY.some((p) => supabaseAnonKey.startsWith(p))

if (!isValidUrl) {
  console.warn('[supabase] VITE_SUPABASE_URL nicht gesetzt oder enthält Platzhalterwert.')
}
if (!isValidKey) {
  console.warn('[supabase] VITE_SUPABASE_ANON_KEY nicht gesetzt oder enthält Platzhalterwert.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
)

export const isSupabaseConfigured = isValidUrl && isValidKey

export default supabase
