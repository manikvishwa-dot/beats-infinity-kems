import { Box } from "@mui/material";

import Navbar from "../common/Navbar/Navbar";

function Home() {
    return (
        <Box
            sx={{
                backgroundColor: "#0B0B0B",
                minHeight: "100vh",
            }}
        >
            <Navbar />

            {/* Hero Placeholder */}
            <Box
                sx={{
                    height: "calc(100vh - 80px)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    color: "#FFFFFF",
                    textAlign: "center",
                    px: 3,
                }}
            >
                <h1
                    style={{
                        fontSize: "3.5rem",
                        marginBottom: "20px",
                        color: "#FFD700",
                    }}
                >
                    🎤 Welcome to Beats Infinity
                </h1>

                <h2
                    style={{
                        fontWeight: 400,
                        marginBottom: "15px",
                    }}
                >
                    Unleash the Harmony in You
                </h2>

                <p
                    style={{
                        maxWidth: "700px",
                        color: "#CCCCCC",
                        fontSize: "18px",
                        lineHeight: "32px",
                    }}
                >
                    Chennai's Premium Karaoke Community dedicated to bringing
                    singers, musicians and music lovers together through
                    unforgettable musical experiences.
                </p>
            </Box>
        </Box>
    );
}

export default Home;