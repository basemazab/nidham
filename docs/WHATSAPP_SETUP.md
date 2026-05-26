# WhatsApp Cloud API — Complete Setup Walkthrough

This guide walks you through everything needed to make these two features go live:

1. **OTP delivery via WhatsApp** — used in login / 2FA / signup verification
2. **Employee self-service bot** — answers "كم رصيد إجازاتي" / "مرتبي" / "حضوري" automatically

Estimated time: **45 minutes** if you're new to Meta Business Manager. Less than the cost of one Apple Developer subscription, and the API itself is free for the first 1,000 conversations/month.

---

## ⚙ Architecture overview

```
Employee texts "+201234567890" (Nidham's WhatsApp business number)
        ↓
Meta WhatsApp Cloud API receives the message
        ↓
Meta POSTs to your webhook: https://www.nidhamhr.com/api/whatsapp/webhook
        ↓
Webhook validates signature → looks up employee by phone → calls bot router
        ↓
Bot generates reply ("رصيدك 21 يوم متبقي") → sends back via Cloud API
        ↓
Employee sees the reply in WhatsApp — < 5 seconds end-to-end
```

For OTP it's the same flow but reversed: server initiates the send.

---

## 📋 What you need before starting

- A Facebook account (probably yours already)
- Admin access to a Facebook Page (you have "Nidham Egypt" already)
- A **fresh phone number** that's NOT currently registered on WhatsApp Business app. You'll need:
  - A new SIM (~100 EGP from Vodafone/Orange/Etisalat), OR
  - A number that's never been used on WhatsApp, OR
  - Switch your existing number from WhatsApp Business app → WhatsApp Cloud API (one-way; can't go back)
- A valid Egyptian credit card (Meta requires it on file even though the first 1,000 conversations are free)

> **⚠ Important**: do NOT use your personal WhatsApp number. The migration is one-way, and you'll lose access to your personal chats on that number.

---

## 🚀 Setup steps

### Step 1 — Open Meta Business Manager

1. Go to https://business.facebook.com
2. Sign in with your Facebook account
3. Top-right → **Settings** (gear icon)

If you don't have a Business Account yet:
- Click **Create Account**
- Business Name: "Nidham" (or your company name)
- Your Name + Business Email
- Click **Submit**

### Step 2 — Add a WhatsApp Business Account (WABA)

1. In Business Manager → **Accounts** → **WhatsApp Accounts**
2. Click **Add** (top-right) → **Create a new WhatsApp Business Account**
3. WABA Name: "Nidham Bot" (this is just an internal label)
4. Timezone: Africa/Cairo
5. Currency: EGP (E£)
6. Click **Continue**

You'll see your WABA in the list with status "Pending verification" — that's fine, you can proceed.

### Step 3 — Register your phone number

1. Inside your new WABA, click **Add phone number**
2. Enter the new phone number (international format: +20 1X XXXX XXXX)
3. Display Name: "Nidham" (this is what employees will see when they receive messages)
4. Verification:
   - Choose SMS or Voice call
   - Enter the 6-digit code Meta sends to that number
5. ⚠ **CRITICAL**: once this phone is registered, it CANNOT be used in WhatsApp Business app or regular WhatsApp anymore. The Cloud API takes exclusive ownership.

### Step 4 — Create a Meta App

You need an "App" to get the API credentials.

1. Go to https://developers.facebook.com/apps
2. Click **Create App** (top-right)
3. App Type: **Business**
4. App Display Name: "Nidham WhatsApp"
5. App Contact Email: your email
6. Business Account: select the Nidham business you created in Step 1
7. Click **Create App**

### Step 5 — Add WhatsApp to your App

1. In your new App dashboard, you'll see a list of products
2. Find **WhatsApp** → click **Set up**
3. On the WhatsApp setup page:
   - Click **Select an existing WhatsApp Business Account**
   - Choose the Nidham Bot WABA you created in Step 2
   - Click **Continue**

### Step 6 — Get the Phone Number ID

You're now on the **API Setup** page. You'll see:

```
From: +20 1X XXXX XXXX (Test Number / Your Number)
Phone Number ID: 123456789012345
WhatsApp Business Account ID: 987654321098765
```

**Copy the Phone Number ID** — you'll need it for `WHATSAPP_PHONE_NUMBER_ID`.

### Step 7 — Generate a permanent Access Token

The "Temporary access token" on this page expires in 24 hours. For production, you need a **System User token** that doesn't expire.

1. Go to https://business.facebook.com/settings/system-users
2. Click **Add** → name it "Nidham API"
3. Role: **Admin**
4. Click **Create System User**
5. In the new system user's page, click **Add Assets**
6. Find your WhatsApp Business Account → assign with "Manage WhatsApp Business Account" permission
7. Click **Save**
8. Back on the system user, click **Generate New Token**
9. App: select your "Nidham WhatsApp" app
10. Token Expiration: **Never**
11. Permissions: check `whatsapp_business_messaging` AND `whatsapp_business_management`
12. Click **Generate Token**
13. **Copy the token immediately** — you'll never see it again. Save it somewhere secure (1Password / a sealed note).

This token starts with `EAA...` and is about 200 characters long. That's `WHATSAPP_ACCESS_TOKEN`.

### Step 8 — Create an Authentication template (for OTP)

WhatsApp requires "templates" for any message you send OUTSIDE the 24-hour customer service window. For OTPs (which arrive when the user hasn't messaged you first), this is required.

1. In Business Manager → WhatsApp Accounts → Message Templates → **New Template**
2. Category: **Authentication**
3. Name: `nidham_otp` (must be exactly this — the code in `src/lib/whatsapp.ts` looks for this name)
4. Language: **Arabic**
5. Body (paste exactly):
   ```
   كود التحقق الخاص بك في نِظام هو: {{1}}
   صالح لمدة 10 دقائق. لا تشاركه مع أي شخص.
   ```
6. Click **Submit**

Approval usually takes **a few minutes** for authentication templates (longer for marketing). You'll get a notification when it's approved.

### Step 9 — Set environment variables in Vercel

1. Open https://vercel.com → your Nidham project → **Settings** → **Environment Variables**
2. Add these four:

| Variable | Value | Source |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | `EAAxxxxxxxxxxxx...` | System User token from Step 7 |
| `WHATSAPP_PHONE_NUMBER_ID` | `123456789012345` | From API Setup (Step 6) |
| `WHATSAPP_VERIFY_TOKEN` | (any random string) | You pick — use something like `nidham_2026_verify_xyz789` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJxxxxx...` | From Supabase Dashboard → Settings → API |

Save each one. Then click **Deployments** → latest deployment → **⋯** → **Redeploy** to pick up the new env vars.

### Step 10 — Configure the webhook in Meta

This tells Meta where to POST incoming messages.

1. In your Meta App → WhatsApp → **Configuration**
2. **Webhook** section → click **Edit**
3. Callback URL: `https://www.nidhamhr.com/api/whatsapp/webhook`
4. Verify Token: paste the SAME string you used for `WHATSAPP_VERIFY_TOKEN` in Vercel
5. Click **Verify and Save**

If Meta returns "Failed verification", the most common causes:
- The verify token doesn't match exactly (whitespace? case?)
- Vercel didn't redeploy after you added the env var
- The URL is wrong (must be HTTPS, must include /api/whatsapp/webhook)

6. After verification succeeds, click **Manage** next to "Webhook Fields"
7. Subscribe to: **messages** (this is the only field the bot needs)
8. Click **Done**

### Step 11 — Add Test Recipients (during development)

While your app is in development mode, you can only send WhatsApp messages to phone numbers you've explicitly approved.

1. In Meta App → WhatsApp → **API Setup**
2. Scroll to **To** → click **Manage phone number list**
3. Add up to **5 test numbers** (start with yours)
4. Each number gets a verification SMS to accept the test invite

When you go to production (more on this below), this restriction lifts.

### Step 12 — Test the OTP flow

From a terminal or Postman:

```bash
curl -X POST https://www.nidhamhr.com/api/otp/send \
  -H "Content-Type: application/json" \
  -d '{"identifier":"01055356622","channel":"whatsapp","purpose":"verify"}'
```

Within 5 seconds, the target WhatsApp should receive:

> كود التحقق الخاص بك في نِظام هو: 123456
> صالح لمدة 10 دقائق. لا تشاركه مع أي شخص.

Verify the code:

```bash
curl -X POST https://www.nidhamhr.com/api/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"identifier":"01055356622","purpose":"verify","code":"123456"}'
```

Response should be `{"ok":true}`.

### Step 13 — Test the bot

From the test phone, send a WhatsApp message to your Nidham phone number (the one from Step 3):

- Send: `مساعدة`
- Expected reply (within 5 seconds): A list of all available bot commands

If the bot doesn't reply:
- Check **Meta App → Webhooks** logs for the incoming event
- Check Vercel function logs for `/api/whatsapp/webhook` — look for errors
- Verify the test sender's phone is in `employees.phone` for an active employee
- If "حسابك مش مسجّل عندنا" — the phone doesn't match any employee record

### Step 14 — Go to Production (lifts the 5-recipient limit)

Once you've tested and confirmed everything works:

1. Meta App → **App Review for Live** → **App Review**
2. You'll need to submit your app for **Business Verification**:
   - Upload business license / commercial registration
   - Verify business address (utility bill or bank statement)
   - Add a privacy policy URL (you have `/privacy` already ✓)
   - Add data deletion instructions
3. Meta reviews in 2–5 business days for Egyptian SMBs
4. Once approved, your app moves from "Development" → "Live"
5. The 5-recipient limit is gone — anyone can message your bot

---

## 💰 Cost & Limits

- **Conversations** (Meta's billing unit, ~24 hours of bidirectional messaging): Free up to 1,000/month per phone number
- **Authentication** (OTP) templates: ~$0.04 per conversation after the free tier
- **Utility** (transactional updates): ~$0.06 per conversation after free tier
- **Marketing** templates: ~$0.08 per conversation (we don't use these)

For a typical Egyptian SMB:
- 50 employees × 5 bot queries/month each = 250 conversations → all free
- 100 OTPs/month for login = 100 conversations → all free
- Total Meta cost: **0 EGP**

---

## 🔧 Troubleshooting

### "Recipient phone number not in allowed list"
- You're still in development mode. Either add the recipient to your test list (Step 11) OR submit your app for business verification (Step 14).

### "Template name does not exist"
- The template name in code (`nidham_otp`) doesn't match what's in Meta Business Manager. Either:
  - Rename the Meta template to exactly `nidham_otp`, OR
  - Edit `src/lib/whatsapp.ts` line ~165 and change the hardcoded template name

### "(#100) Param phone_number is required"
- The `WHATSAPP_PHONE_NUMBER_ID` env var isn't set. Check Vercel → Settings → Environment Variables.

### "(#190) Access token has expired"
- The temporary token from API Setup expired (24h). Generate a permanent System User token (Step 7).

### Bot replies sometimes but not always
- Vercel functions can be killed when a response returns. We use `after()` to extend the lifetime, but make sure your Vercel plan supports it (Hobby and Pro do).

### Cost is appearing on your Meta account
- You've exceeded the 1,000/month free tier OR you're using marketing templates. Check Meta Business Manager → Billing.

### Sender phone reports "This number cannot receive messages"
- The phone might still be associated with WhatsApp Business app. Uninstall the app from that SIM and try again.

### Webhook verification keeps failing
- Double-check the verify token matches EXACTLY (no leading/trailing spaces)
- Make sure Vercel was redeployed after you added the env var
- Try the curl from terminal: `curl 'https://www.nidhamhr.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123'` — should return `test123`

---

## 🎯 Alternative — Skip Meta entirely (use Twilio/MessageBird)

If Meta is too painful for now, we have the code abstracted in `src/lib/whatsapp.ts`. To swap in Twilio:

1. Sign up at https://twilio.com — they have a free trial
2. Enable WhatsApp Business via their console
3. Replace the body of `sendText()` and `sendTemplate()` in `whatsapp.ts` with Twilio's REST API calls
4. Change env vars to `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`

Twilio's WhatsApp is more expensive (~$0.05/msg) but the onboarding is simpler — no business verification required.

---

## ✅ Summary checklist

- [ ] Business account created on business.facebook.com
- [ ] WhatsApp Business Account (WABA) created
- [ ] Phone number registered + verified
- [ ] Meta App created with WhatsApp product added
- [ ] System User created with whatsapp_business_messaging scope
- [ ] Permanent Access Token generated (and saved securely)
- [ ] `nidham_otp` template created + approved
- [ ] 4 env vars set in Vercel + redeployed
- [ ] Webhook URL configured + verified
- [ ] Subscribed to `messages` field
- [ ] Test recipients added (up to 5 in dev mode)
- [ ] OTP curl test returns code in WhatsApp
- [ ] Bot replies to "مساعدة" from test phone

When all 13 are ticked, you're production-ready.

---

**Last updated: 2026-05-26 · For Meta Cloud API v18**
