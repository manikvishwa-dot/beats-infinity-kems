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
    waivePayment,
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
    { key: "entry_type", header: "Entry", width: 14 },
    { key: "free_entry", header: "Free Entry", width: 18 },
    { key: "status", header: "Status (Pending/Paid/Rejected)", width: 26 }
];

const FILTERS = [
    "Pending",
    "Paid",
    "Free",
    "Rejected",
    "All"
];

const FILTER_LABELS = {
    Pending: "Awaiting approval",
    Paid: "Paid",
    Free: "Free entry",
    Rejected: "Rejected",
    All: "All requests"
};

// Free entry (Rs 0) - guests singing as a goodwill gesture and the
// management team. Stored as Paid at Rs 0 with fee_waiver set.
const WAIVERS = [
    { value: "Guest Singer", icon: "🎤" },
    { value: "Management Team", icon: "⭐" }
];

const isWalkIn = payment =>
    payment?.payment_type === "Walk-in";

// Which tile a payment belongs to: free entries get their own
const getCategory = payment =>
    payment.fee_waiver ? "Free" : payment.status;

const formatDate = (value) => {
    if (!value) {
        return "—";
    }

    try {
        return new Date(value).toLocaleString(
            "en-IN",
            {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit"
            }
        );
    }
    catch {
        return value;
    }
};

const formatRupees = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN")}`;

const getInitials = (name = "") => {
    const parts = name.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
        return "?";
    }

    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
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

    if (status === "Free") {
        return "free";
    }

    return "pending";
};

const AdminPaymentManagement = () => {
    const [filter, setFilter] =
        useState("Pending");

    const [search, setSearch] =
        useState("");

    const [payments, setPayments] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [actionId, setActionId] =
        useState(null);

    const [expandedId, setExpandedId] =
        useState(null);

    const [freeMenuId, setFreeMenuId] =
        useState(null);

    const [error, setError] =
        useState("");

    const [notice, setNotice] =
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

    // Always fetches every status for the selected events and filters
    // on the client, so the tile counts stay right whichever tab is
    // open. `silent` keeps the list on screen while it refreshes -
    // swapping it for a spinner after each approval threw the admin
    // back to the top of a long page.
    const loadPayments = useCallback(
        async ({ silent = false } = {}) => {
            if (!eventsReady) {
                return;
            }

            try {
                if (!silent) {
                    setLoading(true);
                }

                setError("");

                const result =
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

    useEffect(() => {
        if (!freeMenuId) {
            return undefined;
        }

        const close = event => {
            if (!event.target.closest?.(".payment-free-wrap")) {
                setFreeMenuId(null);
            }
        };

        document.addEventListener("mousedown", close);

        return () => document.removeEventListener("mousedown", close);
    }, [freeMenuId]);

    useEffect(() => {
        if (!notice) {
            return undefined;
        }

        const timer = setTimeout(() => setNotice(""), 3500);

        return () => clearTimeout(timer);
    }, [notice]);

    const stats = useMemo(
        () => {
            const base = {
                Pending: { count: 0, amount: 0 },
                Paid: { count: 0, amount: 0 },
                Free: { count: 0, amount: 0 },
                Rejected: { count: 0, amount: 0 },
                All: { count: 0, amount: 0 }
            };

            payments.forEach(payment => {
                const amount = Number(payment.amount || 0);
                const bucket = base[getCategory(payment)] || base.Pending;

                bucket.count += 1;
                bucket.amount += amount;
                base.All.count += 1;
                base.All.amount += amount;
            });

            return base;
        },
        [payments]
    );

    const visiblePayments = useMemo(
        () => {
            const query = search.trim().toLowerCase();

            const rows = payments.filter(payment => {
                if (filter !== "All" && getCategory(payment) !== filter) {
                    return false;
                }

                if (!query) {
                    return true;
                }

                const singer = payment.singer || {};

                return (
                    (singer.singer_name || "").toLowerCase().includes(query) ||
                    (singer.mobile_number || "").includes(query)
                );
            });

            // Oldest pending request first, so the queue is worked top-down.
            if (filter === "Pending") {
                rows.sort((a, b) =>
                    new Date(a.created_at) - new Date(b.created_at)
                );
            }

            return rows;
        },
        [payments, filter, search]
    );

    const updateLocalStatus = (paymentId, status, extra = {}) => {
        setPayments(current =>
            current.map(payment =>
                payment.id === paymentId
                    ? {
                        ...payment,
                        status,
                        paid_at: status === "Paid"
                            ? payment.paid_at || new Date().toISOString()
                            : payment.paid_at,
                        ...extra
                    }
                    : payment
            )
        );
    };

    const handleMarkPaid = async (
        payment
    ) => {
        const name =
            payment.singer?.singer_name || "this singer";

        const confirmed = window.confirm(
            isWalkIn(payment)
                ? `Confirm ${formatRupees(payment.amount)} cash received from ${name} (walk-in)?`
                : `Confirm ${formatRupees(payment.amount)} received from ${name}? Their duet songs will then be submitted for pairing.`
        );

        if (!confirmed) {
            return;
        }

        setActionId(payment.id);
        setError("");

        try {
            await markPaymentAsPaid(
                payment.id
            );

            updateLocalStatus(payment.id, "Paid");
            setNotice(`✓ ${name} marked as paid`);
            loadPayments({ silent: true });
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
        payment
    ) => {
        const name =
            payment.singer?.singer_name || "this singer";

        const confirmed = window.confirm(
            isWalkIn(payment)
                ? `Mark ${name}'s walk-in payment as NOT received?`
                : `Reject the payment request from ${name}?`
        );

        if (!confirmed) {
            return;
        }

        setActionId(payment.id);
        setError("");

        try {
            await rejectPayment(
                payment.id
            );

            updateLocalStatus(payment.id, "Rejected");
            setNotice(
                isWalkIn(payment)
                    ? `${name}: payment not received`
                    : `${name}'s request rejected`
            );
            loadPayments({ silent: true });
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

    const handleWaive = async (
        payment,
        waiver
    ) => {
        setFreeMenuId(null);

        const name =
            payment.singer?.singer_name || "this singer";

        const songsNote =
            payment.status === "Pending" && !isWalkIn(payment)
                ? " Their duet songs will be submitted for pairing."
                : "";

        const confirmed = window.confirm(
            `Mark ${name} as ${waiver}? They pay nothing (Rs 0) and won't count toward money collected.${songsNote}`
        );

        if (!confirmed) {
            return;
        }

        setActionId(payment.id);
        setError("");

        try {
            await waivePayment(
                payment.id,
                waiver
            );

            updateLocalStatus(payment.id, "Paid", {
                amount: 0,
                fee_waiver: waiver
            });
            setNotice(`${name} marked as ${waiver} (free)`);
            loadPayments({ silent: true });
        }
        catch (requestError) {
            console.error(
                "Free entry error:",
                requestError
            );

            setError(
                requestError.message ||
                "Unable to mark this entry as free."
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
            entry_type: isWalkIn(payment) ? "Walk-in" : "Registration",
            free_entry: payment.fee_waiver || "",
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

        await loadPayments({ silent: true });

        return { message: response.message };

    };

    const filterWord =
        filter === "All" ? "" : `${filter.toLowerCase()} `;

    const emptyMessage =
        search.trim()
            ? { icon: "🔍", title: "No matches", text: `No ${filterWord}requests match "${search.trim()}".` }
            : filter === "Pending"
                ? { icon: "🎉", title: "All caught up", text: "No payments are waiting for approval." }
                : { icon: "💳", title: `No ${filterWord}payment requests`, text: "Payment requests appear here after singers notify the admin." };

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
                    className="admin-btn admin-btn-ghost admin-btn-sm"
                    onClick={() => loadPayments()}
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

            <div className="payment-controls-row">
                <EventSelector
                    events={events}
                    selectedIds={selectedEventIds}
                    onChange={setSelectedEventIds}
                />

                <details className="payment-excel-panel">
                    <summary>📊 Excel import / export</summary>
                    <ExcelToolbar
                        columns={PAYMENT_COLUMNS}
                        rows={excelRows}
                        filename="beats-infinity-payments"
                        onImportRows={handleImportRows}
                        hint="Exports the rows currently shown. On import, only rows changed to Paid or Rejected are applied, and only for payments still Pending - marking Paid still submits the singer's duet songs for pairing. Other columns are for reference only."
                    />
                </details>
            </div>

            <section className="payment-stat-row">
                {FILTERS.map(item => (
                    <button
                        type="button"
                        key={item}
                        className={
                            filter === item
                                ? `payment-stat ${getStatusClass(item)} active`
                                : `payment-stat ${getStatusClass(item)}`
                        }
                        onClick={() => setFilter(item)}
                    >
                        <span className="payment-stat-label">
                            {FILTER_LABELS[item]}
                        </span>
                        <strong className="payment-stat-count">
                            {stats[item].count}
                        </strong>
                        <span className="payment-stat-amount">
                            {formatRupees(stats[item].amount)}
                        </span>
                    </button>
                ))}
            </section>

            <div className="payment-search-row">
                <div className="payment-search">
                    <span aria-hidden="true">🔍</span>
                    <input
                        type="search"
                        placeholder="Search by singer name or mobile"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                    />
                </div>

                <span className="payment-showing">
                    Showing {visiblePayments.length} of {stats[filter].count}
                </span>
            </div>

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
            ) : visiblePayments.length === 0 ? (
                <div className="admin-payment-empty">
                    <div>{emptyMessage.icon}</div>
                    <h2>{emptyMessage.title}</h2>
                    <p>{emptyMessage.text}</p>
                </div>
            ) : (
                <section className="payment-list">
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

                        const category =
                            getCategory(payment);

                        const statusClass =
                            getStatusClass(category);

                        const walkIn =
                            isWalkIn(payment);

                        const statusLabel =
                            payment.fee_waiver ||
                            payment.status;

                        const canWaive =
                            payment.status !== "Rejected" &&
                            !payment.fee_waiver;

                        const songCount =
                            payment.songs?.length || payment.song_count || 0;

                        const hasSongs =
                            payment.songs?.length > 0 || Boolean(payment.solo_song);

                        return (
                            <article
                                key={payment.id}
                                className={`payment-row ${statusClass}${isExpanded ? " expanded" : ""}`}
                            >
                                <div className="payment-row-main">
                                    <div className={`payment-avatar ${statusClass}`}>
                                        {getInitials(singer.singer_name)}
                                    </div>

                                    <div className="payment-row-who">
                                        <strong>
                                            {singer.singer_name ||
                                                "Unknown Singer"}
                                            {walkIn && (
                                                <em className="payment-walkin-tag">
                                                    Walk-in
                                                </em>
                                            )}
                                        </strong>
                                        <span>
                                            {singer.mobile_number || "—"}
                                            {selectedEventIds.length !== 1 && payment.event_name
                                                ? ` · ${payment.event_name}`
                                                : ""}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        className="payment-songs-chip"
                                        onClick={() =>
                                            setExpandedId(isExpanded ? null : payment.id)
                                        }
                                        aria-expanded={isExpanded}
                                        disabled={!hasSongs}
                                    >
                                        🎵 {songCount} duet{songCount === 1 ? "" : "s"}
                                        {payment.solo_song ? " + solo" : ""}
                                        {hasSongs && (
                                            <span className="payment-chevron">▾</span>
                                        )}
                                    </button>

                                    <div className="payment-row-date">
                                        <span>
                                            {payment.status === "Paid" ? "Paid" : "Requested"}
                                        </span>
                                        {formatDate(
                                            payment.status === "Paid"
                                                ? payment.paid_at
                                                : payment.created_at
                                        )}
                                    </div>

                                    <div className={`payment-row-amount${payment.fee_waiver ? " free" : ""}`}>
                                        {payment.fee_waiver
                                            ? "Free"
                                            : formatRupees(payment.amount)}
                                    </div>

                                    <div className="payment-row-actions">
                                        {isPending ? (
                                            <>
                                                <button
                                                    type="button"
                                                    className="payment-approve-btn"
                                                    onClick={() =>
                                                        handleMarkPaid(payment)
                                                    }
                                                    disabled={isActioning}
                                                    title={walkIn ? "Cash received" : "Payment received"}
                                                >
                                                    {isActioning
                                                        ? "Saving…"
                                                        : "✓ Approve"}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="payment-reject-btn"
                                                    onClick={() =>
                                                        handleReject(payment)
                                                    }
                                                    disabled={isActioning}
                                                    title={walkIn ? "Payment not received" : "Reject"}
                                                >
                                                    ✕ Reject
                                                </button>
                                            </>
                                        ) : (
                                            <span className={`payment-status-pill ${statusClass}`}>
                                                {statusLabel}
                                            </span>
                                        )}

                                        {canWaive && (
                                            <div className="payment-free-wrap">
                                                <button
                                                    type="button"
                                                    className={`payment-free-btn${freeMenuId === payment.id ? " open" : ""}`}
                                                    onClick={() =>
                                                        setFreeMenuId(
                                                            freeMenuId === payment.id
                                                                ? null
                                                                : payment.id
                                                        )
                                                    }
                                                    disabled={isActioning}
                                                    title="Free entry (Rs 0) - guest or management team"
                                                    aria-haspopup="menu"
                                                    aria-expanded={freeMenuId === payment.id}
                                                >
                                                    ₹0 Payment
                                                </button>

                                                {freeMenuId === payment.id && (
                                                    <div className="payment-free-menu" role="menu">
                                                        <span>Free entry · ₹0</span>
                                                        {WAIVERS.map(option => (
                                                            <button
                                                                type="button"
                                                                role="menuitem"
                                                                key={option.value}
                                                                onClick={() =>
                                                                    handleWaive(payment, option.value)
                                                                }
                                                            >
                                                                {option.icon} {option.value}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="payment-row-songs">
                                        {payment.songs?.length > 0 && (
                                            <ol>
                                                {payment.songs.map(song => (
                                                    <li key={song.id}>
                                                        <span>{song.title}</span>
                                                        {song.movie && (
                                                            <em>{song.movie}</em>
                                                        )}
                                                    </li>
                                                ))}
                                            </ol>
                                        )}

                                        {payment.solo_song && (
                                            <p className="payment-solo">
                                                <strong>Solo</strong>
                                                <span>{payment.solo_song.title}</span>
                                                {payment.solo_song.movie && (
                                                    <em>{payment.solo_song.movie}</em>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </section>
            )}

            {notice && (
                <div className="payment-toast" role="status">
                    {notice}
                </div>
            )}
            </main>
        </div>
    );
};

export default AdminPaymentManagement;
