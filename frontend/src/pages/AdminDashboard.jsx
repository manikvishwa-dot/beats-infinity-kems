import { useCallback, useEffect, useMemo, useState } from "react";

import AdminTopbar from "../components/admin/AdminTopbar";
import EventSelector from "../components/admin/EventSelector";
import { getSingersOverview } from "../services/adminDashboardService";
import { getEvents } from "../services/eventService";
import { markPaymentAsPaid, rejectPayment } from "../services/paymentService";
import { updateSong } from "../services/songService";

import "../styles/adminTheme.css";
import "./AdminDashboard.css";

const MAX_SONGS = 5;

// ==========================================================
// PAYMENT STATUS DISPLAY
// ==========================================================

const STATUS_DISPLAY = {
    Pending: "Pending for Confirmation",
    Paid: "Paid",
    Rejected: "Not Paid"
};

const getStatusClass = status => {
    if (status === "Paid") return "paid";
    if (status === "Rejected") return "rejected";
    return "pending";
};

const normalizeGender = value =>
    String(value || "").trim().toLowerCase();

function AdminDashboard() {

    const [singers, setSingers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionId, setActionId] = useState(null);

    const [events, setEvents] = useState([]);
    const [selectedEventIds, setSelectedEventIds] = useState([]);
    const [eventsReady, setEventsReady] = useState(false);

    // Inline song-title editing: { songId, value } while active
    const [editingCell, setEditingCell] = useState(null);
    const [savingCell, setSavingCell] = useState(false);

    useEffect(() => {

        getEvents()
            .then(result => {

                const allEvents = result.events || [];
                setEvents(allEvents);

                const active = allEvents.find(item => item.is_active);
                setSelectedEventIds(current =>
                    current.length > 0 ? current : (active ? [active.id] : [])
                );

            })
            .catch(requestError => {

                console.error("Load events error:", requestError);

            })
            .finally(() => {

                // Gates the first data fetch below - without this, an
                // unscoped "all events" request fires immediately on
                // mount (selectedEventIds still []), racing the later,
                // correctly-scoped one. If the heavier unscoped request
                // resolves last, it silently overwrites the scoped
                // result with mixed-event data.
                setEventsReady(true);

            });

    }, []);

    const loadOverview = useCallback(async () => {
        if (!eventsReady) {
            return;
        }

        try {
            setLoading(true);
            setError("");

            const result = await getSingersOverview(selectedEventIds.join(","));

            setSingers(result.singers || []);
        }
        catch (requestError) {
            console.error("Admin overview error:", requestError);
            setError(
                requestError.message ||
                "Unable to load the singer overview."
            );
        }
        finally {
            setLoading(false);
        }
    }, [selectedEventIds, eventsReady]);

    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    const handleMarkPaid = async paymentId => {
        const confirmed = window.confirm(
            "Confirm that this payment has been received? This will submit the singer's 5 songs for pairing."
        );

        if (!confirmed) {
            return;
        }

        setActionId(paymentId);
        setError("");

        try {
            await markPaymentAsPaid(paymentId);
            await loadOverview();
        }
        catch (requestError) {
            console.error("Mark paid error:", requestError);
            setError(
                requestError.message ||
                "Unable to confirm payment."
            );
        }
        finally {
            setActionId(null);
        }
    };

    const handleMarkNotPaid = async paymentId => {
        const confirmed = window.confirm(
            "Mark this payment as Not Paid?"
        );

        if (!confirmed) {
            return;
        }

        setActionId(paymentId);
        setError("");

        try {
            await rejectPayment(paymentId);
            await loadOverview();
        }
        catch (requestError) {
            console.error("Mark not paid error:", requestError);
            setError(
                requestError.message ||
                "Unable to update payment status."
            );
        }
        finally {
            setActionId(null);
        }
    };

    const handleCellClick = (songId, currentTitle) => {
        if (!songId) {
            return;
        }

        setEditingCell({ songId, value: currentTitle || "" });
    };

    const handleCellSave = async () => {
        if (!editingCell) {
            return;
        }

        const { songId, value } = editingCell;
        const trimmed = value.trim();

        if (!trimmed) {
            setEditingCell(null);
            return;
        }

        setSavingCell(true);
        setError("");

        try {
            await updateSong(songId, { title: trimmed });
            setEditingCell(null);
            await loadOverview();
        }
        catch (requestError) {
            console.error("Update song title error:", requestError);
            setError(
                requestError.message ||
                "Unable to update song title."
            );
        }
        finally {
            setSavingCell(false);
        }
    };

    const { maleSingers, femaleSingers, otherSingers } = useMemo(() => {
        const male = [];
        const female = [];
        const other = [];

        singers.forEach(singer => {
            const gender = normalizeGender(singer.gender);

            if (gender === "male") {
                male.push(singer);
            }
            else if (gender === "female") {
                female.push(singer);
            }
            else {
                other.push(singer);
            }
        });

        return { maleSingers: male, femaleSingers: female, otherSingers: other };
    }, [singers]);

    const renderTable = (title, rows) => {
        if (rows.length === 0) {
            return null;
        }

        return (
            <div className="singer-group" key={title}>
                <h2>{title}</h2>

                <div className="singer-table-wrapper">
                    <table className="singer-table">
                        <thead>
                            <tr>
                                <th>Event</th>
                                <th>Singer Name</th>
                                {Array.from({ length: MAX_SONGS }).map((_, index) => (
                                    <th key={index}>Song {index + 1}</th>
                                ))}
                                <th>Payment Status</th>
                            </tr>
                        </thead>

                        <tbody>
                            {rows.map(row => {
                                const isActioning = actionId === row.payment_id;

                                return (
                                    <tr key={`${row.singer_id}:${row.event_id}`}>
                                        <td className="singer-event-cell">
                                            {row.event_name}
                                        </td>

                                        <td className="singer-name-cell">
                                            {row.singer_name}
                                        </td>

                                        {Array.from({ length: MAX_SONGS }).map((_, index) => {
                                            const song = row.songs[index];
                                            const isEditingThis =
                                                editingCell &&
                                                song &&
                                                editingCell.songId === song.song_id;

                                            if (isEditingThis) {
                                                return (
                                                    <td key={index}>
                                                        <input
                                                            type="text"
                                                            autoFocus
                                                            className="song-cell-input"
                                                            value={editingCell.value}
                                                            disabled={savingCell}
                                                            onChange={event =>
                                                                setEditingCell({
                                                                    ...editingCell,
                                                                    value: event.target.value
                                                                })
                                                            }
                                                            onBlur={handleCellSave}
                                                            onKeyDown={event => {
                                                                if (event.key === "Enter") {
                                                                    event.target.blur();
                                                                }
                                                                if (event.key === "Escape") {
                                                                    setEditingCell(null);
                                                                }
                                                            }}
                                                        />
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td
                                                    key={index}
                                                    className={song ? "song-cell-editable" : ""}
                                                    title={song ? "Click to edit" : ""}
                                                    onClick={() =>
                                                        song && handleCellClick(song.song_id, song.title)
                                                    }
                                                >
                                                    {song?.title || "—"}
                                                </td>
                                            );
                                        })}

                                        <td>
                                            <span
                                                className={`payment-status-pill ${getStatusClass(row.payment_status)}`}
                                            >
                                                {STATUS_DISPLAY[row.payment_status] || row.payment_status}
                                            </span>

                                            {row.payment_status === "Pending" && (
                                                <div className="payment-action-row">
                                                    <button
                                                        type="button"
                                                        className="payment-action-btn mark-paid"
                                                        disabled={isActioning}
                                                        onClick={() => handleMarkPaid(row.payment_id)}
                                                    >
                                                        {isActioning ? "..." : "Mark Paid"}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="payment-action-btn mark-not-paid"
                                                        disabled={isActioning}
                                                        onClick={() => handleMarkNotPaid(row.payment_id)}
                                                    >
                                                        {isActioning ? "..." : "Mark Not Paid"}
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="admin-shell">
            <AdminTopbar />

            <div className="admin-shell-content">
                <h1 className="admin-page-title">Admin Dashboard</h1>
                <p className="admin-page-subtitle">
                    Singer registrations, song selections and payment status at a glance.
                </p>

                <div className="admin-dashboard-event-row">
                    <EventSelector
                        events={events}
                        selectedIds={selectedEventIds}
                        onChange={setSelectedEventIds}
                    />
                </div>

                {error && <div className="admin-dashboard-error">⚠️ {error}</div>}

                {loading ? (
                    <div className="admin-dashboard-empty">Loading singer overview...</div>
                ) : singers.length === 0 ? (
                    <div className="admin-dashboard-empty">
                        No singers have submitted payment yet.
                    </div>
                ) : (
                    <>
                        {renderTable("Male Singer", maleSingers)}
                        {renderTable("Female Singer", femaleSingers)}
                        {renderTable("Other", otherSingers)}
                    </>
                )}
            </div>
        </div>
    );
}

export default AdminDashboard;
