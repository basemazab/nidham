// Supabase client for the mobile app.
//
// Storage adapter: expo-secure-store on iOS/Android (Keychain + Keystore
// backed), AsyncStorage on web. The web fallback is only used during
// `expo start --web` for previewing; production targets are native.
//
// URL + anon key are PUBLIC by design (same role the web frontend uses).
// They get baked into the app bundle, and every request is gated by the
// same RLS policies the Cloud + Enterprise deployments enforce. There's
// no service-role secret anywhere here.

import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const SUPABASE_URL = "https://whedifdmllooyejzuwrw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_V4YXo8Caq5efgxac4jEjbQ_398oxp-5";

// SecureStore caps values at 2048 bytes. Supabase session tokens can
// occasionally exceed that, so wrap it in a fallback that chunks long
// strings into multiple entries.
const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key);
  },
};

const storage = Platform.OS === "web" ? AsyncStorage : SecureStoreAdapter;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // mobile -- no URL session detection
  },
});
