import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string | undefined

const supabaseKey = supabaseServiceKey || supabaseAnonKey

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseKey ?? 'placeholder-service-key',
)
