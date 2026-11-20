-- ==========================================================
-- BEATS INFINITY - SINGER PASSKEYS (Fingerprint / Face ID login)
-- ==========================================================
--
-- One row per device a singer has enabled biometric login on.
-- Stores only the device's PUBLIC key - the fingerprint / face
-- data never leaves the singer's phone.
--
-- Run once in the Supabase SQL editor.
-- ==========================================================

create table if not exists public.singer_passkeys (
    id             uuid primary key default gen_random_uuid(),
    singer_id      uuid not null references public.singers(id) on delete cascade,
    credential_id  text not null unique,
    public_key     text not null,
    counter        bigint not null default 0,
    transports     text[],
    device_label   text,
    created_at     timestamptz not null default now(),
    last_used_at   timestamptz
);

create index if not exists singer_passkeys_singer_id_idx
    on public.singer_passkeys (singer_id);

-- Backend uses the service-role key, which bypasses RLS. Enabling
-- RLS with no policies keeps the table closed to the anon key.
alter table public.singer_passkeys enable row level security;
