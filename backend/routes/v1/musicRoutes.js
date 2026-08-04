const express = require("express");

const router = express.Router();

const musicController = require("../../controllers/v1/musicController");

// GET /api/v1/music/search?q=mustafa
router.get("/search", musicController.searchSongs);

module.exports = router;