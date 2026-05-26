# Clock-In Testing Checklist

Use this checklist to verify `/clock-in` works end-to-end on a real mobile device. Every box should be tickable before you tell employees about the URL.

---

## ✅ Pre-requisites (do these once)

- [ ] Migrations applied: 062, 063, 064, 065, 066, 067, 068
- [ ] Supabase Storage bucket **attendance-photos** exists (Private)
- [ ] Storage RLS policies set (3 policies: upload / read / update — see `WHATSAPP_SETUP.md` if you've already done this)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Vercel env vars
- [ ] You have a real employee record linked to your user account (use the "سجّلني كموظف" button on /clock-in if needed)
- [ ] Geofence configured in **/dashboard/settings/office-location** (or `geofence_enabled = false` so all locations pass)

---

## 📱 Tests to run on your phone

### Test 1 — Open from Safari directly (the gold path)

| Step | Expected | Pass? |
|---|---|---|
| Open Safari (NOT WhatsApp) on iPhone | Browser opens fresh | ☐ |
| Type `nidhamhr.com/clock-in` | Page loads, shows "أهلاً يا [your name]" | ☐ |
| Read welcome card | No yellow "in-app browser" warning shown | ☐ |
| Look for install button | "📱 ثبّت على الموبايل" button visible | ☐ |

### Test 2 — Open from WhatsApp (the realistic path)

| Step | Expected | Pass? |
|---|---|---|
| Send `nidhamhr.com/clock-in` to yourself on WhatsApp | Link arrives | ☐ |
| Tap the link in WhatsApp | Opens in WhatsApp in-app browser | ☐ |
| Top of page shows yellow banner | "افتح اللينك في متصفّحك" warning visible | ☐ |
| Banner says "WhatsApp" specifically | Detection works | ☐ |
| Tap "🌐 افتح في Safari" | Safari opens with the same URL | ☐ |
| Yellow banner now hidden | In Safari it's gone | ☐ |

### Test 3 — GPS permission flow

| Step | Expected | Pass? |
|---|---|---|
| Tap "📍 شارك موقعك" | Browser asks permission to access location | ☐ |
| Tap "Allow" | "بنحدّد موقعك..." with pulsing emoji | ☐ |
| Wait 3–5 seconds | Result card shows distance from office | ☐ |
| If outside geofence | Red warning "خارج النطاق المسموح" appears | ☐ |
| If inside geofence | Step 2 ("Open camera") becomes available | ☐ |
| If you tap "Deny" first | Error: "اسمح للموقع علشان نقدر نسجّل حضورك" | ☐ |

### Test 4 — Camera permission + capture

| Step | Expected | Pass? |
|---|---|---|
| Tap "📸 افتح الكاميرا" | Browser asks for camera permission | ☐ |
| Tap "Allow" | Front camera preview appears in dark frame | ☐ |
| You see yourself | Camera works (not black screen) | ☐ |
| Tap "📸 خد الصورة" | Preview replaced by captured image | ☐ |
| Camera indicator on iPhone (green dot) | Turns off after capture | ☐ |
| Tap "↻ إعادة" | Camera reopens, capture cleared | ☐ |
| Camera indicator | Turns off when you go back, not after retake | ☐ |

### Test 5 — Submit clock-in

| Step | Expected | Pass? |
|---|---|---|
| With selfie + GPS done, tap "✓ سجّل الحضور" | "⏳ بنسجّل الحضور..." shows | ☐ |
| Wait 2–5 seconds | "✓ اتسجّل حضورك الساعة XX:XX" appears | ☐ |
| Look at top "دخول" pill | Shows current time | ☐ |
| Open `/dashboard/attendance` in another tab | Today's row shows you as Present | ☐ |
| Check Supabase: `select check_in_at, check_in_photo_url from attendance where date = today` | Both populated | ☐ |

### Test 6 — Same page → clock-out

| Step | Expected | Pass? |
|---|---|---|
| Reload `/clock-in` (you already clocked in) | Header says "سجّل انصرافك دلوقتي" | ☐ |
| Top pills | "دخول" green with time, "خروج" empty | ☐ |
| Repeat GPS + camera + submit | Now updates `check_out_at` not `check_in_at` | ☐ |
| After submit | "خلصت يومك — لقاء الغد!" | ☐ |

### Test 7 — PWA install (Android Chrome)

| Step | Expected | Pass? |
|---|---|---|
| On Android, open `nidhamhr.com/clock-in` in Chrome | Page loads normally | ☐ |
| Look for "🚀 ثبّت التطبيق" button | Visible under header | ☐ |
| Tap install | Chrome shows "Install Nidham?" dialog | ☐ |
| Tap "Install" | Loading + success | ☐ |
| Home screen | Nidham icon appears | ☐ |
| Tap home screen icon | Opens full-screen, no browser chrome | ☐ |
| Long-press home screen icon | Two shortcuts: "تسجيل حضور" + "Dashboard" | ☐ |

### Test 8 — PWA install (iPhone Safari)

| Step | Expected | Pass? |
|---|---|---|
| Open `nidhamhr.com/clock-in` in Safari | Page loads | ☐ |
| Tap "📱 ثبّت على الموبايل" button | Tooltip with iOS instructions appears | ☐ |
| Follow the steps (Share → Add to Home Screen) | iOS native dialog appears | ☐ |
| Tap "Add" | Icon appears on home screen | ☐ |
| Tap icon | Opens full-screen as standalone app | ☐ |

---

## ❌ Troubleshooting

### Camera shows black screen

- Make sure you're in Safari (iOS) or Chrome (Android), NOT an in-app browser like WhatsApp/Instagram/Facebook
- Check Safari → Settings → Camera → Nidham → "Ask" or "Allow"
- Reload the page after granting permission

### GPS keeps showing "ما قدرناش نلاقي موقعك"

- Make sure Location Services is on in iPhone Settings → Privacy → Location Services
- Make sure Safari has location permission enabled
- Go outside or near a window — getCurrentPosition with `enableHighAccuracy: true` can timeout indoors
- Wait 15 seconds — the timeout is generous

### Photo doesn't upload (clock-in still works but no selfie in DB)

- Open Supabase Dashboard → Storage → check that **attendance-photos** bucket exists
- Check the bucket's RLS policies — there should be 3 (INSERT for authenticated, SELECT for authenticated, UPDATE for authenticated)
- Open DevTools Network tab and look for the storage POST request — if 403, RLS is the issue

### "حسابك مش متربط بأي موظف"

- This means your auth user doesn't have a matching `employees.user_id` row
- If you're admin/HR: tap "✓ سجّلني كموظف" — auto-creates or links
- If you're employee: ask HR to send you the invitation token from `/dashboard/employees/[id]`

### Install button never appears (Android Chrome)

- The site must be HTTPS (it is — Vercel) ✓
- The manifest must be reachable — visit `nidhamhr.com/manifest.webmanifest` directly, you should see JSON
- The service worker must be installed — open DevTools → Application → Service Workers, look for "nidham-v1"
- Chrome only shows the install prompt after the user "engages" with the site (~30 seconds or 2 page visits)

### Install button never appears (iOS Safari)

- iOS Safari doesn't fire `beforeinstallprompt` — you'll see the iOS-specific button "📱 ثبّت على الموبايل" instead, which opens manual instructions
- Make sure you're in Safari proper (not Chrome iOS, Edge iOS, etc.)
- Manual path: Share button (square with up arrow) → scroll → "Add to Home Screen"

---

## 🎯 Real-world deployment

Once all tests pass:

1. **Send to a real employee**: WhatsApp them the link `nidhamhr.com/clock-in` with a brief intro:
   > "افتح اللينك ده **في Safari** (مش من واتساب) عشان الكاميرا تشتغل. لو فتحت من واتساب، الصفحة هتقولك تنقل لـ Safari تلقائياً."

2. **Train HR** on how to verify attendance came in:
   - `/dashboard/attendance` → see today's date → check who's marked
   - Click any row to see check-in time + selfie thumbnail (when storage view is wired up)

3. **Set up the geofence** in `/dashboard/settings/office-location`:
   - Click "Use my location" while at the office
   - Set radius (100m is the default — generous enough that GPS noise won't reject legitimate employees)
   - Toggle `geofence_enabled = true` once happy

4. **Disable WhatsApp install hints** if you don't want them — the in-app banner is conservative (only shows on detected in-app browsers) so it shouldn't false-positive much.

---

## 📊 Operator dashboard

Track adoption with this query:

```sql
select
  date_trunc('day', check_in_at) as day,
  count(*) as clock_ins,
  count(check_in_photo_url) as with_selfie,
  round(avg(check_in_distance_meters)::numeric, 1) as avg_distance_m,
  count(*) filter (where check_in_outside_geofence) as outside_geofence
from public.attendance
where check_in_at >= now() - interval '14 days'
  and company_id = '<your-company-uuid>'
group by 1
order by 1 desc;
```

This shows daily clock-in volume, what % included a selfie, the average GPS distance from the office, and how many were outside the geofence (potential mobile clock-in abuse).

---

**Last updated: 2026-05-26 · Migrations through 068**
