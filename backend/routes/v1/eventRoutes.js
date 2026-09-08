const express = require("express");
const multer = require("multer");

const router = express.Router();

const {
    getActiveEvent,
    getEvents,
    createEvent,
    updateEvent,
    activateEvent,
    deleteEvent
} = require("../../controllers/v1/eventController");

const {
    getExpenses,
    createExpense,
    deleteExpense,
    getFinanceSummary
} = require("../../controllers/v1/eventExpenseController");

const {
    requireAdmin,
    requireSuperAdmin
} = require("../../middleware/requireAdminAuth");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {

        if (!file.mimetype.startsWith("image/")) {

            return callback(new Error("Only image files are allowed for the event banner."));

        }

        callback(null, true);

    }
});

// Wraps upload.single("banner") so any error (file too large,
// wrong field name, the fileFilter rejection above) comes back
// as a clear 400 instead of falling through to a generic 500.
const uploadBanner = (req, res, next) => {

    upload.single("banner")(req, res, err => {

        if (!err) {

            return next();

        }

        const message =
            err.code === "LIMIT_FILE_SIZE"
                ? "That image is too large - please upload a file under 10MB."
                : err.message || "Unable to process the uploaded file.";

        return res.status(400).json({
            success: false,
            message
        });

    });

};


// ==========================================================
// PUBLIC - ACTIVE EVENT
//
// GET /api/v1/events/active
// ==========================================================

router.get("/active", getActiveEvent);


// ==========================================================
// ADMIN - LIST / CREATE / UPDATE / ACTIVATE / DELETE
// ==========================================================

router.get("/", requireAdmin, getEvents);

router.post("/", requireAdmin, uploadBanner, createEvent);

router.put("/:id", requireAdmin, uploadBanner, updateEvent);

router.put("/:id/activate", requireAdmin, activateEvent);

router.delete("/:id", requireAdmin, deleteEvent);


// ==========================================================
// SUPER ADMIN - FINANCE (revenue / expenses / balance)
// ==========================================================

router.get("/:eventId/finance", requireSuperAdmin, getFinanceSummary);

router.get("/:eventId/expenses", requireSuperAdmin, getExpenses);

router.post("/:eventId/expenses", requireSuperAdmin, createExpense);

router.delete("/:eventId/expenses/:expenseId", requireSuperAdmin, deleteExpense);


console.log("✅ Event routes loaded successfully");
console.log("GET    /api/v1/events/active");
console.log("GET    /api/v1/events");
console.log("POST   /api/v1/events");
console.log("PUT    /api/v1/events/:id");
console.log("PUT    /api/v1/events/:id/activate");
console.log("DELETE /api/v1/events/:id");
console.log("GET    /api/v1/events/:eventId/finance");
console.log("GET    /api/v1/events/:eventId/expenses");
console.log("POST   /api/v1/events/:eventId/expenses");
console.log("DELETE /api/v1/events/:eventId/expenses/:expenseId");


module.exports = router;
