const { supabase } = require("../../config/supabase");
const { getActiveEventId } = require("../../utils/activeEvent");

// ==========================================================
// BEATS INFINITY - PAIRING CONTROLLER
// ==========================================================
//
// RULE: two singers of the SAME gender must never be paired
// for the same song. A pairing is always one Male + one
// Female singer who both selected the same song.
//
// "Potential Match" pairs are COMPUTED on demand from the
// latest payment per singer (selected_song_ids) - they are
// NOT stored until an admin approves or rejects them. Only
// decided pairings live in public.pairings.
// ==========================================================


const isValidUuid = value =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(value);


// ==========================================================
// NORMALIZE TITLE
//
// IMPORTANT:
//
// The frontend creates a NEW songs row every time a singer
// selects a song from search results - there is no dedup by
// title. Two different singers who both pick "the same song"
// almost always end up with two DIFFERENT song_id UUIDs that
// share a title. Matching must therefore key on normalized
// title, not song_id.
// ==========================================================

const normalizeTitle = value =>
    String(value || "").trim().toLowerCase();


// ==========================================================
// SOLO SONGS
//
// A solo is never paired - an admin approves (or rejects) it
// instead, and only approved solos appear on the singer's Song
// List.
//
// A song counts as a solo when it is:
//   - in the payment's solo slot (payments.solo_song_id), or
//   - marked song_type "Solo" AND picked on/after the day the
//     solo option shipped. Older "Solo" labels came from the
//     old YouTube search (it marked most picks is_duet=false)
//     and are really duets - many already have pairings, or
//   - assigned to a singer by an admin on the Final List
//     (songs.solo_singer_id) - that singer owns it, whether or
//     not it was one of their own picks.
// ==========================================================

const SOLO_FEATURE_START = "2026-11-23";

const isSoloSong = (song, soloSlotIds) =>
    Boolean(song) && (
        soloSlotIds.has(song.id) ||
        (
            song.song_type === "Solo" &&
            String(song.created_at || "") >= SOLO_FEATURE_START
        )
    );

// songs.solo_status / songs.solo_singer_id are added by migrations -
// until they have been run, read songs without them.
const SONG_COLUMNS = "id,title,movie,event_id,song_type,created_at";

const SONG_COLUMN_SETS = [
    `${SONG_COLUMNS},solo_status,solo_singer_id`,
    `${SONG_COLUMNS},solo_status`,
    SONG_COLUMNS
];

const isMissingColumnError = error =>
    /solo_status|solo_singer_id|column/i.test(error?.message || "");

// build(columns) -> supabase query. Tries the richest column set
// first and falls back while a column doesn't exist yet.
const selectSongsSafe = async build => {

    let lastError = null;

    for (const columns of SONG_COLUMN_SETS) {

        const { data, error } = await build(columns);

        if (!error) {
            return data || [];
        }

        if (!isMissingColumnError(error)) {
            throw error;
        }

        lastError = error;

    }

    throw lastError;

};

const fetchSongRows = ids =>
    selectSongsSafe(columns =>
        supabase.from("songs").select(columns).in("id", ids)
    );

// Admin-assigned solos (songs.solo_singer_id) - [] until the
// column exists.
const fetchAssignedSolos = async eventId => {

    try {

        let query = supabase
            .from("songs")
            .select(`${SONG_COLUMNS},solo_status,solo_singer_id`)
            .not("solo_singer_id", "is", null);

        if (eventId) {
            query = query.eq("event_id", eventId);
        }

        const { data, error } = await query;

        if (error) {
            if (isMissingColumnError(error)) {
                return [];
            }
            throw error;
        }

        return data || [];

    }
    catch (error) {

        if (isMissingColumnError(error)) {
            return [];
        }

        throw error;

    }

};


// ==========================================================
// SHARED: LATEST PAYMENT PER SINGER, WITH SINGER + SONG INFO
//
// selectionsBySinger: singerId -> [{ song_id, title }]  DUETS only
// solosBySinger:      singerId -> [{ song_id, title, movie,
//                                    solo_status }]
// ==========================================================

const loadSingerSongMap = async (eventId = null) => {

    let paymentsQuery = supabase
        .from("payments")
        .select("singer_id,selected_song_ids,solo_song_id,created_at")
        // Walk-in payments only mirror songs already placed on the
        // Final List - they aren't picks waiting to be paired.
        .or("payment_type.is.null,payment_type.neq.Walk-in")
        .order("created_at", { ascending: false });

    if (eventId) {
        paymentsQuery = paymentsQuery.eq("event_id", eventId);
    }

    const {
        data: payments,
        error: paymentsError
    } = await paymentsQuery;

    if (paymentsError) {
        throw paymentsError;
    }

    // Latest payment per singer
    const latestBySinger = new Map();

    (payments || []).forEach(payment => {
        if (!latestBySinger.has(payment.singer_id)) {
            latestBySinger.set(payment.singer_id, {
                songIds: Array.isArray(payment.selected_song_ids)
                    ? payment.selected_song_ids
                    : [],
                soloSongId: payment.solo_song_id || null
            });
        }
    });

    const soloSlotIds = new Set(
        [...latestBySinger.values()]
            .map(entry => entry.soloSongId)
            .filter(Boolean)
    );

    const allSongIds = [
        ...new Set(
            [...latestBySinger.values()].flatMap(entry =>
                [...entry.songIds, entry.soloSongId].filter(Boolean)
            )
        )
    ];

    const [songs, assignedSolos] = await Promise.all([
        allSongIds.length > 0 ? fetchSongRows(allSongIds) : [],
        fetchAssignedSolos(eventId)
    ]);

    const songMap = new Map(songs.map(song => [song.id, song]));

    assignedSolos.forEach(song => songMap.set(song.id, song));

    const assignedIds = new Set(assignedSolos.map(song => song.id));

    const selectionsBySinger = new Map();
    const solosBySinger = new Map();

    const soloEntry = song => ({
        song_id: song.id,
        title: song.title || null,
        movie: song.movie || null,
        solo_status: song.solo_status || null
    });

    latestBySinger.forEach(({ songIds, soloSongId }, singerId) => {

        const ids = [...new Set([...songIds, soloSongId].filter(Boolean))];

        const duets = [];
        const solos = [];

        ids.forEach(songId => {

            const song = songMap.get(songId);

            // Assigned solos are attached to their assigned singer below.
            if (assignedIds.has(songId)) {
                return;
            }

            if (isSoloSong(song, soloSlotIds)) {
                solos.push(soloEntry(song));
            }
            else if (songIds.includes(songId)) {
                duets.push({
                    song_id: songId,
                    title: song?.title || null
                });
            }

        });

        selectionsBySinger.set(singerId, duets);
        solosBySinger.set(singerId, solos);

    });

    assignedSolos.forEach(song => {
        if (!solosBySinger.has(song.solo_singer_id)) {
            solosBySinger.set(song.solo_singer_id, []);
        }
        solosBySinger.get(song.solo_singer_id).push(soloEntry(song));
    });

    const singerIds = [
        ...new Set([...latestBySinger.keys(), ...solosBySinger.keys()])
    ];

    let singers = [];

    if (singerIds.length > 0) {

        const {
            data: singerRows,
            error: singersError
        } = await supabase
            .from("singers")
            .select("id,singer_name,gender")
            .in("id", singerIds);

        if (singersError) {
            throw singersError;
        }

        singers = singerRows || [];

    }

    return {
        singers,
        songMap,
        selectionsBySinger,
        solosBySinger
    };

};


// ==========================================================
// GET PAIRING SUGGESTIONS
//
// GET /api/v1/admin/pairings/suggestions
// ==========================================================

const getSuggestions = async (req, res) => {

    try {

        // Potential Matches / Open Songs / Manual Pairing are a
        // live matching engine - it only ever operates on ONE
        // event at a time (matching across different events would
        // be meaningless), so it uses just the first selected
        // event. The Pairing Report below, being a plain listing,
        // supports comparing all of them (up to 3) side by side.
        const eventIds = (req.query.event_id || "")
            .split(",")
            .map(value => value.trim())
            .filter(Boolean);

        const primaryEventId = eventIds[0] || null;

        const {
            singers,
            songMap,
            selectionsBySinger,
            solosBySinger
        } = await loadSingerSongMap(primaryEventId);


        const singerById =
            new Map(
                singers.map(
                    singer => [singer.id, singer]
                )
            );


        // ----------------------------------------------------
        // SOLO SONGS - approved/rejected by the admin, never
        // paired (selectionsBySinger already excludes them).
        // ----------------------------------------------------

        const soloSongs = [];

        solosBySinger.forEach((solos, singerId) => {

            const singer = singerById.get(singerId);

            solos.forEach(solo => {
                soloSongs.push({
                    song_id: solo.song_id,
                    song_title: solo.title || "Unknown Song",
                    movie: solo.movie,
                    singer_id: singerId,
                    singer_name: singer?.singer_name || "Unknown Singer",
                    gender: singer?.gender || null,
                    solo_status: solo.solo_status || "Pending"
                });
            });

        });

        soloSongs.sort((a, b) =>
            a.singer_name.localeCompare(b.singer_name) ||
            a.song_title.localeCompare(b.song_title)
        );


        // ----------------------------------------------------
        // GROUP SINGERS BY NORMALIZED SONG TITLE + GENDER
        //
        // Each entry keeps the singer's OWN song_id for that
        // title, since that's what gets stored as the FK when
        // a pairing is decided.
        // ----------------------------------------------------

        const maleByTitle =
            new Map();

        const femaleByTitle =
            new Map();


        selectionsBySinger.forEach(

            (selections, singerId) => {

                const singer =
                    singerById.get(singerId);


                if (!singer) {

                    return;

                }


                const gender =
                    String(
                        singer.gender || ""
                    ).trim().toLowerCase();


                selections.forEach(
                    ({ song_id, title }) => {

                        if (!title) {

                            return;

                        }


                        const normalizedTitle =
                            normalizeTitle(title);


                        const entry =
                            { singerId, songId: song_id };


                        if (gender === "male") {

                            if (!maleByTitle.has(normalizedTitle)) {

                                maleByTitle.set(normalizedTitle, []);

                            }

                            maleByTitle.get(normalizedTitle).push(entry);

                        }

                        else if (gender === "female") {

                            if (!femaleByTitle.has(normalizedTitle)) {

                                femaleByTitle.set(normalizedTitle, []);

                            }

                            femaleByTitle.get(normalizedTitle).push(entry);

                        }

                    }
                );

            }

        );


        // ----------------------------------------------------
        // BUILD ALL CANDIDATE PAIRS
        //
        // The male singer's own song_id for this title becomes
        // the candidate's canonical song_id (arbitrary but
        // consistent choice, used as the FK on approval).
        // ----------------------------------------------------

        const candidates =
            [];


        maleByTitle.forEach(
            (maleEntries, normalizedTitle) => {

                const femaleEntries =
                    femaleByTitle.get(normalizedTitle) || [];


                maleEntries.forEach(
                    maleEntry => {

                        femaleEntries.forEach(
                            femaleEntry => {

                                candidates.push({
                                    song_id: maleEntry.songId,
                                    male_singer_id: maleEntry.singerId,
                                    female_singer_id: femaleEntry.singerId
                                });

                            }
                        );

                    }
                );

            }
        );


        // ----------------------------------------------------
        // EXCLUDE ALREADY-DECIDED COMBOS
        // ----------------------------------------------------

        let decidedQuery = supabase

            .from("pairings")

            .select(
                "id,song_id,male_singer_id,female_singer_id,status,source,created_at,event_id"
            )

            .order(
                "created_at",
                { ascending: false }
            );

        if (eventIds.length > 0) {

            decidedQuery = decidedQuery.in("event_id", eventIds);

        }

        const {
            data: decided,
            error: decidedError
        } = await decidedQuery;


        if (decidedError) {

            console.error(
                "PAIRING SUGGESTIONS - DECIDED:",
                decidedError
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to load existing pairings.",

                error:
                    decidedError.message

            });

        }


        const decidedKeys =
            new Set(

                (decided || []).map(
                    row =>
                        `${row.song_id}:${row.male_singer_id}:${row.female_singer_id}`
                )

            );


        const potential =
            candidates

                .filter(
                    candidate =>
                        !decidedKeys.has(
                            `${candidate.song_id}:${candidate.male_singer_id}:${candidate.female_singer_id}`
                        )
                )

                .map(
                    candidate => ({

                        song_id:
                            candidate.song_id,

                        song_title:
                            songMap.get(candidate.song_id)?.title ||
                            "Unknown Song",

                        male_singer_id:
                            candidate.male_singer_id,

                        male_singer_name:
                            singerById.get(candidate.male_singer_id)?.singer_name ||
                            "Unknown Singer",

                        female_singer_id:
                            candidate.female_singer_id,

                        female_singer_name:
                            singerById.get(candidate.female_singer_id)?.singer_name ||
                            "Unknown Singer",

                        status:
                            "Potential Match",

                        event_id:
                            songMap.get(candidate.song_id)?.event_id || null

                    })

                );


        // ------------------------------------------------------
        // RESOLVE NAMES FOR THE REPORT INDEPENDENTLY
        //
        // songMap/singerById above are scoped to just the primary
        // event (the live matching engine). In multi-event compare
        // mode, `decided` can include rows from OTHER selected
        // events too, whose songs/singers won't be in those maps -
        // top up with a direct lookup so the report never shows
        // "Unknown Song"/"Unknown Singer" for a valid past event.
        // ------------------------------------------------------

        const reportSongMap = new Map(songMap);
        const reportSingerMap = new Map(singerById);

        const missingSongIds = [
            ...new Set((decided || []).map(row => row.song_id))
        ].filter(id => id && !reportSongMap.has(id));

        if (missingSongIds.length > 0) {

            const { data: extraSongs } = await supabase
                .from("songs")
                .select("id,title,movie,event_id")
                .in("id", missingSongIds);

            (extraSongs || []).forEach(song => reportSongMap.set(song.id, song));

        }

        const missingSingerIds = [
            ...new Set(
                (decided || []).flatMap(row => [row.male_singer_id, row.female_singer_id])
            )
        ].filter(id => id && !reportSingerMap.has(id));

        if (missingSingerIds.length > 0) {

            const { data: extraSingers } = await supabase
                .from("singers")
                .select("id,singer_name,gender")
                .in("id", missingSingerIds);

            (extraSingers || []).forEach(singer => reportSingerMap.set(singer.id, singer));

        }

        const eventNameById = new Map();

        const allReportEventIds = [
            ...new Set([
                ...(decided || []).map(row => row.event_id),
                ...potential.map(row => row.event_id)
            ].filter(Boolean))
        ];

        if (allReportEventIds.length > 0) {

            const { data: eventRows } = await supabase
                .from("events")
                .select("id,name")
                .in("id", allReportEventIds);

            (eventRows || []).forEach(event => eventNameById.set(event.id, event.name));

        }

        // Potential Matches now carry the ACTUAL event the underlying
        // song selection belongs to (not just "the event currently
        // being viewed") - this is what surfaces data that's scoped
        // to the wrong event instead of hiding it. Open Songs get the
        // same treatment further down, once that list exists.
        potential.forEach(row => {
            row.event_name = eventNameById.get(row.event_id) || "—";
        });


        const existingPairings =
            (decided || []).map(
                row => ({

                    id:
                        row.id,

                    song_id:
                        row.song_id,

                    song_title:
                        reportSongMap.get(row.song_id)?.title ||
                        "Unknown Song",

                    male_singer_id:
                        row.male_singer_id,

                    male_singer_name:
                        reportSingerMap.get(row.male_singer_id)?.singer_name ||
                        "Unknown Singer",

                    female_singer_id:
                        row.female_singer_id,

                    female_singer_name:
                        reportSingerMap.get(row.female_singer_id)?.singer_name ||
                        "Unknown Singer",

                    status:
                        row.status,

                    source:
                        row.source,

                    created_at:
                        row.created_at,

                    event_id:
                        row.event_id || null,

                    event_name:
                        eventNameById.get(row.event_id) || "—"

                })
            );


        // ----------------------------------------------------
        // OPEN SONGS
        //
        // A singer's song is "open" if it has neither a live
        // potential match nor an Approved pairing right now -
        // it needs a manual decision. Rejected candidates are
        // NOT considered covered, so the song correctly stays
        // open for a fresh manual pairing.
        // ----------------------------------------------------

        const coveredKeys =
            new Set();


        potential.forEach(
            candidate => {

                const normalizedTitle =
                    normalizeTitle(candidate.song_title);


                coveredKeys.add(
                    `${candidate.male_singer_id}:${normalizedTitle}`
                );

                coveredKeys.add(
                    `${candidate.female_singer_id}:${normalizedTitle}`
                );

            }
        );


        existingPairings

            .filter(
                pairing =>
                    pairing.status === "Approved"
            )

            .forEach(
                pairing => {

                    const normalizedTitle =
                        normalizeTitle(pairing.song_title);


                    coveredKeys.add(
                        `${pairing.male_singer_id}:${normalizedTitle}`
                    );

                    coveredKeys.add(
                        `${pairing.female_singer_id}:${normalizedTitle}`
                    );

                }
            );


        const openSongs =
            [];


        selectionsBySinger.forEach(

            (selections, singerId) => {

                const singer =
                    singerById.get(singerId);


                if (!singer) {

                    return;

                }


                const gender =
                    String(
                        singer.gender || ""
                    ).trim().toLowerCase();


                if (
                    gender !== "male" &&
                    gender !== "female"
                ) {

                    return;

                }


                selections.forEach(
                    ({ song_id, title }) => {

                        if (!title) {

                            return;

                        }


                        const normalizedTitle =
                            normalizeTitle(title);

                        const key =
                            `${singerId}:${normalizedTitle}`;


                        if (coveredKeys.has(key)) {

                            return;

                        }


                        openSongs.push({

                            song_id,

                            song_title:
                                title,

                            singer_id:
                                singerId,

                            singer_name:
                                singer.singer_name,

                            gender:
                                singer.gender,

                            event_id:
                                songMap.get(song_id)?.event_id || null

                        });

                    }
                );

            }

        );


        openSongs.sort(
            (a, b) =>
                a.song_title.localeCompare(b.song_title)
        );

        const missingOpenSongEventIds = [
            ...new Set(openSongs.map(row => row.event_id))
        ].filter(id => id && !eventNameById.has(id));

        if (missingOpenSongEventIds.length > 0) {

            const { data: extraEventRows } = await supabase
                .from("events")
                .select("id,name")
                .in("id", missingOpenSongEventIds);

            (extraEventRows || []).forEach(event => eventNameById.set(event.id, event.name));

        }

        openSongs.forEach(row => {
            row.event_name = eventNameById.get(row.event_id) || "—";
        });


        return res.status(200).json({

            success: true,

            potential_matches:
                potential,

            existing_pairings:
                existingPairings,

            open_songs:
                openSongs,

            solo_songs:
                soloSongs

        });

    }

    catch (error) {

        console.error(
            "GET SUGGESTIONS EXCEPTION:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Internal server error.",

            error:
                error.message

        });

    }

};


// ==========================================================
// DECIDE A PAIRING (approve or reject)
//
// Covers both:
//   - Acting on a computed suggestion (not yet stored)
//   - Manual pairing (admin picks singer1, singer2, song)
//
// POST /api/v1/admin/pairings/decide
//
// Body:
// {
//     "song_id": "...",
//     "male_singer_id": "...",
//     "female_singer_id": "...",
//     "decision": "Approved" | "Rejected",
//     "source": "auto" | "manual"
// }
// ==========================================================

const httpError = (status, message, cause) => {

    const error = new Error(message);
    error.status = status;
    if (cause) {
        error.cause = cause;
    }
    return error;

};


// ==========================================================
// APPLY A SINGLE PAIRING DECISION
//
// Shared core used by both the single decidePairing endpoint
// and the bulk (Excel import) endpoint - throws an Error with
// a `.status` on any validation/write failure so callers can
// translate it to a per-row or per-request response.
// ==========================================================

const applyPairingDecision = async ({
    song_id,
    male_singer_id,
    female_singer_id,
    decision,
    source,
    adminId
}) => {

    if (
        !isValidUuid(song_id) ||
        !isValidUuid(male_singer_id) ||
        !isValidUuid(female_singer_id)
    ) {

        throw httpError(400, "song_id, male_singer_id and female_singer_id must be valid UUIDs.");

    }

    if (male_singer_id === female_singer_id) {

        throw httpError(400, "The two singers must be different.");

    }

    if (!["Approved", "Rejected"].includes(decision)) {

        throw httpError(400, "decision must be 'Approved' or 'Rejected'.");

    }

    const pairingSource = source === "manual" ? "manual" : "auto";


    // ----------------------------------------------------
    // VALIDATE GENDERS
    // ----------------------------------------------------

    const {
        data: bothSingers,
        error: singersError
    } = await supabase
        .from("singers")
        .select("id,singer_name,gender")
        .in("id", [male_singer_id, female_singer_id]);

    if (singersError) {

        throw httpError(500, "Unable to validate singers.", singersError);

    }

    if (!bothSingers || bothSingers.length !== 2) {

        throw httpError(404, "One or both singers could not be found.");

    }

    const maleRecord = bothSingers.find(singer => singer.id === male_singer_id);
    const femaleRecord = bothSingers.find(singer => singer.id === female_singer_id);

    const normalizeGender = value => String(value || "").trim().toLowerCase();

    if (
        normalizeGender(maleRecord?.gender) !== "male" ||
        normalizeGender(femaleRecord?.gender) !== "female"
    ) {

        throw httpError(400, "Two singers of the same gender cannot be paired for the same song.");

    }


    // ----------------------------------------------------
    // MANUAL PAIRING - VALIDATE SONG BELONGS TO AT LEAST
    // ONE OF THE TWO SINGERS
    //
    // Matched by normalized TITLE, not exact song_id - the
    // two singers almost certainly have different song_id
    // rows for what is nonetheless "the same song".
    //
    // IMPORTANT:
    //
    // Only ONE side needs to actually own the song - this
    // is what lets an admin manually assign a partner to
    // an "open" (unmatched) song, where the partner never
    // selected that title themselves. If BOTH happen to
    // own it (the common case from the general manual
    // pairing form), that trivially satisfies this too.
    // ----------------------------------------------------

    // The song's own event - used to check the manual pairing
    // against THAT event's selections, and stamped on the pairing.
    const { data: songRow } = await supabase
        .from("songs")
        .select("event_id")
        .eq("id", song_id)
        .maybeSingle();

    const eventId = songRow?.event_id || null;

    if (pairingSource === "manual") {

        const { selectionsBySinger, songMap } = await loadSingerSongMap(eventId);

        const maleSelections = selectionsBySinger.get(male_singer_id) || [];
        const femaleSelections = selectionsBySinger.get(female_singer_id) || [];

        const targetTitle = normalizeTitle(songMap.get(song_id)?.title);

        const maleHasTitle =
            targetTitle &&
            maleSelections.some(selection => normalizeTitle(selection.title) === targetTitle);

        const femaleHasTitle =
            targetTitle &&
            femaleSelections.some(selection => normalizeTitle(selection.title) === targetTitle);

        if (!maleHasTitle && !femaleHasTitle) {

            throw httpError(400, "The selected song must belong to at least one of the two singers.");

        }

    }


    // ----------------------------------------------------
    // INSERT DECISION
    //
    // The UNIQUE constraint on (song_id, male_singer_id,
    // female_singer_id) prevents duplicate decisions for
    // the same combination.
    // ----------------------------------------------------

    // Stamped from the song's own event_id (looked up above) - a
    // pairing belongs to whichever event the singer's selection was
    // actually made under, regardless of which event happens to be
    // active right now when the admin gets around to deciding it.
    const { data: existing } = await supabase
        .from("pairings")
        .select("id")
        .eq("song_id", song_id)
        .eq("male_singer_id", male_singer_id)
        .eq("female_singer_id", female_singer_id)
        .maybeSingle();

    let result;
    let resultError;

    if (existing) {

        ({ data: result, error: resultError } = await supabase
            .from("pairings")
            .update({
                status: decision,
                source: pairingSource,
                approved_by: decision === "Approved" ? adminId || null : null,
                event_id: eventId,
                updated_at: new Date().toISOString()
            })
            .eq("id", existing.id)
            .select("*")
            .single());

    }
    else {

        ({ data: result, error: resultError } = await supabase
            .from("pairings")
            .insert({
                song_id,
                male_singer_id,
                female_singer_id,
                status: decision,
                source: pairingSource,
                approved_by: decision === "Approved" ? adminId || null : null,
                event_id: eventId
            })
            .select("*")
            .single());

    }

    if (resultError) {

        throw httpError(500, "Unable to save pairing decision.", resultError);

    }

    console.log(
        `✅ Pairing ${decision}:`,
        maleRecord.singer_name,
        "+",
        femaleRecord.singer_name
    );

    return result;

};


const decidePairing = async (req, res) => {

    try {

        const {
            song_id,
            male_singer_id,
            female_singer_id,
            decision,
            source
        } = req.body || {};

        const pairing = await applyPairingDecision({
            song_id,
            male_singer_id,
            female_singer_id,
            decision,
            source,
            adminId: req.admin?.id
        });

        return res.status(200).json({

            success: true,

            message:
                `Pairing ${decision.toLowerCase()}.`,

            pairing

        });

    }

    catch (error) {

        if (error.status) {

            return res.status(error.status).json({
                success: false,
                message: error.message,
                error: error.cause?.message
            });

        }

        console.error(
            "DECIDE PAIRING EXCEPTION:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Internal server error.",

            error:
                error.message

        });

    }

};


// ==========================================================
// SINGER-FACING - MY PAIRING
//
// GET /api/v1/pairings/my?singer_id=UUID
//
// Returns one row per song this singer chose (their latest
// payment's selected_song_ids for the active event), each with
// a per-song status:
//
//   - "Paired"     - an Approved pairing exists for this song's
//                     title. partner_name is set.
//   - "Pending"    - a same-titled opposite-gender singer exists
//                     who hasn't been decided against yet (or
//                     vice versa) - admin still might pair it.
//                     This is the "TBD" state.
//   - "Not Paired" - either nobody of the opposite gender ever
//                     chose a matching title, or every candidate
//                     that did has already been decided (none
//                     Approved) - this song is settled as unpaired
//                     for this event.
//
// The distinction between Pending and Not Paired matters: a
// singer should only be told "this won't be paired" once there
// is truly no one left to pair with, not just because the admin
// hasn't gotten to it yet.
// ==========================================================

const getMyPairing = async (req, res) => {

    try {

        const singerId =
            req.query.singer_id;


        if (!isValidUuid(singerId)) {

            return res.status(400).json({

                success: false,

                message:
                    "A valid singer_id is required."

            });

        }


        // Scoped to the currently active event, so a singer's
        // songs/pairings from a past event don't linger on their
        // dashboard forever once a new event cycle has started.
        const activeEventId =
            await getActiveEventId();

        // Event name for the dashboard heading, and my own latest
        // payment for this event - picks whose payment the admin
        // hasn't confirmed yet are shown as awaiting confirmation,
        // not as "Not Paired".
        let eventName = null;
        let myPaymentStatus = null;

        if (activeEventId) {

            const [eventResult, paymentResult] = await Promise.all([

                supabase
                    .from("events")
                    .select("name")
                    .eq("id", activeEventId)
                    .maybeSingle(),

                supabase
                    .from("payments")
                    .select("status")
                    .eq("singer_id", singerId)
                    .eq("event_id", activeEventId)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle()

            ]);

            eventName = eventResult.data?.name || null;
            myPaymentStatus = paymentResult.data?.status || null;

        }

        const {
            singers,
            songMap,
            selectionsBySinger,
            solosBySinger
        } = await loadSingerSongMap(activeEventId);

        const singerById =
            new Map(singers.map(singer => [singer.id, singer]));

        let me =
            singerById.get(singerId);

        // true = this singer didn't pick songs themselves - the
        // admin put them on the Final List (walk-in / uploaded
        // list), so the dashboard shows those songs, not the picker
        let addedByAdmin = false;

        // Singers added from the Final List (walk-ins, an uploaded
        // list) have no registration of their own, so they aren't
        // in the map above - look them up directly.
        if (!me) {
            const { data: found } = await supabase
                .from("singers")
                .select("id,singer_name,gender")
                .eq("id", singerId)
                .maybeSingle();

            if (found) {
                me = found;
                singerById.set(found.id, found);
                addedByAdmin = true;
            }
        }

        const mySelections =
            selectionsBySinger.get(singerId) || [];

        // Only solos the admin APPROVED are shown - undecided or
        // rejected solos stay off the Song List.
        const myApprovedSolos =
            (solosBySinger.get(singerId) || [])
                .filter(solo => solo.solo_status === "Approved" && solo.title);

        // Solos given to me on the Final List
        if (activeEventId) {
            const { data: listSolos } = await supabase
                .from("songs")
                .select("id,title,movie,solo_status")
                .eq("event_id", activeEventId)
                .eq("solo_singer_id", singerId)
                .eq("solo_status", "Approved");

            (listSolos || []).forEach(song => {
                if (song.title && !myApprovedSolos.some(solo => solo.song_id === song.id)) {
                    myApprovedSolos.push({
                        song_id: song.id,
                        title: song.title,
                        movie: song.movie,
                        solo_status: "Approved"
                    });
                }
            });
        }

        const myGender =
            String(me?.gender || "").trim().toLowerCase();

        if (
            !me ||
            (myGender !== "male" && myGender !== "female")
        ) {

            return res.status(200).json({
                success: true,
                event_name: eventName,
                payment_status: myPaymentStatus,
                added_by_admin: addedByAdmin,
                songs: []
            });

        }

        const oppositeGender =
            myGender === "male" ? "female" : "male";


        // ----------------------------------------------------
        // Every decision (Approved or Rejected) already made
        // involving me, in the active event.
        // ----------------------------------------------------

        let decidedQuery =
            supabase
                .from("pairings")
                .select("song_id,male_singer_id,female_singer_id,status")
                .or(`male_singer_id.eq.${singerId},female_singer_id.eq.${singerId}`);

        decidedQuery =
            activeEventId
                ? decidedQuery.eq("event_id", activeEventId)
                : decidedQuery.is("event_id", null);

        const {
            data: decidedRows,
            error: decidedError
        } = await decidedQuery;

        if (decidedError) {

            console.error(
                "GET MY PAIRING - DECIDED:",
                decidedError
            );

            return res.status(500).json({
                success: false,
                message: "Unable to load pairing status.",
                error: decidedError.message
            });

        }

        const approvedRows =
            (decidedRows || []).filter(row => row.status === "Approved");

        if (
            mySelections.length === 0 &&
            approvedRows.length === 0 &&
            myApprovedSolos.length === 0
        ) {

            return res.status(200).json({
                success: true,
                event_name: eventName,
                payment_status: myPaymentStatus,
                added_by_admin: addedByAdmin,
                songs: []
            });

        }


        // ----------------------------------------------------
        // Song + partner details for Approved pairings. A pairing
        // can be on my PARTNER's song (admin paired me on a song I
        // didn't pick), so look up any song not already known.
        // ----------------------------------------------------

        const missingSongIds = [
            ...new Set(
                approvedRows
                    .map(row => row.song_id)
                    .filter(id => !songMap.has(id))
            )
        ];

        if (missingSongIds.length > 0) {

            const { data: extraSongs } = await supabase
                .from("songs")
                .select("id,title,movie,event_id")
                .in("id", missingSongIds);

            (extraSongs || []).forEach(song => songMap.set(song.id, song));

        }

        const partnerIds = [
            ...new Set(
                approvedRows.map(row =>
                    row.male_singer_id === singerId
                        ? row.female_singer_id
                        : row.male_singer_id
                )
            )
        ].filter(id => !singerById.has(id));

        if (partnerIds.length > 0) {

            const { data: partners } = await supabase
                .from("singers")
                .select("id,singer_name,gender")
                .in("id", partnerIds);

            (partners || []).forEach(partner => singerById.set(partner.id, partner));

        }

        const nameOf = id =>
            singerById.get(id)?.singer_name || "Unknown Singer";

        const songsOut = [];
        const pairedTitles = new Set();

        approvedRows.forEach(row => {

            const song = songMap.get(row.song_id);

            if (!song?.title) {
                return;
            }

            pairedTitles.add(normalizeTitle(song.title));

            songsOut.push({
                song_id: row.song_id,
                song_title: song.title,
                movie: song.movie || null,
                status: "Paired",
                male_singer_name: nameOf(row.male_singer_id),
                female_singer_name: nameOf(row.female_singer_id),
                partner_name: nameOf(
                    row.male_singer_id === singerId
                        ? row.female_singer_id
                        : row.male_singer_id
                )
            });

        });


        // ----------------------------------------------------
        // My own picks that aren't paired yet.
        //
        // Payment not confirmed -> "Awaiting Payment" (not in
        // pairing yet). Otherwise "Pending" while an opposite-
        // gender singer who picked the same title is undecided,
        // else "Not Paired".
        // ----------------------------------------------------

        const paymentConfirmed =
            !myPaymentStatus || myPaymentStatus === "Paid";

        const oppositeByTitle =
            new Map();

        selectionsBySinger.forEach(
            (selections, otherId) => {

                if (otherId === singerId) {
                    return;
                }

                if (
                    String(singerById.get(otherId)?.gender || "").trim().toLowerCase() !==
                    oppositeGender
                ) {
                    return;
                }

                selections.forEach(({ title }) => {

                    if (!title) {
                        return;
                    }

                    const key = normalizeTitle(title);

                    if (!oppositeByTitle.has(key)) {
                        oppositeByTitle.set(key, []);
                    }

                    oppositeByTitle.get(key).push(otherId);

                });

            }
        );

        const decidedPartnersByTitle =
            new Map();

        (decidedRows || []).forEach(row => {

            const title = songMap.get(row.song_id)?.title;

            if (!title) {
                return;
            }

            const key = normalizeTitle(title);

            if (!decidedPartnersByTitle.has(key)) {
                decidedPartnersByTitle.set(key, new Set());
            }

            decidedPartnersByTitle.get(key).add(
                row.male_singer_id === singerId
                    ? row.female_singer_id
                    : row.male_singer_id
            );

        });

        const myName = me.singer_name || "Unknown Singer";

        // Approved solos sit in the Song List next to the pairings.
        myApprovedSolos.forEach(solo => {
            songsOut.push({
                song_id: solo.song_id,
                song_title: solo.title,
                movie: solo.movie || null,
                status: "Solo",
                male_singer_name: myGender === "male" ? myName : null,
                female_singer_name: myGender === "female" ? myName : null,
                partner_name: null
            });
        });

        const soloTitles = new Set(
            myApprovedSolos.map(solo => normalizeTitle(solo.title))
        );

        mySelections
            .filter(({ title }) => Boolean(title))
            .filter(({ title }) => !pairedTitles.has(normalizeTitle(title)))
            .filter(({ title }) => !soloTitles.has(normalizeTitle(title)))
            .forEach(({ song_id, title }) => {

                const key = normalizeTitle(title);

                let status = "Not Paired";

                if (myPaymentStatus === "Rejected") {
                    status = "Payment Rejected";
                }
                else if (!paymentConfirmed) {
                    status = "Awaiting Payment";
                }
                else {
                    const candidateIds = oppositeByTitle.get(key) || [];
                    const decidedIds = decidedPartnersByTitle.get(key) || new Set();

                    if (candidateIds.some(id => !decidedIds.has(id))) {
                        status = "Pending";
                    }
                }

                songsOut.push({
                    song_id,
                    song_title: title,
                    movie: songMap.get(song_id)?.movie || null,
                    status,
                    male_singer_name: myGender === "male" ? myName : null,
                    female_singer_name: myGender === "female" ? myName : null,
                    partner_name: null
                });

            });

        return res.status(200).json({
            success: true,
            event_name: eventName,
            payment_status: myPaymentStatus,
                added_by_admin: addedByAdmin,
            songs: songsOut
        });

    }

    catch (error) {

        console.error(
            "GET MY PAIRING EXCEPTION:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Internal server error.",

            error:
                error.message

        });

    }

};


// ==========================================================
// BULK DECIDE PAIRINGS (Excel import)
//
// POST /api/v1/admin/pairings/bulk-decide
//
// Body: { rows: [{ song_title, male_singer_name,
//                   female_singer_name, decision, source }] }
//
// The exported "Pairing History" sheet has human-readable
// names, not UUIDs, so each row is resolved by name (male/
// female singer) and by the male singer's own selection
// matching the given song title (falling back to the female
// singer's selection - the same "at least one side owns it"
// rule the manual pairing form uses).
// ==========================================================

const bulkDecidePairings = async (req, res) => {

    try {

        const rows = Array.isArray(req.body?.rows)
            ? req.body.rows
            : [];

        if (rows.length === 0) {

            return res.status(400).json({
                success: false,
                message: "No rows provided."
            });

        }

        const { selectionsBySinger } = await loadSingerSongMap(req.body?.event_id || null);

        // Every singer, not just those with a payment, so a row
        // can reference anyone in the roster.
        const { data: allSingers, error: allSingersError } = await supabase
            .from("singers")
            .select("id,singer_name,gender");

        if (allSingersError) {

            return res.status(500).json({
                success: false,
                message: "Unable to load singers.",
                error: allSingersError.message
            });

        }

        const findSingerByName = (name, gender) => {

            const normalizedName = String(name || "").trim().toLowerCase();
            const matches = (allSingers || []).filter(singer =>
                String(singer.singer_name || "").trim().toLowerCase() === normalizedName &&
                String(singer.gender || "").trim().toLowerCase() === gender
            );

            return matches;

        };

        const results = [];

        for (const row of rows) {

            const decision = String(row.decision || "").trim();
            const decisionNormalized =
                decision.toLowerCase() === "approved" ? "Approved" :
                decision.toLowerCase() === "rejected" ? "Rejected" : null;

            if (!decisionNormalized) {

                results.push({ status: "error", message: `Row for "${row.song_title || "?"}": decision must be 'Approved' or 'Rejected'.` });
                continue;

            }

            const maleMatches = findSingerByName(row.male_singer_name, "male");
            const femaleMatches = findSingerByName(row.female_singer_name, "female");

            if (maleMatches.length === 0) {

                results.push({ status: "error", message: `Male singer "${row.male_singer_name}" not found.` });
                continue;

            }

            if (maleMatches.length > 1) {

                results.push({ status: "error", message: `Multiple male singers named "${row.male_singer_name}" - ambiguous.` });
                continue;

            }

            if (femaleMatches.length === 0) {

                results.push({ status: "error", message: `Female singer "${row.female_singer_name}" not found.` });
                continue;

            }

            if (femaleMatches.length > 1) {

                results.push({ status: "error", message: `Multiple female singers named "${row.female_singer_name}" - ambiguous.` });
                continue;

            }

            const maleSinger = maleMatches[0];
            const femaleSinger = femaleMatches[0];

            const targetTitle = normalizeTitle(row.song_title);

            const maleSelection = (selectionsBySinger.get(maleSinger.id) || [])
                .find(selection => normalizeTitle(selection.title) === targetTitle);

            const femaleSelection = (selectionsBySinger.get(femaleSinger.id) || [])
                .find(selection => normalizeTitle(selection.title) === targetTitle);

            const songId = maleSelection?.song_id || femaleSelection?.song_id;

            if (!songId) {

                results.push({ status: "error", message: `"${row.song_title}" was not selected by either ${row.male_singer_name} or ${row.female_singer_name}.` });
                continue;

            }

            try {

                await applyPairingDecision({
                    song_id: songId,
                    male_singer_id: maleSinger.id,
                    female_singer_id: femaleSinger.id,
                    decision: decisionNormalized,
                    source: row.source === "auto" ? "auto" : "manual",
                    adminId: req.admin?.id
                });

                results.push({
                    status: "updated",
                    message: `${row.song_title}: ${maleSinger.singer_name} + ${femaleSinger.singer_name} ${decisionNormalized.toLowerCase()}.`
                });

            }
            catch (decisionError) {

                results.push({ status: "error", message: decisionError.message });

            }

        }

        const updated = results.filter(row => row.status === "updated").length;
        const failed = results.length - updated;

        return res.status(200).json({
            success: true,
            message: `${updated} pairing(s) applied, ${failed} failed.`,
            results
        });

    }

    catch (error) {

        console.error(
            "BULK DECIDE PAIRINGS EXCEPTION:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });

    }

};


// ==========================================================
// DECIDE A SOLO (approve / reject / undo)
//
// POST /api/v1/admin/pairings/solo
//
// Body: { song_id, decision: "Approved" | "Rejected" | null }
//
// Solos are never paired - the admin just approves them. Only
// approved solos show on the singer's Song List. null clears
// the decision (back to undecided).
// ==========================================================

const decideSolo = async (req, res) => {

    try {

        const songId = req.body?.song_id;
        const decision = req.body?.decision ?? null;

        if (!isValidUuid(songId)) {
            return res.status(400).json({
                success: false,
                message: "A valid song_id is required."
            });
        }

        if (decision !== null && !["Approved", "Rejected"].includes(decision)) {
            return res.status(400).json({
                success: false,
                message: "decision must be 'Approved', 'Rejected' or null."
            });
        }

        const { data: song, error: songError } = await supabase
            .from("songs")
            .select("id,title,event_id")
            .eq("id", songId)
            .maybeSingle();

        if (songError) {
            throw songError;
        }

        if (!song) {
            return res.status(404).json({
                success: false,
                message: "Song not found."
            });
        }

        // Must really be someone's solo in that song's event.
        const { solosBySinger } = await loadSingerSongMap(song.event_id || null);

        const isSolo = [...solosBySinger.values()]
            .some(solos => solos.some(solo => solo.song_id === songId));

        if (!isSolo) {
            return res.status(400).json({
                success: false,
                message: "This song isn't a solo in any singer's current selection."
            });
        }

        const { error: updateError } = await supabase
            .from("songs")
            .update({ solo_status: decision })
            .eq("id", songId);

        if (updateError) {

            if (/solo_status/i.test(updateError.message || "")) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Solo approval isn't set up in the database yet - run backend/migrations/2026-11-24_solo_approval.sql in Supabase first."
                });
            }

            throw updateError;

        }

        console.log(`✅ Solo ${decision || "reset"}:`, song.title);

        return res.status(200).json({
            success: true,
            message: decision
                ? `Solo "${song.title}" ${decision.toLowerCase()}.`
                : `Solo "${song.title}" set back to undecided.`
        });

    }

    catch (error) {

        console.error("DECIDE SOLO:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update the solo.",
            error: error.message
        });

    }

};


module.exports = {
    getSuggestions,
    decidePairing,
    getMyPairing,
    bulkDecidePairings,
    decideSolo,
    loadSingerSongMap,
    normalizeTitle,
    isValidUuid
};
