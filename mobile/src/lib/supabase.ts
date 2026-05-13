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

// SecureStore caps individual values at 2048 bytes on iOS / Android.
// Supabase session payloads (access + refresh tokens + user) regularly
// exceed that, so wrap the native API in a chunking adapter:
//
//   <key>           -> JSON metadata { v: 1, chunks: N }
//   <key>.0 .. .N-1 -> the actual UTF-8 slices, max 1800 bytes each
//
// A small value still fits in a single chunk (chunks: 1) -- one extra
// metadata round-trip on read, but no behavioural change for callers.
const CHUNK_SIZE = 1800;

async function clearChunks(key: string): Promise<void> {
  const meta = await SecureStore.getItemAsync(key);
  if (!meta) return;
  try {
    const parsed = JSON.parse(meta) as { v?: number; chunks?: number };
    if (parsed?.v === 1 && typeof parsed.chunks === "number") {
      await Promise.all(
        Array.from({ length: parsed.chunks }, (_, i) =>
          SecureStore.deleteItemAsync(`${key}.${i}`),
        ),
      );
    }
  } catch {
    // Legacy single-string value -- nothing to clean up beyond the key.
  }
}

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const meta = await SecureStore.getItemAsync(key);
    if (!meta) return null;
    try {
      const parsed = JSON.parse(meta) as { v?: number; chunks?: number };
      if (parsed?.v !== 1 || typeof parsed.chunks !== "number") {
        // Looks like a legacy single value or unrelated JSON -- return as-is.
        return meta;
      }
      const parts: string[] = [];
      for (let i = 0; i < parsed.chunks; i++) {
        const part = await SecureStore.getItemAsync(`${key}.${i}`);
        if (part === null) return null; // corrupted -- treat as no session
        parts.push(part);
      }
      return parts.join("");
    } catch {
      // meta isn't JSON -- legacy single-string write.
      return meta;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    await clearChunks(key); // drop leftover slices from a longer prior write
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(
      chunks.map((part, i) => SecureStore.setItemAsync(`${key}.${i}`, part)),
    );
    await SecureStore.setItemAsync(
      key,
      JSON.stringify({ v: 1, chunks: chunks.length }),
    );
  },

  removeItem: async (key: string): Promise<void> => {
    await clearChunks(key);
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
