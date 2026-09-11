import { Navigate } from "react-router-dom";

import { isStandalone, hasSingerSession } from "../utils/pwa";
import Home from "../pages/Home";

// The installed PWA's start_url is "/" - without this, every launch
// of the installed app dumps the user on the full marketing home
// page (hero, stats, Events/Gallery/About/Contact nav) instead of
// feeling like an app. A normal browser tab still gets the real
// marketing Home page, since a first-time visitor needs that.
function AppEntryGate() {

    if (isStandalone()) {

        return hasSingerSession()
            ? <Navigate to="/singer-dashboard" replace />
            : <Navigate to="/login" replace />;

    }

    return <Home />;

}

export default AppEntryGate;
