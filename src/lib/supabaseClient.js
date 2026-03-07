// src/lib/supabaseClient.js
// ─────────────────────────────────────────────────────────────
// Single Supabase client instance shared across the whole app.
// Never import createClient anywhere else — always use this file.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn(
    "[Supabase] Missing env vars — portfolio will not persist.\n" +
    "Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to your .env file."
  );
}

export const supabase = SUPABASE_URL && SUPABASE_ANON
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

export const hasSupabase = !!supabase;
