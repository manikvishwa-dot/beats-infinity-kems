require("dotenv").config();
const { supabase } = require("../config/supabase");

// ==========================================================
// BEATS INFINITY - DATA INTEGRITY AUDIT
// ==========================================================
//
// Acts as a QA pass over one event's data - everything the
// Admin and Super Admin dashboards (Singers, Songs, Pairing,
// Payments, Finance) ultimately read from. Run it any time you
// want to sanity-check an event before/after an import, before
// an event goes live, or when something in the dashboards looks
// off.
//
// Usage:
//   node scripts/verify-data-integrity.js                  (active event)
//   node scripts/verify-data-integrity.js <event_id>        (specific event)
//   node scripts/verify-data-integrity.js --all             (every event)
//
// Exits with code 1 if any HIGH severity finding exists, so it
// can be used as a pass/fail gate too.
// ==========================================================

const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

async function loadEventData(eventId) {

    const [{ data: singers }, { data: songs }, { data: pairings }, { data: payments }] = await Promise.all([
        supabase.from("singers").select("*"),
        supabase.from("songs").select("*").eq("event_id", eventId),
        supabase.from("pairings").select("*").eq("event_id", eventId),
        supabase.from("payments").select("*").eq("event_id", eventId)
    ]);

    return { singers: singers || [], songs: songs || [], pairings: pairings || [], payments: payments || [] };

}

function runChecks({ singers, songs, pairings, payments }) {

    const findings = [];

    const singerById = new Map(singers.map(s => [s.id, s]));
    const songById = new Map(songs.map(s => [s.id, s]));

    const add = (severity, category, message, detail) =>
        findings.push({ severity, category, message, detail: detail || null });


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

function printReport(eventLabel, findings) {

    const bySeverity = { high: [], medium: [], low: [] };
    findings.forEach(f => bySeverity[f.severity].push(f));

    console.log(`\n${"=".repeat(60)}`);
    console.log(`DATA INTEGRITY AUDIT - ${eventLabel}`);
    console.log("=".repeat(60));
    console.log(`HIGH: ${bySeverity.high.length}   MEDIUM: ${bySeverity.medium.length}   LOW: ${bySeverity.low.length}`);

    ["high", "medium", "low"].forEach(sev => {

        if (bySeverity[sev].length === 0) return;

        console.log(`\n--- ${sev.toUpperCase()} ---`);

        bySeverity[sev].forEach(f => {
            console.log(`  [${f.category}] ${f.message}`);
        });

    });

    if (findings.length === 0) {
        console.log("\nNo issues found - this event's data looks clean.");
    }

    console.log("");

}

async function main() {

    const arg = process.argv[2];

    let events = [];

    if (arg === "--all") {

        const { data } = await supabase.from("events").select("id,name");
        events = data || [];

    }
    else if (arg) {

        const { data } = await supabase.from("events").select("id,name").eq("id", arg).maybeSingle();
        if (!data) throw new Error(`No event found with id ${arg}`);
        events = [data];

    }
    else {

        const { data } = await supabase.from("events").select("id,name").eq("is_active", true).maybeSingle();
        if (!data) throw new Error("No active event found - pass an event id or --all explicitly.");
        events = [data];

    }

    let anyHigh = false;
    const allFindings = {};

    for (const event of events) {

        const data = await loadEventData(event.id);
        const findings = runChecks(data);

        allFindings[event.id] = { event, findings };

        printReport(`${event.name} (${event.id})`, findings);

        if (findings.some(f => f.severity === "high")) anyHigh = true;

    }

    require("fs").writeFileSync(
        require("path").join(__dirname, "last-audit-result.json"),
        JSON.stringify(allFindings, null, 2)
    );

    console.log("Full findings written to scripts/last-audit-result.json\n");

    process.exit(anyHigh ? 1 : 0);

}

main().catch(e => {
    console.error("AUDIT FAILED:", e.message);
    process.exit(1);
});
