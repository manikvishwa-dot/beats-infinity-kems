-- ==========================================================
-- BEATS INFINITY - FINAL LIST "COMPLETED" TICKS
-- ==========================================================
--
-- On the event day the admin ticks each song on the Final
-- Pairing List once it has been sung; the row turns green.
-- One row here per ticked song, keyed by the list row's ref
-- ("pairing:<pairing id>" or "solo:<song id>").
--
-- New table only - no existing data is changed. Safe to run
-- more than once.
--
-- Run once in the Supabase SQL editor.
-- ==========================================================

create table if not exists public.final_list_progress (
    id            uuid primary key default gen_random_uuid(),
    event_id      uuid not null references public.events(id) on delete cascade,
    row_ref       text not null,
    completed_at  timestamptz not null default now(),
    completed_by  text,
    unique (event_id, row_ref)
);

-- Backend uses the service-role key, which bypasses RLS. Enabling
-- RLS with no policies keeps the table closed to the public API.
alter table public.final_list_progress enable row level security;
