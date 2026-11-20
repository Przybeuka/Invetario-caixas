import { createClient } from '@supabase/supabase-js'

// Valores públicos (chave "publishable"): podem ficar no front-end.
// A segurança vem das regras de acesso (RLS) no banco.
const URL_PADRAO = 'https://hnxarlyxjvghyomxplmc.supabase.co'
const CHAVE_PADRAO = 'sb_publishable_5lHwLCBQQfaJDQx3p7yVMA_iAgXnrTG'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || URL_PADRAO,
  import.meta.env.VITE_SUPABASE_ANON_KEY || CHAVE_PADRAO,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)

export const BUCKET_FOTOS = 'fotos'

export function urlFoto(caminho: string): string {
  return supabase.storage.from(BUCKET_FOTOS).getPublicUrl(caminho).data.publicUrl
}

export const LOGIN_GOOGLE = import.meta.env.VITE_LOGIN_GOOGLE === '1'
