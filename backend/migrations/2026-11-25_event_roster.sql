-- ==========================================================
-- BEATS INFINITY - EVENT ROSTER (event_singers)
-- ==========================================================
--
-- Which singers take part in an event, independent of online
-- registration/payment. Used by the Final Pairing List:
--   - its singer dropdowns list only this event's singers
--     (registered + roster + already on the list)
--   - "+ Add a singer" puts a last-minute walk-in on the roster
--
-- Same table as 2026-10-05_event_singers.sql, which was never
-- run on this database. Safe to run more than once - creates the
-- table only if it doesn't exist; no existing data is changed.
--
-- Run once in the Supabase SQL editor.
-- ==========================================================

create table if not exists public.event_singers (
    id          uuid primary key default gen_random_uuid(),
    event_id    uuid not null references public.events(id) on delete cascade,
    singer_id   uuid not null references public.singers(id) on delete cascade,
    source      text not null default 'import',
    created_at  timestamptz not null default now(),
    unique (event_id, singer_id)
);

create index if not exists event_singers_singer_id_idx
    on public.event_singers (singer_id);

-- Backend uses the service-role key, which bypasses RLS. Enabling
-- RLS with no policies keeps the table closed to the anon key.
alter table public.event_singers enable row level security;
