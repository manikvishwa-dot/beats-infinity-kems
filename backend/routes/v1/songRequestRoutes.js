const express = require("express");

const router = express.Router();


// ==========================================================
// SONG REQUEST CONTROLLER
// ==========================================================

const songRequestController =
    require("../../controllers/v1/songRequestController");


// ==========================================================
// DEBUG
// ==========================================================

console.log("========================================");
console.log("🎵 SONG REQUEST ROUTES LOADING");
console.log("========================================");

console.log(
    "createSongRequest:",
    typeof songRequestController.createSongRequest
);

console.log(
    "getSongRequests:",
    typeof songRequestController.getSongRequests
);

console.log(
    "updateSongRequest:",
    typeof songRequestController.updateSongRequest
);

console.log(
    "submitSongRequestForPairing:",
    typeof songRequestController.submitSongRequestForPairing
);

console.log(
    "submitMultipleSongRequestsForPairing:",
    typeof songRequestController.submitMultipleSongRequestsForPairing
);

console.log(
    "submitFinalSelection:",
    typeof songRequestController.submitFinalSelection
);

console.log(
    "deleteSongRequest:",
    typeof songRequestController.deleteSongRequest
);

console.log("========================================");


// ==========================================================
// SAFETY CHECK
// ==========================================================

if (
    typeof songRequestController.createSongRequest !==
    "function"
) {

    throw new Error(
        "❌ createSongRequest is missing from songRequestController.js"
    );

}


if (
    typeof songRequestController.getSongRequests !==
    "function"
) {

    throw new Error(
        "❌ getSongRequests is missing from songRequestController.js"
    );

}


if (
    typeof songRequestController.updateSongRequest !==
    "function"
) {

    throw new Error(
        "❌ updateSongRequest is missing from songRequestController.js"
    );

}


if (
    typeof songRequestController.submitSongRequestForPairing !==
    "function"
) {

    throw new Error(
        "❌ submitSongRequestForPairing is missing from songRequestController.js"
    );

}


if (
    typeof songRequestController.submitMultipleSongRequestsForPairing !==
    "function"
) {

    throw new Error(
        "❌ submitMultipleSongRequestsForPairing is missing from songRequestController.js"
    );

}


if (
    typeof songRequestController.submitFinalSelection !==
    "function"
) {

    throw new Error(
        "❌ submitFinalSelection is missing from songRequestController.js"
    );

}


if (
    typeof songRequestController.deleteSongRequest !==
    "function"
) {

    throw new Error(
        "❌ deleteSongRequest is missing from songRequestController.js"
    );

}


// ==========================================================
// GET ALL SONG REQUESTS
//
// GET /api/v1/song-requests
// ==========================================================

router.get(
    "/",
    songRequestController.getSongRequests
);


// ==========================================================
// CREATE SONG REQUEST
//
// POST /api/v1/song-requests
//
// Legacy endpoint.
// ==========================================================

router.post(
    "/",
    songRequestController.createSongRequest
);


// ==========================================================
// FINAL SELECTION
//
// PUT /api/v1/song-requests/submit-final-selection
//
// NEW FRONTEND ENDPOINT
//
// Body:
//
// {
//     singer_id: "UUID",
//     songs: [
//         {
//             title: "...",
//             channel: "...",
//             thumbnail: "...",
//             videoId: "...",
//             provider: "YouTube"
//         }
//     ]
// }
//
// Exactly 5 songs are required.
//
// This is the preferred endpoint for the new
// Singer Dashboard.
// ==========================================================

router.put(
    "/submit-final-selection",
    songRequestController.submitFinalSelection
);


// ==========================================================
// SUBMIT MULTIPLE SONG REQUESTS
//
// PUT /api/v1/song-requests/submit-for-pairing
//
// Supports legacy request_ids and the new songs format.
// ==========================================================

router.put(
    "/submit-for-pairing",
    songRequestController.submitMultipleSongRequestsForPairing
);


// ==========================================================
// SUBMIT SINGLE SONG REQUEST
//
// PUT /api/v1/song-requests/:id/submit
// ==========================================================

router.put(
    "/:id/submit",
    songRequestController.submitSongRequestForPairing
);


// ==========================================================
// UPDATE SONG REQUEST
//
// PUT /api/v1/song-requests/:id
// ==========================================================

router.put(
    "/:id",
    songRequestController.updateSongRequest
);


// ==========================================================
// DELETE SONG REQUEST
//
// DELETE /api/v1/song-requests/:id
// ==========================================================

router.delete(
    "/:id",
    songRequestController.deleteSongRequest
);


// ==========================================================
// ROUTES READY
// ==========================================================

console.log(
    "✅ Song Request routes loaded successfully"
);

console.log(
    "GET    /api/v1/song-requests"
);

console.log(
    "POST   /api/v1/song-requests"
);

console.log(
    "PUT    /api/v1/song-requests/submit-final-selection"
);

console.log(
    "PUT    /api/v1/song-requests/submit-for-pairing"
);

console.log(
    "PUT    /api/v1/song-requests/:id/submit"
);

console.log(
    "PUT    /api/v1/song-requests/:id"
);

console.log(
    "DELETE /api/v1/song-requests/:id"
);

console.log("========================================");


// ==========================================================
// EXPORT
// ==========================================================

module.exports = router;