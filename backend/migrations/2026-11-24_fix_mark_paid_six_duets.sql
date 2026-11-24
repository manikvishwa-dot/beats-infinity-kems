-- ==========================================================
-- BEATS INFINITY - FIX "MARK AS PAID" FOR 6-DUET PAYMENTS
-- ==========================================================
--
-- Symptom: clicking Mark as Paid leaves the payment Pending.
--
-- Cause: 2026-11-23_six_duets_optional_solo.sql taught
-- confirm_payment_and_submit_songs to accept 6 duets, but missed
-- the final check after the song requests are created:
--
--     IF v_request_count <> 5 THEN
--         RAISE EXCEPTION 'Exactly 5 song requests were expected, ...'
--
-- With 6 duets it creates 6 requests, sees 6 <> 5 and raises -
-- which rolls the whole confirmation back, so nothing changes.
--
-- This edits ONLY that check (plus, if present, the "5 songs"
-- wording of the success message), in place. If the check isn't
-- found exactly as above, the block stops with an error and
-- NOTHING is changed.
--
-- Run once in the Supabase SQL editor, then click Mark as Paid
-- again.
-- ==========================================================

do $migration$
declare
    def text;
    -- [find, replace, required?]
    edits text[][] := array[
        [
            $a$IF v_request_count <> 5 THEN$a$,
            $b$IF v_request_count <> cardinality(v_unique_song_ids) THEN$b$,
            'required'
        ],
        [
            $a$'Exactly 5 song requests were expected, but % were created.'$a$,
            $b$'Not every selected song got a song request (% created).'$b$,
            'required'
        ],
        [
            $a$'Payment confirmed and 5 songs submitted for pairing.'$a$,
            $b$'Payment confirmed and duet songs submitted for pairing.'$b$,
            'optional'
        ]
    ];
    i int;
begin

    def := pg_get_functiondef(
        'public.confirm_payment_and_submit_songs'::regproc
    );

    for i in 1 .. array_length(edits, 1) loop

        if position(edits[i][1] in def) = 0 then

            if edits[i][3] = 'required' then
                raise exception
                    'Function text not as expected - could not find: %. Nothing was changed.',
                    edits[i][1];
            end if;

            raise notice 'Skipped (not present): %', edits[i][1];
            continue;

        end if;

        def := replace(def, edits[i][1], edits[i][2]);

    end loop;

    execute def;

    raise notice 'confirm_payment_and_submit_songs fixed: Mark as Paid works for 6 duets.';

end
$migration$;
