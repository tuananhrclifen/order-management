import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined

export function getSupabaseServer() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase env vars not set on server')
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

