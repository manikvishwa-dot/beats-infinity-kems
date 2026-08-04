const express = require("express");

const router = express.Router();

const songSearchController = require("../../controllers/v1/songSearchController");

router.get("/", songSearchController.searchSongs);

module.exports = router;