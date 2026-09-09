const { supabase } = require("../../config/supabase");
const { getActiveEventId } = require("../../utils/activeEvent");

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

// The exactly-5 rule is what the singer app itself always submits
// (and what markPaymentAsPaid's confirm_payment_and_submit_songs
// RPC still enforces before a payment can be confirmed) - but an
// admin assigning/replacing songs on a singer's behalf isn't bound
// by picking a full set of 5 in one sitting, so creation only
// requires at least 1, up to the 5-slot maximum.
const validateSongSelection = (songIds) => {
    if (!Array.isArray(songIds)) {
        return "selected_song_ids must be an array.";
    }

    if (songIds.length < 1 || songIds.length > REQUIRED_SONG_COUNT) {
        return `Between 1 and ${REQUIRED_SONG_COUNT} songs are required.`;
    }

    const normalized = normalizeSongIds(songIds);

    if (normalized.length !== songIds.length) {
        return "The selected songs must be unique.";
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
            validateSongSelection(selected_song_ids);

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

        if (!songs || songs.length !== songIds.length) {
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

        const eventId = await getActiveEventId();

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
                selected_song_ids: songIds,
                event_id: eventId
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
// REMOVE ONE SONG FROM A PAYMENT (UNLINK, NOT DELETE) - ADMIN
//
// PUT /api/v1/payments/:id/remove-song
// Body: { song_id }
//
// Removes a song from a singer's selection WITHOUT deleting the
// underlying songs row - the song itself may be referenced by
// other singers' payments too, so this only edits this one
// payment's array. Use songController's deleteSong instead if the
// song itself (not just this singer's pick) should be destroyed.
// ==========================================================

const removeSongFromPayment = async (req, res) => {
    try {
        const paymentId = cleanString(req.params.id);
        const songId = cleanString(req.body?.song_id);

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: "Payment ID is required."
            });
        }

        if (!songId) {
            return res.status(400).json({
                success: false,
                message: "song_id is required."
            });
        }

        const {
            data: payment,
            error: paymentError
        } = await supabase
            .from("payments")
            .select("*")
            .eq("id", paymentId)
            .maybeSingle();

        if (paymentError) {
            console.error("REMOVE SONG - PAYMENT LOOKUP:", paymentError);

            return res.status(500).json({
                success: false,
                message: "Unable to load payment.",
                error: paymentError.message
            });
        }

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found."
            });
        }

        const currentIds = normalizeSongIds(payment.selected_song_ids);
        const updatedIds = currentIds.filter(id => id !== songId);

        if (updatedIds.length === currentIds.length) {
            return res.status(400).json({
                success: false,
                message: "That song is not part of this payment."
            });
        }

        const {
            data: updatedPayment,
            error: updateError
        } = await supabase
            .from("payments")
            .update({ selected_song_ids: updatedIds })
            .eq("id", paymentId)
            .select()
            .single();

        if (updateError) {
            console.error("REMOVE SONG - UPDATE:", updateError);

            return res.status(500).json({
                success: false,
                message: "Unable to remove song.",
                error: updateError.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "Song removed from this singer's selection.",
            payment: updatedPayment
        });
    }
    catch (error) {
        console.error("REMOVE SONG EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }
};

// ==========================================================
// ADD ONE SONG TO AN EXISTING PAYMENT - ADMIN
//
// PUT /api/v1/payments/:id/add-song
// Body: { song_id }
//
// Appends a song to a payment that already has between 1 and 4
// songs (a singer who has already started but not yet reached the
// 5-song limit). Rejects once the payment already has 5.
// ==========================================================

const addSongToPayment = async (req, res) => {
    try {
        const paymentId = cleanString(req.params.id);
        const songId = cleanString(req.body?.song_id);

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: "Payment ID is required."
            });
        }

        if (!songId) {
            return res.status(400).json({
                success: false,
                message: "song_id is required."
            });
        }

        const {
            data: payment,
            error: paymentError
        } = await supabase
            .from("payments")
            .select("*")
            .eq("id", paymentId)
            .maybeSingle();

        if (paymentError) {
            console.error("ADD SONG - PAYMENT LOOKUP:", paymentError);

            return res.status(500).json({
                success: false,
                message: "Unable to load payment.",
                error: paymentError.message
            });
        }

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found."
            });
        }

        const currentIds = normalizeSongIds(payment.selected_song_ids);

        if (currentIds.includes(songId)) {
            return res.status(400).json({
                success: false,
                message: "This singer already has that song."
            });
        }

        if (currentIds.length >= REQUIRED_SONG_COUNT) {
            return res.status(400).json({
                success: false,
                message: "This singer already has 5 songs - replace one instead."
            });
        }

        const {
            data: song,
            error: songError
        } = await supabase
            .from("songs")
            .select("id")
            .eq("id", songId)
            .maybeSingle();

        if (songError) {
            console.error("ADD SONG - SONG LOOKUP:", songError);

            return res.status(500).json({
                success: false,
                message: "Unable to validate song.",
                error: songError.message
            });
        }

        if (!song) {
            return res.status(404).json({
                success: false,
                message: "That song could not be found."
            });
        }

        const {
            data: updatedPayment,
            error: updateError
        } = await supabase
            .from("payments")
            .update({ selected_song_ids: [...currentIds, songId] })
            .eq("id", paymentId)
            .select()
            .single();

        if (updateError) {
            console.error("ADD SONG - UPDATE:", updateError);

            return res.status(500).json({
                success: false,
                message: "Unable to add song.",
                error: updateError.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "Song added.",
            payment: updatedPayment
        });
    }
    catch (error) {
        console.error("ADD SONG EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }
};

// ==========================================================
// REPLACE ONE SONG IN A PAYMENT - ADMIN
//
// PUT /api/v1/payments/:id/replace-song
// Body: { old_song_id, new_song_id }
//
// Swaps one song out of an existing payment's selection for
// another, leaving the rest untouched - the array length never
// changes, so this never conflicts with the 5-song rule that
// still applies when the payment is later confirmed.
// ==========================================================

const replaceSongInPayment = async (req, res) => {
    try {
        const paymentId = cleanString(req.params.id);
        const oldSongId = cleanString(req.body?.old_song_id);
        const newSongId = cleanString(req.body?.new_song_id);

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: "Payment ID is required."
            });
        }

        if (!oldSongId || !newSongId) {
            return res.status(400).json({
                success: false,
                message: "old_song_id and new_song_id are required."
            });
        }

        const {
            data: payment,
            error: paymentError
        } = await supabase
            .from("payments")
            .select("*")
            .eq("id", paymentId)
            .maybeSingle();

        if (paymentError) {
            console.error("REPLACE SONG - PAYMENT LOOKUP:", paymentError);

            return res.status(500).json({
                success: false,
                message: "Unable to load payment.",
                error: paymentError.message
            });
        }

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found."
            });
        }

        const currentIds = normalizeSongIds(payment.selected_song_ids);

        if (!currentIds.includes(oldSongId)) {
            return res.status(400).json({
                success: false,
                message: "That song is not part of this payment."
            });
        }

        if (oldSongId !== newSongId && currentIds.includes(newSongId)) {
            return res.status(400).json({
                success: false,
                message: "That song is already part of this payment."
            });
        }

        const {
            data: newSong,
            error: newSongError
        } = await supabase
            .from("songs")
            .select("id")
            .eq("id", newSongId)
            .maybeSingle();

        if (newSongError) {
            console.error("REPLACE SONG - NEW SONG LOOKUP:", newSongError);

            return res.status(500).json({
                success: false,
                message: "Unable to validate the replacement song.",
                error: newSongError.message
            });
        }

        if (!newSong) {
            return res.status(404).json({
                success: false,
                message: "The replacement song could not be found."
            });
        }

        const updatedIds = currentIds.map(
            id => (id === oldSongId ? newSongId : id)
        );

        const {
            data: updatedPayment,
            error: updateError
        } = await supabase
            .from("payments")
            .update({ selected_song_ids: updatedIds })
            .eq("id", paymentId)
            .select()
            .single();

        if (updateError) {
            console.error("REPLACE SONG - UPDATE:", updateError);

            return res.status(500).json({
                success: false,
                message: "Unable to replace song.",
                error: updateError.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "Song replaced.",
            payment: updatedPayment
        });
    }
    catch (error) {
        console.error("REPLACE SONG EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }
};

// ==========================================================
// REASSIGN A SONG TO A DIFFERENT SINGER - ADMIN
//
// PUT /api/v1/payments/reassign-song
// Body: { song_id, from_singer_id, to_singer_id, event_id }
//
// Moves one song from one singer's selection to another's for
// the same event. If the destination singer doesn't yet have a
// payment for this event, one is created for them with just this
// song (allowed since creation only requires 1-5 songs now).
// ==========================================================

const reassignSongToSinger = async (req, res) => {
    try {
        const songId = cleanString(req.body?.song_id);
        const fromSingerId = cleanString(req.body?.from_singer_id);
        const toSingerId = cleanString(req.body?.to_singer_id);
        const eventId = cleanString(req.body?.event_id);

        if (!songId || !fromSingerId || !toSingerId || !eventId) {
            return res.status(400).json({
                success: false,
                message: "song_id, from_singer_id, to_singer_id and event_id are required."
            });
        }

        if (fromSingerId === toSingerId) {
            return res.status(400).json({
                success: false,
                message: "Source and destination singer must be different."
            });
        }

        const {
            data: toSinger,
            error: toSingerError
        } = await supabase
            .from("singers")
            .select("id")
            .eq("id", toSingerId)
            .maybeSingle();

        if (toSingerError) {
            console.error("REASSIGN SONG - SINGER LOOKUP:", toSingerError);

            return res.status(500).json({
                success: false,
                message: "Unable to validate destination singer.",
                error: toSingerError.message
            });
        }

        if (!toSinger) {
            return res.status(404).json({
                success: false,
                message: "Destination singer not found."
            });
        }

        const {
            data: sourcePayments,
            error: sourceError
        } = await supabase
            .from("payments")
            .select("*")
            .eq("singer_id", fromSingerId)
            .eq("event_id", eventId);

        if (sourceError) {
            console.error("REASSIGN SONG - SOURCE LOOKUP:", sourceError);

            return res.status(500).json({
                success: false,
                message: "Unable to load source singer's payment.",
                error: sourceError.message
            });
        }

        const sourcePayment = (sourcePayments || []).find(
            payment => normalizeSongIds(payment.selected_song_ids).includes(songId)
        );

        if (!sourcePayment) {
            return res.status(404).json({
                success: false,
                message: "That singer does not have this song for this event."
            });
        }

        const {
            data: destPayments,
            error: destError
        } = await supabase
            .from("payments")
            .select("*")
            .eq("singer_id", toSingerId)
            .eq("event_id", eventId)
            .order("created_at", { ascending: false });

        if (destError) {
            console.error("REASSIGN SONG - DEST LOOKUP:", destError);

            return res.status(500).json({
                success: false,
                message: "Unable to load destination singer's payment.",
                error: destError.message
            });
        }

        const destPayment = (destPayments || [])[0] || null;
        const destCurrentIds = destPayment ? normalizeSongIds(destPayment.selected_song_ids) : [];

        if (destCurrentIds.includes(songId)) {
            return res.status(400).json({
                success: false,
                message: "Destination singer already has this song."
            });
        }

        if (destCurrentIds.length >= REQUIRED_SONG_COUNT) {
            return res.status(400).json({
                success: false,
                message: "Destination singer already has 5 songs - replace one first."
            });
        }

        const sourceUpdatedIds = normalizeSongIds(sourcePayment.selected_song_ids)
            .filter(id => id !== songId);

        const {
            error: sourceUpdateError
        } = await supabase
            .from("payments")
            .update({ selected_song_ids: sourceUpdatedIds })
            .eq("id", sourcePayment.id);

        if (sourceUpdateError) {
            console.error("REASSIGN SONG - SOURCE UPDATE:", sourceUpdateError);

            return res.status(500).json({
                success: false,
                message: "Unable to remove song from source singer.",
                error: sourceUpdateError.message
            });
        }

        if (destPayment) {
            const {
                error: destUpdateError
            } = await supabase
                .from("payments")
                .update({ selected_song_ids: [...destCurrentIds, songId] })
                .eq("id", destPayment.id);

            if (destUpdateError) {
                console.error("REASSIGN SONG - DEST UPDATE:", destUpdateError);

                return res.status(500).json({
                    success: false,
                    message: "Song was removed from the source singer, but could not be added to the destination singer. Please check both singers' selections.",
                    error: destUpdateError.message
                });
            }
        }
        else {
            const {
                error: destCreateError
            } = await supabase
                .from("payments")
                .insert({
                    singer_id: toSingerId,
                    amount: PAYMENT_AMOUNT,
                    payment_type: "Singer Registration",
                    status: "Pending",
                    selected_song_ids: [songId],
                    event_id: eventId
                });

            if (destCreateError) {
                console.error("REASSIGN SONG - DEST CREATE:", destCreateError);

                return res.status(500).json({
                    success: false,
                    message: "Song was removed from the source singer, but a new payment could not be created for the destination singer. Please check both singers' selections.",
                    error: destCreateError.message
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Song reassigned."
        });
    }
    catch (error) {
        console.error("REASSIGN SONG EXCEPTION:", error);

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

        // Scoped to the currently active event - otherwise a
        // singer who already paid for a past event would see that
        // old payment's status here instead of "not paid yet" for
        // their new selection.
        const activeEventId = await getActiveEventId();

        let paymentQuery = supabase
            .from("payments")
            .select("*")
            .eq("singer_id", singerId);

        paymentQuery = activeEventId
            ? paymentQuery.eq("event_id", activeEventId)
            : paymentQuery.is("event_id", null);

        const {
            data: payment,
            error
        } = await paymentQuery
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

        // Scoped to one or more events when ?event_id= is given
        // (comma-separated for a multi-event comparison, up to 3) -
        // otherwise every event's payments get mixed together with
        // no way to tell them apart. Mirrors getSingersOverview.
        const eventIds = (req.query.event_id || "")
            .split(",")
            .map(value => value.trim())
            .filter(Boolean);

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

        if (eventIds.length > 0) {
            query = query.in("event_id", eventIds);
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

        // ------------------------------------------------------
        // EVENT NAMES - resolved per row from that row's own
        // event_id, not a single label applied to the whole list.
        // ------------------------------------------------------

        const resultEventIds = [
            ...new Set(
                rows
                    .map(payment => payment.event_id)
                    .filter(Boolean)
            )
        ];

        let eventNameById = new Map();

        if (resultEventIds.length > 0) {
            const { data: eventRows, error: eventsError } = await supabase
                .from("events")
                .select("id,name")
                .in("id", resultEventIds);

            if (eventsError) {
                console.error("GET PAYMENTS - EVENTS:", eventsError);
            }
            else {
                eventNameById = new Map(
                    (eventRows || []).map(event => [event.id, event.name])
                );
            }
        }

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
                        selectedIds.length,
                    event_name:
                        eventNameById.get(payment.event_id) || "—"
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
    bulkUpdatePaymentStatus,
    addSongToPayment,
    removeSongFromPayment,
    replaceSongInPayment,
    reassignSongToSinger
};
