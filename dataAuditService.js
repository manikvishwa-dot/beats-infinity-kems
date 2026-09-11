const { supabase } = require("../config/supabase");

// ==========================================================
// BEATS INFINITY - DATA AUDIT SERVICE  ("Maggie")
// ==========================================================
//
// Single source of truth for the data-integrity checks that
// back both:
//
//   - the CLI script (scripts/verify-data-integrity.js), and
//   - the Maggie admin-dashboard feature (controllers/v1/maggieController.js)
//
// Keeping the check logic here (rather than duplicated in both
// places) means the CLI and the dashboard can never quietly
// drift apart. See .claude/skills/pairing-audit/SKILL.md for the
// full description of what each check catches and why.
//
// The checks themselves are fully deterministic - no LLM
// involved - so the same input always produces the same
// findings.
// ==========================================================

const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");


// ==========================================================
// HUMAN-READABLE SUGGESTIONS, PER FINDING CATEGORY
//
// Shown in the dashboard next to each finding so an admin
// knows what to actually DO about it, not just that something
// is wrong. Kept separate from the check logic itself so wording
// can be tuned without touching runChecks().
// ==========================================================

const SUGGESTIONS = {

    "orphaned-reference":
        "This row points to a singer/song that no longer exists - likely " +
        "a delete that didn't cascade. Recreate the missing record, or " +
        "clear/re-point this reference directly in Supabase.",

    "duplicate-pairing":
        "The exact same pairing was inserted more than once. Open Pairing " +
        "Management and remove the extra copy, keeping just one.",

    "repeated-singer-on-song":
        "Not necessarily wrong - confirm this singer genuinely has two " +
        "separate pairings for the same song (e.g. two different partners) " +
        "rather than a duplicate entry.",

    "same-gender-song-duplicate":
        "Often a copy/paste or transcription slip rather than a real " +
        "coincidence. Confirm with the singers whether this is intentional, " +
        "or reassign one of them to a different song in Pairing Management.",

    "pending-payment":
        "Awaiting an admin decision. Approve or reject this payment in " +
        "Payment Management.",

    "pending-pairing":
        "Awaiting an admin decision. Approve or reject this pairing in " +
        "Pairing Management.",

    "paid-not-paired":
        "The most actionable finding - this singer has paid but their " +
        "pairing decision was never made. Pair them to a song in Pairing " +
        "Management, or refund them if they're withdrawing.",

    "unpaired-singer":
        "This singer has registration/payment activity but no pairing yet. " +
        "Follow up to see whether a pairing is still expected."

};

const suggestionFor = category =>
    SUGGESTIONS[category] || "Review this finding and decide whether action is needed.";


// ==========================================================
// LOAD DATA
// ==========================================================

async function loadEventData(eventId) {

    const [{ data: singers }, { data: songs }, { data: pairings }, { data: payments }] = await Promise.all([
        supabase.from("singers").select("*"),
        supabase.from("songs").select("*").eq("event_id", eventId),
        supabase.from("pairings").select("*").eq("event_id", eventId),
        supabase.from("payments").select("*").eq("event_id", eventId)
    ]);

    return { singers: singers || [], songs: songs || [], pairings: pairings || [], payments: payments || [] };

}

async function loadActiveEvent() {

    const { data, error } = await supabase
        .from("events")
        .select("id,name")
        .eq("is_active", true)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("No active event found - pass an event id, or use the 'all events' view explicitly.");

    return data;

}

async function loadEventById(eventId) {

    const { data, error } = await supabase
        .from("events")
        .select("id,name")
        .eq("id", eventId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error(`No event found with id ${eventId}`);

    return data;

}

async function loadAllEvents() {

    const { data, error } = await supabase.from("events").select("id,name");

    if (error) throw error;
    return data || [];

}


// ==========================================================
// CHECKS
//
// Event-scoped (singers are global, but songs/pairings/payments
// are all filtered by event_id) so running this against one
// event never gets confused by another event's data.
// ==========================================================

function runChecks({ singers, songs, pairings, payments }) {

    const findings = [];

    const singerById = new Map(singers.map(s => [s.id, s]));
    const songById = new Map(songs.map(s => [s.id, s]));

    const add = (severity, category, message, detail) =>
        findings.push({
            severity,
            category,
            message,
            detail: detail || null,
            suggestion: suggestionFor(category)
        });


    // ------------------------------------------------------
    // A. ORPHANED REFERENCES - data the dashboards can't even
    //    resolve to a name, which usually renders as a blank
    //    or "undefined" row in the UI.
    // ------------------------------------------------------

    pairings.forEach(p => {

        if (!songById.has(p.song_id)) {
            add("high", "orphaned-reference",
                `Pairing ${p.id} points to a song_id that no longer exists.`,
                { pairing_id: p.id, song_id: p.song_id });
        }

        if (!singerById.has(p.male_singer_id)) {
            add("high", "orphaned-reference",
                `Pairing ${p.id} points to a male_singer_id that no longer exists.`,
                { pairing_id: p.id, male_singer_id: p.male_singer_id });
        }

        if (!singerById.has(p.female_singer_id)) {
            add("high", "orphaned-reference",
                `Pairing ${p.id} points to a female_singer_id that no longer exists.`,
                { pairing_id: p.id, female_singer_id: p.female_singer_id });
        }

    });

    payments.forEach(pay => {

        if (!singerById.has(pay.singer_id)) {
            add("high", "orphaned-reference",
                `Payment ${pay.id} points to a singer_id that no longer exists.`,
                { payment_id: pay.id, singer_id: pay.singer_id });
        }

        (pay.selected_song_ids || []).forEach(sid => {
            if (!songById.has(sid)) {
                add("medium", "orphaned-reference",
                    `Payment ${pay.id} references a selected song_id that no longer exists.`,
                    { payment_id: pay.id, song_id: sid });
            }
        });

    });


    // ------------------------------------------------------
    // B. DUPLICATE PAIRINGS
    // ------------------------------------------------------

    const pairingKeyCounts = new Map();

    pairings.forEach(p => {
        const key = `${p.song_id}|${p.male_singer_id}|${p.female_singer_id}`;
        pairingKeyCounts.set(key, (pairingKeyCounts.get(key) || 0) + 1);
    });

    pairingKeyCounts.forEach((count, key) => {
        if (count > 1) {
            const [songId, maleId, femaleId] = key.split("|");
            add("high", "duplicate-pairing",
                `The exact same pairing (song + both singers) appears ${count} times.`,
                {
                    song: songById.get(songId)?.title || songId,
                    male: singerById.get(maleId)?.singer_name || maleId,
                    female: singerById.get(femaleId)?.singer_name || femaleId,
                    count
                });
        }
    });

    // Same singer paired to the same song multiple times with DIFFERENT
    // partners - not necessarily wrong, but worth a human glance.
    const songSingerCounts = new Map(); // songId -> singerId -> count

    pairings.forEach(p => {
        [p.male_singer_id, p.female_singer_id].forEach(sid => {
            if (!songSingerCounts.has(p.song_id)) songSingerCounts.set(p.song_id, new Map());
            const m = songSingerCounts.get(p.song_id);
            m.set(sid, (m.get(sid) || 0) + 1);
        });
    });

    songSingerCounts.forEach((singerMap, songId) => {
        singerMap.forEach((count, singerId) => {
            if (count > 1) {
                add("low", "repeated-singer-on-song",
                    `${singerById.get(singerId)?.singer_name || singerId} appears in ${count} separate pairings for the same song "${songById.get(songId)?.title || songId}".`,
                    { song_id: songId, singer_id: singerId, count });
            }
        });
    });


    // ------------------------------------------------------
    // C. SAME-GENDER SONG TITLE DUPLICATION
    //    Same song TITLE used by two different singers of the
    //    SAME gender (in their own separate pairings) - often
    //    a copy/paste or transcription slip, not a real coincidence.
    // ------------------------------------------------------

    const maleTitleMap = new Map(); // normalized title -> Set(male singer names)
    const femaleTitleMap = new Map();

    pairings.forEach(p => {

        const title = norm(songById.get(p.song_id)?.title);
        if (!title || title === "tbd") return;

        const maleName = singerById.get(p.male_singer_id)?.singer_name || p.male_singer_id;
        const femaleName = singerById.get(p.female_singer_id)?.singer_name || p.female_singer_id;

        if (!maleTitleMap.has(title)) maleTitleMap.set(title, new Set());
        maleTitleMap.get(title).add(maleName);

        if (!femaleTitleMap.has(title)) femaleTitleMap.set(title, new Set());
        femaleTitleMap.get(title).add(femaleName);

    });

    const reportGenderDupes = (map, label) => {
        map.forEach((names, title) => {
            if (names.size > 1) {
                add("medium", "same-gender-song-duplicate",
                    `"${title}" is sung by ${names.size} different ${label} singers.`,
                    { title, singers: [...names] });
            }
        });
    };

    reportGenderDupes(maleTitleMap, "male");
    reportGenderDupes(femaleTitleMap, "female");


    // ------------------------------------------------------
    // D. UNAPPROVED PAYMENTS / PAIRINGS
    // ------------------------------------------------------

    payments.filter(p => p.status === "Pending").forEach(p => {
        add("medium", "pending-payment",
            `${singerById.get(p.singer_id)?.singer_name || p.singer_id} has a Pending payment awaiting confirmation.`,
            { payment_id: p.id, singer_id: p.singer_id, amount: p.amount });
    });

    pairings.filter(p => p.status === "Pending").forEach(p => {
        add("medium", "pending-pairing",
            `A pairing for "${songById.get(p.song_id)?.title || p.song_id}" is still Pending admin decision.`,
            { pairing_id: p.id, song_id: p.song_id });
    });


    // ------------------------------------------------------
    // E. PAID BUT NOT PAIRED
    // ------------------------------------------------------

    const pairedSingerIds = new Set();
    pairings.forEach(p => {
        pairedSingerIds.add(p.male_singer_id);
        pairedSingerIds.add(p.female_singer_id);
    });

    payments.filter(p => p.status === "Paid").forEach(p => {
        if (!pairedSingerIds.has(p.singer_id)) {
            add("high", "paid-not-paired",
                `${singerById.get(p.singer_id)?.singer_name || p.singer_id} has paid but has no pairing yet.`,
                { singer_id: p.singer_id, payment_id: p.id });
        }
    });


    // ------------------------------------------------------
    // F. SINGERS WITH NO PAIRING AT ALL, DESPITE ACTIVITY
    //    (paid, or has a payment of any status) in this event
    // ------------------------------------------------------

    const singersWithPaymentActivity = new Set(payments.map(p => p.singer_id));

    singersWithPaymentActivity.forEach(singerId => {
        if (!pairedSingerIds.has(singerId)) {
            const s = singerById.get(singerId);
            // already reported above under paid-not-paired if Paid;
            // this catches Pending/Rejected payment singers too.
            const payment = payments.find(p => p.singer_id === singerId);
            if (payment && payment.status !== "Paid") {
                add("low", "unpaired-singer",
                    `${s?.singer_name || singerId} has registered/paid activity (${payment.status}) but no pairing.`,
                    { singer_id: singerId, payment_status: payment.status });
            }
        }
    });


    return findings;

}


// ==========================================================
// SUMMARIZE
// ==========================================================

function summarize(findings) {

    const summary = { high: 0, medium: 0, low: 0, total: findings.length };

    findings.forEach(f => { summary[f.severity] = (summary[f.severity] || 0) + 1; });

    return summary;

}


// ==========================================================
// AUDIT ONE EVENT (the shared entry point both the CLI and
// the dashboard controller call)
// ==========================================================

async function auditEvent(eventId) {

    const event = eventId ? await loadEventById(eventId) : await loadActiveEvent();
    const data = await loadEventData(event.id);
    const findings = runChecks(data);

    return { event, findings, summary: summarize(findings) };

}

async function auditAllEvents() {

    const events = await loadAllEvents();

    const results = [];

    for (const event of events) {
        const data = await loadEventData(event.id);
        const findings = runChecks(data);
        results.push({ event, findings, summary: summarize(findings) });
    }

    return results;

}


module.exports = {
    loadEventData,
    loadActiveEvent,
    loadEventById,
    loadAllEvents,
    runChecks,
    summarize,
    suggestionFor,
    auditEvent,
    auditAllEvents
};
