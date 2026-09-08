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
// SHARED: LATEST PAYMENT PER SINGER, WITH SINGER + SONG INFO
// ==========================================================

const loadSingerSongMap = async (eventId = null) => {

    let paymentsQuery = supabase

        .from("payments")

        .select(
            "singer_id,selected_song_ids,created_at"
        )

        .order(
            "created_at",
            { ascending: false }
        );

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


    const latestBySinger =
        new Map();


    (payments || []).forEach(
        payment => {

            if (
                !latestBySinger.has(
                    payment.singer_id
                )
            ) {

                latestBySinger.set(
                    payment.singer_id,
                    Array.isArray(
                        payment.selected_song_ids
                    )
                        ? payment.selected_song_ids
                        : []
                );

            }

        }
    );


    const singerIds =
        [...latestBySinger.keys()];


    if (singerIds.length === 0) {

        return {
            singers: [],
            songMap: new Map(),
            selectionsBySinger: latestBySinger
        };

    }


    const {
        data: singers,
        error: singersError
    } = await supabase

        .from("singers")

        .select(
            "id,singer_name,gender"
        )

        .in(
            "id",
            singerIds
        );


    if (singersError) {

        throw singersError;

    }


    const allSongIds =
        [
            ...new Set(
                [...latestBySinger.values()].flat()
            )
        ];


    let songs = [];


    if (allSongIds.length > 0) {

        const {
            data: songRows,
            error: songsError
        } = await supabase

            .from("songs")

            .select(
                "id,title,movie,event_id"
            )

            .in(
                "id",
                allSongIds
            );


        if (songsError) {

            throw songsError;

        }


        songs =
            songRows || [];

    }


    const songMap =
        new Map(
            songs.map(
                song => [song.id, song]
            )
        );


    // ------------------------------------------------------
    // selectionsBySinger: singerId -> [{ song_id, title }]
    // ------------------------------------------------------

    const selectionsBySinger =
        new Map(

            [...latestBySinger.entries()].map(
                ([singerId, songIds]) => [

                    singerId,

                    songIds.map(
                        songId => ({

                            song_id:
                                songId,

                            title:
                                songMap.get(songId)?.title ||
                                null

                        })
                    )

                ]
            )

        );


    return {

        singers:
            singers || [],

        songMap,

        selectionsBySinger

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
            selectionsBySinger
        } = await loadSingerSongMap(primaryEventId);


        const singerById =
            new Map(
                singers.map(
                    singer => [singer.id, singer]
                )
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
                            "Potential Match"

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
                .select("id,title,movie")
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

        const decidedEventIds = [
            ...new Set((decided || []).map(row => row.event_id).filter(Boolean))
        ];

        if (decidedEventIds.length > 0) {

            const { data: eventRows } = await supabase
                .from("events")
                .select("id,name")
                .in("id", decidedEventIds);

            (eventRows || []).forEach(event => eventNameById.set(event.id, event.name));

        }


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
                                singer.gender

                        });

                    }
                );

            }

        );


        openSongs.sort(
            (a, b) =>
                a.song_title.localeCompare(b.song_title)
        );


        return res.status(200).json({

            success: true,

            potential_matches:
                potential,

            existing_pairings:
                existingPairings,

            open_songs:
                openSongs

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

    if (pairingSource === "manual") {

        const { selectionsBySinger, songMap } = await loadSingerSongMap();

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

    // Stamped from the song's own event_id - a pairing belongs to
    // whichever event the singer's selection was actually made
    // under, regardless of which event happens to be active right
    // now when the admin gets around to deciding it.
    const { data: songRow } = await supabase
        .from("songs")
        .select("event_id")
        .eq("id", song_id)
        .maybeSingle();

    const eventId = songRow?.event_id || null;

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


        // Scoped to the currently active event, so an Approved
        // pairing from a past event doesn't linger on a singer's
        // dashboard forever once a new event cycle has started.
        const activeEventId =
            await getActiveEventId();

        let pairingQuery =
            supabase

                .from("pairings")

                .select("*")

                .eq(
                    "status",
                    "Approved"
                )

                .or(
                    `male_singer_id.eq.${singerId},female_singer_id.eq.${singerId}`
                );

        pairingQuery =
            activeEventId
                ? pairingQuery.eq("event_id", activeEventId)
                : pairingQuery.is("event_id", null);

        const {
            data: pairing,
            error
        } = await pairingQuery

            .order(
                "updated_at",
                { ascending: false }
            )

            .limit(1)

            .maybeSingle();


        if (error) {

            console.error(
                "GET MY PAIRING:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to load pairing status.",

                error:
                    error.message

            });

        }


        if (!pairing) {

            return res.status(200).json({

                success: true,

                pairing: null

            });

        }


        const partnerId =
            pairing.male_singer_id === singerId
                ? pairing.female_singer_id
                : pairing.male_singer_id;


        const [
            { data: partner },
            { data: song }
        ] = await Promise.all([

            supabase
                .from("singers")
                .select("singer_name")
                .eq("id", partnerId)
                .maybeSingle(),

            supabase
                .from("songs")
                .select("title,movie")
                .eq("id", pairing.song_id)
                .maybeSingle()

        ]);


        return res.status(200).json({

            success: true,

            pairing: {

                song_title:
                    song?.title || "Unknown Song",

                partner_name:
                    partner?.singer_name || "Unknown Singer"

            }

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


module.exports = {
    getSuggestions,
    decidePairing,
    getMyPairing,
    bulkDecidePairings
};
