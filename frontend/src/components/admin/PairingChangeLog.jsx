import { useEffect, useState } from "react";

import ExcelToolbar from "./ExcelToolbar";
import { getPairingChangeLog } from "../../services/adminDashboardService";

import "./FinalPairingList.css";

// ==========================================================
// PAIRING CHANGE LOG - every Final List edit, newest first
// ==========================================================

const describe = value => {
    if (!value) return "";
    if (value.singer) {
        return `${value.singer} (${value.gender || "singer"}) added to the event${value.new_registration ? " - newly registered" : ""}`;
    }
    const singers = [value.male_singer, value.female_singer].filter(Boolean).join(" + ");
    const solo = value.male_singer && value.female_singer ? "" : " (solo)";
    return `${singers || "—"}${solo} · ${value.song || "—"}${value.movie ? ` (${value.movie})` : ""}`;
};

const formatWhen = iso =>
    new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });

const EXCEL_COLUMNS = [
    { key: "when", header: "When", width: 22 },
    { key: "action", header: "Change", width: 12 },
    { key: "before", header: "Before", width: 50 },
    { key: "after", header: "After", width: 50 },
    { key: "by", header: "Changed By", width: 20 }
];

function PairingChangeLog({ eventId }) {

    const [entries, setEntries] = useState([]);
    const [notSetUp, setNotSetUp] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {

        let cancelled = false;

        getPairingChangeLog(eventId)
            .then(result => {
                if (cancelled) return;
                setEntries(result.entries || []);
                setNotSetUp(Boolean(result.not_set_up));
            })
            .catch(requestError => {
                if (!cancelled) setError(requestError.message || "Unable to load the change log.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };

    }, [eventId]);

    if (loading) {
        return <div className="pairing-empty">Loading the change log...</div>;
    }

    const excelRows = entries.map(entry => ({
        when: formatWhen(entry.created_at),
        action: entry.action,
        before: describe(entry.before_value),
        after: describe(entry.after_value),
        by: entry.changed_by_name || ""
    }));

    return (
        <div className="pairing-section">
            <h2>Change Log</h2>
            <p className="pairing-section-hint">
                Every change saved on the Final List - who changed what, and when. Removed or
                replaced pairings are kept as Rejected, so past reports stay complete.
            </p>

            {error && <div className="pairing-error">⚠️ {error}</div>}

            {notSetUp ? (
                <div className="pairing-empty">
                    The change log isn't set up yet - run
                    <code> backend/migrations/2026-11-24_final_pairing_list.sql </code>
                    in Supabase.
                </div>
            ) : entries.length === 0 ? (
                <div className="pairing-empty">No changes recorded for this event yet.</div>
            ) : (
                <>
                    <ExcelToolbar
                        columns={EXCEL_COLUMNS}
                        rows={excelRows}
                        filename="pairing-change-log"
                        onImportRows={async () => ({ error: true, message: "The change log is read-only." })}
                    />

                    <div className="pairing-table-wrapper">
                        <table className="pairing-table change-log-table">
                            <thead>
                                <tr>
                                    <th>When</th>
                                    <th>Change</th>
                                    <th>Details</th>
                                    <th>By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(entry => (
                                    <tr key={entry.id}>
                                        <td>{formatWhen(entry.created_at)}</td>
                                        <td>
                                            <span className={`change-log-action ${entry.action}`}>
                                                {entry.action === "singer_added" ? "singer added" : entry.action}
                                            </span>
                                        </td>
                                        <td>
                                            {entry.action === "changed" ? (
                                                <>
                                                    <div className="change-log-before">{describe(entry.before_value)}</div>
                                                    <div>→ {describe(entry.after_value)}</div>
                                                </>
                                            ) : (
                                                describe(entry.after_value || entry.before_value)
                                            )}
                                        </td>
                                        <td>{entry.changed_by_name || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );

}

export default PairingChangeLog;
