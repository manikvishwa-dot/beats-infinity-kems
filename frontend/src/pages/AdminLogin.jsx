import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";

import { login } from "../services/adminService";

import PasswordToggleInput from "../components/common/PasswordToggleInput";

import "./AdminLogin.css";


function AdminLogin() {

    const location =
        useLocation();

    const navigate =
        useNavigate();


    // ======================================================
    // MODE - derived from the URL, not user-selectable
    // within the page itself. The tabs navigate between
    // the two distinct routes.
    // ======================================================

    const isSuperAdmin =
        location.pathname.startsWith(
            "/superadmin"
        );


    const [username, setUsername] =
        useState("");

    const [password, setPassword] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");


    const handleSubmit =
        async event => {

            event.preventDefault();

            setError("");


            if (
                !username.trim() ||
                !password
            ) {

                setError(
                    "Please enter both username and password."
                );

                return;

            }


            setLoading(true);


            try {

                const result =
                    await login(
                        username.trim(),
                        password,
                        isSuperAdmin
                            ? "super_admin"
                            : undefined
                    );


                if (
                    !result ||
                    !result.success
                ) {

                    setError(
                        result?.message ||
                        "Unable to login."
                    );

                    return;

                }


                const redirectTo =
                    location.state?.from?.pathname ||
                    (
                        result.admin?.role ===
                        "super_admin" &&
                        isSuperAdmin
                            ? "/superadmin"
                            : "/admin"
                    );


                navigate(
                    redirectTo,
                    { replace: true }
                );

            }

            catch (err) {

                setError(
                    err?.message ||
                    "Unable to login."
                );

            }

            finally {

                setLoading(false);

            }

        };


    return (

        <div className="admin-login-page">

            <div className="admin-login-card">

                <div className="admin-login-brand">

                    BEATS ∞ INFINITY

                </div>


                {/* ==================================================
                    TABS
                ================================================== */}

                <div className="admin-login-tabs">

                    <Link
                        to="/admin/login"
                        className={
                            !isSuperAdmin
                                ? "admin-login-tab active"
                                : "admin-login-tab"
                        }
                    >

                        Admin

                    </Link>

                    <Link
                        to="/superadmin/login"
                        className={
                            isSuperAdmin
                                ? "admin-login-tab active"
                                : "admin-login-tab"
                        }
                    >

                        Super Admin

                    </Link>

                </div>


                <h1>

                    {isSuperAdmin
                        ? "Super Admin Login"
                        : "Admin Login"
                    }

                </h1>


                {error && (

                    <div className="admin-login-error">

                        ⚠️ {error}

                    </div>

                )}


                <form onSubmit={handleSubmit}>

                    <div className="admin-login-field">

                        <label>
                            Username
                        </label>

                        <input
                            type="text"
                            value={username}
                            onChange={
                                event =>
                                    setUsername(
                                        event.target.value
                                    )
                            }
                            autoComplete="username"
                            disabled={loading}
                            autoFocus
                        />

                    </div>


                    <div className="admin-login-field">

                        <label>
                            Password
                        </label>

                        <PasswordToggleInput
                            value={password}
                            onChange={
                                event =>
                                    setPassword(
                                        event.target.value
                                    )
                            }
                            autoComplete="current-password"
                            disabled={loading}
                        />

                    </div>


                    <button
                        type="submit"
                        className="admin-login-button"
                        disabled={loading}
                    >

                        {loading
                            ? "Logging in..."
                            : "LOGIN"
                        }

                    </button>

                </form>


                <Link
                    to="/"
                    className="admin-login-back"
                >

                    ← Back to Beats Infinity

                </Link>

            </div>

        </div>

    );

}

export default AdminLogin;
