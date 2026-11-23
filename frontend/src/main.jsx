import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";

import App from "./App";
import theme from "./theme/theme";

import "./index.css";

import startPwaAutoUpdate from "./pwaUpdate";

// Refresh to the newest version after a deploy (see pwaUpdate.js)
startPwaAutoUpdate();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);