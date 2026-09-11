---
description: Audits one event's singers/songs/pairings/payments for data problems the Admin and Super Admin dashboards would otherwise surface as broken or confusing rows - unpaired singers, duplicate pairings, same-gender song title collisions, paid-but-unpaired singers, and anything still Pending. Use when asked to check/verify/audit the pairing list, sanity-check an event's data, or QA the admin dashboards before or after an event.
---

# Pairing & Event Data Audit

Acts as a test manager for the data behind the Admin/Super Admin
dashboards (Singers, Songs, Pairing, Payments, Finance) - not the UI
itself, the data those screens read. Most "the dashboard looks wrong"
reports trace back to a data problem this catches directly.

## Running it

```
cd backend
node scripts/verify-data-integrity.js              # active event
node scripts/verify-data-integrity.js <event_id>    # a specific event
node scripts/verify-data-integrity.js --all         # every event
```

The script is fully deterministic (no LLM involved in the checks
themselves) and prints a severity-ranked report, then writes the full
structured findings to `backend/scripts/last-audit-result.json`
(gitignored - a fresh copy every run).

## What it checks

- **Orphaned references** (high) - a pairing or payment pointing at a
  song/singer id that no longer exists. This is what makes a
  dashboard row render blank or "undefined".
- **Duplicate pairings** (high) - the exact same song+male+female
  combination inserted more than once.
- **Paid but not paired** (high) - a singer with a `Paid` payment who
  has zero pairings in this event. The most actionable finding -
  usually means their pairing decision was simply never made.
- **Same-gender song duplicates** (medium) - the same song title sung
  by two different singers of the same gender, in separate pairings.
  Often a copy/paste or transcription slip rather than a real
  coincidence - flag it, don't auto-fix it.
- **Pending payments / pending pairings** (medium) - anything still
  awaiting an admin decision.
- **Unpaired singers with any payment activity** (low) - broader net
  than "paid but not paired" - catches Pending/Rejected payments too.
- **Repeated singer on the same song** (low) - a singer appearing in
  more than one pairing for an identical song row - not necessarily
  wrong, worth a glance.

## After running it

1. Read the console report (or `last-audit-result.json` for the full
   detail) and lead with HIGH severity findings - these are the ones
   that would visibly break a dashboard screen or misrepresent money
   collected.
2. For each finding, name the specific row (singer/song/pairing) and
   what's actually wrong - not just which check tripped.
3. Before fixing anything found here, follow the same rule as any
   other destructive/data-correcting change in this project: show the
   user exactly what you're about to change and get their go-ahead
   first, the same way the Kondattam import review worked. Data
   audits surface problems - they don't authorize fixing them
   silently.
4. If a finding looks like it might be a false positive given
   context you know (e.g. a legitimate male-male or female-female
   duet, which this script does NOT flag on its own since it checks
   by id not by gender-vs-slot), say so rather than treating every
   finding as automatically wrong.

## Extending it

The check logic lives entirely in
`backend/scripts/verify-data-integrity.js` (`runChecks`) - add a new
check there as another `add(severity, category, message, detail)`
call. Keep checks event-scoped (singers are global, but
songs/pairings/payments are all filtered by `event_id`) so running
this against one event never gets confused by another event's data.
