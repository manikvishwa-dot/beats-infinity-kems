const express = require("express");

const router = express.Router();

const {
    getSingersOverview,
    getAllSingers,
    bulkUpdateSingers
} = require("../../controllers/v1/adminDashboardController");

const {
    getSuggestions,
    decidePairing,
    bulkDecidePairings,
    decideSolo
} = require("../../controllers/v1/pairingController");

const {
    getFinalList,
    saveFinalList,
    getChangeLog,
    addEventSinger,
    setRowCompleted,
    registerEventSingers
} = require("../../controllers/v1/finalPairingController");

const {
    getSingersPerEvent,
    getFinanceByEvent,
    getEventAnalytics
} = require("../../controllers/v1/superAdminStatsController");

const { getDashboardOverview } = require("../../controllers/v1/adminInsightsController");

const {
    requireAdmin,
    requireSuperAdmin
} = require("../../middleware/requireAdminAuth");


// ==========================================================
// SINGERS OVERVIEW
//
// GET /api/v1/admin/singers-overview
// ==========================================================

router.get(
    "/singers-overview",
    requireAdmin,
    getSingersOverview
);


// ==========================================================
// ALL SINGERS (ROSTER)
//
// GET /api/v1/admin/singers
// ==========================================================

router.get(
    "/singers",
    requireAdmin,
    getAllSingers
);


// ==========================================================
// BULK UPDATE SINGERS (Excel import)
//
// PUT /api/v1/admin/singers/bulk
// ==========================================================

router.put(
    "/singers/bulk",
    requireAdmin,
    bulkUpdateSingers
);


// ==========================================================
// PAIRING SUGGESTIONS
//
// GET /api/v1/admin/pairings/suggestions
// ==========================================================

router.get(
    "/pairings/suggestions",
    requireAdmin,
    getSuggestions
);


// ==========================================================
// DECIDE PAIRING (approve / reject / manual)
//
// POST /api/v1/admin/pairings/decide
// ==========================================================

router.post(
    "/pairings/decide",
    requireAdmin,
    decidePairing
);


// ==========================================================
// DECIDE SOLO (approve / reject / undo)
//
// POST /api/v1/admin/pairings/solo
// ==========================================================

router.post(
    "/pairings/solo",
    requireAdmin,
    decideSolo
);


// ==========================================================
// FINAL PAIRING LIST (event-day list, editable as a whole)
//
// GET /api/v1/admin/pairings/final?event_id=UUID
// PUT /api/v1/admin/pairings/final
// GET /api/v1/admin/pairings/change-log?event_id=UUID
// ==========================================================

router.get(
    "/pairings/final",
    requireAdmin,
    getFinalList
);

router.put(
    "/pairings/final",
    requireAdmin,
    saveFinalList
);

// POST /api/v1/admin/pairings/final/singers - add a walk-in singer
router.post(
    "/pairings/final/singers",
    requireAdmin,
    addEventSinger
);

// Event day: tick a song as completed (saved at once)
router.put(
    "/pairings/final/completed",
    requireAdmin,
    setRowCompleted
);

// Register several singers at once (names from an uploaded list)
router.post(
    "/pairings/final/singers/bulk",
    requireAdmin,
    registerEventSingers
);

router.get(
    "/pairings/change-log",
    requireAdmin,
    getChangeLog
);


// ==========================================================
// BULK DECIDE PAIRINGS (Excel import)
//
// POST /api/v1/admin/pairings/bulk-decide
// ==========================================================

router.post(
    "/pairings/bulk-decide",
    requireAdmin,
    bulkDecidePairings
);


// ==========================================================
// ADMIN DASHBOARD INSIGHTS (no money - any admin)
//
// GET /api/v1/admin/stats/overview
// ==========================================================

router.get(
    "/stats/overview",
    requireAdmin,
    getDashboardOverview
);


// ==========================================================
// SUPER ADMIN STATS - SINGERS PER EVENT (last 6 months)
//
// GET /api/v1/admin/stats/singers-per-event
// ==========================================================

router.get(
    "/stats/singers-per-event",
    requireSuperAdmin,
    getSingersPerEvent
);


// ==========================================================
// SUPER ADMIN STATS - FINANCE BY EVENT (last 6 months)
//
// GET /api/v1/admin/stats/finance-by-event
// ==========================================================

router.get(
    "/stats/finance-by-event",
    requireSuperAdmin,
    getFinanceByEvent
);


// ==========================================================
// SUPER ADMIN STATS - EVENT ANALYTICS (last 6 months)
//
// GET /api/v1/admin/stats/event-analytics
// ==========================================================

router.get(
    "/stats/event-analytics",
    requireSuperAdmin,
    getEventAnalytics
);


console.log(
    "✅ Admin dashboard routes loaded successfully"
);

console.log(
    "GET    /api/v1/admin/singers-overview"
);

console.log(
    "GET    /api/v1/admin/singers"
);

console.log(
    "PUT    /api/v1/admin/singers/bulk"
);

console.log(
    "GET    /api/v1/admin/pairings/suggestions"
);

console.log(
    "POST   /api/v1/admin/pairings/decide"
);

console.log(
    "POST   /api/v1/admin/pairings/bulk-decide"
);

console.log(
    "GET    /api/v1/admin/stats/singers-per-event"
);

console.log(
    "GET    /api/v1/admin/stats/finance-by-event"
);

console.log(
    "GET    /api/v1/admin/stats/event-analytics"
);


module.exports = router;
