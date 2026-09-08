import React, {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button
} from "@mui/material";

import {
    useNavigate
} from "react-router-dom";

import {
    createPayment,
    getMyPayment
} from "../services/paymentService";
import { logout } from "../services/singerService";

import "./SingerPayment.css";

const PAYMENT_AMOUNT = 700;
const POLL_INTERVAL = 5000;
const PENDING_SELECTION_KEY =
    "beatsInfinityPendingSongSelection";

const getSingerId = () => {
    const directKeys = [
        "singer_id",
        "singerId",
        "singerID",
        "loggedInSingerId",
        "currentSingerId",
        "beatsInfinitySingerId"
    ];

    for (const key of directKeys) {
        const value = localStorage.getItem(key);

        if (value) {
            return String(value);
        }
    }

    const objectKeys = [
        "singer",
        "currentSinger",
        "loggedInSinger",
        "user",
        "currentUser",
        "beatsInfinitySinger"
    ];

    for (const key of objectKeys) {
        try {
            const raw = localStorage.getItem(key);

            if (!raw) {
                continue;
            }

            const parsed = JSON.parse(raw);

            const id =
                parsed?.id ||
                parsed?.singer_id ||
                parsed?.singerId;

            if (id) {
                return String(id);
            }
        }
        catch {
            // Ignore malformed localStorage values.
        }
    }

    return null;
};

const readPendingSelection = () => {
    try {
        const raw = sessionStorage.getItem(
            PENDING_SELECTION_KEY
        );

        if (!raw) {
            return null;
        }

        return JSON.parse(raw);
    }
    catch {
        return null;
    }
};

const SingerPayment = () => {
    const navigate = useNavigate();

    const [selection, setSelection] = useState(null);
    const [payment, setPayment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [confirmationDialogOpen, setConfirmationDialogOpen] =
        useState(false);

    const singerId = useMemo(
        () => getSingerId(),
        []
    );

    const loadPaymentStatus = useCallback(
        async (showLoading = false) => {
            if (!singerId) {
                setError(
                    "Unable to identify the logged-in singer. Please log in again."
                );
                setLoading(false);
                return;
            }

            try {
                if (showLoading) {
                    setLoading(true);
                }

                const result = await getMyPayment(
                    singerId
                );

                if (result.success) {
                    setPayment(
                        result.payment || null
                    );
                }
            }
            catch (requestError) {
                console.error(
                    "Payment status error:",
                    requestError
                );

                if (showLoading) {
                    setError(
                        requestError.message ||
                        "Unable to load payment status."
                    );
                }
            }
            finally {
                if (showLoading) {
                    setLoading(false);
                }
            }
        },
        [singerId]
    );

    useEffect(() => {
        const pendingSelection =
            readPendingSelection();

        if (!pendingSelection) {
            setError(
                "Your selected songs could not be found. Please return to My Songs and select 5 songs again."
            );
            setLoading(false);
            return;
        }

        if (
            !Array.isArray(pendingSelection.songs) ||
            pendingSelection.songs.length !== 5
        ) {
            setError(
                "Exactly 5 selected songs are required."
            );
            setLoading(false);
            return;
        }

        setSelection(pendingSelection);
        loadPaymentStatus(true);
    }, [loadPaymentStatus]);

    useEffect(() => {
        if (!singerId) {
            return undefined;
        }

        if (payment?.status === "Paid") {
            return undefined;
        }

        const timer = setInterval(
            () => {
                loadPaymentStatus(false);
            },
            POLL_INTERVAL
        );

        return () => {
            clearInterval(timer);
        };
    }, [
        singerId,
        payment?.status,
        loadPaymentStatus
    ]);

    useEffect(() => {
        if (payment?.status !== "Paid") {
            return undefined;
        }

        sessionStorage.removeItem(
            PENDING_SELECTION_KEY
        );

        const timer = setTimeout(
            () => {
                navigate(
                    "/singer-dashboard",
                    {
                        replace: true
                    }
                );
            },
            2500
        );

        return () => {
            clearTimeout(timer);
        };
    }, [payment?.status, navigate]);

    const handlePaidClick = async () => {
        if (!singerId) {
            setError(
                "Unable to identify the logged-in singer. Please log in again."
            );
            return;
        }

        if (!selection) {
            setError(
                "Selected songs are unavailable."
            );
            return;
        }

        if (
            !Array.isArray(selection.songs) ||
            selection.songs.length !== 5
        ) {
            setError(
                "Exactly 5 songs are required."
            );
            return;
        }

        if (payment?.status === "Pending") {
            setConfirmationDialogOpen(true);
            return;
        }

        setSubmitting(true);
        setError("");
        setSuccess("");

        try {
            const songIds = selection.songs.map(
                song => String(
                    song.databaseSongId ||
                    song.songId
                )
            );

            const result = await createPayment(
                singerId,
                songIds
            );

            setPayment(
                result.payment || null
            );

            setConfirmationDialogOpen(true);
        }
        catch (requestError) {
            console.error(
                "Payment notification error:",
                requestError
            );

            setError(
                requestError.message ||
                "Unable to record your payment notification. Please try again."
            );
        }
        finally {
            setSubmitting(false);
        }
    };

    const handleConfirmationDialogClose = () => {
        setConfirmationDialogOpen(false);
        setSuccess(
            "Your payment notification has been received."
        );
    };

    const handleBack = () => {
        navigate(
            "/singer-dashboard"
        );
    };

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    if (loading) {
        return (
            <main className="singer-payment-page">
                <div className="payment-loading-card">
                    <div className="payment-spinner">
                        ⏳
                    </div>
                    <h2>
                        Loading Payment...
                    </h2>
                    <p>
                        Please wait while we check your payment status.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="singer-payment-page">
            <div className="payment-background-note note-one">
                ♪
            </div>
            <div className="payment-background-note note-two">
                ♫
            </div>

            <section className="payment-card">
                <div className="payment-header">
                    <button
                        type="button"
                        className="payment-back-button"
                        onClick={handleBack}
                    >
                        ←
                    </button>

                    <div className="payment-header-title">
                        <div className="payment-brand-mark">
                            ∞
                        </div>

                        <div>
                            <div className="payment-brand-name">
                                BEATS ∞ INFINITY
                            </div>
                            <div className="payment-brand-tagline">
                                Unleash the Harmony in You
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="payment-logout-button"
                        onClick={handleLogout}
                    >
                        Logout
                    </button>
                </div>

                <div className="payment-content">
                    <div className="payment-title-block">
                        <span className="payment-icon">
                            🎵
                        </span>

                        <h1>
                            Complete Your Payment
                        </h1>

                        <p>
                            Your 5-song selection is ready.
                        </p>
                    </div>

                    <div className="payment-summary">
                        <div>
                            <strong>
                                5 Songs Selected
                            </strong>
                            <span>
                                Your final song selection is ready for submission.
                            </span>
                        </div>

                        <div className="payment-amount-block">
                            <span>
                                Amount Payable
                            </span>
                            <strong>
                                ₹{PAYMENT_AMOUNT}
                            </strong>
                            <small>
                                One Time Registration Fee
                            </small>
                        </div>
                    </div>

                    <div className="payment-divider" />

                    <div className="qr-section">
                        <h2>
                            Scan &amp; Pay
                        </h2>

                        <p>
                            Scan the QR code below using any UPI app
                        </p>

                        <div className="qr-frame">
                            <img
                                src="/payment-qr.jpeg"
                                alt="UPI payment QR code"
                                className="payment-qr"
                            />
                        </div>
                    </div>

                    <div className="important-box">
                        <div className="important-icon">
                            🛡️
                        </div>

                        <div>
                            <strong>
                                After Payment
                            </strong>

                            <p>
                                Complete the payment using the QR code above.
                            </p>

                            <p>
                                Then click <strong>I HAVE MADE THE PAYMENT</strong>.
                            </p>

                            <p>
                                Your payment will show as <strong>Pending</strong> until Admin verifies it.
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="payment-message payment-error">
                            ⚠️ {error}
                        </div>
                    )}

                    {success && (
                        <div className="payment-message payment-success">
                            ✅ {success}
                        </div>
                    )}

                    {payment?.status === "Pending" && (
                        <div className="payment-status-card pending">
                            <span className="status-badge">
                                PENDING
                            </span>
                            <strong>
                                Payment Verification Pending
                            </strong>
                            <p>
                                Your payment notification has been received. Please do not make another payment. Our Admin team is verifying your payment.
                            </p>
                        </div>
                    )}

                    {payment?.status === "Paid" && (
                        <div className="payment-status-card paid">
                            <span className="status-badge">
                                PAID
                            </span>
                            <strong>
                                Payment Confirmed
                            </strong>
                            <p>
                                Your payment has been verified and your 5 songs have been submitted for pairing.
                            </p>
                        </div>
                    )}

                    {payment?.status !== "Paid" && (
                        <button
                            type="button"
                            className="paid-button"
                            onClick={handlePaidClick}
                            disabled={
                                submitting ||
                                payment?.status === "Pending"
                            }
                        >
                            <span className="paid-button-icon">
                                ✓
                            </span>

                            <span>
                                <strong>
                                    {submitting
                                        ? "RECORDING PAYMENT..."
                                        : payment?.status === "Pending"
                                            ? "PAYMENT NOTIFICATION RECEIVED"
                                            : "I HAVE MADE THE PAYMENT"}
                                </strong>

                                <small>
                                    {payment?.status === "Pending"
                                        ? "Awaiting Admin verification"
                                        : "Click after completing the payment"}
                                </small>
                            </span>
                        </button>
                    )}

                    {payment?.status === "Paid" && (
                        <div className="redirect-note">
                            Returning to My Songs...
                        </div>
                    )}

                    <div className="payment-help">
                        Need help? Contact Beats Infinity Support
                    </div>

                    {selection?.songs?.length === 5 && (
                        <details className="selected-song-details">
                            <summary>
                                View selected songs
                            </summary>

                            <ol>
                                {selection.songs.map(
                                    (item, index) => (
                                        <li
                                            key={`${item.songId}-${index}`}
                                        >
                                            {item.title ||
                                                item.song?.title ||
                                                "Selected Song"}
                                        </li>
                                    )
                                )}
                            </ol>
                        </details>
                    )}
                </div>
            </section>

            <Dialog
                open={confirmationDialogOpen}
                onClose={handleConfirmationDialogClose}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>
                    Beats Infinity Says
                </DialogTitle>

                <DialogContent>
                    <div
                        style={{
                            paddingTop: "8px",
                            textAlign: "center"
                        }}
                    >
                        <div
                            style={{
                                fontSize: "42px",
                                marginBottom: "12px"
                            }}
                        >
                            🎵
                        </div>

                        <p
                            style={{
                                fontSize: "18px",
                                fontWeight: 700,
                                margin: "0 0 12px"
                            }}
                        >
                            Your Song selection is submitted and Payment is being verified by the Admin
                        </p>

                        <p
                            style={{
                                margin: 0
                            }}
                        >
                            You will receive a communication soon.
                        </p>
                    </div>
                </DialogContent>

                <DialogActions
                    style={{
                        justifyContent: "center",
                        padding: "8px 24px 20px"
                    }}
                >
                    <Button
                        variant="contained"
                        onClick={handleConfirmationDialogClose}
                    >
                        OK
                    </Button>
                </DialogActions>
            </Dialog>
        </main>
    );
};

export default SingerPayment;
