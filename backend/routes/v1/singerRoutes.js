const express = require("express");

const router = express.Router();


// ==========================================================
// SINGER CONTROLLER
// ==========================================================

const {

    getSingerByMobile,

    sendOTP,

    verifyOTP,

    createSinger,

    loginWithPin,

    resetPin,

    updateSingerProfile

} = require("../../controllers/v1/singerController");


// ==========================================================
// DEBUG
// ==========================================================

console.log("========================================");

console.log(
    "🎤 Singer Routes Controller Check"
);

console.log(
    "getSingerByMobile:",
    typeof getSingerByMobile
);

console.log(
    "sendOTP:",
    typeof sendOTP
);

console.log(
    "verifyOTP:",
    typeof verifyOTP
);

console.log(
    "createSinger:",
    typeof createSinger
);

console.log(
    "loginWithPin:",
    typeof loginWithPin
);

console.log(
    "resetPin:",
    typeof resetPin
);

console.log(
    "updateSingerProfile:",
    typeof updateSingerProfile
);

console.log("========================================");


// ==========================================================
// GET SINGER BY MOBILE
//
// GET
// /api/v1/singers/check?mobile=XXXXXXXXXX
// ==========================================================

router.get(
    "/check",
    getSingerByMobile
);


// ==========================================================
// SEND OTP
//
// POST
// /api/v1/singers/send-otp
// ==========================================================

router.post(
    "/send-otp",
    sendOTP
);


// ==========================================================
// VERIFY OTP
//
// POST
// /api/v1/singers/verify-otp
// ==========================================================

router.post(
    "/verify-otp",
    verifyOTP
);


// ==========================================================
// CREATE FIRST-TIME SINGER
//
// POST
// /api/v1/singers
// ==========================================================

router.post(
    "/",
    createSinger
);


// ==========================================================
// LOGIN WITH PIN
//
// POST
// /api/v1/singers/login
// ==========================================================

router.post(
    "/login",
    loginWithPin
);


// ==========================================================
// RESET PIN
//
// POST
// /api/v1/singers/reset-pin
// ==========================================================

router.post(
    "/reset-pin",
    resetPin
);


// ==========================================================
// UPDATE SINGER PROFILE
//
// PUT
// /api/v1/singers/:id
// ==========================================================

router.put(
    "/:id",
    updateSingerProfile
);


// ==========================================================
// EXPORT
// ==========================================================

module.exports = router;