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
    bulkDecidePairings
} = require("../../controllers/v1/pairingController");

const {
    getSingersPerEvent,
    getFinanceByEvent,
    getEventAnalytics
} = require("../../controllers/v1/superAdminStatsController");

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
