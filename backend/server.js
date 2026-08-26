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

    console.log("🔍 About to call app.listen()");
    console.log("🔍 PORT =", PORT);

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
                `➡️  http://localhost:${PORT}/api/v1/singers`
            );


            console.log(
                "========================================"
            );


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