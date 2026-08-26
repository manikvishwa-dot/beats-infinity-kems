import { useEffect, useState } from "react";

import {
    AppBar,
    Toolbar,
    Box,
    Button,
    Container
} from "@mui/material";

import {
    Link,
    useLocation
} from "react-router-dom";

import ASSETS from "../../config/assets";

import "./Navbar.css";


function Navbar() {

    const location = useLocation();

    const [scrolled, setScrolled] =
        useState(false);


    // ==========================================================
    // SCROLL EFFECT
    // ==========================================================

    useEffect(() => {

        const handleScroll = () => {

            setScrolled(
                window.scrollY > 40
            );

        };


        window.addEventListener(
            "scroll",
            handleScroll
        );


        return () => {

            window.removeEventListener(
                "scroll",
                handleScroll
            );

        };

    }, []);


    // ==========================================================
    // NAVIGATION ITEMS
    // ==========================================================

    const navItems = [

        {
            label: "Home",
            path: "/"
        },

        {
            label: "Events",
            path: "/events"
        },

        {
            label: "Gallery",
            path: "/gallery"
        },

        {
            label: "About",
            path: "/about"
        },

        {
            label: "Contact",
            path: "/contact"
        }

    ];


    // ==========================================================
    // RENDER
    // ==========================================================

    return (

        <AppBar

            elevation={0}

            position="fixed"

            className={
                scrolled
                    ? "navbar navbar-scrolled"
                    : "navbar"
            }

        >

            <Container
                maxWidth="xl"
            >

                <Toolbar
                    className="navbar-toolbar"
                >


                    {/* ==================================================
                        LOGO
                    ================================================== */}

                    <Box
                        className="navbar-logo-section"
                    >

                        <Link
                            to="/"
                            className="logo-link"
                        >

                            <img

                                src={ASSETS.logo}

                                alt="Beats Infinity"

                                className="navbar-logo"

                            />

                        </Link>

                    </Box>


                    {/* ==================================================
                        MENU
                    ================================================== */}

                    <Box
                        className="navbar-menu"
                    >

                        {

                            navItems.map(
                                (item) => (

                                    <Button

                                        key={
                                            item.label
                                        }

                                        component={
                                            Link
                                        }

                                        to={
                                            item.path
                                        }

                                        className={

                                            location.pathname ===
                                            item.path

                                                ? "nav-button active"

                                                : "nav-button"

                                        }

                                    >

                                        {
                                            item.label
                                        }

                                    </Button>

                                )

                            )

                        }

                    </Box>


                    {/* ==================================================
                        ACTION BUTTONS
                    ================================================== */}

                    <Box
                        className="navbar-actions"
                    >


                        {/* ==================================================
                            LOGIN
                        ================================================== */}

                        <Button

                            component={
                                Link
                            }

                            to="/login"

                            className="login-button"

                        >

                            Login

                        </Button>


                        {/* ==================================================
                            JOIN BEATS INFINITY

                            IMPORTANT:
                            This now goes directly to the
                            common Singer Registration page.
                        ================================================== */}

                        <Button

                            component={
                                Link
                            }

                            to="/singer-registration"

                            className="register-button"

                        >

                            Join Beats ∞ Infinity

                        </Button>


                    </Box>


                </Toolbar>

            </Container>

        </AppBar>

    );

}


export default Navbar;