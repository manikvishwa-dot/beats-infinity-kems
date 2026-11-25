import { useCallback, useEffect, useState } from "react";

import ExcelToolbar from "./ExcelToolbar";
import {
    getFinalListRollback,
    getPairingChangeLog,
    rollbackFinalPairingList
} from "../../services/adminDashboardService";

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

function PairingChangeLog({ eventId, onRolledBack }) {

    const [entries, setEntries] = useState([]);
    const [notSetUp, setNotSetUp] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // "Roll back last save" - { available, rows, saved_at, saved_by }
    const [rollback, setRollback] = useState(null);
    const [rollingBack, setRollingBack] = useState(false);

    const loadAll = useCallback(() => Promise.all([
        getPairingChangeLog(eventId),
        eventId ? getFinalListRollback(eventId).catch(() => null) : Promise.resolve(null)
    ]), [eventId]);

    const applyLoaded = ([result, rollbackInfo]) => {
        setEntries(result.entries || []);
        setNotSetUp(Boolean(result.not_set_up));
        setRollback(rollbackInfo);
    };

    useEffect(() => {

        let cancelled = false;

        loadAll()
            .then(loaded => {
                if (!cancelled) applyLoaded(loaded);
            })
            .catch(requestError => {
                if (!cancelled) setError(requestError.message || "Unable to load the change log.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };

    }, [loadAll]);

    const handleRollback = async () => {

        if (!rollback?.available) return;

        const ok = window.confirm(
            "Roll back the Final List to how it was before the last save?\n\n" +
            `It had ${rollback.rows} song${rollback.rows === 1 ? "" : "s"}.` +
            (rollback.saved_at ? ` Last save: ${formatWhen(rollback.saved_at)}${rollback.saved_by ? ` by ${rollback.saved_by}` : ""}.` : "") +
            "\n\nThe list saved now will be replaced. Only one rollback is kept, so this can't be undone with the button again."
        );

        if (!ok) return;

        setRollingBack(true);
        setError("");
        setSuccess("");

        try {
            const result = await rollbackFinalPairingList(eventId);
            applyLoaded(await loadAll());
            setSuccess(result.message || "Rolled back.");
            onRolledBack?.();
        }
        catch (requestError) {
            setError(requestError.message || "Unable to roll back.");
        }
        finally {
            setRollingBack(false);
        }

    };

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
            {success && <div className="pairing-success">✅ {success}</div>}

            {!notSetUp && (
                <div className="change-log-rollback">
                    <div>
                        <b>Roll back last save</b>
                        <span>
                            {rollback?.available
                                ? ` Puts the Final List back to how it was before the last save (${rollback.rows} songs${rollback.saved_at ? `, saved ${formatWhen(rollback.saved_at)}` : ""}).`
                                : " Nothing to roll back - a copy is kept each time the Final List is saved."}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="admin-btn admin-btn-outline admin-btn-sm"
                        onClick={handleRollback}
                        disabled={!rollback?.available || rollingBack}
                    >
                        {rollingBack ? "Rolling back..." : "↶ Roll back last save"}
                    </button>
                </div>
            )}

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
