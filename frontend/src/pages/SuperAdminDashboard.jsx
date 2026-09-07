import AdminTopbar from "../components/admin/AdminTopbar";

import "../styles/adminTheme.css";

function SuperAdminDashboard() {

    return (
        <div className="admin-shell">
            <AdminTopbar loginPath="/superadmin/login" />

            <div className="admin-shell-content">
                <h1 className="admin-page-title">Super Admin Dashboard</h1>
                <p className="admin-page-subtitle">
                    Revenue / expense finance dashboard coming next (Step 4).
                </p>

                <div className="admin-card" style={{ padding: "40px", textAlign: "center", color: "#888888" }}>
                    Finance overview is under construction.
                </div>
            </div>
        </div>
    );

}

export default SuperAdminDashboard;
