#!/usr/bin/env node
// ============================================================================
// generate-keys.mjs
//
// Run ONCE at install time. Generates:
//   • POSTGRES_PASSWORD — a random 32-char alphanumeric password
//   • JWT_SECRET        — a random 48-char alphanumeric secret
//   • ANON_KEY          — a JWT signed with JWT_SECRET, role=anon
//   • SERVICE_ROLE_KEY  — a JWT signed with JWT_SECRET, role=service_role
//
// Writes them to ../.env (creating it from .env.example if missing).
// Re-running won't overwrite existing keys unless --force is passed.
//
// Usage:
//   node enterprise/scripts/generate-keys.mjs           # generate if missing
//   node enterprise/scripts/generate-keys.mjs --force   # regenerate everything
// ============================================================================

import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "../.env");
const ENV_EXAMPLE_PATH = resolve(__dirname, "../.env.example");

const FORCE = process.argv.includes("--force");

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function randomAlphanumeric(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

/**
 * Mint an HS256 JWT compatible with Supabase GoTrue + PostgREST.
 * Note: exp is 10 years from now — these keys are long-lived for the
 * Enterprise install; rotate by re-running with --force when needed.
 */
function signSupabaseJwt(role, secret) {
  const now = Math.floor(Date.now() / 1000);
  const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    role,
    iss: "supabase",
    iat: now,
    exp: now + TEN_YEARS,
  };

  const h = base64UrlEncode(JSON.stringify(header));
  const p = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(
    createHmac("sha256", secret).update(`${h}.${p}`).digest(),
  );

  return `${h}.${p}.${signature}`;
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function stringifyEnv(map, originalText) {
  // Preserve comments + ordering when we can
  if (originalText) {
    return originalText
      .split(/\r?\n/)
      .map((line) => {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=/);
        if (m && Object.prototype.hasOwnProperty.call(map, m[1])) {
          return `${m[1]}=${map[m[1]]}`;
        }
        return line;
      })
      .join("\n");
  }
  return (
    Object.entries(map)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n"
  );
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

if (!existsSync(ENV_PATH)) {
  if (!existsSync(ENV_EXAMPLE_PATH)) {
    console.error("✖ .env.example missing — repo is incomplete");
    process.exit(1);
  }
  copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
  console.log("→ Created .env from .env.example");
}

const original = readFileSync(ENV_PATH, "utf8");
const env = parseEnv(original);

// Decide which keys we need to (re)generate
const needsPostgres = FORCE || !env.POSTGRES_PASSWORD || env.POSTGRES_PASSWORD === "change-me";
const needsJwt = FORCE || !env.JWT_SECRET || env.JWT_SECRET === "change-me";

if (!needsPostgres && !needsJwt && env.ANON_KEY && env.SERVICE_ROLE_KEY) {
  console.log("✓ Keys already present in .env — pass --force to regenerate.");
  process.exit(0);
}

if (needsPostgres) {
  env.POSTGRES_PASSWORD = randomAlphanumeric(32);
  console.log("→ POSTGRES_PASSWORD generated");
}

if (needsJwt || FORCE) {
  env.JWT_SECRET = randomAlphanumeric(48);
  console.log("→ JWT_SECRET generated");
}

// Anon + service role are always re-derived when JWT_SECRET changes
env.ANON_KEY = signSupabaseJwt("anon", env.JWT_SECRET);
env.SERVICE_ROLE_KEY = signSupabaseJwt("service_role", env.JWT_SECRET);
console.log("→ ANON_KEY and SERVICE_ROLE_KEY signed");

writeFileSync(ENV_PATH, stringifyEnv(env, original));
console.log(`\n✓ Updated ${ENV_PATH}`);
console.log("\nNext step:  docker compose up -d");
