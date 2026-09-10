const express = require("express");
const multer = require("multer");

const router = express.Router();

const {
    getJourneyEvents,
    getAllJourneyEvents,
    createJourneyEvent,
    updateJourneyEvent,
    deleteJourneyEvent
} = require("../../controllers/v1/journeyController");

const { requireAdmin } = require("../../middleware/requireAdminAuth");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {

        if (!file.mimetype.startsWith("image/")) {

            return callback(new Error("Only image files are allowed."));

        }

        callback(null, true);

    }
});

// Wraps upload.single("image") so any error (file too large, wrong
// field name, the fileFilter rejection above) comes back as a clear
// 400 instead of falling through to a generic 500.
const uploadImage = (req, res, next) => {

    upload.single("image")(req, res, err => {

        if (!err) {
            return next();
        }

        const message =
            err.code === "LIMIT_FILE_SIZE"
                ? "That image is too large - please upload a file under 10MB."
                : err.message || "Unable to process the uploaded file.";

        return res.status(400).json({ success: false, message });

    });

};


// ==========================================================
// PUBLIC - MOST RECENT EVENTS FOR THE HOME PAGE CAROUSEL
//
// GET /api/v1/journey
// ==========================================================

router.get("/", getJourneyEvents);


// ==========================================================
// ADMIN - FULL CRUD (Admin and Super Admin both allowed)
// ==========================================================

router.get("/all", requireAdmin, getAllJourneyEvents);

router.post("/", requireAdmin, uploadImage, createJourneyEvent);

router.put("/:id", requireAdmin, uploadImage, updateJourneyEvent);

router.delete("/:id", requireAdmin, deleteJourneyEvent);


console.log("✅ Journey routes loaded successfully");
console.log("GET    /api/v1/journey");
console.log("GET    /api/v1/journey/all");
console.log("POST   /api/v1/journey");
console.log("PUT    /api/v1/journey/:id");
console.log("DELETE /api/v1/journey/:id");


module.exports = router;
