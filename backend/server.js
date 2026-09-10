require("dotenv").config();

const express = require("express");
const cors = require("cors");


// ==========================================================
// SUPABASE
// ==========================================================

const {
    supabase
} = require("./config/supabase");


// ==========================================================
// ROUTES
// ==========================================================

const musicRoutes =
    require("./routes/v1/musicRoutes");

const songRoutes =
    require("./routes/v1/songRoutes");

const songSearchRoutes =
    require("./routes/v1/songSearchRoutes");

const songRequestRoutes =
    require("./routes/v1/songRequestRoutes");

const singerRoutes =
    require("./routes/v1/singerRoutes");

const paymentRoutes =
    require("./routes/v1/paymentRoutes");

const adminAuthRoutes =
    require("./routes/v1/adminAuthRoutes");

const adminDashboardRoutes =
    require("./routes/v1/adminDashboardRoutes");

const pairingRoutes =
    require("./routes/v1/pairingRoutes");

const eventRoutes =
    require("./routes/v1/eventRoutes");

const journeyRoutes =
    require("./routes/v1/journeyRoutes");


// ==========================================================
// EXPRESS APP
// ==========================================================

const app = express();


// ==========================================================
// MIDDLEWARE
// ==========================================================

app.use(
    cors()
);

app.use(
    express.json()
);


// ==========================================================
// BASIC HEALTH CHECK
// ==========================================================

app.get(
    "/",
    (req, res) => {

        res.status(200).json({

            success: true,

            message:
                "🎵 Beats Infinity Backend is running",

            version:
                "v1",

            status:
                "OK"

        });

    }
);


// ==========================================================
// SUPABASE-TOUCHING HEALTH CHECK
//
// GET /health
//
// Unlike "/" above, this actually queries Supabase - it exists
// for an external uptime pinger (cron-job.org) to hit periodically
// so the free-tier project never accumulates enough inactivity to
// get auto-paused. A static response wouldn't touch Supabase at
// all, so it wouldn't reset that clock.
// ==========================================================

app.get(
    "/health",
    async (req, res) => {

        try {

            const {
                error
            } = await supabase

                .from("events")

                .select("id")

                .limit(1);


            if (error) {

                console.error(
                    "HEALTH CHECK - SUPABASE:",
                    error
                );

                return res.status(503).json({

                    success: false,

                    supabase:
                        "unreachable",

                    error:
                        error.message

                });

            }


            return res.status(200).json({

                success: true,

                supabase:
                    "reachable",

                checked_at:
                    new Date().toISOString()

            });

        }

        catch (error) {

            console.error(
                "HEALTH CHECK EXCEPTION:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);


// ==========================================================
// API ROUTES
// ==========================================================


// ----------------------------------------------------------
// MUSIC PROVIDER
// ----------------------------------------------------------

app.use(
    "/api/v1/music",
    musicRoutes
);


// ----------------------------------------------------------
// SONG CRUD
// ----------------------------------------------------------

app.use(
    "/api/v1/songs",
    songRoutes
);


// ----------------------------------------------------------
// SONG SEARCH
// ----------------------------------------------------------

app.use(
    "/api/v1/song-search",
    songSearchRoutes
);


// ----------------------------------------------------------
// SONG REQUESTS
// ----------------------------------------------------------

app.use(
    "/api/v1/song-requests",
    songRequestRoutes
);


// ----------------------------------------------------------
// PAYMENTS
// ----------------------------------------------------------
//
// POST
//    /api/v1/payments
//
// GET
//    /api/v1/payments/my?singer_id=UUID
//
// GET
//    /api/v1/payments
//
// PUT
//    /api/v1/payments/:id/mark-paid
//
// PUT
//    /api/v1/payments/:id/reject
//
// ----------------------------------------------------------

app.use(
    "/api/v1/payments",
    paymentRoutes
);


// ----------------------------------------------------------
// ADMIN AUTH
// ----------------------------------------------------------

app.use(
    "/api/v1/admin",
    adminAuthRoutes
);

app.use(
    "/api/v1/admin",
    adminDashboardRoutes
);


// ----------------------------------------------------------
// PAIRING (SINGER-FACING)
// ----------------------------------------------------------

app.use(
    "/api/v1/pairings",
    pairingRoutes
);


// ----------------------------------------------------------
// EVENTS
// ----------------------------------------------------------

app.use(
    "/api/v1/events",
    eventRoutes
);


// ----------------------------------------------------------
// MUSICAL JOURNEY (Home page carousel)
// ----------------------------------------------------------

app.use(
    "/api/v1/journey",
    journeyRoutes
);


console.log(
    "========================================"
);

console.log(
    "💳 Payment routes registered"
);

console.log(
    "========================================"
);


// ----------------------------------------------------------
// SINGERS
// ----------------------------------------------------------
//
// GET
//    /api/v1/singers/check
//
// POST
//    /api/v1/singers
//
// POST
//    /api/v1/singers/send-otp
//
// POST
//    /api/v1/singers/verify-otp
//
// POST
//    /api/v1/singers/login
//
// POST
//    /api/v1/singers/reset-pin
//
// PUT
//    /api/v1/singers/:id
//
// ----------------------------------------------------------

app.use(
    "/api/v1/singers",
    singerRoutes
);


console.log(
    "✅ Singer routes registered"
);


// ==========================================================
// API 404 HANDLER
// ==========================================================

app.use(
    (req, res) => {

        console.log(
            "❌ API endpoint not found:",
            req.method,
            req.originalUrl
        );


        res.status(404).json({

            success: false,

            message:
                "API endpoint not found",

            method:
                req.method,

            path:
                req.originalUrl

        });

    }
);


// ==========================================================
// GLOBAL ERROR HANDLER
// ==========================================================

app.use(
    (err, req, res, next) => {

        console.error(
            "❌ Server Error:",
            err
        );


        // Multer upload errors (file too large, wrong field, a
        // fileFilter rejection) are user-actionable - surface
        // the real reason instead of a generic 500.
        if (err.name === "MulterError" || err.code === "LIMIT_FILE_SIZE") {

            const message =
                err.code === "LIMIT_FILE_SIZE"
                    ? "That image is too large - please upload a file under 10MB."
                    : err.message || "Unable to process the uploaded file.";

            return res.status(400).json({
                success: false,
                message
            });

        }


        res.status(500).json({

            success: false,

            message:
                "Internal server error",

            error:
                process.env.NODE_ENV === "development"
                    ? err.message
                    : undefined

        });

    }
);


// ==========================================================
// START SERVER
// ==========================================================

const PORT =
    process.env.PORT || 5000;


const startServer = () => {

    console.log(
        "========================================"
    );

    console.log(
        "🎵 Starting Beats Infinity Backend..."
    );

    console.log(
        "========================================"
    );

    console.log(
        "🔍 About to call app.listen()"
    );

    console.log(
        "🔍 PORT =",
        PORT
    );


    app.listen(

        PORT,

        () => {

            console.log(
                "========================================"
            );

            console.log(
                "🎵 Beats Infinity Backend Started"
            );

            console.log(
                `🚀 Server running at http://localhost:${PORT}`
            );

            console.log(
                "API Version : v1"
            );

            console.log(
                "========================================"
            );


            // ==================================================
            // AVAILABLE APIS
            // ==================================================

            console.log(
                "Available APIs:"
            );


            console.log(
                `➡️  http://localhost:${PORT}/`
            );


            console.log(
                `➡️  http://localhost:${PORT}/api/v1/music`
            );


            console.log(
                `➡️  http://localhost:${PORT}/api/v1/songs`
            );


            console.log(
                `➡️  http://localhost:${PORT}/api/v1/song-search`
            );


            console.log(
                `➡️  http://localhost:${PORT}/api/v1/song-requests`
            );


            console.log(
                `➡️  http://localhost:${PORT}/api/v1/payments`
            );


            console.log(
                `➡️  http://localhost:${PORT}/api/v1/singers`
            );


            console.log(
                "========================================"
            );


            // ==================================================
            // PAYMENT ENDPOINTS
            // ==================================================

            console.log(
                "💳 Payment endpoints:"
            );


            console.log(
                `POST   http://localhost:${PORT}/api/v1/payments`
            );


            console.log(
                `GET    http://localhost:${PORT}/api/v1/payments/my?singer_id=UUID`
            );


            console.log(
                `GET    http://localhost:${PORT}/api/v1/payments`
            );


            console.log(
                `PUT    http://localhost:${PORT}/api/v1/payments/:id/mark-paid`
            );


            console.log(
                `PUT    http://localhost:${PORT}/api/v1/payments/:id/reject`
            );


            console.log(
                "========================================"
            );


            // ==================================================
            // SINGER ENDPOINTS
            // ==================================================

            console.log(
                "🎤 Singer endpoints:"
            );


            console.log(
                `GET    http://localhost:${PORT}/api/v1/singers/check?mobile=XXXXXXXXXX`
            );


            console.log(
                `POST   http://localhost:${PORT}/api/v1/singers/send-otp`
            );


            console.log(
                `POST   http://localhost:${PORT}/api/v1/singers/verify-otp`
            );


            console.log(
                `POST   http://localhost:${PORT}/api/v1/singers`
            );


            console.log(
                `POST   http://localhost:${PORT}/api/v1/singers/login`
            );


            console.log(
                `POST   http://localhost:${PORT}/api/v1/singers/reset-pin`
            );


            console.log(
                `PUT    http://localhost:${PORT}/api/v1/singers/:id`
            );


            console.log(
                "========================================"
            );


            // ==================================================
            // SONG REQUEST DELETE ENDPOINT
            // ==================================================

            console.log(
                "🗑️ DELETE request endpoint:"
            );


            console.log(
                `DELETE http://localhost:${PORT}/api/v1/song-requests/:id`
            );


            console.log(
                "========================================"
            );

        }

    );

};


// ==========================================================
// RUN SERVER
// ==========================================================

startServer();