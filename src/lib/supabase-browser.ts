// Client-side helper to create a Supabase client in the browser. This
// requires the `@supabase/auth-helpers-nextjs` package to be installed in your
// environment. See the README for instructions on adding these dependencies.

import { createClient } from '@supabase/supabase-js';

// Create a Supabase client on the client side. We explicitly disable
// session persistence because this app currently performs only public
// queries (no user login required). Environment variables are read
// directly from NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);