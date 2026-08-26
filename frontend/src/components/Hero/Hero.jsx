import { Box } from "@mui/material";

import HeroLeft from "./HeroLeft";
import HeroRight from "./HeroRight";

import "./Hero.css";


function Hero() {

    return (

        <Box className="hero-section">

            <div className="hero-container">

                {/* ==================================================
                    LEFT SIDE
                ================================================== */}

                <HeroLeft />


                {/* ==================================================
                    RIGHT SIDE
                ================================================== */}

                <HeroRight />

            </div>

        </Box>

    );

}


export default Hero;