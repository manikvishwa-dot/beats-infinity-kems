const express = require("express");

const router = express.Router();


// ==========================================================
// ADMIN AUTH CONTROLLER
// ==========================================================

const {
    login,
    logout,
    me,
    listAdminUsers,
    changeAdminPassword
} = require("../../controllers/v1/adminAuthController");

const {
    requireAdmin,
    requireSuperAdmin
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


// ==========================================================
// LIST ADMIN ACCOUNTS - SUPER ADMIN ONLY
//
// GET /api/v1/admin/users
// ==========================================================

router.get(
    "/users",
    requireSuperAdmin,
    listAdminUsers
);


// ==========================================================
// CHANGE ADMIN PASSWORD
//
// PUT /api/v1/admin/users/:id/password
//
// requireAdmin (not requireSuperAdmin) - an "admin"-role account
// is allowed to change ITS OWN password (self-service). Resetting
// a DIFFERENT account's password still requires super_admin; that
// check happens inside changeAdminPassword itself, since it needs
// to compare the target id against the caller's own id.
// ==========================================================

router.put(
    "/users/:id/password",
    requireAdmin,
    changeAdminPassword
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

console.log(
    "GET    /api/v1/admin/users"
);

console.log(
    "PUT    /api/v1/admin/users/:id/password"
);


module.exports = router;
