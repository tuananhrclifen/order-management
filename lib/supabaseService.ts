import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined

export function getSupabaseService() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service env vars not set on server')
  }
  return createClient(supabaseUrl, serviceKey)
}

