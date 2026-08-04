import { createTheme } from "@mui/material/styles";

const theme = createTheme({

    palette: {

        mode: "dark",

        primary: {
            main: "#7C3AED"
        },

        secondary: {
            main: "#06B6D4"
        },

        success: {
            main: "#22C55E"
        },

        warning: {
            main: "#FBBF24"
        },

        error: {
            main: "#EF4444"
        },

        background: {
            default: "#0F172A",
            paper: "#1E293B"
        },

        text: {
            primary: "#FFFFFF",
            secondary: "#CBD5E1"
        }

    },

    typography: {

        fontFamily: [
            "Poppins",
            "sans-serif"
        ].join(","),

        h1: {

            fontSize: "4rem",
            fontWeight: 700

        },

        h2: {

            fontSize: "3rem",
            fontWeight: 700

        },

        h3: {

            fontSize: "2.25rem",
            fontWeight: 600

        },

        h4: {

            fontSize: "1.8rem",
            fontWeight: 600

        },

        h5: {

            fontSize: "1.4rem",
            fontWeight: 600

        },

        h6: {

            fontSize: "1.1rem",
            fontWeight: 600

        },

        body1: {

            fontSize: "1rem"

        },

        body2: {

            fontSize: ".95rem"

        },

        button: {

            fontWeight: 600,
            textTransform: "none",
            fontSize: "1rem"

        }

    },

    shape: {

        borderRadius: 16

    },

    components: {

        MuiCssBaseline: {

            styleOverrides: {

                body: {

                    backgroundColor: "#0F172A",
                    color: "#FFFFFF",
                    margin: 0,
                    padding: 0,
                    overflowX: "hidden"

                },

                a: {

                    textDecoration: "none",
                    color: "inherit"

                }

            }

        },

        MuiPaper: {

            styleOverrides: {

                root: {

                    backgroundImage: "none",
                    borderRadius: 20

                }

            }

        },

        MuiButton: {

            styleOverrides: {

                root: {

                    borderRadius: 14,
                    padding: "12px 28px",
                    fontWeight: 600

                },

                containedPrimary: {

                    background:
                        "linear-gradient(90deg,#7C3AED,#06B6D4)",

                    "&:hover": {

                        background:
                            "linear-gradient(90deg,#6D28D9,#0891B2)"

                    }

                }

            }

        },

        MuiCard: {

            styleOverrides: {

                root: {

                    borderRadius: 20,
                    backgroundColor: "#1E293B"

                }

            }

        }

    }

});

export default theme;