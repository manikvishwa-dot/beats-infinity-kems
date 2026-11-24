-- ==========================================================
-- BEATS INFINITY - FINAL PAIRING LIST + CHANGE LOG
-- ==========================================================
--
-- 1. songs.solo_singer_id
--    Lets an admin make any row on the Final List a solo for
--    any singer (last-minute changes), even when it wasn't one
--    of that singer's own picks.
--
-- 2. public.pairing_change_log
--    Every edit an admin saves on the Final List (add / remove /
--    change, duet or solo) is recorded with the before and after
--    values, the admin and the time - for future reports.
--    Pairings themselves are never deleted: removed or replaced
--    ones are kept with status 'Rejected'.
--
-- Safe to run more than once. Adds a column and a table only -
-- no existing data is changed.
--
-- Run once in the Supabase SQL editor.
-- ==========================================================

alter table public.songs
    add column if not exists solo_singer_id uuid references public.singers(id);

create index if not exists songs_solo_singer_id_idx
    on public.songs (solo_singer_id)
    where solo_singer_id is not null;


create table if not exists public.pairing_change_log (

    id uuid primary key default gen_random_uuid(),

    event_id uuid references public.events(id),

    -- 'added' | 'removed' | 'changed'
    action text not null,

    -- 'duet' | 'solo' (after the change; before for 'removed')
    kind text not null,

    -- { male_singer, female_singer, song, movie } - names kept as
    -- text so the log still reads correctly if a row is renamed
    before_value jsonb,
    after_value jsonb,

    pairing_id uuid references public.pairings(id) on delete set null,
    song_id uuid references public.songs(id) on delete set null,

    changed_by uuid references public.admin_users(id) on delete set null,
    changed_by_name text,

    created_at timestamptz not null default now()

);

create index if not exists pairing_change_log_event_idx
    on public.pairing_change_log (event_id, created_at desc);

-- Only the backend (service role) touches this table.
alter table public.pairing_change_log enable row level security;
