import { useEffect, useState } from "react";

import {
    AppBar,
    Toolbar,
    Box,
    Button,
    Container,
    IconButton,
    Drawer,
    List,
    ListItem
} from "@mui/material";

import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

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

    const [mobileOpen, setMobileOpen] =
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


    // Close the mobile drawer automatically on route change, so
    // it never stays open covering the page after navigating.
    useEffect(() => {

        setMobileOpen(false);

    }, [location.pathname]);


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
                        MENU (desktop)
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
                        ACTION BUTTONS (desktop)
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


                    {/* ==================================================
                        MOBILE MENU TOGGLE
                    ================================================== */}

                    <IconButton
                        className="navbar-mobile-toggle"
                        onClick={() => setMobileOpen(true)}
                        aria-label="Open menu"
                    >

                        <MenuRoundedIcon />

                    </IconButton>


                </Toolbar>

            </Container>

            {/* ==================================================
                MOBILE DRAWER
            ================================================== */}

            <Drawer
                anchor="right"
                open={mobileOpen}
                onClose={() => setMobileOpen(false)}
                className="navbar-drawer"
                ModalProps={{ keepMounted: true }}
            >

                <Box className="navbar-drawer-content">

                    <IconButton
                        className="navbar-drawer-close"
                        onClick={() => setMobileOpen(false)}
                        aria-label="Close menu"
                    >

                        <CloseRoundedIcon />

                    </IconButton>

                    <List className="navbar-drawer-list">

                        {navItems.map(item => (

                            <ListItem key={item.label} disablePadding>

                                <Button
                                    component={Link}
                                    to={item.path}
                                    className={
                                        location.pathname === item.path
                                            ? "drawer-nav-button active"
                                            : "drawer-nav-button"
                                    }
                                >

                                    {item.label}

                                </Button>

                            </ListItem>

                        ))}

                    </List>

                    <Box className="navbar-drawer-actions">

                        <Button
                            component={Link}
                            to="/login"
                            className="login-button"
                        >

                            Login

                        </Button>

                        <Button
                            component={Link}
                            to="/singer-registration"
                            className="register-button"
                        >

                            Join Beats ∞ Infinity

                        </Button>

                    </Box>

                </Box>

            </Drawer>

        </AppBar>

    );

}


export default Navbar;
