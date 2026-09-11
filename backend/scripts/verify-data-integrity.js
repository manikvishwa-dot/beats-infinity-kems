require("dotenv").config();
const { supabase } = require("../config/supabase");
const { loadEventData, runChecks } = require("../services/dataAuditService");

// ==========================================================
// BEATS INFINITY - DATA INTEGRITY AUDIT (CLI)
// ==========================================================
//
// Acts as a QA pass over one event's data - everything the
// Admin and Super Admin dashboards (Singers, Songs, Pairing,
// Payments, Finance) ultimately read from. Run it any time you
// want to sanity-check an event before/after an import, before
// an event goes live, or when something in the dashboards looks
// off.
//
// The check logic itself lives in ../services/dataAuditService.js
// (runChecks) - this script is just the CLI wrapper around it.
// The same service backs the "Maggie" page in the Admin/Super
// Admin dashboards (controllers/v1/maggieController.js), so the
// CLI and the dashboard can never drift apart.
//
// Usage:
//   node scripts/verify-data-integrity.js                  (active event)
//   node scripts/verify-data-integrity.js <event_id>        (specific event)
//   node scripts/verify-data-integrity.js --all             (every event)
//
// Exits with code 1 if any HIGH severity finding exists, so it
// can be used as a pass/fail gate too.
// ==========================================================

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
