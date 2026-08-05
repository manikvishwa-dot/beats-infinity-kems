import { createTheme } from "@mui/material/styles";

const theme = createTheme({

    palette: {

        mode: "dark",

        primary: {
            main: "#1DB954",
        },

        secondary: {
            main: "#FFD700",
        },

        background: {
            default: "#0B0B0B",
            paper: "#181818",
        },

        text: {
            primary: "#FFFFFF",
            secondary: "#B3B3B3",
        }

    },

    typography: {

        fontFamily: `"Roboto", "Helvetica", "Arial", sans-serif`,

        h1: {
            fontWeight: 700,
        },

        h2: {
            fontWeight: 700,
        },

        h3: {
            fontWeight: 600,
        },

        button: {
            textTransform: "none",
            fontWeight: 600,
        }

    },

    shape: {
        borderRadius: 12,
    }

});

export default theme;