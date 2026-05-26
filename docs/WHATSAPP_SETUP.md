# WhatsApp Cloud API Setup Guide

This module enables WhatsApp for:
- **OTP delivery** (signup / login / 2FA) — `/api/otp/send` channel: `whatsapp`
- **Employee self-service bot** — `/api/whatsapp/webhook` (incoming messages)

## Cost

WhatsApp Cloud API is FREE for the first 1,000 conversations/month per phone number. After that:
- Authentication (OTP) templates: ~0.04 USD per conversation
- Marketing / utility templates: ~0.08 USD per conversation

This is much cheaper than Twilio SMS (~0.05 USD per SMS) for the same use case.

## Setup Steps

### 1. Create a Meta Business Account

Visit https://business.facebook.com — sign in with the Facebook account that owns the Nidham page.

Add a business if you don't already have one (use "نِظام / Nidham" as the business name).

### 2. Add a WhatsApp Business Account (WABA)

In Business Manager → Accounts → WhatsApp Accounts → "Add" → "Create a new WhatsApp Business Account".

Name it something like "Nidham OTP / Bot".

### 3. Add a Phone Number

Inside the WABA, click "Add phone number" and provide:
- The phone number you want to send from (NOT your existing WhatsApp Business app number — must be a fresh number, not already attached to the WA app)
- Display name (e.g., "Nidham")
- Verify via SMS or voice call

> **⚠️ Important**: once a phone is registered on Cloud API, it can't be used with the standalone WhatsApp Business app. Plan ahead — register a dedicated number.

### 4. Create an App + Add WhatsApp Product

In Meta for Developers → My Apps → Create App → "Business" type.

In the new app, click "Add Product" → WhatsApp → Set up.

Link the WABA you created in step 2.

### 5. Get the Credentials

From the WhatsApp → API Setup screen, copy:
- **Phone Number ID** (under your phone number)
- **Access Token** — the *temporary* one is fine for testing, but for production you MUST generate a System User token that doesn't expire:
  - Business Manager → Settings → System Users → Create
  - Assign the WABA + give "Manage WhatsApp Business Account" permission
  - Generate token with `whatsapp_business_messaging` scope

### 6. Set the Vercel Environment Variables

Go to your Vercel project → Settings → Environment Variables. Add:

```
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxx     (System User token)
WHATSAPP_PHONE_NUMBER_ID=1234567890123456       (from step 5)
WHATSAPP_VERIFY_TOKEN=pick_any_long_random_string
```

Redeploy after adding.

### 7. Create the OTP Template

WhatsApp requires templates for messages OUTSIDE the 24-hour customer service window. Without a template, you can only reply within 24h of the user messaging you first.

In Business Manager → WhatsApp Accounts → Message Templates → New Template:

- **Name**: `nidham_otp`
- **Category**: Authentication
- **Language**: Arabic
- **Body**:
  ```
  كود التحقق الخاص بك في نِظام هو: {{1}}
  صالح لمدة 10 دقائق. لا تشاركه مع أي شخص.
  ```

Submit for review — Meta usually approves authentication templates within minutes.

### 8. (For the Bot) Configure the Webhook

In Meta for Developers → WhatsApp → Configuration → Webhook:

- **Callback URL**: `https://www.nidhamhr.com/api/whatsapp/webhook`
- **Verify Token**: must match `WHATSAPP_VERIFY_TOKEN` from step 6

Click "Verify and Save". Meta will hit the URL with a GET to confirm.

Then subscribe to the `messages` field — that's the one that fires when employees send your bot a message.

## Testing

After setup, test the OTP flow with a CURL:

```bash
curl -X POST https://www.nidhamhr.com/api/otp/send \
  -H "Content-Type: application/json" \
  -d '{"identifier":"01055356622","channel":"whatsapp","purpose":"verify"}'
```

You should receive a 6-digit code on the target WhatsApp number within seconds.

Verify it:

```bash
curl -X POST https://www.nidhamhr.com/api/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"identifier":"01055356622","purpose":"verify","code":"123456"}'
```

## Troubleshooting

- **"Recipient phone number not in allowed list"** — In dev mode, you can only message phone numbers you've explicitly added to the recipient list. Add up to 5 test numbers in API Setup.
- **"Template name does not exist"** — The template `nidham_otp` isn't approved yet. Wait or check rejection reason.
- **"Authentication failed"** — Access token is expired (24h for temp tokens). Generate a System User token instead.
- **Falls back to text and works for SOME users but not others** — Free-form text only works if the user messaged your business in the last 24h. Use templates for first contact.

## What if I can't / don't want to set up WhatsApp Cloud API?

The OTP layer falls back to email automatically if WhatsApp isn't configured. Set `EMAIL_FROM` + integrate Resend/SES in `src/lib/otp.ts` (search for "Resend/SES").

The bot won't work without Cloud API — the webhook needs Meta's incoming events.
