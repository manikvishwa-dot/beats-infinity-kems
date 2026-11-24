import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import ASSETS from "../../config/assets";
import { getSession, logout } from "../../services/adminService";

import "./AdminTopbar.css";

// ==========================================================
// ADMIN NAVIGATION - responsive left sidebar
//
//   >= 1200px   full sidebar; « collapses it to an icon rail
//               (remembered per browser)
//   901-1199px  icon rail automatically
//   <= 900px    slim top bar + ☰ slide-in menu
//
// Whenever it's a rail, hovering it (or tabbing into it) expands
// it over the page - the content never shifts.
//
// (Still named AdminTopbar so every admin page keeps working
// unchanged - each renders <AdminTopbar /> first inside
// .admin-shell.)
// ==========================================================

const NAV_GROUPS = [

    {
        title: "Overview",
        items: [
            { label: "Dashboard", path: "/admin", icon: "📊" }
        ]
    },

    {
        title: "People & Music",
        items: [
            { label: "Singers", path: "/admin/singers", icon: "🎤" },
            { label: "Songs", path: "/admin/songs", icon: "🎵" }
        ]
    },

    {
        title: "Event Day",
        items: [
            { label: "Events", path: "/events", icon: "📅" },
            { label: "Pairing", path: "/admin/pairing", icon: "🎼" },
            { label: "Payments", path: "/admin/payments", icon: "💳" }
        ]
    },

    {
        title: "Content",
        items: [
            { label: "Journey", path: "/admin/journey", icon: "🖼️" },
            { label: "Maggie", path: "/admin/maggie", icon: "🕵️" }
        ]
    }

];

const SUPER_GROUP = {
    title: "Super Admin",
    super: true,
    items: [
        { label: "Finance", path: "/superadmin", icon: "👑" },
        { label: "Comparison", path: "/superadmin/comparison", icon: "📈" }
    ]
};

const COLLAPSED_KEY = "beatsInfinityAdminSidebarCollapsed";

// Laptop / tablet widths get the icon rail automatically
const MID_SCREEN = "(min-width: 901px) and (max-width: 1199px)";

const matchesMid = () =>
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.(MID_SCREEN).matches);

const readCollapsed = () => {
    try {
        return localStorage.getItem(COLLAPSED_KEY) === "1";
    }
    catch {
        return false;
    }
};

function AdminTopbar({ loginPath = "/admin/login" }) {

    const location = useLocation();
    const navigate = useNavigate();
    const session = getSession();

    const [menuOpen, setMenuOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(readCollapsed);
    const [midScreen, setMidScreen] = useState(matchesMid);

    // Icon rail: chosen on a big screen, or automatic on a mid one
    const rail = collapsed || midScreen;

    const isSuperAdmin = session?.admin?.role === "super_admin";
    const username = session?.admin?.username || "Admin";
    const roleLabel = isSuperAdmin ? "Super Admin" : "Admin";
    const isDashboard =
        location.pathname === "/admin" ||
        location.pathname === "/superadmin" ||
        location.pathname === "/superadmin/comparison";

    const groups = isSuperAdmin ? [...NAV_GROUPS, SUPER_GROUP] : NAV_GROUPS;

    // The page content's left margin follows the sidebar width
    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("admin-sidebar-collapsed", collapsed);
        return () => root.classList.remove("admin-sidebar-collapsed");
    }, [collapsed]);

    useEffect(() => {
        const query = window.matchMedia?.(MID_SCREEN);
        if (!query) return undefined;

        const onChange = event => setMidScreen(event.matches);

        query.addEventListener("change", onChange);

        return () => query.removeEventListener("change", onChange);
    }, []);

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

    const toggleCollapsed = () => {
        setCollapsed(current => {
            const next = !current;
            try {
                localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
            }
            catch {
                // private mode - just don't remember it
            }
            return next;
        });
    };

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

    const renderLink = (item, superLink) => {
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
        <Link to="/admin" className="admin-side-brand" onClick={closeMenu} title="Admin home">
            <span className="admin-side-logo">
                <img src={ASSETS.logo} alt="" />
            </span>
            <span className="admin-side-brand-text">
                <span className="admin-side-brand-name">BEATS ∞ INFINITY</span>
                <span className="admin-side-brand-sub">
                    Admin Console
                    <span className={isSuperAdmin ? "admin-side-badge super" : "admin-side-badge"}>
                        {isSuperAdmin ? "SUPER" : "ADMIN"}
                    </span>
                </span>
            </span>
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
                className={[
                    "admin-sidebar",
                    menuOpen ? "open" : "",
                    rail ? "rail" : "",
                    collapsed ? "collapsed" : ""
                ].filter(Boolean).join(" ")}
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
                    {groups.map(group => (
                        <div
                            key={group.title}
                            className={group.super ? "admin-side-group super" : "admin-side-group"}
                        >
                            <span className="admin-side-group-title">{group.title}</span>
                            {group.items.map(item => renderLink(item, group.super))}
                        </div>
                    ))}
                </nav>

                <div className="admin-sidebar-footer">
                    <div className="admin-sidebar-profile">
                        <span
                            className={isSuperAdmin ? "admin-sidebar-avatar super" : "admin-sidebar-avatar"}
                            title={`${username} · ${roleLabel}`}
                        >
                            {username.charAt(0).toUpperCase()}
                        </span>
                        <span className="admin-sidebar-who">
                            <strong>{username}</strong>
                            <em className={isSuperAdmin ? "super" : ""}>
                                <i aria-hidden="true" />
                                {roleLabel}
                            </em>
                        </span>
                        <button
                            type="button"
                            className="admin-sidebar-logout"
                            onClick={handleLogout}
                            title="Logout"
                            aria-label="Logout"
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                <path
                                    d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    </div>

                    <button
                        type="button"
                        className="admin-sidebar-collapse"
                        onClick={toggleCollapsed}
                        aria-pressed={collapsed}
                        title={collapsed ? "Keep the menu open" : "Shrink the menu to icons"}
                    >
                        <span className="admin-sidebar-collapse-icon" aria-hidden="true">«</span>
                        <span className="admin-sidebar-collapse-label">
                            {collapsed ? "Keep menu open" : "Collapse menu"}
                        </span>
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
