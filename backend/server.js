require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { supabase } = require("./config/supabase");

const musicRoutes = require("./routes/v1/musicRoutes");
const songRoutes = require("./routes/v1/songRoutes");
const songSearchRoutes = require("./routes/v1/songSearchRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Future Middleware
// app.use(authentication);
// app.use(rateLimiter);

// ========================================
// API Routes
// ========================================

app.use("/api/v1/music", musicRoutes);
app.use("/api/v1/songs", songRoutes);
app.use("/api/v1/song-search", songSearchRoutes);

// ========================================
// Test Supabase Connection
// ========================================

(async () => {

    try {

        const { error } = await supabase
            .from("songs")
            .select("*")
            .limit(1);

        if (error) {

            console.log("⚠️ Supabase Connected");
            console.log("Songs table not created yet.");

        } else {

            console.log("✅ Supabase Connected Successfully");

        }

    } catch (err) {

        console.error("❌ Database Connection Failed");
        console.error(err.message);

    }

})();

// ========================================
// Start Server
// ========================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log("========================================");
    console.log("🎵 Beats Infinity Backend Started");
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log("API Version : v1");
    console.log("========================================");

});