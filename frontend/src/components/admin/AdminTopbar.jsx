import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import ASSETS from "../../config/assets";
import { getSession, logout } from "../../services/adminService";

import "./AdminTopbar.css";

// ==========================================================
// ADMIN NAVIGATION - left sidebar
//
// Desktop: fixed sidebar (logo, menu, signed-in admin + Logout);
// the page content sits to its right with a "← Back" bar on top.
// Phones / small tablets: a slim top bar with ☰ that slides the
// same sidebar in from the left.
//
// (Still named AdminTopbar so every admin page keeps working
// unchanged - each renders <AdminTopbar /> first inside
// .admin-shell.)
// ==========================================================

const NAV_ITEMS = [

    { label: "Dashboard", path: "/admin", icon: "📊" },

    { label: "Singers", path: "/admin/singers", icon: "🎤" },

    { label: "Songs", path: "/admin/songs", icon: "🎵" },

    { label: "Events", path: "/events", icon: "📅" },

    { label: "Pairing", path: "/admin/pairing", icon: "🎼" },

    { label: "Payments", path: "/admin/payments", icon: "💳" },

    { label: "Journey", path: "/admin/journey", icon: "🖼️" },

    { label: "Maggie", path: "/admin/maggie", icon: "🕵️" }

];

const SUPER_ITEMS = [

    { label: "Finance", path: "/superadmin", icon: "👑" },

    { label: "Comparison Dashboard", path: "/superadmin/comparison", icon: "📈" }

];

function AdminTopbar({ loginPath = "/admin/login" }) {

    const location = useLocation();
    const navigate = useNavigate();
    const session = getSession();

    const [menuOpen, setMenuOpen] = useState(false);

    const isSuperAdmin = session?.admin?.role === "super_admin";
    const isDashboard =
        location.pathname === "/admin" ||
        location.pathname === "/superadmin" ||
        location.pathname === "/superadmin/comparison";

    // Esc closes the phone menu
    useEffect(() => {
        if (!menuOpen) {
            return undefined;
        }

        const onKey = event => {
            if (event.key === "Escape") setMenuOpen(false);
        };

        document.addEventListener("keydown", onKey);

        return () => document.removeEventListener("keydown", onKey);
    }, [menuOpen]);

    const closeMenu = () => setMenuOpen(false);

    const handleLogout = async () => {
        await logout();
        navigate(loginPath);
    };

    const handleBack = () => {
        if (location.key !== "default") {
            navigate(-1);
        }
        else {
            navigate("/admin");
        }
    };

    const renderLink = (item, superLink = false) => {
        const active = location.pathname === item.path;

        return (
            <Link
                key={item.path}
                to={item.path}
                onClick={closeMenu}
                aria-current={active ? "page" : undefined}
                className={[
                    "admin-side-link",
                    active ? "active" : "",
                    superLink ? "super" : ""
                ].filter(Boolean).join(" ")}
            >
                <span className="admin-side-link-icon" aria-hidden="true">{item.icon}</span>
                <span className="admin-side-link-label">{item.label}</span>
            </Link>
        );
    };

    const brand = (
        <Link to="/admin" className="admin-side-brand" onClick={closeMenu}>
            <img src={ASSETS.logo} alt="" />
            <span className="admin-side-brand-name">BEATS ∞ INFINITY</span>
            <span className="admin-side-badge">{isSuperAdmin ? "SUPER" : "ADMIN"}</span>
        </Link>
    );

    return (

        <>

            {/* Phones / small tablets */}
            <header className="admin-mobilebar">
                <button
                    type="button"
                    className="admin-mobilebar-toggle"
                    onClick={() => setMenuOpen(true)}
                    aria-label="Open menu"
                    aria-expanded={menuOpen}
                    aria-controls="admin-sidebar"
                >
                    <span />
                    <span />
                    <span />
                </button>

                {brand}
            </header>

            {menuOpen && (
                <div
                    className="admin-sidebar-backdrop"
                    onClick={closeMenu}
                    aria-hidden="true"
                />
            )}

            <aside
                id="admin-sidebar"
                className={menuOpen ? "admin-sidebar open" : "admin-sidebar"}
                aria-label="Admin menu"
            >

                <div className="admin-sidebar-top">
                    {brand}

                    <button
                        type="button"
                        className="admin-sidebar-close"
                        onClick={closeMenu}
                        aria-label="Close menu"
                    >
                        ✕
                    </button>
                </div>

                <nav className="admin-sidebar-nav">
                    {NAV_ITEMS.map(item => renderLink(item))}

                    {isSuperAdmin && (
                        <>
                            <span className="admin-sidebar-group">Super Admin</span>
                            {SUPER_ITEMS.map(item => renderLink(item, true))}
                        </>
                    )}
                </nav>

                <div className="admin-sidebar-footer">
                    <div className="admin-sidebar-identity">
                        <span className="admin-sidebar-avatar" aria-hidden="true">
                            {(session?.admin?.username || "A").charAt(0).toUpperCase()}
                        </span>
                        <span className="admin-sidebar-who">
                            <strong>{session?.admin?.username || "Admin"}</strong>
                            <em className={isSuperAdmin ? "super" : ""}>
                                {isSuperAdmin ? "Super Admin" : "Admin"}
                            </em>
                        </span>
                    </div>

                    <button
                        type="button"
                        className="admin-btn admin-btn-ghost admin-btn-sm admin-sidebar-logout"
                        onClick={handleLogout}
                    >
                        Logout
                    </button>
                </div>

            </aside>

            {!isDashboard && (
                <div className="admin-backbar">
                    <button
                        type="button"
                        className="admin-btn admin-btn-ghost admin-btn-sm"
                        onClick={handleBack}
                    >
                        ← Back
                    </button>
                </div>
            )}

        </>

    );

}

export default AdminTopbar;
