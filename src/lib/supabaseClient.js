// src/lib/supabaseClient.js
// ─────────────────────────────────────────────────────────────
// Safe Supabase client — gracefully handles missing package
// or missing env vars without crashing the app.

let createClient;
try {
  ({ createClient } = require("@supabase/supabase-js"));
} catch {
  // Package not installed — persistence will be disabled
  createClient = null;
}

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY;

const missingPackage = !createClient;
const missingEnv     = !SUPABASE_URL || !SUPABASE_ANON;

if (missingPackage) {
  console.warn("[Supabase] @supabase/supabase-js not installed. Run: npm install @supabase/supabase-js");
} else if (missingEnv) {
  console.warn("[Supabase] Missing env vars. Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to your .env file.");
}

export const supabase = (!missingPackage && !missingEnv)
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

export const hasSupabase = !!supabase;
