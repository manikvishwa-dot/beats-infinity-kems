import { Routes, Route, Navigate } from "react-router-dom";


/* ==========================================================
   PUBLIC PAGES
========================================================== */

import Home from "../pages/Home";
import Events from "../pages/Events";
import About from "../pages/About";
import Contact from "../pages/Contact";
import Login from "../pages/Login";
import Registration from "../pages/Registration";
import Welcome from "../pages/Welcome";


/* ==========================================================
   SINGER PAGES
========================================================== */

import SingerRegistration from "../pages/SingerRegistration";
import SingerDashboard from "../pages/SingerDashboard";
import SingerLogin from "../pages/SingerLogin";
import SingerPayment from "../pages/SingerPayment";


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
import AdminLogin from "../pages/AdminLogin";
import SongManagement from "../pages/SongManagement";
import SingerManagement from "../pages/SingerManagement";
import PairingManagement from "../pages/PairingManagement";
import AdminPaymentManagement from "../pages/AdminPaymentManagement";
import SuperAdminDashboard from "../pages/SuperAdminDashboard";
import ComparisonDashboard from "../pages/ComparisonDashboard";
import RequireAdminAuth from "../components/admin/RequireAdminAuth";


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
                EVENTS
                -----------------------------------------------
                Public page. Admin-only edit controls (banner
                upload, date/time/venue/seats) render inline on
                this same page when an admin session is active.
            ================================================== */}

            <Route
                path="/events"
                element={<Events />}
            />


            {/* ==================================================
                ABOUT
            ================================================== */}

            <Route
                path="/about"
                element={<About />}
            />


            {/* ==================================================
                CONTACT
            ================================================== */}

            <Route
                path="/contact"
                element={<Contact />}
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
                SINGER PAYMENT
            ================================================== */}

            <Route
                path="/singer-payment"
                element={<SingerPayment />}
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
                ADMIN LOGIN / SUPER ADMIN LOGIN
                -----------------------------------------------
                Public - not behind the auth guard.
            ================================================== */}

            <Route
                path="/admin/login"
                element={<AdminLogin />}
            />

            <Route
                path="/superadmin/login"
                element={<AdminLogin />}
            />


            {/* ==================================================
                ADMIN - PROTECTED
            ================================================== */}

            <Route
                path="/admin"
                element={
                    <RequireAdminAuth>
                        <AdminDashboard />
                    </RequireAdminAuth>
                }
            />

            {/* /admin/events now lives at the public /events page
                (admins see the edit controls inline there). */}
            <Route
                path="/admin/events"
                element={<Navigate to="/events" replace />}
            />

            <Route
                path="/admin/songs"
                element={
                    <RequireAdminAuth>
                        <SongManagement />
                    </RequireAdminAuth>
                }
            />

            <Route
                path="/admin/singers"
                element={
                    <RequireAdminAuth>
                        <SingerManagement />
                    </RequireAdminAuth>
                }
            />

            <Route
                path="/admin/pairing"
                element={
                    <RequireAdminAuth>
                        <PairingManagement />
                    </RequireAdminAuth>
                }
            />

            <Route
                path="/admin/payments"
                element={
                    <RequireAdminAuth>
                        <AdminPaymentManagement />
                    </RequireAdminAuth>
                }
            />


            {/* ==================================================
                SUPER ADMIN - PROTECTED (super_admin role only)
            ================================================== */}

            <Route
                path="/superadmin"
                element={
                    <RequireAdminAuth role="super_admin">
                        <SuperAdminDashboard />
                    </RequireAdminAuth>
                }
            />

            <Route
                path="/superadmin/comparison"
                element={
                    <RequireAdminAuth role="super_admin">
                        <ComparisonDashboard />
                    </RequireAdminAuth>
                }
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