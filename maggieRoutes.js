const express = require("express");

const router = express.Router();

const {
    getAudit,
    getAuditAllEvents
} = require("../../controllers/v1/maggieController");

const {
    requireAdmin,
    requireSuperAdmin
} = require("../../middleware/requireAdminAuth");


// ==========================================================
// MAGGIE - DATA AUDIT ROUTES
// ==========================================================
//
// Mounted at /api/v1/admin (see server.js), same prefix as
// adminAuthRoutes / adminDashboardRoutes.
// ==========================================================


// ==========================================================
// AUDIT ONE EVENT (active event, or ?event_id=UUID)
//
// GET /api/v1/admin/maggie/audit
// ==========================================================

router.get(
    "/maggie/audit",
    requireAdmin,
    getAudit
);


// ==========================================================
// AUDIT ACROSS ALL EVENTS - SUPER ADMIN ONLY
//
// GET /api/v1/admin/maggie/audit/all
// ==========================================================

router.get(
    "/maggie/audit/all",
    requireSuperAdmin,
    getAuditAllEvents
);


console.log(
    "✅ Maggie (data audit) routes loaded successfully"
);

console.log(
    "GET    /api/v1/admin/maggie/audit"
);

console.log(
    "GET    /api/v1/admin/maggie/audit/all"
);


module.exports = router;
