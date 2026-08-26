import {
    Box,
    Button,
    Chip,
    Stack,
    Typography
} from "@mui/material";

import MicRoundedIcon from "@mui/icons-material/MicRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";

import homepage from "../../config/homepage";

import "./HeroContent.css";

function HeroContent() {

    const { hero, statistics } = homepage;

    return (

        <Box className="hero-content">

            {/* Community Badge */}

            <Chip
                label={hero.community}
                className="hero-community"
            />

            {/* Main Heading */}

            <Typography
                className="hero-title"
            >

                Where Every

                <br />

                Voice Finds

                <br />

                A Stage

            </Typography>

            {/* Tagline */}

            <Typography
                className="hero-subtitle"
            >

                {hero.subtitle}

            </Typography>

            {/* Description */}

            <Typography
                className="hero-description"
            >

                {hero.description}

            </Typography>

            {/* Buttons */}

            <Stack

                direction={{
                    xs: "column",
                    sm: "row"
                }}

                spacing={3}

                mt={4}

            >

                <Button

                    className="hero-register-btn"

                    startIcon={<MicRoundedIcon />}

                >

                    Register Now

                </Button>

                <Button

                    className="hero-events-btn"

                    startIcon={<EventRoundedIcon />}

                >

                    Upcoming Events

                </Button>

            </Stack>

            {/* Statistics */}

            <Typography
                className="hero-stats"
            >

                🎵 {statistics.members}+ Members

                &nbsp;&nbsp;&nbsp;

                •

                &nbsp;&nbsp;&nbsp;

                🎤 {statistics.events}+ Events

                &nbsp;&nbsp;&nbsp;

                •

                &nbsp;&nbsp;&nbsp;

                🎶 {statistics.performances}+ Performances

            </Typography>

            {/* Scroll */}

            <Box
                className="hero-scroll"
            >

                <Typography>

                    Scroll Down

                </Typography>

                <KeyboardArrowDownRoundedIcon />

            </Box>

        </Box>

    );

}

export default HeroContent;