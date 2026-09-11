import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { isStandalone, hasSingerSession } from "../utils/pwa";
import Home from "../pages/Home";
import LaunchChooser from "../components/Login/LaunchChooser";

// The installed PWA's start_url is "/" - without this, every launch
// of the installed app dumps the user on the full marketing home
// page (hero, stats, Events/Gallery/About/Contact nav) instead of
// feeling like an app. A normal browser tab still gets the real
// marketing Home page, since a first-time visitor needs that.
//
// This only fires ONCE per app launch (didHandleEntry is a module
// variable, reset only by a real reload/relaunch) - if someone
// navigates back to "/" later in the same session (e.g. tapping
// "Home" in the menu), they see the real Home page instead of being
// bounced straight back out again.
//
// IMPORTANT: the flag is only ever written from useEffect, never
// during render - React 18/19 StrictMode intentionally invokes
// render twice in development, so mutating it directly in the
// render body would make the first invocation's decision get
// silently overwritten by the second, before it could ever commit.
let didHandleEntry = false;

function AppEntryGate() {

    const [decision] = useState(() => {

        if (didHandleEntry || !isStandalone()) {
            return "home";
        }

        return hasSingerSession() ? "dashboard" : "chooser";

    });

    useEffect(() => {
        didHandleEntry = true;
    }, []);

    if (decision === "dashboard") {
        return <Navigate to="/singer-dashboard" replace />;
    }

    if (decision === "chooser") {
        return <LaunchChooser />;
    }

    return <Home />;

}

export default AppEntryGate;
