import { Link, useLocation, useNavigate } from "react-router-dom";

import ASSETS from "../../config/assets";
import { getSession, logout } from "../../services/adminService";

import "./AdminTopbar.css";

const NAV_ITEMS = [

    { label: "Dashboard", path: "/admin", icon: "📊" },

    { label: "Singers", path: "/admin/singers", icon: "🎤" },

    { label: "Songs", path: "/admin/songs", icon: "🎵" },

    { label: "Events", path: "/events", icon: "📅" },

    { label: "Pairing", path: "/admin/pairing", icon: "🎼" },

    { label: "Payments", path: "/admin/payments", icon: "💳" },

    { label: "Journey", path: "/admin/journey", icon: "🖼️" }

];

function AdminTopbar({ loginPath = "/admin/login" }) {

    const location = useLocation();
    const navigate = useNavigate();
    const session = getSession();

    const isSuperAdmin = session?.admin?.role === "super_admin";
    const isDashboard =
        location.pathname === "/admin" ||
        location.pathname === "/superadmin" ||
        location.pathname === "/superadmin/comparison";

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

    return (

        <header className="admin-topbar">

            <div className="admin-topbar-row admin-topbar-toprow">

                <Link to="/admin" className="admin-topbar-brand">
                    <img src={ASSETS.logo} alt="Beats Infinity" />
                    <span>BEATS ∞ INFINITY</span>
                    <span className="admin-topbar-badge">ADMIN</span>
                </Link>

                <div className="admin-topbar-actions">
                    {!isDashboard && (
                        <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={handleBack}>
                            ← Back
                        </button>
                    )}

                    <div className="admin-topbar-identity">
                        <span className="admin-topbar-username">
                            {session?.admin?.username || "Admin"}
                        </span>
                        <span className={isSuperAdmin ? "admin-topbar-role super" : "admin-topbar-role"}>
                            {isSuperAdmin ? "Super Admin" : "Admin"}
                        </span>
                    </div>

                    <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={handleLogout}>
                        Logout
                    </button>
                </div>

            </div>

            <div className="admin-topbar-divider" />

            <nav className="admin-topbar-row admin-topbar-nav">
                {NAV_ITEMS.map(item => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={
                            location.pathname === item.path
                                ? "admin-topbar-link active"
                                : "admin-topbar-link"
                        }
                    >
                        <span className="admin-topbar-link-icon">{item.icon}</span>
                        {item.label}
                    </Link>
                ))}

                {isSuperAdmin && (
                    <Link
                        to="/superadmin"
                        className={
                            location.pathname === "/superadmin"
                                ? "admin-topbar-link active super"
                                : "admin-topbar-link super"
                        }
                    >
                        <span className="admin-topbar-link-icon">👑</span>
                        Finance
                    </Link>
                )}

                {isSuperAdmin && (
                    <Link
                        to="/superadmin/comparison"
                        className={
                            location.pathname === "/superadmin/comparison"
                                ? "admin-topbar-link active super"
                                : "admin-topbar-link super"
                        }
                    >
                        <span className="admin-topbar-link-icon">📈</span>
                        Comparison Dashboard
                    </Link>
                )}
            </nav>

        </header>

    );

}

export default AdminTopbar;
