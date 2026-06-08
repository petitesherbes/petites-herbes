import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

function getSupabase() {
  if (_supabase) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    // Pendant le build, retourner un client vide factice
    if (typeof window === 'undefined') {
      return createClient('https://placeholder.supabase.co', 'placeholder')
    }
    throw new Error('Variables Supabase manquantes. Vérifiez .env.local')
  }
  _supabase = createClient(url, key)
  return _supabase
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabase()[prop as keyof SupabaseClient]
  }
})
