const bcrypt = require("bcryptjs");

const { supabase } = require("../../config/supabase");
const { getActiveEventId } = require("../../utils/activeEvent");
const {
    PAYMENT_AMOUNT,
    PAYMENT_TYPE_WALK_IN
} = require("../../utils/paymentRules");
const {
    loadSingerSongMap,
    normalizeTitle,
    isValidUuid
} = require("./pairingController");

// ==========================================================
// BEATS INFINITY - FINAL PAIRING LIST
// ==========================================================
//
// The event-day list: every approved duet pairing and approved
// solo for one event, editable as a whole so an admin can make
// last-minute changes (swap a singer, change the song, turn a
// duet into a solo, add or remove rows) and save once.
//
// Row shape (both directions):
//   { ref, male_singer_id, female_singer_id, song_title, movie }
//   ref: "pairing:<id>" | "solo:<song_id>" | null (new row)
//   Both singers  -> duet (stored in public.pairings)
//   One singer    -> solo (songs.solo_status = 'Approved')
//
// Nothing is deleted: a removed or replaced pairing is kept as
// 'Rejected', a removed solo as solo_status 'Rejected', and every
// change is written to public.pairing_change_log for reports.
// ==========================================================

const httpError = (status, message) =>
    Object.assign(new Error(message), { status });

const cleanText = value => String(value ?? "").trim();

const isMissingRosterTable = error =>
    /event_singers/i.test(error?.message || "");

const ROSTER_MIGRATION_MESSAGE =
    "Adding singers needs the event roster table - run backend/migrations/2026-11-25_event_roster.sql in Supabase first.";

// "Completed" ticks (final_list_progress). Table missing = the
// migration hasn't been run yet.
const isMissingProgressTable = error =>
    error?.code === "42P01" || error?.code === "PGRST205" ||
    /final_list_progress/i.test(String(error?.message || ""));

const PROGRESS_MIGRATION_MESSAGE =
    "Ticking songs as completed needs a one-time database update - run backend/migrations/2026-11-25_final_list_progress.sql in the Supabase SQL editor.";

// Set of refs ticked as completed, or null if the table is missing
const loadCompletedRefs = async eventId => {

    const { data, error } = await supabase
        .from("final_list_progress")
        .select("row_ref")
        .eq("event_id", eventId);

    if (error) {
        if (isMissingProgressTable(error)) return null;
        throw error;
    }

    return new Set((data || []).map(row => row.row_ref));

};

const loadEvent = async eventId => {

    const { data, error } = await supabase
        .from("events")
        .select("id,name")
        .eq("id", eventId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        throw httpError(404, "Event not found.");
    }

    return data;

};

const resolveEventId = async requested => {

    const eventId = cleanText(requested) || await getActiveEventId();

    if (!isValidUuid(eventId)) {
        throw httpError(400, "Select an event first.");
    }

    return eventId;

};


// ----------------------------------------------------------
// CURRENT FINAL LIST
//
// Returns rows plus maps the save step needs:
//   rows:      the list as shown on the page
//   byRef:     ref -> row (with song_id / singer ids)
//   singerById
// ----------------------------------------------------------

const loadFinalList = async eventId => {

    const [{ singers: eventSingers, songMap, solosBySinger }, pairingsResult] =
        await Promise.all([
            loadSingerSongMap(eventId),
            supabase
                .from("pairings")
                .select("id,song_id,male_singer_id,female_singer_id,created_at")
                .eq("event_id", eventId)
                .eq("status", "Approved")
                .order("created_at", { ascending: true })
        ]);

    if (pairingsResult.error) {
        throw pairingsResult.error;
    }

    const pairings = pairingsResult.data || [];

    // Top up songs the approved pairings point at (e.g. ones an
    // admin created on this list - not anyone's own pick).
    const missingSongIds = [
        ...new Set(pairings.map(row => row.song_id))
    ].filter(id => id && !songMap.has(id));

    if (missingSongIds.length > 0) {

        const { data, error } = await supabase
            .from("songs")
            .select("id,title,movie,event_id")
            .in("id", missingSongIds);

        if (error) {
            throw error;
        }

        (data || []).forEach(song => songMap.set(song.id, song));

    }

    // Every singer (for validation and the "Add a singer" picker),
    // plus this event's roster - only roster singers are offered in
    // the Final List dropdowns.
    const [{ data: allSingers, error: singersError }, { data: roster, error: rosterError }] =
        await Promise.all([
            supabase
                .from("singers")
                .select("id,singer_name,gender")
                .order("singer_name", { ascending: true }),
            supabase
                .from("event_singers")
                .select("singer_id")
                .eq("event_id", eventId)
        ]);

    if (singersError) {
        throw singersError;
    }

    // Roster table missing (migration not run) -> just no roster
    if (rosterError && !isMissingRosterTable(rosterError)) {
        throw rosterError;
    }

    const singerById = new Map((allSingers || []).map(singer => [singer.id, singer]));

    // In this event = registered (has a payment) + on the event
    // roster + already on the Final List.
    const eventSingerIds = new Set([
        ...eventSingers.map(singer => singer.id),
        ...(roster || []).map(row => row.singer_id),
        ...pairings.flatMap(row => [row.male_singer_id, row.female_singer_id])
    ]);

    solosBySinger.forEach((solos, singerId) => {
        if (solos.some(solo => solo.solo_status === "Approved")) {
            eventSingerIds.add(singerId);
        }
    });

    const rows = [];

    pairings.forEach(pairing => {
        const song = songMap.get(pairing.song_id);
        rows.push({
            ref: `pairing:${pairing.id}`,
            kind: "duet",
            pairing_id: pairing.id,
            song_id: pairing.song_id,
            male_singer_id: pairing.male_singer_id,
            female_singer_id: pairing.female_singer_id,
            song_title: song?.title || "Unknown Song",
            movie: song?.movie || ""
        });
    });

    solosBySinger.forEach((solos, singerId) => {

        const gender = String(singerById.get(singerId)?.gender || "").toLowerCase();

        solos
            .filter(solo => solo.solo_status === "Approved")
            .forEach(solo => {
                rows.push({
                    ref: `solo:${solo.song_id}`,
                    kind: "solo",
                    song_id: solo.song_id,
                    solo_singer_id: singerId,
                    male_singer_id: gender === "female" ? "" : singerId,
                    female_singer_id: gender === "female" ? singerId : "",
                    song_title: solo.title || "Unknown Song",
                    movie: solo.movie || ""
                });
            });

    });

    const nameOf = id => singerById.get(id)?.singer_name || "";

    rows.sort((a, b) =>
        nameOf(a.male_singer_id || a.female_singer_id)
            .localeCompare(nameOf(b.male_singer_id || b.female_singer_id)) ||
        a.song_title.localeCompare(b.song_title)
    );

    return {
        rows,
        byRef: new Map(rows.map(row => [row.ref, row])),
        singerById,
        eventSingerIds,
        allSingers: allSingers || []
    };

};


// ==========================================================
// GET /api/v1/admin/pairings/final?event_id=UUID
// ==========================================================

const getFinalList = async (req, res) => {

    try {

        const eventId = await resolveEventId(req.query.event_id);
        const event = await loadEvent(eventId);

        const [{ rows, allSingers, eventSingerIds }, completedRefs] = await Promise.all([
            loadFinalList(eventId),
            loadCompletedRefs(eventId)
        ]);

        return res.status(200).json({
            success: true,
            event_id: event.id,
            event_name: event.name,
            rows: rows.map(row => ({
                ref: row.ref,
                male_singer_id: row.male_singer_id || "",
                female_singer_id: row.female_singer_id || "",
                song_title: row.song_title,
                movie: row.movie || "",
                completed: Boolean(completedRefs?.has(row.ref))
            })),
            // false = the "completed" migration hasn't been run
            completion_ready: completedRefs !== null,
            singers: allSingers.map(singer => ({
                id: singer.id,
                singer_name: singer.singer_name,
                gender: singer.gender,
                in_event: eventSingerIds.has(singer.id)
            }))
        });

    }

    catch (error) {

        console.error("GET FINAL LIST:", error);

        return res.status(error.status || 500).json({
            success: false,
            message: error.status ? error.message : "Unable to load the final pairing list.",
            error: error.message
        });

    }

};


// ----------------------------------------------------------
// SAVE HELPERS
// ----------------------------------------------------------

const createSong = async ({ eventId, title, movie, solo, soloSingerId }) => {

    const insert = {
        title,
        movie: movie || null,
        album: movie || null,
        event_id: eventId,
        song_type: solo ? "Solo" : "Duet",
        is_duet: !solo,
        language: "Tamil",
        provider: "Beats Infinity"
    };

    if (solo) {
        insert.solo_status = "Approved";
        insert.solo_singer_id = soloSingerId;
    }

    const { data, error } = await supabase
        .from("songs")
        .insert(insert)
        .select("id")
        .single();

    if (error) {

        if (/solo_singer_id/i.test(error.message || "")) {
            throw httpError(
                500,
                "The Final List isn't set up in the database yet - run backend/migrations/2026-11-24_final_pairing_list.sql in Supabase first."
            );
        }

        throw error;

    }

    return data.id;

};

const approvePairing = async ({ eventId, songId, maleId, femaleId, adminId }) => {

    const { data: existing, error: findError } = await supabase
        .from("pairings")
        .select("id")
        .eq("song_id", songId)
        .eq("male_singer_id", maleId)
        .eq("female_singer_id", femaleId)
        .maybeSingle();

    if (findError) {
        throw findError;
    }

    const values = {
        status: "Approved",
        source: "manual",
        approved_by: adminId || null,
        event_id: eventId,
        updated_at: new Date().toISOString()
    };

    const query = existing
        ? supabase.from("pairings").update(values).eq("id", existing.id)
        : supabase.from("pairings").insert({
            song_id: songId,
            male_singer_id: maleId,
            female_singer_id: femaleId,
            ...values
        });

    const { data, error } = await query.select("id").single();

    if (error) {
        throw error;
    }

    return data.id;

};

const rejectPairing = async pairingId => {

    const { error } = await supabase
        .from("pairings")
        .update({
            status: "Rejected",
            approved_by: null,
            updated_at: new Date().toISOString()
        })
        .eq("id", pairingId);

    if (error) {
        throw error;
    }

};

const setSolo = async (songId, values) => {

    const { error } = await supabase
        .from("songs")
        .update(values)
        .eq("id", songId);

    if (error) {

        if (/solo_singer_id|solo_status/i.test(error.message || "")) {
            throw httpError(
                500,
                "The Final List isn't set up in the database yet - run backend/migrations/2026-11-24_final_pairing_list.sql in Supabase first."
            );
        }

        throw error;

    }

};


// strict: fail when the roster table is missing (Add a singer);
// otherwise skip quietly (saving the list still works).
const addToRoster = async (eventId, singerId, strict = false) => {

    const { error } = await supabase
        .from("event_singers")
        .upsert(
            { event_id: eventId, singer_id: singerId, source: "final_list" },
            { onConflict: "event_id,singer_id", ignoreDuplicates: true }
        );

    if (error) {

        if (isMissingRosterTable(error)) {
            if (strict) throw httpError(500, ROSTER_MIGRATION_MESSAGE);
            return;
        }

        throw error;

    }

};

// ----------------------------------------------------------
// WALK-IN PAYMENTS
//
// Walk-ins pay cash at the venue (or are let in free as a guest /
// management team - the admin decides on the Payments page). So:
//   - every singer on this event's Final List, plus `extraSingerIds`
//     (a walk-in just added, not on any row yet), who has NO payment
//     for this event gets a Pending "Walk-in" payment;
//   - every Walk-in payment's songs are kept equal to that singer's
//     rows on the list, so the Songs and Singers pages show them.
// Registered singers' payments are never touched.
//
// Returns warnings for the admin (never throws for one singer).
// ----------------------------------------------------------

const syncWalkInPayments = async (eventId, extraSingerIds = []) => {

    const warnings = [];
    const list = await loadFinalList(eventId);

    const duetsBySinger = new Map();
    const soloBySinger = new Map();

    const addDuet = (singerId, songId) => {
        if (!singerId) return;
        const songs = duetsBySinger.get(singerId) || [];
        if (!songs.includes(songId)) songs.push(songId);
        duetsBySinger.set(singerId, songs);
    };

    list.rows.forEach(row => {
        if (row.kind === "solo") {
            if (!soloBySinger.has(row.solo_singer_id)) {
                soloBySinger.set(row.solo_singer_id, row.song_id);
            }
        }
        else {
            addDuet(row.male_singer_id, row.song_id);
            addDuet(row.female_singer_id, row.song_id);
        }
    });

    const wanted = new Set([
        ...duetsBySinger.keys(),
        ...soloBySinger.keys(),
        ...extraSingerIds.filter(Boolean)
    ]);

    const { data: payments, error } = await supabase
        .from("payments")
        .select("id,singer_id,payment_type,selected_song_ids,solo_song_id,created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    const hasPayment = new Set((payments || []).map(payment => payment.singer_id));
    const nameOf = id => list.singerById.get(id)?.singer_name || "A singer";

    for (const singerId of wanted) {

        if (hasPayment.has(singerId)) {
            continue;
        }

        const { error: insertError } = await supabase
            .from("payments")
            .insert({
                singer_id: singerId,
                amount: PAYMENT_AMOUNT,
                payment_type: PAYMENT_TYPE_WALK_IN,
                status: "Pending",
                selected_song_ids: duetsBySinger.get(singerId) || [],
                solo_song_id: soloBySinger.get(singerId) || null,
                event_id: eventId
            });

        if (insertError) {

            console.error("WALK-IN PAYMENT:", insertError);

            warnings.push(
                insertError.code === "23505"
                    ? `${nameOf(singerId)} still has a pending payment from another event, so no walk-in payment was created - settle that one on the Payments page first.`
                    : `Couldn't create a walk-in payment for ${nameOf(singerId)}.`
            );

        }

    }

    // Keep walk-ins' songs in step with the list
    const latestWalkIn = new Map();

    (payments || [])
        .filter(payment => payment.payment_type === PAYMENT_TYPE_WALK_IN)
        .forEach(payment => {
            if (!latestWalkIn.has(payment.singer_id)) {
                latestWalkIn.set(payment.singer_id, payment);
            }
        });

    for (const [singerId, payment] of latestWalkIn) {

        const duets = duetsBySinger.get(singerId) || [];
        const solo = soloBySinger.get(singerId) || null;
        const current = Array.isArray(payment.selected_song_ids) ? payment.selected_song_ids : [];

        const same =
            current.length === duets.length &&
            current.every((id, index) => id === duets[index]) &&
            (payment.solo_song_id || null) === solo;

        if (same) {
            continue;
        }

        const { error: updateError } = await supabase
            .from("payments")
            .update({
                selected_song_ids: duets,
                solo_song_id: solo,
                updated_at: new Date().toISOString()
            })
            .eq("id", payment.id);

        if (updateError) {
            console.error("WALK-IN PAYMENT SONGS:", updateError);
            warnings.push(`Couldn't update ${nameOf(singerId)}'s walk-in songs.`);
        }

    }

    return warnings;

};

const syncWalkInsSafely = async (eventId, extraSingerIds) => {
    try {
        return await syncWalkInPayments(eventId, extraSingerIds);
    }
    catch (error) {
        console.error("SYNC WALK-IN PAYMENTS:", error);
        return ["Walk-in payments couldn't be updated - check the Payments page."];
    }
};

const normalizeMobile = value =>
    String(value || "").replace(/\D/g, "").slice(-10);

// Same placeholder registration uses for singers whose date of
// birth isn't known yet (Forgot PIN skips the DOB check for it).
const PLACEHOLDER_DOB = "2000-01-01";


// ==========================================================
// ADD A SINGER TO THE EVENT (last-minute walk-ins)
//
// POST /api/v1/admin/pairings/final/singers
//
// Body, existing singer: { event_id, singer_id }
// Body, new singer:      { event_id, singer_name, gender,
//                          mobile_number, date_of_birth? }
//
// A new singer whose mobile number is already registered reuses
// that singer instead of creating a duplicate.
// ==========================================================

const addEventSinger = async (req, res) => {

    try {

        const eventId = await resolveEventId(req.body?.event_id);
        await loadEvent(eventId);

        // Check the roster table exists before creating anyone
        const { error: rosterCheckError } = await supabase
            .from("event_singers")
            .select("id")
            .limit(1);

        if (rosterCheckError) {
            if (isMissingRosterTable(rosterCheckError)) {
                throw httpError(500, ROSTER_MIGRATION_MESSAGE);
            }
            throw rosterCheckError;
        }

        let singer = null;
        let created = false;
        let reused = false;

        const singerId = cleanText(req.body?.singer_id);

        if (singerId) {

            if (!isValidUuid(singerId)) {
                throw httpError(400, "Invalid singer.");
            }

            const { data, error } = await supabase
                .from("singers")
                .select("id,singer_name,gender")
                .eq("id", singerId)
                .maybeSingle();

            if (error) throw error;
            if (!data) throw httpError(404, "Singer not found.");

            singer = data;

        }
        else {

            const name = cleanText(req.body?.singer_name);
            const genderInput = cleanText(req.body?.gender).toLowerCase();
            const mobile = normalizeMobile(req.body?.mobile_number);
            const dobInput = cleanText(req.body?.date_of_birth).slice(0, 10);

            if (name.length < 2) {
                throw httpError(400, "Enter the singer's name.");
            }

            if (genderInput !== "male" && genderInput !== "female") {
                throw httpError(400, "Choose Male or Female.");
            }

            if (!/^\d{10}$/.test(mobile)) {
                throw httpError(400, "Enter a 10-digit mobile number.");
            }

            if (dobInput && !/^\d{4}-\d{2}-\d{2}$/.test(dobInput)) {
                throw httpError(400, "Date of birth looks wrong.");
            }

            const gender = genderInput === "male" ? "Male" : "Female";

            const { data: existing, error: findError } = await supabase
                .from("singers")
                .select("id,singer_name,gender")
                .eq("mobile_number", mobile)
                .maybeSingle();

            if (findError) throw findError;

            if (existing) {

                singer = existing;
                reused = true;

            }
            else {

                const { data, error } = await supabase
                    .from("singers")
                    .insert({
                        singer_name: name,
                        gender,
                        mobile_number: mobile,
                        date_of_birth: dobInput || PLACEHOLDER_DOB
                    })
                    .select("id,singer_name,gender")
                    .single();

                if (error) throw error;

                singer = data;
                created = true;

            }

        }

        await addToRoster(eventId, singer.id, true);

        const walkInWarnings = await syncWalkInsSafely(eventId, [singer.id]);

        const { error: logError } = await supabase
            .from("pairing_change_log")
            .insert({
                event_id: eventId,
                action: "singer_added",
                kind: "singer",
                before_value: null,
                after_value: {
                    singer: singer.singer_name,
                    gender: singer.gender,
                    new_registration: created
                },
                changed_by: req.admin?.id || null,
                changed_by_name: req.admin?.full_name || req.admin?.username || null
            });

        if (logError) {
            console.error("PAIRING CHANGE LOG (singer):", logError);
        }

        console.log(`✅ Singer added to event${created ? " (new registration)" : ""}:`, singer.singer_name);

        const addedMessage = created
            ? `${singer.singer_name} registered and added to this event.`
            : reused
                ? `That mobile number is already registered as ${singer.singer_name} - added them to this event.`
                : `${singer.singer_name} added to this event.`;

        return res.status(200).json({
            success: true,
            message: [addedMessage, ...walkInWarnings].join(" "),
            warnings: walkInWarnings,
            singer: {
                id: singer.id,
                singer_name: singer.singer_name,
                gender: singer.gender,
                in_event: true
            }
        });

    }

    catch (error) {

        console.error("ADD EVENT SINGER:", error);

        return res.status(error.status || 500).json({
            success: false,
            message: error.status ? error.message : "Unable to add the singer.",
            error: error.message
        });

    }

};


// ==========================================================
// REGISTER SINGERS FROM AN UPLOADED LIST
//
// POST /api/v1/admin/pairings/final/singers/bulk
// Body: { event_id, singers: [{ singer_name, gender }] }
//
// For a pairing list uploaded from Excel with names that aren't
// registered yet. Each new singer gets a temporary PIN (1234) and
// a temporary phone number "00000NNNNN" (can't be a real Indian
// mobile, so it never clashes) that an admin replaces later on
// the Singers page. A name already registered with the same
// gender is reused, never duplicated. Everyone goes on the
// event roster.
// ==========================================================

const TEMP_PIN = "1234";
const TEMP_MOBILE_PREFIX = "00000";

const nextTempMobiles = async count => {

    const { data, error } = await supabase
        .from("singers")
        .select("mobile_number")
        .like("mobile_number", `${TEMP_MOBILE_PREFIX}%`);

    if (error) throw error;

    let highest = 0;
    (data || []).forEach(row => {
        const n = Number(String(row.mobile_number).slice(TEMP_MOBILE_PREFIX.length));
        if (Number.isFinite(n) && n > highest) highest = n;
    });

    return Array.from({ length: count }, (_, i) =>
        `${TEMP_MOBILE_PREFIX}${String(highest + i + 1).padStart(5, "0")}`
    );

};

const registerEventSingers = async (req, res) => {

    try {

        const eventId = await resolveEventId(req.body?.event_id);
        await loadEvent(eventId);

        const input = Array.isArray(req.body?.singers) ? req.body.singers : null;

        if (!input || input.length === 0) {
            throw httpError(400, "No singers to register.");
        }

        if (input.length > 200) {
            throw httpError(400, "Too many singers in one go (max 200).");
        }

        // Clean + de-duplicate the request itself
        const wanted = [];
        const seen = new Set();

        for (const item of input) {
            const name = cleanText(item?.singer_name).replace(/\s+/g, " ");
            const g = cleanText(item?.gender).toLowerCase();

            if (name.length < 2) throw httpError(400, `"${name}" is too short for a name.`);
            if (g !== "male" && g !== "female") throw httpError(400, `Choose Male or Female for ${name}.`);

            const gender = g === "male" ? "Male" : "Female";
            const key = `${name.toLowerCase()}|${gender}`;

            if (!seen.has(key)) {
                seen.add(key);
                wanted.push({ name, gender, key });
            }
        }

        // Reuse anyone already registered with that name + gender
        const { data: existing, error: existingError } = await supabase
            .from("singers")
            .select("id,singer_name,gender");

        if (existingError) throw existingError;

        const byKey = new Map();
        (existing || []).forEach(singer => {
            const key = `${String(singer.singer_name).trim().toLowerCase()}|${singer.gender}`;
            if (!byKey.has(key)) byKey.set(key, singer);
        });

        const toCreate = wanted.filter(w => !byKey.has(w.key));
        const mobiles = await nextTempMobiles(toCreate.length);
        const pinHash = toCreate.length > 0 ? await bcrypt.hash(TEMP_PIN, 10) : null;

        let created = [];

        if (toCreate.length > 0) {

            const { data, error } = await supabase
                .from("singers")
                .insert(toCreate.map((w, i) => ({
                    singer_name: w.name,
                    gender: w.gender,
                    mobile_number: mobiles[i],
                    date_of_birth: PLACEHOLDER_DOB,
                    pin_hash: pinHash
                })))
                .select("id,singer_name,gender,mobile_number");

            if (error) throw error;

            created = data || [];
            created.forEach(singer => byKey.set(`${singer.singer_name.toLowerCase()}|${singer.gender}`, singer));

        }

        const singers = wanted.map(w => byKey.get(w.key));

        for (const singer of singers) {
            await addToRoster(eventId, singer.id, true);
        }

        const createdIds = new Set(created.map(singer => singer.id));
        const reusedCount = singers.length - created.length;

        return res.status(200).json({
            success: true,
            message: `${created.length} new singer${created.length === 1 ? "" : "s"} registered` +
                (reusedCount > 0 ? `, ${reusedCount} already registered` : "") +
                ". Temporary PIN 1234 - update their phone numbers on the Singers page.",
            singers: singers.map(singer => ({
                id: singer.id,
                singer_name: singer.singer_name,
                gender: singer.gender,
                in_event: true,
                created: createdIds.has(singer.id)
            }))
        });

    }
    catch (error) {
        console.error("REGISTER EVENT SINGERS:", error);

        return res.status(error.status || 500).json({
            success: false,
            message: error.status ? error.message : "Unable to register the singers.",
            error: error.message
        });
    }

};


// ==========================================================
// PUT /api/v1/admin/pairings/final
//
// Body: { event_id, rows: [{ ref, male_singer_id,
//                             female_singer_id, song_title, movie }] }
// ==========================================================

// ----------------------------------------------------------
// ROLLBACK COPY - one per event: the list as it was just before
// the most recent save. Kept in pairing_change_log (action
// 'snapshot') so no new table is needed; the Change Log hides it.
// ----------------------------------------------------------

const SNAPSHOT_ACTION = "snapshot";

const loadSnapshot = async eventId => {

    const { data, error } = await supabase
        .from("pairing_change_log")
        .select("id,before_value,changed_by_name,created_at")
        .eq("event_id", eventId)
        .eq("action", SNAPSHOT_ACTION)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        if (/pairing_change_log/i.test(error.message || "")) return null;
        throw error;
    }

    return data && Array.isArray(data.before_value?.rows) ? data : null;

};

const deleteSnapshots = async eventId => {

    const { error } = await supabase
        .from("pairing_change_log")
        .delete()
        .eq("event_id", eventId)
        .eq("action", SNAPSHOT_ACTION);

    if (error) throw error;

};

// Replace the event's rollback copy with `rows` (the list before a save)
const writeSnapshot = async ({ eventId, rows, singerById, adminId, adminName }) => {

    const genderOf = id => String(singerById.get(id)?.gender || "").toLowerCase();

    await deleteSnapshots(eventId);

    const { error } = await supabase
        .from("pairing_change_log")
        .insert({
            event_id: eventId,
            action: SNAPSHOT_ACTION,
            kind: "list",
            before_value: {
                rows: rows.map(row => ({
                    male_singer_id: row.male_singer_id || "",
                    female_singer_id: row.female_singer_id || "",
                    song_title: row.song_title,
                    movie: row.movie || "",
                    same_gender: Boolean(row.male_singer_id && row.female_singer_id) &&
                        genderOf(row.male_singer_id) === genderOf(row.female_singer_id)
                }))
            },
            after_value: null,
            changed_by: adminId,
            changed_by_name: adminName
        });

    if (error) throw error;

};

// Validates and saves a whole list. Throws httpError(400) with
// .problems when any row is wrong (nothing written then).
const applyFinalList = async ({ eventId, inputRows, admin, takeSnapshot = true }) => {

        const current = await loadFinalList(eventId);
        const { singerById } = current;
        const nameOf = id => singerById.get(id)?.singer_name || "";

        // --------------------------------------------------
        // VALIDATE EVERYTHING FIRST - nothing is written if
        // any row is wrong.
        // --------------------------------------------------

        const problems = [];
        const seen = new Set();

        const rows = inputRows.map((input, index) => {

            const line = `Row ${index + 1}`;
            const maleId = cleanText(input.male_singer_id);
            const femaleId = cleanText(input.female_singer_id);
            const title = cleanText(input.song_title);
            const movie = cleanText(input.movie);
            const ref = cleanText(input.ref) || null;

            if (!maleId && !femaleId) {
                problems.push(`${line}: pick at least one singer.`);
            }

            if (!title) {
                problems.push(`${line}: song name is missing.`);
            }

            // Two men (or two women) singing one song together is
            // allowed once the admin has confirmed it (same_gender).
            // Both columns then just hold "the two singers".
            const sameGender = input.same_gender === true && Boolean(maleId && femaleId);

            if (maleId && femaleId && maleId === femaleId) {
                problems.push(`${line}: the same singer is in both columns.`);
            }

            if (maleId) {
                const singer = singerById.get(maleId);
                if (!singer) problems.push(`${line}: male singer not found.`);
                else if (!sameGender && String(singer.gender).toLowerCase() !== "male") {
                    problems.push(`${line}: ${singer.singer_name} isn't a male singer.`);
                }
            }

            if (femaleId) {
                const singer = singerById.get(femaleId);
                if (!singer) problems.push(`${line}: female singer not found.`);
                else if (!sameGender && String(singer.gender).toLowerCase() !== "female") {
                    problems.push(`${line}: ${singer.singer_name} isn't a female singer.`);
                }
            }

            if (sameGender) {
                const a = String(singerById.get(maleId)?.gender || "").toLowerCase();
                const b = String(singerById.get(femaleId)?.gender || "").toLowerCase();
                if (a && b && a !== b) {
                    problems.push(`${line}: marked as a same-gender song, but the singers aren't the same gender.`);
                }
            }

            if (ref && !current.byRef.has(ref)) {
                problems.push(`${line}: this row changed since the page loaded - reload and try again.`);
            }

            // Order-free, so "A & B" and "B & A" singing the same
            // song count as the same row
            const key = `${[maleId, femaleId].sort().join("|")}|${normalizeTitle(title)}`;

            if (title && seen.has(key)) {
                problems.push(`${line}: duplicate of an earlier row.`);
            }

            seen.add(key);

            return { ref, maleId, femaleId, title, movie, solo: !(maleId && femaleId) };

        });

        const refsInInput = rows.map(row => row.ref).filter(Boolean);

        if (new Set(refsInInput).size !== refsInInput.length) {
            problems.push("The same row was sent twice - reload and try again.");
        }

        if (problems.length > 0) {
            throw Object.assign(httpError(400, problems.slice(0, 8).join(" ")), { problems });
        }

        // --------------------------------------------------
        // APPLY
        // --------------------------------------------------

        const adminId = admin?.id || null;
        const adminName = admin?.full_name || admin?.username || null;

        const describe = ({ maleId, femaleId, title, movie }) => ({
            male_singer: nameOf(maleId) || null,
            female_singer: nameOf(femaleId) || null,
            song: title,
            movie: movie || null
        });

        const describeRow = row => describe({
            maleId: row.male_singer_id,
            femaleId: row.female_singer_id,
            title: row.song_title,
            movie: row.movie
        });

        const log = [];
        const kept = new Set();

        for (const row of rows) {

            const orig = row.ref ? current.byRef.get(row.ref) : null;
            const kind = row.solo ? "solo" : "duet";
            const soloSingerId = row.maleId || row.femaleId;

            const sameTitle = orig && normalizeTitle(orig.song_title) === normalizeTitle(row.title);
            const sameKind = orig && orig.kind === kind;
            const titleTextChanged = orig && orig.song_title !== row.title;
            const movieChanged = orig && cleanText(orig.movie) !== row.movie;

            // Keep the same song row when it's the same song of the
            // same kind - only fix spelling / movie in place.
            let songId = sameTitle && sameKind ? orig.song_id : null;

            if (songId && (movieChanged || titleTextChanged)) {
                const { error } = await supabase
                    .from("songs")
                    .update({ title: row.title, movie: row.movie || null })
                    .eq("id", songId);
                if (error) throw error;
            }

            let pairingId = null;

            if (kind === "solo") {

                if (songId) {
                    if (orig.solo_singer_id !== soloSingerId) {
                        await setSolo(songId, { solo_status: "Approved", solo_singer_id: soloSingerId });
                    }
                }
                else {
                    songId = await createSong({
                        eventId,
                        title: row.title,
                        movie: row.movie,
                        solo: true,
                        soloSingerId
                    });
                }

                if (orig && orig.kind === "solo" && orig.song_id === songId) {
                    kept.add(orig.ref);
                }

            }
            else {

                if (!songId) {
                    songId = await createSong({
                        eventId,
                        title: row.title,
                        movie: row.movie,
                        solo: false
                    });
                }

                const unchanged =
                    orig && orig.kind === "duet" &&
                    orig.song_id === songId &&
                    orig.male_singer_id === row.maleId &&
                    orig.female_singer_id === row.femaleId;

                if (unchanged) {
                    kept.add(orig.ref);
                    pairingId = orig.pairing_id;
                }
                else {
                    pairingId = await approvePairing({
                        eventId,
                        songId,
                        maleId: row.maleId,
                        femaleId: row.femaleId,
                        adminId
                    });

                    if (orig && orig.kind === "duet" && orig.pairing_id === pairingId) {
                        kept.add(orig.ref);
                    }
                }

            }

            const after = describe(row);

            if (!orig) {
                log.push({ action: "added", kind, before_value: null, after_value: after, pairing_id: pairingId, song_id: songId });
            }
            else {
                const before = describeRow(orig);
                if (JSON.stringify(before) !== JSON.stringify(after)) {
                    log.push({ action: "changed", kind, before_value: before, after_value: after, pairing_id: pairingId, song_id: songId });
                }
            }

        }

        // Everyone on the saved list belongs to this event's roster.
        const listedSingerIds = [
            ...new Set(rows.flatMap(row => [row.maleId, row.femaleId]).filter(Boolean))
        ].filter(id => !current.eventSingerIds.has(id));

        for (const singerId of listedSingerIds) {
            await addToRoster(eventId, singerId);
        }

        // Rows that left the list: keep them, marked Rejected.
        const replacedRefs = new Set(rows.map(row => row.ref).filter(Boolean));

        for (const row of current.rows) {

            if (kept.has(row.ref)) {
                continue;
            }

            if (row.kind === "duet") {
                await rejectPairing(row.pairing_id);
            }
            else {
                await setSolo(row.song_id, { solo_status: "Rejected" });
            }

            // An edited row already has its own 'changed' entry.
            if (!replacedRefs.has(row.ref)) {
                log.push({
                    action: "removed",
                    kind: row.kind,
                    before_value: describeRow(row),
                    after_value: null,
                    pairing_id: row.pairing_id || null,
                    song_id: row.song_id
                });
            }

        }

        // Walk-ins: Pending payment + songs in step with the list
        const walkInWarnings = await syncWalkInsSafely(eventId);

        // Keep the list as it was before this save, for "Roll back"
        let snapshotWarning = "";

        if (takeSnapshot && log.length > 0) {
            try {
                await writeSnapshot({ eventId, rows: current.rows, singerById, adminId, adminName });
            }
            catch (snapshotError) {
                console.error("FINAL LIST SNAPSHOT:", snapshotError);
                snapshotWarning = " (The rollback copy couldn't be kept this time.)";
            }
        }

        // --------------------------------------------------
        // CHANGE LOG (for reports)
        // --------------------------------------------------

        let logWarning = "";

        if (log.length > 0) {

            const { error: logError } = await supabase
                .from("pairing_change_log")
                .insert(log.map(entry => ({
                    ...entry,
                    event_id: eventId,
                    changed_by: adminId,
                    changed_by_name: adminName
                })));

            if (logError) {
                console.error("PAIRING CHANGE LOG:", logError);
                logWarning = " (The change log couldn't be written - run backend/migrations/2026-11-24_final_pairing_list.sql in Supabase.)";
            }

        }

        const counts = log.reduce((acc, entry) => {
            acc[entry.action] = (acc[entry.action] || 0) + 1;
            return acc;
        }, {});

        const summary = ["added", "changed", "removed"]
            .filter(action => counts[action])
            .map(action => `${counts[action]} ${action}`)
            .join(", ");

        console.log(`✅ Final list saved (${summary || "no changes"}) by`, adminName);

        const warningText = walkInWarnings.length > 0
            ? ` ${walkInWarnings.join(" ")}`
            : "";

        return {
            summary,
            changes: log.length,
            warnings: walkInWarnings,
            warningText: `${logWarning}${snapshotWarning}${warningText}`
        };

};

const sendListError = (res, error, label, fallback) => {

    console.error(label, error);

    return res.status(error.status || 500).json({
        success: false,
        message: error.status ? error.message : fallback,
        problems: error.problems,
        error: error.message
    });

};

const saveFinalList = async (req, res) => {

    try {

        const eventId = await resolveEventId(req.body?.event_id);
        await loadEvent(eventId);

        const inputRows = Array.isArray(req.body?.rows) ? req.body.rows : null;

        if (!inputRows) {
            throw httpError(400, "rows must be a list.");
        }

        const result = await applyFinalList({ eventId, inputRows, admin: req.admin });

        return res.status(200).json({
            success: true,
            message: result.summary
                ? `Final list saved - ${result.summary}.${result.warningText}`
                : `No changes to save.${result.warningText}`,
            changes: result.changes,
            warnings: result.warnings
        });

    }

    catch (error) {
        return sendListError(res, error, "SAVE FINAL LIST:", "Unable to save the final pairing list.");
    }

};


// ==========================================================
// ROLL BACK THE LAST SAVE
//
// GET  /api/v1/admin/pairings/final/rollback?event_id=UUID
//      -> { available, rows, saved_at, saved_by }
// POST /api/v1/admin/pairings/final/rollback   { event_id }
//      -> puts back the list as it was before the last save.
//
// One level only: the copy is used up by the rollback (the next
// save makes a new one).
// ==========================================================

const getRollbackInfo = async (req, res) => {

    try {

        const eventId = await resolveEventId(req.query.event_id);
        const snapshot = await loadSnapshot(eventId);

        return res.status(200).json({
            success: true,
            available: Boolean(snapshot),
            rows: snapshot ? snapshot.before_value.rows.length : 0,
            saved_at: snapshot?.created_at || null,
            saved_by: snapshot?.changed_by_name || null
        });

    }

    catch (error) {
        return sendListError(res, error, "GET ROLLBACK INFO:", "Unable to check the rollback copy.");
    }

};

const rollbackFinalList = async (req, res) => {

    try {

        const eventId = await resolveEventId(req.body?.event_id);
        await loadEvent(eventId);

        const snapshot = await loadSnapshot(eventId);

        if (!snapshot) {
            throw httpError(404, "There's no earlier version to roll back to.");
        }

        // Rows that are still on the list keep their place (and
        // their Completed tick); the rest come back as new rows.
        const { rows: currentRows } = await loadFinalList(eventId);
        const unused = [...currentRows];
        const pairOf = (a, b) => [a, b].filter(Boolean).sort().join("|");

        const inputRows = snapshot.before_value.rows.map(row => {

            const index = unused.findIndex(existing =>
                pairOf(existing.male_singer_id, existing.female_singer_id) ===
                    pairOf(row.male_singer_id, row.female_singer_id) &&
                normalizeTitle(existing.song_title) === normalizeTitle(row.song_title)
            );

            const ref = index >= 0 ? unused.splice(index, 1)[0].ref : null;

            return { ...row, ref };

        });

        const result = await applyFinalList({
            eventId,
            inputRows,
            admin: req.admin,
            takeSnapshot: false
        });

        await deleteSnapshots(eventId);

        console.log(`↩️ Final list rolled back (${result.summary || "no changes"}) by`,
            req.admin?.full_name || req.admin?.username);

        return res.status(200).json({
            success: true,
            message: result.summary
                ? `Rolled back to the earlier list - ${result.summary}.${result.warningText}`
                : `The list already matches the earlier version.${result.warningText}`,
            changes: result.changes
        });

    }

    catch (error) {
        return sendListError(res, error, "ROLLBACK FINAL LIST:", "Unable to roll back the final pairing list.");
    }

};


// ==========================================================
// GET /api/v1/admin/pairings/change-log?event_id=UUID
// ==========================================================

// ==========================================================
// PUT /api/v1/admin/pairings/final/completed
// { event_id, ref, completed: true|false }
//
// Event day: tick a song once it has been sung. Saved at once -
// separate from "Save final list".
// ==========================================================

const setRowCompleted = async (req, res) => {

    try {

        const eventId = await resolveEventId(req.body?.event_id);
        await loadEvent(eventId);

        const ref = cleanText(req.body?.ref);
        const completed = req.body?.completed === true;

        if (!ref) {
            throw httpError(400, "ref is required.");
        }

        const { byRef } = await loadFinalList(eventId);

        if (!byRef.has(ref)) {
            throw httpError(409, "This song isn't on the saved list any more - reload the page.");
        }

        const query = completed
            ? supabase
                .from("final_list_progress")
                .upsert({
                    event_id: eventId,
                    row_ref: ref,
                    completed_at: new Date().toISOString(),
                    completed_by: req.admin?.full_name || req.admin?.username || null
                }, { onConflict: "event_id,row_ref" })
            : supabase
                .from("final_list_progress")
                .delete()
                .eq("event_id", eventId)
                .eq("row_ref", ref);

        const { error } = await query;

        if (error) {
            if (isMissingProgressTable(error)) throw httpError(503, PROGRESS_MIGRATION_MESSAGE);
            throw error;
        }

        return res.status(200).json({ success: true, ref, completed });

    }

    catch (error) {

        console.error("SET ROW COMPLETED:", error);

        return res.status(error.status || 500).json({
            success: false,
            message: error.status ? error.message : "Unable to update the song.",
            error: error.message
        });

    }

};

const getChangeLog = async (req, res) => {

    try {

        const eventId = await resolveEventId(req.query.event_id);

        const { data, error } = await supabase
            .from("pairing_change_log")
            .select("id,action,kind,before_value,after_value,changed_by_name,created_at")
            .eq("event_id", eventId)
            .neq("action", SNAPSHOT_ACTION)
            .order("created_at", { ascending: false })
            .limit(500);

        if (error) {

            if (/pairing_change_log/i.test(error.message || "")) {
                return res.status(200).json({ success: true, entries: [], not_set_up: true });
            }

            throw error;

        }

        return res.status(200).json({ success: true, entries: data || [] });

    }

    catch (error) {

        console.error("GET CHANGE LOG:", error);

        return res.status(error.status || 500).json({
            success: false,
            message: error.status ? error.message : "Unable to load the change log.",
            error: error.message
        });

    }

};


module.exports = {
    getFinalList,
    saveFinalList,
    getRollbackInfo,
    rollbackFinalList,
    getChangeLog,
    setRowCompleted,
    addEventSinger,
    registerEventSingers
};
