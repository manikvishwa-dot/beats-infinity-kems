import {
    Box,
    Button,
    Chip,
    Stack,
    Typography
} from "@mui/material";

import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import CelebrationRoundedIcon from "@mui/icons-material/CelebrationRounded";

import homepage from "../../config/homepage";

import poster from "../../assets/events/anniversary-poster.jpg";

import "./HeroEventCard.css";

function HeroEventCard() {

    const { featuredEvent } = homepage;

    return (

        <Box className="hero-event-card">

            {/* Poster */}

            <Box
                component="img"
                src={poster}
                alt={featuredEvent.title}
                className="event-poster"
            />

            {/* Content */}

            <Box className="event-content">

                <Chip

                    icon={<CelebrationRoundedIcon />}

                    label="FEATURED EVENT"

                    className="featured-chip"

                />

                <Typography className="event-title">

                    {featuredEvent.title}

                </Typography>

                <Typography className="event-subtitle">

                    {featuredEvent.subtitle}

                </Typography>

                <Stack
                    spacing={2}
                    mt={3}
                >

                    <Stack
                        direction="row"
                        spacing={2}
                        alignItems="center"
                    >

                        <CalendarMonthRoundedIcon className="event-icon"/>

                        <Typography>

                            {featuredEvent.date}

                        </Typography>

                    </Stack>

                    <Stack
                        direction="row"
                        spacing={2}
                        alignItems="center"
                    >

                        <AccessTimeRoundedIcon className="event-icon"/>

                        <Typography>

                            {featuredEvent.time}

                        </Typography>

                    </Stack>

                    <Stack
                        direction="row"
                        spacing={2}
                        alignItems="center"
                    >

                        <LocationOnRoundedIcon className="event-icon"/>

                        <Typography>

                            {featuredEvent.venue}

                        </Typography>

                    </Stack>

                </Stack>

                {/* Progress */}

                <Box mt={4}>

                    <Typography
                        className="registration-text"
                    >

                        Registration Progress

                    </Typography>

                    <Box className="progress-bar">

                        <Box
                            className="progress-fill"
                            sx={{
                                width: `${
                                    (featuredEvent.registrationCount /
                                        featuredEvent.totalSeats) *
                                    100
                                }%`
                            }}
                        />

                    </Box>

                    <Typography
                        className="registration-count"
                    >

                        {featuredEvent.registrationCount}

                        {" / "}

                        {featuredEvent.totalSeats}

                        {" Seats Filled"}

                    </Typography>

                </Box>

                {/* Status */}

                <Chip

                    label={featuredEvent.registrationStatus}

                    color="success"

                    sx={{
                        mt:3,
                        mb:3,
                        fontWeight:700
                    }}

                />

                {/* Button */}

                <Button

                    fullWidth

                    className="event-register-btn"

                >

                    {featuredEvent.buttonText}

                </Button>

            </Box>

        </Box>

    );

}

export default HeroEventCard;