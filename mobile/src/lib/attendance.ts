// Attendance domain layer for the mobile app.
//
// Wraps the two RPCs we shipped in migration 015:
//   mobile_clock_in(lat, lng, device_id?)
//   mobile_clock_out(lat, lng, device_id?)
// plus a helper that fetches the current employee's row for today so
// the home screen can render the right state (not-in / in / out).
//
// Everything Arabic-facing is in the error messages -- the values
// themselves stay typed-Latin.

import * as Location from "expo-location";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type TodayAttendance = {
  id: string;
  date: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_distance_meters: number | null;
  check_in_outside_geofence: boolean | null;
  check_out_distance_meters: number | null;
  check_out_outside_geofence: boolean | null;
  hours_worked: number | null;
};

export type ClockResult =
  | {
      ok: true;
      attendanceId: string;
      distanceMeters: number | null;
      outsideGeofence: boolean | null;
      hoursWorked?: number | null;
    }
  | { ok: false; error: string };

// ----------------------------------------------------------------------------
// Permission + location
// ----------------------------------------------------------------------------

// Stable device identifier per install. First call mints a UUID and
// persists it in AsyncStorage; subsequent calls reuse it.
const DEVICE_ID_KEY = "nidham.device_id";
let cachedDeviceId: string | null = null;

async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }
  const fresh = `${Platform.OS}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
  cachedDeviceId = fresh;
  return fresh;
}

/**
 * Ensures we have foreground location permission. Returns null on success,
 * an Arabic error string otherwise so callers can show it in a toast.
 */
export async function ensureLocationPermission(): Promise<string | null> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return null;
  if (!current.canAskAgain) {
    return "محتاجين إذن الموقع — افتح الإعدادات وفعّله للتطبيق";
  }
  const requested = await Location.requestForegroundPermissionsAsync();
  if (!requested.granted) {
    return "محتاجين إذن الموقع عشان نتأكد إنك في المكتب";
  }
  return null;
}

/**
 * Reads the current GPS coordinates with a 12-second hard timeout. Returns
 * { lat, lng } on success or null. We use Balanced accuracy: city blocks
 * are enough to enforce a 100m geofence and it spares the battery.
 */
export async function getCurrentLocation(): Promise<
  { lat: number; lng: number; accuracy: number } | null
> {
  try {
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("GPS timeout")), 12000),
      ),
    ]);
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? 0,
    };
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Server calls
// ----------------------------------------------------------------------------

export async function clockIn(): Promise<ClockResult> {
  const permErr = await ensureLocationPermission();
  if (permErr) return { ok: false, error: permErr };

  const loc = await getCurrentLocation();
  if (!loc) return { ok: false, error: "مش قادرين نقرا الموقع — جرّب تاني" };

  const { data, error } = await supabase
    .rpc("mobile_clock_in", {
      p_lat: loc.lat,
      p_lng: loc.lng,
      p_device_id: await getDeviceId(),
    })
    .single<{
      attendance_id: string;
      distance_meters: number | null;
      outside_geofence: boolean | null;
      geofence_enabled: boolean;
    }>();

  if (error) return { ok: false, error: arabicizeRpcError(error.message) };
  if (!data) return { ok: false, error: "مفيش رد من السيرفر" };

  return {
    ok: true,
    attendanceId: data.attendance_id,
    distanceMeters: data.distance_meters,
    outsideGeofence: data.outside_geofence,
  };
}

export async function clockOut(): Promise<ClockResult> {
  const permErr = await ensureLocationPermission();
  if (permErr) return { ok: false, error: permErr };

  const loc = await getCurrentLocation();
  if (!loc) return { ok: false, error: "مش قادرين نقرا الموقع — جرّب تاني" };

  const { data, error } = await supabase
    .rpc("mobile_clock_out", {
      p_lat: loc.lat,
      p_lng: loc.lng,
      p_device_id: await getDeviceId(),
    })
    .single<{
      attendance_id: string;
      distance_meters: number | null;
      outside_geofence: boolean | null;
      hours_worked: number | null;
    }>();

  if (error) return { ok: false, error: arabicizeRpcError(error.message) };
  if (!data) return { ok: false, error: "مفيش رد من السيرفر" };

  return {
    ok: true,
    attendanceId: data.attendance_id,
    distanceMeters: data.distance_meters,
    outsideGeofence: data.outside_geofence,
    hoursWorked: data.hours_worked,
  };
}

/**
 * Returns today's attendance row for the linked employee, or null if no
 * row exists yet (= hasn't clocked in today).
 */
export async function getTodayAttendance(
  employeeId: string,
): Promise<TodayAttendance | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("attendance")
    .select(
      "id, date, status, check_in_at, check_out_at, check_in_distance_meters, check_in_outside_geofence, check_out_distance_meters, check_out_outside_geofence, hours_worked",
    )
    .eq("employee_id", employeeId)
    .eq("date", today)
    .maybeSingle();
  return (data as TodayAttendance | null) ?? null;
}

// ----------------------------------------------------------------------------
// Error translation
// ----------------------------------------------------------------------------

function arabicizeRpcError(message: string): string {
  // The two RPCs already raise Arabic errors via errcode P0001. Anything
  // else (network, RLS, JSON parse...) gets a generic fallback.
  if (message.startsWith("حسابك")) return message;
  if (message.startsWith("لازم")) return message;
  if (message.startsWith("مش في")) return message;
  return `حصلت مشكلة: ${message}`;
}
