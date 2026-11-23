-- ==========================================================
-- BEATS INFINITY - 6 DUETS + OPTIONAL SOLO (male singers)
-- ==========================================================
--
-- 1. payments.solo_song_id - the one optional solo song a male
--    singer may pick. Kept OUT of selected_song_ids on purpose,
--    so pairing (which reads selected_song_ids) never sees it.
--
-- 2. confirm_payment_and_submit_songs - the "Mark Paid" function
--    required exactly 5 songs. It now accepts 6 (new rule) or 5
--    (payments made before this change).
--
--    Only the four song-count lines are edited, in place. If any
--    of them doesn't match the live function exactly, the whole
--    block stops with an error and NOTHING is changed.
--
-- Run once in the Supabase SQL editor.
-- ==========================================================

alter table public.payments
    add column if not exists solo_song_id uuid
        references public.songs(id) on delete set null;


do $migration$
declare
    def text;
    edits text[][] := array[
        [
            $a$IF jsonb_array_length(v_payment.selected_song_ids) <> 5 THEN$a$,
            $b$IF jsonb_array_length(v_payment.selected_song_ids) NOT IN (5, 6) THEN$b$
        ],
        [
            $a$RAISE EXCEPTION 'Exactly 5 songs are required.';$a$,
            $b$RAISE EXCEPTION '6 duet songs are required.';$b$
        ],
        [
            $a$IF cardinality(v_unique_song_ids) <> 5 THEN$a$,
            $b$IF cardinality(v_unique_song_ids) <> jsonb_array_length(v_payment.selected_song_ids) THEN$b$
        ],
        [
            $a$RAISE EXCEPTION 'The 5 selected songs must be unique.';$a$,
            $b$RAISE EXCEPTION 'The selected songs must be unique.';$b$
        ],
        [
            $a$IF v_song_count <> 5 THEN$a$,
            $b$IF v_song_count <> cardinality(v_unique_song_ids) THEN$b$
        ],
        [
            $a$final 5-song selection submitted for pairing$a$,
            $b$final duet selection submitted for pairing$b$
        ]
    ];
    i int;
begin

    def := pg_get_functiondef(
        'public.confirm_payment_and_submit_songs'::regproc
    );

    for i in 1 .. array_length(edits, 1) loop

        if position(edits[i][1] in def) = 0 then
            raise exception
                'Function text not as expected - could not find: %. Nothing was changed.',
                edits[i][1];
        end if;

        def := replace(def, edits[i][1], edits[i][2]);

    end loop;

    execute def;

    raise notice 'confirm_payment_and_submit_songs updated: accepts 5 or 6 duet songs.';

end
$migration$;
