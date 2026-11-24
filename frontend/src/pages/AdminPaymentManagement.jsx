import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import AdminTopbar from "../components/admin/AdminTopbar";
import EventSelector from "../components/admin/EventSelector";
import ExcelToolbar from "../components/admin/ExcelToolbar";
import PastDuesAlert from "../components/admin/PastDuesAlert";
import {
    getPayments,
    markPaymentAsPaid,
    rejectPayment,
    bulkUpdatePaymentStatus
} from "../services/paymentService";
import { getEvents } from "../services/eventService";

import "../styles/adminTheme.css";
import "./AdminPaymentManagement.css";

const PAYMENT_COLUMNS = [
    { key: "id", header: "ID", width: 38 },
    { key: "singer_name", header: "Singer Name", width: 26 },
    { key: "mobile_number", header: "Mobile Number", width: 18 },
    { key: "event_name", header: "Event", width: 22 },
    { key: "amount", header: "Amount", width: 12 },
    { key: "song_count", header: "Duet Songs", width: 14 },
    { key: "solo_song", header: "Solo Song", width: 30 },
    { key: "status", header: "Status (Pending/Paid/Rejected)", width: 26 }
];

const FILTERS = [
    "All",
    "Pending",
    "Paid",
    "Rejected"
];

const formatDate = (value) => {
    if (!value) {
        return "—";
    }

    try {
        return new Date(value).toLocaleString(
            "en-IN",
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );
    }
    catch {
        return value;
    }
};

const getStatusClass = (status) => {
    if (status === "All") {
        return "all";
    }

    if (status === "Paid") {
        return "paid";
    }

    if (status === "Rejected") {
        return "rejected";
    }

    return "pending";
};

const AdminPaymentManagement = () => {
    // Pending first - that's the list an admin opens this page to clear.
    const [filter, setFilter] =
        useState("Pending");

    const [search, setSearch] =
        useState("");

    const [expandedId, setExpandedId] =
        useState(null);

    const [payments, setPayments] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [actionId, setActionId] =
        useState(null);

    const [error, setError] =
        useState("");

    const [events, setEvents] =
        useState([]);

    const [selectedEventIds, setSelectedEventIds] =
        useState([]);

    const [eventsReady, setEventsReady] =
        useState(false);

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

    const loadPayments = useCallback(
        async () => {
            if (!eventsReady) {
                return;
            }

            try {
                setLoading(true);
                setError("");

                const result =
                    // Always load every status and filter in the browser,
                    // so the tab counts stay correct and switching tabs
                    // doesn't refetch.
                    await getPayments(
                        "All",
                        selectedEventIds.join(",")
                    );

                setPayments(
                    result.payments || []
                );
            }
            catch (requestError) {
                console.error(
                    "Admin payment load error:",
                    requestError
                );

                setError(
                    requestError.message ||
                    "Unable to load payment requests."
                );
            }
            finally {
                setLoading(false);
            }
        },
        [selectedEventIds, eventsReady]
    );

    useEffect(() => {
        loadPayments();
    }, [loadPayments]);

    const counts = useMemo(
        () => {
            return {
                all: payments.length,
                pending: payments.filter(
                    payment =>
                        payment.status ===
                        "Pending"
                ).length,
                paid: payments.filter(
                    payment =>
                        payment.status ===
                        "Paid"
                ).length,
                rejected: payments.filter(
                    payment =>
                        payment.status ===
                        "Rejected"
                ).length
            };
        },
        [payments]
    );

    const pendingTotal = useMemo(
        () => payments
            .filter(payment => payment.status === "Pending")
            .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
        [payments]
    );

    const visiblePayments = useMemo(
        () => {
            const term = search.trim().toLowerCase();

            return payments.filter(payment => {
                if (filter !== "All" && payment.status !== filter) {
                    return false;
                }

                if (!term) {
                    return true;
                }

                const singer = payment.singer || {};

                return (
                    (singer.singer_name || "").toLowerCase().includes(term) ||
                    (singer.mobile_number || "").includes(term)
                );
            });
        },
        [payments, filter, search]
    );

    const handleMarkPaid = async (
        paymentId
    ) => {
        const confirmed = window.confirm(
            "Confirm that this payment has been received? The singer's duet songs will then be submitted for pairing."
        );

        if (!confirmed) {
            return;
        }

        setActionId(paymentId);
        setError("");

        try {
            await markPaymentAsPaid(
                paymentId
            );

            await loadPayments();
        }
        catch (requestError) {
            console.error(
                "Mark paid error:",
                requestError
            );

            setError(
                requestError.message ||
                "Unable to confirm payment."
            );
        }
        finally {
            setActionId(null);
        }
    };

    const handleReject = async (
        paymentId
    ) => {
        const confirmed = window.confirm(
            "Reject this payment request?"
        );

        if (!confirmed) {
            return;
        }

        setActionId(paymentId);
        setError("");

        try {
            await rejectPayment(
                paymentId
            );

            await loadPayments();
        }
        catch (requestError) {
            console.error(
                "Reject payment error:",
                requestError
            );

            setError(
                requestError.message ||
                "Unable to reject payment."
            );
        }
        finally {
            setActionId(null);
        }
    };

    const excelRows = useMemo(
        () => visiblePayments.map(payment => ({
            id: payment.id,
            singer_name: payment.singer?.singer_name || "",
            mobile_number: payment.singer?.mobile_number || "",
            event_name: payment.event_name || "—",
            amount: payment.amount || 0,
            song_count: payment.song_count || 0,
            solo_song: payment.solo_song
                ? `${payment.solo_song.title}${payment.solo_song.movie ? ` (${payment.solo_song.movie})` : ""}`
                : "",
            status: payment.status
        })),
        [visiblePayments]
    );

    const handleImportRows = async parsedRows => {

        const rows = parsedRows.map(row => ({
            id: row.id,
            status: row.status
        }));

        const response = await bulkUpdatePaymentStatus(rows);

        await loadPayments();

        return { message: response.message };

    };

    return (
        <div className="admin-shell">
            <AdminTopbar />

            <main className="admin-shell-content admin-payment-page">
            <header className="admin-payment-header">
                <div>
                    <h1 className="admin-page-title">Payment Management</h1>
                    <p className="admin-page-subtitle">
                        Review and confirm singer payments
                    </p>
                </div>

                <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={loadPayments}
                    disabled={loading}
                >
                    ↻ Refresh
                </button>
            </header>

            <PastDuesAlert
                refreshKey={payments}
                onViewEvent={eventId => {
                    setFilter("Pending");
                    setSelectedEventIds([eventId]);
                }}
            />

            <div className="admin-dashboard-event-row">
                <EventSelector
                    events={events}
                    selectedIds={selectedEventIds}
                    onChange={setSelectedEventIds}
                />
            </div>

            <ExcelToolbar
                columns={PAYMENT_COLUMNS}
                rows={excelRows}
                filename="beats-infinity-payments"
                onImportRows={handleImportRows}
                hint="Only rows changed to Paid or Rejected are applied, and only for payments still Pending - marking Paid still submits the singer's duet songs for pairing. Other columns are for reference only."
            />

            <section className="payment-controls">
                <div className="payment-filter-row">
                    {FILTERS.map(item => (
                        <button
                            type="button"
                            key={item}
                            className={
                                filter === item
                                    ? `payment-filter active ${getStatusClass(item)}`
                                    : `payment-filter ${getStatusClass(item)}`
                            }
                            onClick={() =>
                                setFilter(item)
                            }
                        >
                            {item}
                            <span className="payment-filter-count">
                                {counts[item.toLowerCase()]}
                            </span>
                        </button>
                    ))}
                </div>

                <input
                    type="search"
                    className="payment-search"
                    placeholder="Search name or mobile"
                    value={search}
                    onChange={event =>
                        setSearch(event.target.value)
                    }
                />
            </section>

            {counts.pending > 0 && (
                <p className="payment-pending-summary">
                    <strong>{counts.pending}</strong> awaiting confirmation ·{" "}
                    <strong>₹{pendingTotal.toLocaleString("en-IN")}</strong> to verify
                </p>
            )}

            {error && (
                <div className="admin-payment-error">
                    ⚠️ {error}
                </div>
            )}

            {loading ? (
                <div className="admin-payment-empty">
                    Loading payment requests...
                </div>
            ) : visiblePayments.length === 0 ? (
                <div className="admin-payment-empty">
                    {payments.length === 0
                        ? "No payment requests yet. They appear here after singers notify the admin."
                        : search.trim()
                            ? "No payments match your search."
                            : `No ${filter.toLowerCase()} payments.`}
                </div>
            ) : (
                <div className="admin-table-shell payment-table-shell">
                    <table className="payment-table">
                        <thead>
                            <tr>
                                <th>Singer</th>
                                <th>Event</th>
                                <th>Songs</th>
                                <th className="num">Amount</th>
                                <th>Requested</th>
                                <th>Status</th>
                                <th className="actions">Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {visiblePayments.map(payment => {
                                const singer =
                                    payment.singer || {};

                                const isPending =
                                    payment.status ===
                                    "Pending";

                                const isActioning =
                                    actionId === payment.id;

                                const isExpanded =
                                    expandedId === payment.id;

                                const hasSongs =
                                    payment.songs?.length > 0 ||
                                    Boolean(payment.solo_song);

                                const songLabel =
                                    `${payment.song_count || 0} duet${payment.solo_song ? " + solo" : ""}`;

                                return [
                                    <tr
                                        key={payment.id}
                                        className={isExpanded ? "expanded" : undefined}
                                    >
                                        <td data-label="Singer" className="payment-singer-cell">
                                            <div className="payment-singer-name">
                                                {singer.singer_name ||
                                                    "Unknown Singer"}
                                            </div>
                                            <div className="payment-muted">
                                                {singer.mobile_number || "—"}
                                            </div>
                                        </td>

                                        <td data-label="Event" className="payment-muted">
                                            {payment.event_name || "—"}
                                        </td>

                                        <td data-label="Songs">
                                            {hasSongs ? (
                                                <button
                                                    type="button"
                                                    className="payment-songs-toggle"
                                                    onClick={() =>
                                                        setExpandedId(
                                                            isExpanded
                                                                ? null
                                                                : payment.id
                                                        )
                                                    }
                                                    aria-expanded={isExpanded}
                                                >
                                                    {songLabel}
                                                    <span aria-hidden="true">
                                                        {isExpanded ? " ▴" : " ▾"}
                                                    </span>
                                                </button>
                                            ) : (
                                                <span className="payment-muted">
                                                    {songLabel}
                                                </span>
                                            )}
                                        </td>

                                        <td data-label="Amount" className="num payment-amount">
                                            ₹{Number(payment.amount || 0).toLocaleString("en-IN")}
                                        </td>

                                        <td data-label="Requested" className="payment-muted">
                                            {formatDate(payment.created_at)}
                                        </td>

                                        <td data-label="Status">
                                            <span
                                                className={`payment-status-badge ${getStatusClass(payment.status)}`}
                                            >
                                                {payment.status}
                                            </span>
                                        </td>

                                        <td data-label="Action" className="actions">
                                            {isPending ? (
                                                <div className="payment-actions">
                                                    <button
                                                        type="button"
                                                        className="admin-btn admin-btn-primary admin-btn-sm"
                                                        onClick={() =>
                                                            handleMarkPaid(
                                                                payment.id
                                                            )
                                                        }
                                                        disabled={isActioning}
                                                    >
                                                        {isActioning
                                                            ? "Saving…"
                                                            : "✓ Paid"}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="admin-btn admin-btn-danger admin-btn-sm"
                                                        onClick={() =>
                                                            handleReject(
                                                                payment.id
                                                            )
                                                        }
                                                        disabled={isActioning}
                                                        aria-label="Reject payment"
                                                        title="Reject payment"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="payment-muted">
                                                    {payment.status === "Paid"
                                                        ? `Paid ${formatDate(payment.paid_at)}`
                                                        : "—"}
                                                </span>
                                            )}
                                        </td>
                                    </tr>,

                                    isExpanded && (
                                        <tr
                                            key={`${payment.id}-songs`}
                                            className="payment-songs-row"
                                        >
                                            <td colSpan={7}>
                                                {payment.songs?.length > 0 && (
                                                    <ol>
                                                        {payment.songs.map(song => (
                                                            <li key={song.id}>
                                                                {song.title}
                                                                {song.movie && (
                                                                    <span className="payment-muted"> — {song.movie}</span>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ol>
                                                )}
                                                {payment.solo_song && (
                                                    <p>
                                                        <strong>Solo:</strong>{" "}
                                                        {payment.solo_song.title}
                                                        {payment.solo_song.movie && (
                                                            <span className="payment-muted"> — {payment.solo_song.movie}</span>
                                                        )}
                                                    </p>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                ];
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            </main>
        </div>
    );
};

export default AdminPaymentManagement;
