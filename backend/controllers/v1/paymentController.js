const { supabase } = require("../../config/supabase");

// ==========================================================
// BEATS INFINITY - PAYMENT CONTROLLER
// ==========================================================
//
// PAYMENT FLOW
//
// Singer selects exactly 5 songs
//       ↓
// Singer sees QR code
//       ↓
// Singer clicks "I HAVE PAID THE AMOUNT"
//       ↓
// payment.status = "Pending"
//       ↓
// Admin verifies payment
//       ↓
// payment.status = "Paid"
//       ↓
// Exactly 5 song_requests are created as
// "Submitted for Pairing"
//
// No UTR is collected.
// ==========================================================

const PAYMENT_AMOUNT = 700;
const REQUIRED_SONG_COUNT = 5;

const VALID_STATUSES = [
    "Pending",
    "Paid",
    "Rejected"
];

const cleanString = (value) => {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
};

const normalizeSongIds = (songIds) => {
    if (!Array.isArray(songIds)) {
        return [];
    }

    return [
        ...new Set(
            songIds
                .map(cleanString)
                .filter(Boolean)
        )
    ];
};

const validateFiveSongs = (songIds) => {
    if (!Array.isArray(songIds)) {
        return "selected_song_ids must be an array.";
    }

    if (songIds.length !== REQUIRED_SONG_COUNT) {
        return "Exactly 5 songs are required for payment submission.";
    }

    const normalized = normalizeSongIds(songIds);

    if (normalized.length !== REQUIRED_SONG_COUNT) {
        return "The 5 selected songs must be unique.";
    }

    return null;
};

// ==========================================================
// CREATE PAYMENT REQUEST
//
// POST /api/v1/payments
// ==========================================================

const createPayment = async (req, res) => {
    try {
        const {
            singer_id,
            selected_song_ids
        } = req.body || {};

        if (!singer_id) {
            return res.status(400).json({
                success: false,
                message: "singer_id is required."
            });
        }

        const songValidationError =
            validateFiveSongs(selected_song_ids);

        if (songValidationError) {
            return res.status(400).json({
                success: false,
                message: songValidationError
            });
        }

        const songIds = normalizeSongIds(
            selected_song_ids
        );

        // ------------------------------------------------------
        // VERIFY SINGER
        // ------------------------------------------------------

        const {
            data: singer,
            error: singerError
        } = await supabase
            .from("singers")
            .select(
                "id,mobile_number,singer_name"
            )
            .eq("id", singer_id)
            .maybeSingle();

        if (singerError) {
            console.error(
                "CREATE PAYMENT - SINGER CHECK:",
                singerError
            );

            return res.status(500).json({
                success: false,
                message: "Unable to validate singer.",
                error: singerError.message
            });
        }

        if (!singer) {
            return res.status(404).json({
                success: false,
                message: "Singer not found. Please log in again."
            });
        }

        // ------------------------------------------------------
        // VERIFY ALL FIVE SONGS EXIST
        // ------------------------------------------------------

        const {
            data: songs,
            error: songsError
        } = await supabase
            .from("songs")
            .select("id,title,movie,thumbnail,provider")
            .in("id", songIds);

        if (songsError) {
            console.error(
                "CREATE PAYMENT - SONG CHECK:",
                songsError
            );

            return res.status(500).json({
                success: false,
                message: "Unable to validate selected songs.",
                error: songsError.message
            });
        }

        if (!songs || songs.length !== REQUIRED_SONG_COUNT) {
            return res.status(400).json({
                success: false,
                message:
                    "One or more selected songs could not be found in the database."
            });
        }

        // ------------------------------------------------------
        // DO NOT CREATE MULTIPLE PENDING PAYMENTS
        // ------------------------------------------------------

        const {
            data: existingPending,
            error: pendingError
        } = await supabase
            .from("payments")
            .select("*")
            .eq("singer_id", singer_id)
            .eq("status", "Pending")
            .order("created_at", {
                ascending: false
            })
            .limit(1)
            .maybeSingle();

        if (pendingError) {
            console.error(
                "CREATE PAYMENT - PENDING CHECK:",
                pendingError
            );

            return res.status(500).json({
                success: false,
                message: "Unable to check existing payment status.",
                error: pendingError.message
            });
        }

        if (existingPending) {
            return res.status(200).json({
                success: true,
                existing: true,
                message:
                    "A payment request is already pending admin confirmation.",
                payment: existingPending
            });
        }

        // ------------------------------------------------------
        // CREATE PAYMENT
        // ------------------------------------------------------

        const {
            data: payment,
            error: paymentError
        } = await supabase
            .from("payments")
            .insert({
                singer_id,
                amount: PAYMENT_AMOUNT,
                payment_type: "Singer Registration",
                status: "Pending",
                selected_song_ids: songIds
            })
            .select()
            .single();

        if (paymentError) {
            console.error(
                "CREATE PAYMENT:",
                paymentError
            );

            return res.status(500).json({
                success: false,
                message: "Unable to create payment request.",
                error: paymentError.message
            });
        }

        console.log(
            "💳 PAYMENT REQUEST CREATED:",
            payment
        );

        return res.status(201).json({
            success: true,
            message:
                "Payment notification received. Awaiting admin confirmation.",
            payment,
            singer,
            songs
        });
    }
    catch (error) {
        console.error(
            "CREATE PAYMENT EXCEPTION:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }
};

// ==========================================================
// GET MY LATEST PAYMENT
//
// GET /api/v1/payments/my?singer_id=UUID
// ==========================================================

const getMyPayment = async (req, res) => {
    try {
        const singerId = cleanString(
            req.query.singer_id
        );

        if (!singerId) {
            return res.status(400).json({
                success: false,
                message: "singer_id is required."
            });
        }

        const {
            data: payment,
            error
        } = await supabase
            .from("payments")
            .select("*")
            .eq("singer_id", singerId)
            .order("created_at", {
                ascending: false
            })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error(
                "GET MY PAYMENT:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Unable to load payment status.",
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            payment: payment || null
        });
    }
    catch (error) {
        console.error(
            "GET MY PAYMENT EXCEPTION:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }
};

// ==========================================================
// GET ALL PAYMENTS - ADMIN
//
// GET /api/v1/payments?status=Pending
// ==========================================================

const getPayments = async (req, res) => {
    try {
        const requestedStatus = cleanString(
            req.query.status
        );

        let query = supabase
            .from("payments")
            .select("*")
            .order("created_at", {
                ascending: false
            });

        if (
            requestedStatus &&
            requestedStatus !== "All"
        ) {
            if (!VALID_STATUSES.includes(requestedStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid payment status."
                });
            }

            query = query.eq(
                "status",
                requestedStatus
            );
        }

        const {
            data: payments,
            error
        } = await query;

        if (error) {
            console.error(
                "GET PAYMENTS:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Unable to load payments.",
                error: error.message
            });
        }

        const rows = payments || [];

        // ------------------------------------------------------
        // ENRICH SINGER INFORMATION
        // ------------------------------------------------------

        const singerIds = [
            ...new Set(
                rows
                    .map(payment => payment.singer_id)
                    .filter(Boolean)
            )
        ];

        let singers = [];

        if (singerIds.length > 0) {
            const {
                data,
                error: singerError
            } = await supabase
                .from("singers")
                .select(
                    "id,singer_name,mobile_number,gender"
                )
                .in("id", singerIds);

            if (singerError) {
                console.error(
                    "GET PAYMENTS - SINGERS:",
                    singerError
                );

                return res.status(500).json({
                    success: false,
                    message: "Unable to load singer information.",
                    error: singerError.message
                });
            }

            singers = data || [];
        }

        const singerMap = new Map(
            singers.map(singer => [
                singer.id,
                singer
            ])
        );

        // ------------------------------------------------------
        // ENRICH SONG INFORMATION
        // ------------------------------------------------------

        const songIds = [
            ...new Set(
                rows.flatMap(payment =>
                    normalizeSongIds(
                        payment.selected_song_ids
                    )
                )
            )
        ];

        let songs = [];

        if (songIds.length > 0) {
            const {
                data,
                error: songsError
            } = await supabase
                .from("songs")
                .select(
                    "id,title,movie,thumbnail,provider"
                )
                .in("id", songIds);

            if (songsError) {
                console.error(
                    "GET PAYMENTS - SONGS:",
                    songsError
                );

                return res.status(500).json({
                    success: false,
                    message: "Unable to load song information.",
                    error: songsError.message
                });
            }

            songs = data || [];
        }

        const songMap = new Map(
            songs.map(song => [
                song.id,
                song
            ])
        );

        const enrichedPayments = rows.map(
            payment => {
                const selectedIds =
                    normalizeSongIds(
                        payment.selected_song_ids
                    );

                return {
                    ...payment,
                    singer:
                        singerMap.get(
                            payment.singer_id
                        ) || null,
                    songs:
                        selectedIds
                            .map(id =>
                                songMap.get(id)
                            )
                            .filter(Boolean),
                    song_count:
                        selectedIds.length
                };
            }
        );

        return res.status(200).json({
            success: true,
            count: enrichedPayments.length,
            payments: enrichedPayments
        });
    }
    catch (error) {
        console.error(
            "GET PAYMENTS EXCEPTION:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }
};

// ==========================================================
// MARK PAYMENT AS PAID
//
// PUT /api/v1/payments/:id/mark-paid
//
// IMPORTANT:
// The database RPC performs the payment confirmation and
// creation of the five song_requests atomically.
// Supabase supports calling PostgreSQL functions through RPC.
// ==========================================================

const markPaymentAsPaid = async (req, res) => {
    try {
        const paymentId = cleanString(
            req.params.id
        );

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: "Payment ID is required."
            });
        }

        const {
            data: rpcResult,
            error: rpcError
        } = await supabase.rpc(
            "confirm_payment_and_submit_songs",
            {
                p_payment_id: paymentId
            }
        );

        if (rpcError) {
            console.error(
                "MARK PAYMENT PAID RPC:",
                rpcError
            );

            return res.status(500).json({
                success: false,
                message:
                    rpcError.message ||
                    "Unable to confirm payment.",
                error: rpcError.message
            });
        }

        if (
            !rpcResult ||
            rpcResult.success !== true
        ) {
            return res.status(400).json({
                success: false,
                message:
                    rpcResult?.message ||
                    "Unable to confirm payment."
            });
        }

        const {
            data: payment,
            error: paymentError
        } = await supabase
            .from("payments")
            .select("*")
            .eq("id", paymentId)
            .single();

        if (paymentError) {
            console.error(
                "MARK PAYMENT PAID - FETCH:",
                paymentError
            );
        }

        console.log(
            "✅ PAYMENT CONFIRMED:",
            paymentId
        );

        return res.status(200).json({
            success: true,
            message:
                "Payment confirmed. The 5 songs have been submitted for pairing.",
            payment: payment || null,
            request_count:
                rpcResult.request_count ||
                REQUIRED_SONG_COUNT
        });
    }
    catch (error) {
        console.error(
            "MARK PAYMENT PAID EXCEPTION:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }
};

// ==========================================================
// REJECT PAYMENT - ADMIN
//
// PUT /api/v1/payments/:id/reject
// ==========================================================

const rejectPayment = async (req, res) => {
    try {
        const paymentId = cleanString(
            req.params.id
        );

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: "Payment ID is required."
            });
        }

        const {
            data: payment,
            error
        } = await supabase
            .from("payments")
            .update({
                status: "Rejected",
                updated_at:
                    new Date().toISOString()
            })
            .eq("id", paymentId)
            .eq("status", "Pending")
            .select()
            .maybeSingle();

        if (error) {
            console.error(
                "REJECT PAYMENT:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Unable to reject payment.",
                error: error.message
            });
        }

        if (!payment) {
            return res.status(400).json({
                success: false,
                message:
                    "Only a pending payment can be rejected."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Payment request rejected.",
            payment
        });
    }
    catch (error) {
        console.error(
            "REJECT PAYMENT EXCEPTION:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }
};

// ==========================================================
// BULK UPDATE PAYMENT STATUS (Excel import)
//
// PUT /api/v1/payments/bulk-status
//
// Body: { rows: [{ id, status }] }
//
// Only a currently-Pending payment can transition, and only
// to "Paid" (via the same atomic RPC used by the single mark-
// paid endpoint, so the 5 songs still get submitted) or
// "Rejected". This deliberately does NOT allow overwriting an
// already-decided payment's status via spreadsheet, since that
// would bypass the song-submission side effect with no way to
// safely undo it.
// ==========================================================

const bulkUpdatePaymentStatus = async (req, res) => {
    try {
        const rows = Array.isArray(req.body?.rows)
            ? req.body.rows
            : [];

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No rows provided."
            });
        }

        const results = [];

        for (const row of rows) {
            const id = cleanString(row.id);
            const targetStatus = cleanString(row.status);

            if (!id) {
                results.push({ id: null, status: "error", message: "Missing payment id - row skipped." });
                continue;
            }

            if (!["Paid", "Rejected"].includes(targetStatus)) {
                results.push({ id, status: "error", message: "status must be 'Paid' or 'Rejected' to apply a change." });
                continue;
            }

            const { data: current, error: currentError } = await supabase
                .from("payments")
                .select("id,status")
                .eq("id", id)
                .maybeSingle();

            if (currentError) {
                results.push({ id, status: "error", message: currentError.message });
                continue;
            }

            if (!current) {
                results.push({ id, status: "error", message: "Payment not found." });
                continue;
            }

            if (current.status !== "Pending") {
                results.push({ id, status: "skipped", message: `Already ${current.status} - no change applied.` });
                continue;
            }

            if (targetStatus === "Paid") {
                const { data: rpcResult, error: rpcError } = await supabase.rpc(
                    "confirm_payment_and_submit_songs",
                    { p_payment_id: id }
                );

                if (rpcError || !rpcResult || rpcResult.success !== true) {
                    results.push({
                        id,
                        status: "error",
                        message: rpcError?.message || rpcResult?.message || "Unable to confirm payment."
                    });
                    continue;
                }

                results.push({ id, status: "updated", message: "Marked Paid - songs submitted for pairing." });
            }
            else {
                const { data, error } = await supabase
                    .from("payments")
                    .update({ status: "Rejected", updated_at: new Date().toISOString() })
                    .eq("id", id)
                    .eq("status", "Pending")
                    .select("id")
                    .maybeSingle();

                if (error) {
                    results.push({ id, status: "error", message: error.message });
                    continue;
                }

                if (!data) {
                    results.push({ id, status: "error", message: "Only a pending payment can be rejected." });
                    continue;
                }

                results.push({ id, status: "updated", message: "Marked Rejected." });
            }
        }

        const updated = results.filter(row => row.status === "updated").length;
        const skipped = results.filter(row => row.status === "skipped").length;
        const failed = results.length - updated - skipped;

        return res.status(200).json({
            success: true,
            message: `${updated} payment(s) updated, ${skipped} skipped, ${failed} failed.`,
            results
        });
    }
    catch (error) {
        console.error(
            "BULK UPDATE PAYMENT STATUS EXCEPTION:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }
};

module.exports = {
    createPayment,
    getMyPayment,
    getPayments,
    markPaymentAsPaid,
    rejectPayment,
    bulkUpdatePaymentStatus
};
