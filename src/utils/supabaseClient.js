// Single Supabase client shared across the app (App root + Setup screen). Kept as
// one module-level singleton so there is exactly one realtime/auth connection.
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
