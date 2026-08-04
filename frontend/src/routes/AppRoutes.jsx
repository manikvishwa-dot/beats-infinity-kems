import { Routes, Route } from "react-router-dom";

import Home from "../pages/Home";
import Registration from "../pages/Registration";
import Login from "../pages/Login";

import SingerDashboard from "../pages/SingerDashboard";

import AdminDashboard from "../pages/AdminDashboard";
import EventManagement from "../pages/EventManagement";
import SongManagement from "../pages/SongManagement";
import SingerManagement from "../pages/SingerManagement";
import PairingManagement from "../pages/PairingManagement";

import PageNotFound from "../pages/PageNotFound";

function AppRoutes() {

    return (

        <Routes>

            {/* Public */}

            <Route
                path="/"
                element={<Home />}
            />

            <Route
                path="/register"
                element={<Registration />}
            />

            <Route
                path="/login"
                element={<Login />}
            />

            {/* Singer */}

            <Route
                path="/dashboard"
                element={<SingerDashboard />}
            />

            {/* Admin */}

            <Route
                path="/admin"
                element={<AdminDashboard />}
            />

            <Route
                path="/admin/events"
                element={<EventManagement />}
            />

            <Route
                path="/admin/songs"
                element={<SongManagement />}
            />

            <Route
                path="/admin/singers"
                element={<SingerManagement />}
            />

            <Route
                path="/admin/pairing"
                element={<PairingManagement />}
            />

            {/* 404 */}

            <Route
                path="*"
                element={<PageNotFound />}
            />

        </Routes>

    );

}

export default AppRoutes;