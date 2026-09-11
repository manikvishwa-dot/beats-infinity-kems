const {
    auditEvent,
    auditAllEvents
} = require("../../services/dataAuditService");

// ==========================================================
// BEATS INFINITY - MAGGIE (DATA AUDIT) CONTROLLER
// ==========================================================
//
// Maggie acts as a test manager for the data behind the Admin
// and Super Admin dashboards (Singers, Songs, Pairing, Payments)
// - not the UI itself, the data those screens read. Most
// "the dashboard looks wrong" reports trace back to a data
// problem this catches directly.
//
// Both endpoints below reuse ../../services/dataAuditService.js,
// the same logic the CLI script (scripts/verify-data-integrity.js)
// runs - so the dashboard and the CLI never disagree.
// ==========================================================


// ==========================================================
// AUDIT ONE EVENT
//
// GET /api/v1/admin/maggie/audit
// GET /api/v1/admin/maggie/audit?event_id=UUID
//
// Defaults to the active event when event_id is omitted, same
// as the CLI script with no argument. Available to admin and
// super_admin.
// ==========================================================

const getAudit = async (req, res) => {

    try {

        const { event_id: eventId } = req.query || {};

        const result = await auditEvent(eventId || null);

        return res.status(200).json({

            success: true,

            ...result

        });

    }

    catch (error) {

        console.error("MAGGIE AUDIT EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to run the audit.",
            error: error.message
        });

    }

};


// ==========================================================
// AUDIT ACROSS ALL EVENTS - SUPER ADMIN ONLY
//
// GET /api/v1/admin/maggie/audit/all
//
// Cross-event view, mirroring `node verify-data-integrity.js --all`.
// Restricted to Super Admin the same way the other cross-event
// reporting (stats/*) is - it's a heavier query and a broader
// view than day-to-day operational work needs.
// ==========================================================

const getAuditAllEvents = async (req, res) => {

    try {

        const results = await auditAllEvents();

        const grandTotal = results.reduce(
            (acc, r) => ({
                high: acc.high + r.summary.high,
                medium: acc.medium + r.summary.medium,
                low: acc.low + r.summary.low,
                total: acc.total + r.summary.total
            }),
            { high: 0, medium: 0, low: 0, total: 0 }
        );

        return res.status(200).json({

            success: true,

            events: results,

            grand_total: grandTotal

        });

    }

    catch (error) {

        console.error("MAGGIE AUDIT ALL EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to run the audit across events.",
            error: error.message
        });

    }

};


module.exports = {
    getAudit,
    getAuditAllEvents
};
