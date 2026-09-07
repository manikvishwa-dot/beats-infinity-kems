const express = require("express");

const router = express.Router();

const {
    getMyPairing
} = require("../../controllers/v1/pairingController");


// ==========================================================
// SINGER-FACING - MY PAIRING
//
// GET /api/v1/pairings/my?singer_id=UUID
//
// No admin auth required - a singer checking their own
// pairing status, same pattern as GET /payments/my.
// ==========================================================

router.get(
    "/my",
    getMyPairing
);


console.log(
    "✅ Pairing routes loaded successfully"
);

console.log(
    "GET    /api/v1/pairings/my?singer_id=UUID"
);


module.exports = router;
