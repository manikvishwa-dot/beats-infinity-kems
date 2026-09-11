import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AdminTopbar from "../components/admin/AdminTopbar";
import PasswordToggleInput from "../components/common/PasswordToggleInput";
import { getMaggieAudit, getMaggieAuditAllEvents } from "../services/adminDashboardService";
import { getSession, changeAdminPassword, logout } from "../services/adminService";
import { getEvents } from "../services/eventService";

import "../styles/adminTheme.css";
import "./Maggie.css";

// ==========================================================
// BEATS INFINITY - MAGGIE (DATA AUDIT)
// ==========================================================
//
// Acts as a test manager for the data behind the Admin and
// Super Admin dashboards - not the UI itself, the data those
// screens read (Singers, Songs, Pairing, Payments). Runs the
// same checks as `node backend/scripts/verify-data-integrity.js`
// (see backend/services/dataAuditService.js), surfaced here with
// plain-language suggestions instead of a terminal report.
// ==========================================================

const SEVERITY_ORDER = ["high", "medium", "low"];

const SEVERITY_LABEL = {
    high: "High",
    medium: "Medium",
    low: "Low"
};

const CATEGORY_LABEL = category =>
    String(category || "")
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

const EMPTY_PASSWORD_FORM = { currentPassword: "", newPassword: "", confirmPassword: "" };


function SummaryBar({ summary }) {

    return (
        <div className="maggie-summary-row">
            <div className="maggie-summary-card high">
                <span className="maggie-summary-count">{summary.high || 0}</span>
                <span className="maggie-summary-label">High</span>
            </div>
            <div className="maggie-summary-card medium">
                <span className="maggie-summary-count">{summary.medium || 0}</span>
                <span className="maggie-summary-label">Medium</span>
            </div>
            <div className="maggie-summary-card low">
                <span className="maggie-summary-count">{summary.low || 0}</span>
                <span className="maggie-summary-label">Low</span>
            </div>
            <div className="maggie-summary-card total">
                <span className="maggie-summary-count">{summary.total || 0}</span>
                <span className="maggie-summary-label">Total Findings</span>
            </div>
        </div>
    );

}

function FindingsList({ findings }) {

    if (!findings || findings.length === 0) {

        return (
            <div className="maggie-clean">
                ✅ No issues found — this event's data looks clean.
            </div>
        );

    }

    const bySeverity = { high: [], medium: [], low: [] };
    findings.forEach(f => bySeverity[f.severity]?.push(f));

    return (
        <div className="maggie-findings">
            {SEVERITY_ORDER.map(severity => {

                const items = bySeverity[severity];
                if (!items || items.length === 0) return null;

                return (
                    <div key={severity} className={`maggie-severity-group ${severity}`}>

                        <h3 className="maggie-severity-heading">
                            {SEVERITY_LABEL[severity]} <span>({items.length})</span>
                        </h3>

                        {items.map((finding, index) => (
                            <div key={`${severity}-${index}`} className={`maggie-finding-card ${severity}`}>

                                <div className="maggie-finding-top">
                                    <span className="maggie-finding-category">{CATEGORY_LABEL(finding.category)}</span>
                                </div>

                                <p className="maggie-finding-message">{finding.message}</p>

                                {finding.suggestion && (
                                    <p className="maggie-finding-suggestion">💡 {finding.suggestion}</p>
                                )}

                            </div>
                        ))}

                    </div>
                );

            })}
        </div>
    );

}


function Maggie() {

    const navigate = useNavigate();
    const session = getSession();
    const isSuperAdmin = session?.admin?.role === "super_admin";

    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [eventsReady, setEventsReady] = useState(false);
    const [allEventsMode, setAllEventsMode] = useState(false);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [singleResult, setSingleResult] = useState(null); // { event, findings, summary }
    const [allResults, setAllResults] = useState(null); // { events: [...], grand_total }

    // Self-service change password (admin role only - Super Admin
    // already has full account management on /superadmin).
    const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);

    useEffect(() => {

        getEvents()
            .then(result => {

                const allEvents = result.events || [];
                setEvents(allEvents);

                const active = allEvents.find(item => item.is_active);
                setSelectedEventId(current => current || active?.id || allEvents[0]?.id || "");

            })
            .catch(requestError => {

                console.error("Load events error:", requestError);

            })
            .finally(() => setEventsReady(true));

    }, []);

    const runAudit = useCallback(async () => {

        if (!eventsReady) return;

        try {

            setLoading(true);
            setError("");

            if (allEventsMode) {

                const result = await getMaggieAuditAllEvents();
                setAllResults(result);
                setSingleResult(null);

            }
            else {

                const result = await getMaggieAudit(selectedEventId);
                setSingleResult(result);
                setAllResults(null);

            }

        }
        catch (requestError) {

            console.error("Maggie audit error:", requestError);
            setError(requestError.message || "Unable to run the audit.");

        }
        finally {

            setLoading(false);

        }

    }, [eventsReady, allEventsMode, selectedEventId]);

    useEffect(() => {

        runAudit();

    }, [runAudit]);

    const handleChangePassword = async event => {

        event.preventDefault();

        setPasswordError("");
        setPasswordSuccess("");

        if (!passwordForm.currentPassword) {
            setPasswordError("Please enter your current password.");
            return;
        }

        if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
            setPasswordError("New password must be at least 6 characters.");
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError("New password and confirmation do not match.");
            return;
        }

        setSavingPassword(true);

        try {

            const result = await changeAdminPassword(
                session.admin.id,
                passwordForm.newPassword,
                passwordForm.currentPassword
            );

            setPasswordSuccess(result.message || "Password updated.");
            setPasswordForm(EMPTY_PASSWORD_FORM);

            if (result.forced_logout) {

                setTimeout(async () => {
                    await logout();
                    navigate("/admin/login");
                }, 1800);

            }

        }
        catch (requestError) {

            console.error("Change password error:", requestError);
            setPasswordError(requestError.message || "Unable to change password.");

        }
        finally {

            setSavingPassword(false);

        }

    };

    return (
        <div className="admin-shell">
            <AdminTopbar />

            <div className="admin-shell-content">

                <div className="maggie-header">
                    <div>
                        <h1>🕵️ Maggie — Data Audit</h1>
                        <p className="maggie-subtitle">
                            Checks the data behind Singers, Songs, Pairing and Payments for
                            problems before they show up as broken dashboard rows: unpaired
                            singers, duplicate or orphaned pairings, same-gender song
                            duplicates, paid-but-unpaired singers, and anything still
                            awaiting approval.
                        </p>
                    </div>

                    <button type="button" className="admin-btn admin-btn-primary" onClick={runAudit} disabled={loading}>
                        {loading ? "Running…" : "🔄 Run Audit"}
                    </button>
                </div>

                <div className="maggie-controls">

                    {!allEventsMode && (
                        <div className="maggie-control-field">
                            <label>Event</label>
                            <select
                                value={selectedEventId}
                                onChange={event => setSelectedEventId(event.target.value)}
                                disabled={events.length === 0}
                            >
                                {events.length === 0 && <option value="">No events yet</option>}
                                {events.map(event => (
                                    <option key={event.id} value={event.id}>
                                        {event.name}{event.is_active ? " (Active)" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {isSuperAdmin && (
                        <label className="maggie-all-events-toggle">
                            <input
                                type="checkbox"
                                checked={allEventsMode}
                                onChange={event => setAllEventsMode(event.target.checked)}
                            />
                            All events (Super Admin)
                        </label>
                    )}

                </div>

                {error && <div className="maggie-error">⚠️ {error}</div>}

                {loading && !error && (
                    <div className="maggie-loading">Running the audit…</div>
                )}

                {!loading && !error && singleResult && (
                    <>
                        <h2 className="maggie-event-title">{singleResult.event?.name}</h2>
                        <SummaryBar summary={singleResult.summary} />
                        <FindingsList findings={singleResult.findings} />
                    </>
                )}

                {!loading && !error && allResults && (
                    <>
                        <h2 className="maggie-event-title">All Events</h2>
                        <SummaryBar summary={allResults.grand_total} />

                        {(allResults.events || []).map(entry => (
                            <div key={entry.event.id} className="maggie-event-block">
                                <h3 className="maggie-event-block-title">{entry.event.name}</h3>
                                <SummaryBar summary={entry.summary} />
                                <FindingsList findings={entry.findings} />
                            </div>
                        ))}
                    </>
                )}

                {!isSuperAdmin && (
                    <div className="maggie-password-section">
                        <h2>🔐 Change My Password</h2>

                        {passwordError && <div className="maggie-error">⚠️ {passwordError}</div>}
                        {passwordSuccess && (
                            <div className="maggie-success">
                                ✅ {passwordSuccess} Redirecting to login…
                            </div>
                        )}

                        <form className="maggie-password-form" onSubmit={handleChangePassword}>

                            <div className="maggie-control-field">
                                <label>Current Password</label>
                                <PasswordToggleInput
                                    value={passwordForm.currentPassword}
                                    onChange={event => setPasswordForm(current => ({ ...current, currentPassword: event.target.value }))}
                                    autoComplete="current-password"
                                />
                            </div>

                            <div className="maggie-control-field">
                                <label>New Password</label>
                                <PasswordToggleInput
                                    value={passwordForm.newPassword}
                                    onChange={event => setPasswordForm(current => ({ ...current, newPassword: event.target.value }))}
                                    autoComplete="new-password"
                                />
                            </div>

                            <div className="maggie-control-field">
                                <label>Confirm New Password</label>
                                <PasswordToggleInput
                                    value={passwordForm.confirmPassword}
                                    onChange={event => setPasswordForm(current => ({ ...current, confirmPassword: event.target.value }))}
                                    autoComplete="new-password"
                                />
                            </div>

                            <button type="submit" className="admin-btn admin-btn-primary" disabled={savingPassword}>
                                {savingPassword ? "Updating…" : "Update Password"}
                            </button>

                        </form>
                    </div>
                )}

            </div>
        </div>
    );

}

export default Maggie;
