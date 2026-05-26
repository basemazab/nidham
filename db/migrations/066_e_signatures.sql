-- ============================================================================
-- Migration 066 -- E-signature requests + captured signatures
-- ============================================================================
--
-- HR creates a signature request for any HR document (employment contract,
-- amendment, EOS settlement, NDA, etc.). The request gets a public token
-- — HR sends the URL https://nidhamhr.com/sign/<token> to the recipient
-- via WhatsApp / Email. Recipient signs on their phone (canvas pad), the
-- signature is stored as a base64 PNG with audit metadata (IP, UA, time).
--
-- Two tables:
--   signature_requests  — the document + recipient + status
--   signature_captures  — the actual signed image + audit trail
--
-- Status lifecycle:
--   pending  → signed | expired | cancelled
--   signed   → terminal (immutable, audit trail)
-- ============================================================================

create table if not exists public.signature_requests (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,

  -- Internal title HR sees in the list
  title             text not null,
  -- Optional FK to the employee being signed about (e.g. employment
  -- contract for a specific employee). Nullable so HR can also send to
  -- non-employees (vendors, candidates).
  employee_id       uuid references public.employees(id) on delete set null,

  -- The document body. HTML (sanitised on render). For MVP this is what
  -- the signer sees. Future: link to a PDF stored in Supabase Storage.
  document_html     text not null,

  -- Who's expected to sign
  recipient_name    text not null,
  recipient_phone   text,
  recipient_email   text,

  -- Public token used in /sign/<token> URL. Generated server-side
  -- with gen_random_uuid(); 36-char unguessable URL.
  token             uuid not null default gen_random_uuid() unique,

  status            text not null default 'pending'
                    check (status in ('pending', 'signed', 'expired', 'cancelled')),

  expires_at        timestamp with time zone,
  signed_at         timestamp with time zone,

  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamp with time zone default now() not null,
  updated_at        timestamp with time zone default now() not null
);

create table if not exists public.signature_captures (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.signature_requests(id) on delete cascade,

  -- The signer types their name to confirm + draws their signature
  signer_name     text not null,

  -- Base64-encoded PNG data URL ("data:image/png;base64,..."). Capped
  -- at ~500KB by application code; rejected if signer somehow sends
  -- larger payload.
  signature_png_data_url text not null,

  -- Audit trail
  signer_ip       inet,
  signer_user_agent text,

  signed_at       timestamp with time zone default now() not null
);

create index if not exists idx_sig_requests_company on public.signature_requests(company_id);
create index if not exists idx_sig_requests_token   on public.signature_requests(token);
create index if not exists idx_sig_requests_status  on public.signature_requests(company_id, status);
create index if not exists idx_sig_captures_request on public.signature_captures(request_id);

create trigger sig_requests_set_updated_at
  before update on public.signature_requests
  for each row execute function public.tg_set_updated_at();

-- ── RLS ──
alter table public.signature_requests enable row level security;
alter table public.signature_captures enable row level security;

-- HR / admin view + manage their own company's requests
create policy "view_sig_requests_in_own_company"
  on public.signature_requests for select
  using (company_id = public.current_company_id());

create policy "manage_sig_requests_in_own_company"
  on public.signature_requests for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Captures inherit company scoping via the FK to the parent request.
create policy "view_sig_captures_in_own_company"
  on public.signature_captures for select
  using (
    request_id in (
      select id from public.signature_requests
       where company_id = public.current_company_id()
    )
  );

-- ⚠ The PUBLIC signing endpoint uses the service-role client to
-- INSERT a capture row + UPDATE the parent request — bypasses RLS.
-- The route handler validates the token + checks request state.
-- Standard authenticated roles SHOULDN'T be able to insert captures
-- arbitrarily.
create policy "deny_anon_capture_writes"
  on public.signature_captures for insert
  with check (false);

notify pgrst, 'reload schema';
