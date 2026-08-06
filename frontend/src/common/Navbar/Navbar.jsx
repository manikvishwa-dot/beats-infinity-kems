import { AppBar, Toolbar, Box, Button } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import ASSETS from "../../config/assets";

import "./Navbar.css";

function Navbar() {
  const location = useLocation();

  const navItems = [
    { label: "Home", path: "/" },
    { label: "Events", path: "/events" },
    { label: "Gallery", path: "/gallery" },
    { label: "Journey", path: "/journey" },
    { label: "About", path: "/about" },
    { label: "Contact", path: "/contact" },
  ];

  return (
    <AppBar
      position="sticky"
      elevation={0}
      className="navbar"
    >
      <Toolbar className="navbar-toolbar">

        {/* Left Section */}

        <Box className="navbar-logo-section">

          <Link to="/" className="logo-link">

            <img
              src={ASSETS.logo}
              alt="Beats Infinity"
              className="navbar-logo"
            />

          </Link>

        </Box>

        {/* Center Navigation */}

        <Box className="navbar-menu">

          {navItems.map((item) => (

            <Button
              key={item.label}
              component={Link}
              to={item.path}
              className={
                location.pathname === item.path
                  ? "nav-button active"
                  : "nav-button"
              }
            >
              {item.label}
            </Button>

          ))}

        </Box>

        {/* Right Buttons */}

        <Box className="navbar-actions">

          <Button
            component={Link}
            to="/login"
            variant="outlined"
            className="login-button"
          >
            Singer Login
          </Button>

          <Button
            component={Link}
            to="/register"
            variant="contained"
            className="register-button"
          >
            Register Now
          </Button>

        </Box>

      </Toolbar>
    </AppBar>
  );
}

export default Navbar;