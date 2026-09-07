import { Box, Button } from "@mui/material";
import { Link } from "react-router-dom";

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

            {/* ==========================================
                STAFF ACCESS
            ========================================== */}

            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "18px",
                    flexWrap: "wrap",
                    padding: "40px 20px",
                    borderTop: "1px solid rgba(255,255,255,0.06)"
                }}
            >

                <Button
                    component={Link}
                    to="/admin/login"
                    sx={{
                        border: "2px solid #FFD54A",
                        color: "#FFD54A",
                        borderRadius: "50px",
                        minWidth: "160px",
                        height: "46px",
                        padding: "0 24px",
                        textTransform: "none",
                        fontFamily: "Poppins, sans-serif",
                        fontSize: "15px",
                        fontWeight: 600,
                        "&:hover": {
                            background: "#FFD54A",
                            color: "#111111"
                        }
                    }}
                >
                    Admin Login
                </Button>

                <Button
                    component={Link}
                    to="/superadmin/login"
                    sx={{
                        border: "2px solid #1DB954",
                        color: "#1DB954",
                        borderRadius: "50px",
                        minWidth: "190px",
                        height: "46px",
                        padding: "0 24px",
                        textTransform: "none",
                        fontFamily: "Poppins, sans-serif",
                        fontSize: "15px",
                        fontWeight: 600,
                        "&:hover": {
                            background: "#1DB954",
                            color: "#ffffff"
                        }
                    }}
                >
                    Super Admin Login
                </Button>

            </Box>

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