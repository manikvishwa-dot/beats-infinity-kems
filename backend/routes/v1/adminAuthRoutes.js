const express = require("express");

const router = express.Router();


// ==========================================================
// ADMIN AUTH CONTROLLER
// ==========================================================

const {
    login,
    logout,
    me
} = require("../../controllers/v1/adminAuthController");

const {
    requireAdmin
} = require("../../middleware/requireAdminAuth");


// ==========================================================
// LOGIN
//
// POST /api/v1/admin/login
// ==========================================================

router.post(
    "/login",
    login
);


// ==========================================================
// LOGOUT
//
// POST /api/v1/admin/logout
// ==========================================================

router.post(
    "/logout",
    requireAdmin,
    logout
);


// ==========================================================
// CURRENT ADMIN SESSION
//
// GET /api/v1/admin/me
// ==========================================================

router.get(
    "/me",
    requireAdmin,
    me
);


console.log(
    "✅ Admin auth routes loaded successfully"
);

console.log(
    "POST   /api/v1/admin/login"
);

console.log(
    "POST   /api/v1/admin/logout"
);

console.log(
    "GET    /api/v1/admin/me"
);


module.exports = router;
