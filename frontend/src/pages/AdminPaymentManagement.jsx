import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import AdminTopbar from "../components/admin/AdminTopbar";
import EventSelector from "../components/admin/EventSelector";
import ExcelToolbar from "../components/admin/ExcelToolbar";
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
    { key: "song_count", header: "Songs Selected", width: 16 },
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
    const [filter, setFilter] =
        useState("All");

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
                    await getPayments(
                        filter,
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
        [filter, selectedEventIds, eventsReady]
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

    const handleMarkPaid = async (
        paymentId
    ) => {
        const confirmed = window.confirm(
            "Confirm that this payment has been received? The singer's 5 songs will then be submitted for pairing."
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
        () => payments.map(payment => ({
            id: payment.id,
            singer_name: payment.singer?.singer_name || "",
            mobile_number: payment.singer?.mobile_number || "",
            event_name: payment.event_name || "—",
            amount: payment.amount || 0,
            song_count: payment.song_count || 0,
            status: payment.status
        })),
        [payments]
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
                hint="Only rows changed to Paid or Rejected are applied, and only for payments still Pending - marking Paid still submits the singer's 5 songs for pairing. Other columns are for reference only."
            />

            <section className="payment-filter-row">
                {FILTERS.map(item => {
                    const count =
                        item === "All"
                            ? counts.all
                            : item === "Pending"
                                ? counts.pending
                                : item === "Paid"
                                    ? counts.paid
                                    : counts.rejected;

                    return (
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
                            {item} ({count})
                        </button>
                    );
                })}
            </section>

            {error && (
                <div className="admin-payment-error">
                    ⚠️ {error}
                </div>
            )}

            {loading ? (
                <div className="admin-payment-empty">
                    <div>⏳</div>
                    <h2>
                        Loading payment requests...
                    </h2>
                </div>
            ) : payments.length === 0 ? (
                <div className="admin-payment-empty">
                    <div>💳</div>
                    <h2>
                        No payment requests
                    </h2>
                    <p>
                        Payment requests will appear here after singers notify the admin.
                    </p>
                </div>
            ) : (
                <section className="payment-request-list">
                    {payments.map(payment => {
                        const singer =
                            payment.singer || {};

                        const isPending =
                            payment.status ===
                            "Pending";

                        const isActioning =
                            actionId === payment.id;

                        return (
                            <article
                                key={payment.id}
                                className="payment-request-card"
                            >
                                <div className="payment-card-topline">
                                    <span
                                        className={`payment-status-badge ${getStatusClass(payment.status)}`}
                                    >
                                        {payment.status.toUpperCase()}
                                    </span>

                                    <div className="requested-date">
                                        <span>
                                            Requested on
                                        </span>
                                        <strong>
                                            {formatDate(
                                                payment.created_at
                                            )}
                                        </strong>
                                    </div>

                                    <span className="payment-event-badge">
                                        📅 {payment.event_name || "—"}
                                    </span>
                                </div>

                                <div className="payment-singer-row">
                                    <div className="singer-avatar">
                                        👤
                                    </div>

                                    <div className="singer-payment-info">
                                        <h2>
                                            {singer.singer_name ||
                                                "Unknown Singer"}
                                        </h2>

                                        <p>
                                            Mobile: {singer.mobile_number || "—"}
                                        </p>

                                        <p>
                                            🎵 {payment.song_count || 0} Songs Selected
                                        </p>
                                    </div>

                                    <div className="payment-amount-display">
                                        <strong>
                                            ₹{Number(payment.amount || 0).toLocaleString("en-IN")}
                                        </strong>
                                        <span>
                                            Registration Fee
                                        </span>
                                    </div>
                                </div>

                                <div className="payment-card-divider" />

                                <div className="payment-card-status">
                                    <strong>
                                        🕘 Status: {payment.status.toUpperCase()}
                                    </strong>

                                    {payment.status === "Pending" && (
                                        <p>
                                            Payment marked as paid by singer. Awaiting admin confirmation.
                                        </p>
                                    )}

                                    {payment.status === "Paid" && (
                                        <p>
                                            Payment confirmed by admin. Paid on {formatDate(payment.paid_at)}.
                                        </p>
                                    )}

                                    {payment.status === "Rejected" && (
                                        <p>
                                            Payment request was rejected by admin.
                                        </p>
                                    )}
                                </div>

                                {payment.songs?.length > 0 && (
                                    <details className="payment-song-details">
                                        <summary>
                                            View 5 selected songs
                                        </summary>
                                        <ol>
                                            {payment.songs.map(song => (
                                                <li key={song.id}>
                                                    {song.title}
                                                    {song.movie
                                                        ? ` — ${song.movie}`
                                                        : ""}
                                                </li>
                                            ))}
                                        </ol>
                                    </details>
                                )}

                                {isPending && (
                                    <div className="payment-actions">
                                        <button
                                            type="button"
                                            className="admin-btn admin-btn-primary"
                                            onClick={() =>
                                                handleMarkPaid(
                                                    payment.id
                                                )
                                            }
                                            disabled={isActioning}
                                        >
                                            {isActioning
                                                ? "Processing..."
                                                : "✓ Mark as Paid"}
                                        </button>

                                        <button
                                            type="button"
                                            className="admin-btn admin-btn-danger"
                                            onClick={() =>
                                                handleReject(
                                                    payment.id
                                                )
                                            }
                                            disabled={isActioning}
                                        >
                                            ✕ Reject
                                        </button>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </section>
            )}
            </main>
        </div>
    );
};

export default AdminPaymentManagement;
