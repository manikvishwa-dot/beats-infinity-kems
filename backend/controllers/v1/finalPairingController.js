const { supabase } = require("../../config/supabase");
const { getActiveEventId } = require("../../utils/activeEvent");
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

    // Every singer, so last-minute replacements who didn't
    // register for this event can still be picked.
    const { data: allSingers, error: singersError } = await supabase
        .from("singers")
        .select("id,singer_name,gender")
        .order("singer_name", { ascending: true });

    if (singersError) {
        throw singersError;
    }

    const singerById = new Map((allSingers || []).map(singer => [singer.id, singer]));
    const eventSingerIds = new Set(eventSingers.map(singer => singer.id));

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

        const { rows, allSingers, eventSingerIds } = await loadFinalList(eventId);

        return res.status(200).json({
            success: true,
            event_id: event.id,
            event_name: event.name,
            rows: rows.map(row => ({
                ref: row.ref,
                male_singer_id: row.male_singer_id || "",
                female_singer_id: row.female_singer_id || "",
                song_title: row.song_title,
                movie: row.movie || ""
            })),
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


// ==========================================================
// PUT /api/v1/admin/pairings/final
//
// Body: { event_id, rows: [{ ref, male_singer_id,
//                             female_singer_id, song_title, movie }] }
// ==========================================================

const saveFinalList = async (req, res) => {

    try {

        const eventId = await resolveEventId(req.body?.event_id);
        await loadEvent(eventId);

        const inputRows = Array.isArray(req.body?.rows) ? req.body.rows : null;

        if (!inputRows) {
            throw httpError(400, "rows must be a list.");
        }

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

            if (maleId) {
                const singer = singerById.get(maleId);
                if (!singer) problems.push(`${line}: male singer not found.`);
                else if (String(singer.gender).toLowerCase() !== "male") {
                    problems.push(`${line}: ${singer.singer_name} isn't a male singer.`);
                }
            }

            if (femaleId) {
                const singer = singerById.get(femaleId);
                if (!singer) problems.push(`${line}: female singer not found.`);
                else if (String(singer.gender).toLowerCase() !== "female") {
                    problems.push(`${line}: ${singer.singer_name} isn't a female singer.`);
                }
            }

            if (ref && !current.byRef.has(ref)) {
                problems.push(`${line}: this row changed since the page loaded - reload and try again.`);
            }

            const key = `${maleId}|${femaleId}|${normalizeTitle(title)}`;

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
            return res.status(400).json({
                success: false,
                message: problems.slice(0, 8).join(" "),
                problems
            });
        }

        // --------------------------------------------------
        // APPLY
        // --------------------------------------------------

        const adminId = req.admin?.id || null;
        const adminName = req.admin?.full_name || req.admin?.username || null;

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

        return res.status(200).json({
            success: true,
            message: summary
                ? `Final list saved - ${summary}.${logWarning}`
                : "No changes to save.",
            changes: log.length
        });

    }

    catch (error) {

        console.error("SAVE FINAL LIST:", error);

        return res.status(error.status || 500).json({
            success: false,
            message: error.status ? error.message : "Unable to save the final pairing list.",
            error: error.message
        });

    }

};


// ==========================================================
// GET /api/v1/admin/pairings/change-log?event_id=UUID
// ==========================================================

const getChangeLog = async (req, res) => {

    try {

        const eventId = await resolveEventId(req.query.event_id);

        const { data, error } = await supabase
            .from("pairing_change_log")
            .select("id,action,kind,before_value,after_value,changed_by_name,created_at")
            .eq("event_id", eventId)
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
    getChangeLog
};
