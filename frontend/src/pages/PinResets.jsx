// ==========================================================
// BEATS INFINITY - FORGOT PIN REQUESTS (ADMIN)
// ==========================================================
//
// Singers who tap "Forgot PIN" never see their OTP on screen
// (anyone could type someone else's number). The request shows
// up here, and an admin sends the OTP on WhatsApp to the
// singer's REGISTERED number - only the real owner gets it.
// ==========================================================

import { useCallback, useEffect, useState } from "react";

import AdminTopbar from "../components/admin/AdminTopbar";
import { getPinResets, markPinResetSent } from "../services/adminDashboardService";

import "../styles/adminTheme.css";
import "./PinResets.css";


const STATUS_LABELS = {
    waiting: { text: "Waiting - send OTP", tone: "waiting" },
    sent: { text: "Sent on WhatsApp", tone: "sent" },
    entered: { text: "OTP entered", tone: "sent" },
    done: { text: "PIN reset ✓", tone: "done" },
    expired: { text: "Expired", tone: "muted" },
    locked: { text: "Locked - 5 wrong tries", tone: "muted" }
};

const formatTime = value =>
    value
        ? new Date(value).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit"
        })
        : "";

const whatsappLink = request => {

    const name = request.singer_name ? ` ${request.singer_name}` : "";

    const message =
        `Hi${name}, your Beats Infinity OTP to reset your PIN is ${request.otp}. ` +
        "It's valid for 2 hours. Please don't share it with anyone. " +
        "If you didn't ask to reset your PIN, ignore this message.";

    return `https://wa.me/91${request.mobile_number}?text=${encodeURIComponent(message)}`;

};


function PinResets() {

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {

        try {
            const result = await getPinResets();
            setRequests(result.requests || []);
            setError("");
        }
        catch (err) {
            setError(err.message || "Unable to load requests.");
        }
        finally {
            setLoading(false);
        }

    }, []);

    // Refresh every 30 seconds so new requests appear on their own
    useEffect(() => {

        const first = setTimeout(load, 0);
        const timer = setInterval(load, 30000);

        return () => {
            clearTimeout(first);
            clearInterval(timer);
        };

    }, [load]);


    const handleSend = async request => {

        // Open WhatsApp first - the click must open it directly
        // or phones block it as a popup.
        window.open(whatsappLink(request), "_blank", "noopener");

        try {
            await markPinResetSent(request.id);
            load();
        }
        catch (err) {
            setError(err.message || "Unable to mark as sent.");
        }

    };


    const waitingCount =
        requests.filter(r => r.status === "waiting").length;


    return (

        <div className="admin-shell">

            <AdminTopbar />

            <div className="admin-shell-content">

                <h1 className="admin-page-title">🔑 PIN Reset Requests</h1>

                <p className="admin-page-subtitle">
                    Singers who tapped "Forgot PIN" in the last 24 hours. Tap
                    <strong> Send on WhatsApp</strong> - it opens a chat with the
                    singer's <strong>registered number</strong> with the OTP already
                    typed. Never read an OTP out to someone who calls or messages
                    from a different number.
                </p>

                {waitingCount > 0 && (
                    <div className="pin-resets-alert">
                        {waitingCount} {waitingCount === 1 ? "singer is" : "singers are"} waiting for an OTP
                    </div>
                )}

                {error && <div className="pin-resets-error">{error}</div>}

                {loading ? (

                    <div className="admin-card pin-resets-empty">Loading…</div>

                ) : requests.length === 0 ? (

                    <div className="admin-card pin-resets-empty">
                        No PIN reset requests in the last 24 hours.
                    </div>

                ) : (

                    <div className="pin-resets-list">

                        {requests.map(request => {

                            const status =
                                STATUS_LABELS[request.status] || STATUS_LABELS.waiting;

                            return (

                                <div key={request.id} className="admin-card pin-resets-card">

                                    <div className="pin-resets-main">

                                        <div className="pin-resets-name">
                                            {request.singer_name || "Unknown singer"}
                                        </div>

                                        <div className="pin-resets-meta">
                                            +91 {request.mobile_number} · asked {formatTime(request.created_at)}
                                        </div>

                                        <span className={`pin-resets-status ${status.tone}`}>
                                            {status.text}
                                        </span>

                                    </div>

                                    {request.otp && (

                                        <div className="pin-resets-actions">

                                            <div className="pin-resets-otp">{request.otp}</div>

                                            <button
                                                type="button"
                                                className={
                                                    request.status === "waiting"
                                                        ? "admin-btn admin-btn-primary admin-btn-sm"
                                                        : "admin-btn admin-btn-outline admin-btn-sm"
                                                }
                                                onClick={() => handleSend(request)}
                                            >
                                                {request.status === "waiting"
                                                    ? "Send on WhatsApp"
                                                    : "Send again"}
                                            </button>

                                        </div>

                                    )}

                                </div>

                            );

                        })}

                    </div>

                )}

            </div>

        </div>

    );

}

export default PinResets;
