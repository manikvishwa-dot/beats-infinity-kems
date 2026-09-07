import { useCallback, useEffect, useMemo, useState } from "react";

import AdminTopbar from "../components/admin/AdminTopbar";
import ExcelToolbar from "../components/admin/ExcelToolbar";
import { getAllSingers, bulkUpdateSingers } from "../services/adminDashboardService";

import "../styles/adminTheme.css";
import "./SingerManagement.css";

const SINGER_COLUMNS = [
    { key: "id", header: "ID", width: 38 },
    { key: "singer_name", header: "Singer Name", width: 26 },
    { key: "gender", header: "Gender", width: 12 },
    { key: "date_of_birth", header: "Date of Birth (YYYY-MM-DD)", width: 24 },
    { key: "mobile_number", header: "Mobile Number", width: 18 }
];

const formatDate = value => {
    if (!value) {
        return "—";
    }

    try {
        return new Date(value).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }
    catch {
        return value;
    }
};

const getGenderClass = gender => {
    const normalized = String(gender || "").trim().toLowerCase();

    if (normalized === "male") return "male";
    if (normalized === "female") return "female";
    return "other";
};

function SingerManagement() {

    const [singers, setSingers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    const loadSingers = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const result = await getAllSingers();

            setSingers(result.singers || []);
        }
        catch (requestError) {
            console.error("Load singers error:", requestError);
            setError(
                requestError.message ||
                "Unable to load singers."
            );
        }
        finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSingers();
    }, [loadSingers]);

    const filteredSingers = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
            return singers;
        }

        return singers.filter(singer =>
            (singer.singer_name || "").toLowerCase().includes(query) ||
            (singer.mobile_number || "").includes(query)
        );
    }, [singers, search]);

    const handleImportRows = async parsedRows => {

        const rows = parsedRows.map(row => ({
            id: row.id,
            singer_name: row.singer_name,
            gender: row.gender,
            date_of_birth: row.date_of_birth,
            mobile_number: row.mobile_number
        }));

        const response = await bulkUpdateSingers(rows);

        await loadSingers();

        return { message: response.message };

    };

    return (
        <div className="admin-shell">
            <AdminTopbar />

            <div className="admin-shell-content">
                <h1 className="admin-page-title">Singers</h1>
                <p className="admin-page-subtitle">Full roster of registered singers.</p>

                <ExcelToolbar
                    columns={SINGER_COLUMNS}
                    rows={filteredSingers}
                    filename="beats-infinity-singers"
                    onImportRows={handleImportRows}
                    hint="Export, edit Name/Gender/Date of Birth/Mobile Number, then re-upload the same file to bulk-update. Leave the ID column untouched - it's how each row is matched."
                />

                {error && <div className="singer-mgmt-error">⚠️ {error}</div>}

                <div className="singer-mgmt-toolbar">
                    <span className="singer-mgmt-count">
                        <strong>{filteredSingers.length}</strong> of {singers.length} singers enrolled
                    </span>

                    <input
                        type="text"
                        className="singer-mgmt-search"
                        placeholder="Search by name or mobile number..."
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                    />
                </div>

                {loading ? (
                    <div className="singer-mgmt-empty">Loading singers...</div>
                ) : filteredSingers.length === 0 ? (
                    <div className="singer-mgmt-empty">
                        {singers.length === 0
                            ? "No singers have registered yet."
                            : "No singers match your search."}
                    </div>
                ) : (
                    <div className="singer-mgmt-table-wrapper">
                        <table className="singer-mgmt-table">
                            <thead>
                                <tr>
                                    <th>Singer Name</th>
                                    <th>Gender</th>
                                    <th>Date of Birth</th>
                                    <th>Mobile Number</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredSingers.map(singer => (
                                    <tr key={singer.id}>
                                        <td className="name-cell">{singer.singer_name}</td>
                                        <td>
                                            <span className={`gender-pill ${getGenderClass(singer.gender)}`}>
                                                {singer.gender || "—"}
                                            </span>
                                        </td>
                                        <td>{formatDate(singer.date_of_birth)}</td>
                                        <td>{singer.mobile_number || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SingerManagement;
