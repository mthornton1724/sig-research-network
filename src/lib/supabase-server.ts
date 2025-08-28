// Server-side helper to create a Supabase client inside server actions or API
// routes. This uses the `@supabase/auth-helpers-nextjs` package.

import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client for server-side usage. Because we do not rely on
 * auth-helpers in this scaffold, we instantiate the client directly using
 * environment variables. Session persistence is disabled since no user
 * authentication is required for public queries. In a future iteration, you
 * can replace this with a cookie-aware client if using Supabase Auth.
 */
export function createSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
      },
    }
  );
}