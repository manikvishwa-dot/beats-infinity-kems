import { useEffect, useState } from "react";

import { getPastEventDues } from "../../services/paymentService";

import "./PastDuesAlert.css";

// ==========================================================
// BEATS INFINITY - PAST-EVENT DUES ALERT (admin)
// ==========================================================
//
// Payments still "Pending" from an event other than the active
// one. They stay with their own event; this just makes sure an
// admin sees them once a new event has taken over the default
// view. Renders nothing when there are none.
//
// onViewEvent(eventId) - optional; switches the page's event
// selector to that payment's event.
// ==========================================================

const formatDate = value =>
    value
        ? new Date(value).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        })
        : "—";

const daysSince = value =>
    value
        ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000))
        : null;

function PastDuesAlert({ onViewEvent, refreshKey }) {

    const [dues, setDues] = useState([]);
    const [total, setTotal] = useState(0);
    const [open, setOpen] = useState(false);

    useEffect(() => {

        let cancelled = false;

        getPastEventDues()
            .then(result => {

                if (cancelled) {
                    return;
                }

                setDues(Array.isArray(result.dues) ? result.dues : []);
                setTotal(Number(result.total_amount) || 0);

            })
            .catch(error => {

                console.error("Unable to load past-event dues:", error);

            });

        return () => {
            cancelled = true;
        };

    }, [refreshKey]);

    if (dues.length === 0) {
        return null;
    }

    return (

        <section className="past-dues-alert" role="alert">

            <button
                type="button"
                className="past-dues-summary"
                onClick={() => setOpen(value => !value)}
                aria-expanded={open}
            >
                <span>
                    ⚠️ <strong>{dues.length} pending {dues.length === 1 ? "payment" : "payments"} from past events</strong>
                    {" "}- ₹{total.toLocaleString("en-IN")} not yet confirmed
                </span>

                <span className="past-dues-toggle">
                    {open ? "Hide ▲" : "Show ▼"}
                </span>
            </button>

            {open && (

                <div className="past-dues-table-wrap">

                    <table className="past-dues-table">

                        <thead>
                            <tr>
                                <th>Singer</th>
                                <th>Mobile</th>
                                <th>Event</th>
                                <th>Amount</th>
                                <th>Pending since</th>
                                {onViewEvent && <th />}
                            </tr>
                        </thead>

                        <tbody>
                            {dues.map(due => (
                                <tr key={due.id}>
                                    <td>{due.singer_name}</td>
                                    <td>{due.mobile_number || "—"}</td>
                                    <td>{due.event_name}</td>
                                    <td>₹{due.amount}</td>
                                    <td>
                                        {formatDate(due.created_at)}
                                        {daysSince(due.created_at) !== null && (
                                            <span className="past-dues-days">
                                                {" "}({daysSince(due.created_at)} days)
                                            </span>
                                        )}
                                    </td>
                                    {onViewEvent && (
                                        <td>
                                            {due.event_id && (
                                                <button
                                                    type="button"
                                                    className="admin-btn admin-btn-ghost admin-btn-sm"
                                                    onClick={() => onViewEvent(due.event_id)}
                                                >
                                                    View
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>

                    </table>

                </div>

            )}

        </section>

    );

}

export default PastDuesAlert;
