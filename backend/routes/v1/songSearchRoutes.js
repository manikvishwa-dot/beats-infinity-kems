const express = require("express");

const router = express.Router();

const songSearchController = require("../../controllers/v1/songSearchController");

// Song name suggestions while typing  - GET /api/v1/song-search/suggest?q=
router.get("/suggest", songSearchController.suggestSongs);

// Movie names for a chosen song        - GET /api/v1/song-search/movie?title=
router.get("/movie", songSearchController.findMovies);

// Legacy YouTube search (no longer used by the singer app)
router.get("/", songSearchController.searchSongs);

module.exports = router;
