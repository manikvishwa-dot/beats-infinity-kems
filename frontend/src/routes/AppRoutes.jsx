import { Routes, Route } from "react-router-dom";


/* ==========================================================
   PUBLIC PAGES
========================================================== */

import Home from "../pages/Home";
import Login from "../pages/Login";
import Registration from "../pages/Registration";
import Welcome from "../pages/Welcome";


/* ==========================================================
   SINGER PAGES
========================================================== */

import SingerRegistration from "../pages/SingerRegistration";
import SingerDashboard from "../pages/SingerDashboard";
import SingerLogin from "../pages/SingerLogin";


/* ==========================================================
   AUTHENTICATION COMPONENTS
========================================================== */

import PinLogin from "../components/Auth/PinLogin";
import OTPVerification from "../components/Auth/OTPVerification";
import ForgotPin from "../components/Auth/ForgotPin";
import RegistrationWizard from "../components/Auth/RegistrationWizard";


/* ==========================================================
   ADMIN PAGES
========================================================== */

import AdminDashboard from "../pages/AdminDashboard";
import EventManagement from "../pages/EventManagement";
import SongManagement from "../pages/SongManagement";
import SingerManagement from "../pages/SingerManagement";
import PairingManagement from "../pages/PairingManagement";


/* ==========================================================
   PAGE NOT FOUND
========================================================== */

import PageNotFound from "../pages/PageNotFound";


function AppRoutes() {

    return (

        <Routes>


            {/* ==================================================
                HOME
            ================================================== */}

            <Route
                path="/"
                element={<Home />}
            />


            {/* ==================================================
                EXISTING SINGER LOGIN
            ================================================== */}

            <Route
                path="/login"
                element={<Login />}
            />


            {/* ==================================================
                GENERAL REGISTRATION
            ================================================== */}

            <Route
                path="/register"
                element={<Registration />}
            />


            {/* ==================================================
                BEATS INFINITY SINGER REGISTRATION
            ================================================== */}

            <Route
                path="/singer-registration"
                element={<SingerRegistration />}
            />


            {/* ==================================================
                OLD SINGER LOGIN / REGISTRATION
                -----------------------------------------------
                Kept temporarily so existing links don't break.
            ================================================== */}

            <Route
                path="/singer-login"
                element={<SingerLogin />}
            />


            {/* ==================================================
                AUTHENTICATION
            ================================================== */}

            <Route
                path="/auth"
                element={<Welcome />}
            />

            <Route
                path="/auth/pin"
                element={<PinLogin />}
            />

            <Route
                path="/auth/register"
                element={<RegistrationWizard />}
            />

            <Route
                path="/auth/otp"
                element={<OTPVerification />}
            />

            <Route
                path="/auth/forgot-pin"
                element={<ForgotPin />}
            />


            {/* ==================================================
                SINGER DASHBOARD
            ================================================== */}

            <Route
                path="/singer-dashboard"
                element={<SingerDashboard />}
            />


            {/* ==================================================
                OLD DASHBOARD ROUTE
                -----------------------------------------------
                Kept for backward compatibility.
            ================================================== */}

            <Route
                path="/dashboard"
                element={<SingerDashboard />}
            />


            {/* ==================================================
                ADMIN
            ================================================== */}

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


            {/* ==================================================
                PAGE NOT FOUND
            ================================================== */}

            <Route
                path="*"
                element={<PageNotFound />}
            />

        </Routes>

    );

}


export default AppRoutes;