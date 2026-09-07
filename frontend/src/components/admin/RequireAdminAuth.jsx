import { Navigate, useLocation } from "react-router-dom";

import { getSession } from "../../services/adminService";

// ==========================================================
// ROUTE GUARD
//
// role="super_admin" restricts to Super Admin accounts only.
// Omit role (or pass "admin") to allow either admin or
// super_admin, since super_admin has all admin privileges.
// ==========================================================

function RequireAdminAuth({ children, role }) {

    const location =
        useLocation();

    const session =
        getSession();


    if (!session) {

        return (

            <Navigate
                to={
                    role === "super_admin"
                        ? "/superadmin/login"
                        : "/admin/login"
                }
                state={{ from: location }}
                replace
            />

        );

    }


    if (
        role === "super_admin" &&
        session.admin?.role !== "super_admin"
    ) {

        return (

            <Navigate
                to="/superadmin/login"
                state={{ from: location }}
                replace
            />

        );

    }


    return children;

}

export default RequireAdminAuth;
