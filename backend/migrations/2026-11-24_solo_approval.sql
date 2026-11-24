-- ==========================================================
-- BEATS INFINITY - SOLO APPROVAL
-- ==========================================================
--
-- A male singer's optional solo is never paired - the admin
-- approves (or rejects) it on Pairing Management instead. Only
-- approved solos appear on the singer's Song List.
--
-- songs.solo_status:
--   NULL       -> not decided yet (default)
--   'Approved' -> shown on the singer's Song List as Solo
--   'Rejected' -> not shown
--
-- Safe to run more than once. Adds a column only - no existing
-- data is changed.
--
-- Run once in the Supabase SQL editor.
-- ==========================================================

alter table public.songs
    add column if not exists solo_status text;

do $migration$
begin

    if not exists (
        select 1
        from pg_constraint
        where conname = 'songs_solo_status_check'
    ) then

        alter table public.songs
            add constraint songs_solo_status_check
            check (solo_status is null or solo_status in ('Approved', 'Rejected'));

    end if;

end
$migration$;
