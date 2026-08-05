import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { Link } from "react-router-dom";

function Navbar() {
  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: "#0B0B0B",
        borderBottom: "1px solid #222",
      }}
    >
      <Toolbar
        sx={{
          display: "flex",
          justifyContent: "space-between",
          height: "80px",
        }}
      >
        {/* Logo */}

        <Typography
          variant="h5"
          sx={{
            fontWeight: "bold",
            color: "#1DB954",
            letterSpacing: 1,
          }}
        >
          🎵 Beats ∞ Infinity
        </Typography>

        {/* Navigation */}

        <Box
          sx={{
            display: "flex",
            gap: 3,
            alignItems: "center",
          }}
        >
          <Button color="inherit" component={Link} to="/">
            Home
          </Button>

          <Button color="inherit">
            Events
          </Button>

          <Button color="inherit">
            Gallery
          </Button>

          <Button color="inherit">
            Journey
          </Button>

          <Button color="inherit">
            Contact
          </Button>
        </Box>

        {/* Right Buttons */}

        <Box
          sx={{
            display: "flex",
            gap: 2,
          }}
        >
          <Button
            variant="outlined"
            color="success"
            component={Link}
            to="/login"
          >
            Singer Login
          </Button>

          <Button
            variant="contained"
            color="success"
            component={Link}
            to="/register"
          >
            Register Now
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;