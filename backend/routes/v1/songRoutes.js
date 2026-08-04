const express = require("express");

const router = express.Router();

const songController = require("../../controllers/v1/songController");

// Search Songs
router.get("/search", songController.searchSongs);

// Create Song
router.post("/", songController.createSong);

// Get All Songs
router.get("/", songController.getAllSongs);

// Get Song By ID
router.get("/:id", songController.getSongById);

// Update Song
router.put("/:id", songController.updateSong);

// Delete Song
router.delete("/:id", songController.deleteSong);

module.exports = router;