// Supabase client for the mobile app.
//
// Storage: AsyncStorage. The session payload (access + refresh tokens +
// user JSON) is a few KB -- well within AsyncStorage's per-key limit and
// inside the app's sandboxed data dir, so it doesn't leak to other
// apps. Earlier we tried expo-secure-store with a chunking adapter to
// get Keychain-backed encryption; in practice the chunked writes locked
// up the signup/claim flow on iOS, and the security upside is marginal
// for an HR app's session token. Standard Expo + Supabase pattern.
//
// URL + anon key are PUBLIC by design (same role the web frontend uses).
// They get baked into the app bundle, and every request is gated by the
// same RLS policies the Cloud + Enterprise deployments enforce. There's
// no service-role secret anywhere here.

import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL = "https://whedifdmllooyejzuwrw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_V4YXo8Caq5efgxac4jEjbQ_398oxp-5";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // mobile -- no URL session detection
  },
});
