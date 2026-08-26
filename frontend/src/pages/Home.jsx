import { Box } from "@mui/material";

import Navbar from "../common/Navbar/Navbar";
import Hero from "../components/Hero/Hero";
import Journey from "../components/Journey/Journey";
import WhyJoin from "../components/WhyJoin/WhyJoin";
import Statistics from "../components/Statistics/Statistics";

function Home() {

    return (

        <Box
            sx={{
                backgroundColor: "#0B0B0B",
                minHeight: "100vh",
                overflowX: "hidden",
            }}
        >

            {/* ==========================================
                NAVIGATION
            ========================================== */}

            <Navbar />

            {/* ==========================================
                HERO SECTION
            ========================================== */}

            <Hero />

            {/* ==========================================
                OUR MUSICAL JOURNEY
            ========================================== */}

            <Journey />

            {/* ==========================================
                WHY JOIN BEATS ∞ INFINITY
            ========================================== */}

            <WhyJoin />

            {/* ==========================================
                GROWING TOGETHER THROUGH MUSIC
            ========================================== */}

            <Statistics />

            {/*
            ==========================================

            UPCOMING HOMEPAGE SECTIONS

            1. Gallery Highlights
            2. Testimonials
            3. Upcoming Events
            4. Join Beats ∞ Infinity CTA
            5. Footer

            ==========================================
            */}

        </Box>

    );

}

export default Home;