import { createClient } from '@supabase/supabase-js'

// サーバーサイド（APIルート）専用。ブラウザには読み込まれない
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
