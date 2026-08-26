const express = require("express");

const router = express.Router();


// ==========================================================
// LOAD SONG CONTROLLER
// ==========================================================

const songController =
    require("../../controllers/v1/songController");


// ==========================================================
// DEBUG CONTROLLER
// ==========================================================

console.log("========================================");
console.log("🎵 SONG ROUTES LOADING");
console.log("========================================");

console.log(
    "songController:",
    songController
);

console.log(
    "getSongs:",
    typeof songController.getSongs
);

console.log(
    "getSongById:",
    typeof songController.getSongById
);

console.log(
    "createSong:",
    typeof songController.createSong
);

console.log(
    "updateSong:",
    typeof songController.updateSong
);

console.log(
    "deleteSong:",
    typeof songController.deleteSong
);

console.log("========================================");


// ==========================================================
// SAFETY CHECK
// ==========================================================

if (typeof songController.getSongs !== "function") {

    throw new Error(
        "❌ getSongs is missing from songController.js"
    );

}


if (typeof songController.getSongById !== "function") {

    throw new Error(
        "❌ getSongById is missing from songController.js"
    );

}


if (typeof songController.createSong !== "function") {

    throw new Error(
        "❌ createSong is missing from songController.js"
    );

}


if (typeof songController.updateSong !== "function") {

    throw new Error(
        "❌ updateSong is missing from songController.js"
    );

}


if (typeof songController.deleteSong !== "function") {

    throw new Error(
        "❌ deleteSong is missing from songController.js"
    );

}


// ==========================================================
// GET ALL SONGS
//
// GET /api/v1/songs
// ==========================================================

router.get(
    "/",
    songController.getSongs
);


// ==========================================================
// GET SONG BY ID
//
// GET /api/v1/songs/:id
// ==========================================================

router.get(
    "/:id",
    songController.getSongById
);


// ==========================================================
// CREATE SONG
//
// POST /api/v1/songs
// ==========================================================

router.post(
    "/",
    songController.createSong
);


// ==========================================================
// UPDATE SONG
//
// PUT /api/v1/songs/:id
// ==========================================================

router.put(
    "/:id",
    songController.updateSong
);


// ==========================================================
// DELETE SONG
//
// DELETE /api/v1/songs/:id
//
// NOTE:
// This deletes the actual catalog song.
//
// MySongs REMOVE should use:
// /api/v1/song-requests/:id
// ==========================================================

router.delete(
    "/:id",
    songController.deleteSong
);


// ==========================================================
// ROUTER READY
// ==========================================================

console.log("✅ Song routes loaded successfully");

console.log(
    "GET    /api/v1/songs"
);

console.log(
    "GET    /api/v1/songs/:id"
);

console.log(
    "POST   /api/v1/songs"
);

console.log(
    "PUT    /api/v1/songs/:id"
);

console.log(
    "DELETE /api/v1/songs/:id"
);

console.log("========================================");


// ==========================================================
// EXPORT
// ==========================================================

module.exports = router;