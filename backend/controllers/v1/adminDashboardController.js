const { supabase } = require("../../config/supabase");

// ==========================================================
// BEATS INFINITY - ADMIN DASHBOARD CONTROLLER
// ==========================================================
//
// Singer / Song 1-5 / Payment Status overview.
//
// IMPORTANT:
//
// Songs are sourced from payments.selected_song_ids, NOT
// song_requests. song_requests rows only exist once a payment
// has been marked "Paid" (the confirm_payment_and_submit_songs
// RPC creates them). Admin needs to see a singer's 5 selected
// songs as soon as they submit payment, even while it is still
// "Pending" - so the dashboard reads directly from the latest
// payment per singer.
// ==========================================================


// ==========================================================
// GET SINGERS OVERVIEW
//
// GET /api/v1/admin/singers-overview
// ==========================================================

const getSingersOverview = async (req, res) => {

    try {

        // --------------------------------------------------
        // LATEST PAYMENT PER SINGER
        // --------------------------------------------------

        const {
            data: payments,
            error: paymentsError
        } = await supabase

            .from("payments")

            .select(
                "id,singer_id,status,selected_song_ids,created_at"
            )

            .order(
                "created_at",
                { ascending: false }
            );


        if (paymentsError) {

            console.error(
                "ADMIN OVERVIEW - PAYMENTS:",
                paymentsError
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to load payments.",

                error:
                    paymentsError.message

            });

        }


        const latestPaymentBySinger =
            new Map();


        (payments || []).forEach(
            payment => {

                if (
                    !latestPaymentBySinger.has(
                        payment.singer_id
                    )
                ) {

                    latestPaymentBySinger.set(
                        payment.singer_id,
                        payment
                    );

                }

            }
        );


        const singerIds =
            [...latestPaymentBySinger.keys()];


        if (singerIds.length === 0) {

            return res.status(200).json({

                success: true,

                singers: []

            });

        }


        // --------------------------------------------------
        // SINGERS
        // --------------------------------------------------

        const {
            data: singers,
            error: singersError
        } = await supabase

            .from("singers")

            .select(
                "id,singer_name,mobile_number,gender"
            )

            .in(
                "id",
                singerIds
            );


        if (singersError) {

            console.error(
                "ADMIN OVERVIEW - SINGERS:",
                singersError
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to load singers.",

                error:
                    singersError.message

            });

        }


        // --------------------------------------------------
        // SONGS
        // --------------------------------------------------

        const allSongIds =
            [
                ...new Set(

                    (payments || [])

                        .flatMap(
                            payment =>
                                Array.isArray(
                                    payment.selected_song_ids
                                )
                                    ? payment.selected_song_ids
                                    : []
                        )

                )

            ];


        let songs = [];


        if (allSongIds.length > 0) {

            const {
                data: songRows,
                error: songsError
            } = await supabase

                .from("songs")

                .select(
                    "id,title,movie"
                )

                .in(
                    "id",
                    allSongIds
                );


            if (songsError) {

                console.error(
                    "ADMIN OVERVIEW - SONGS:",
                    songsError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to load songs.",

                    error:
                        songsError.message

                });

            }


            songs =
                songRows || [];

        }


        const songMap =
            new Map(
                songs.map(
                    song => [song.id, song]
                )
            );


        const singerMap =
            new Map(
                (singers || []).map(
                    singer => [singer.id, singer]
                )
            );


        // --------------------------------------------------
        // BUILD ROWS
        // --------------------------------------------------

        const rows =
            singerIds

                .map(
                    singerId => {

                        const singer =
                            singerMap.get(singerId);

                        const payment =
                            latestPaymentBySinger.get(singerId);


                        if (!singer) {

                            return null;

                        }


                        const songs =
                            (
                                Array.isArray(
                                    payment.selected_song_ids
                                )
                                    ? payment.selected_song_ids
                                    : []
                            )

                                .map(
                                    songId => ({

                                        song_id:
                                            songId,

                                        title:
                                            songMap.get(songId)?.title ||
                                            null

                                    })
                                );


                        return {

                            singer_id:
                                singerId,

                            singer_name:
                                singer.singer_name,

                            mobile_number:
                                singer.mobile_number,

                            gender:
                                singer.gender,

                            songs,

                            payment_id:
                                payment.id,

                            payment_status:
                                payment.status

                        };

                    }

                )

                .filter(
                    row => row !== null
                )

                .sort(
                    (a, b) =>
                        a.singer_name.localeCompare(
                            b.singer_name
                        )
                );


        return res.status(200).json({

            success: true,

            singers:
                rows

        });

    }

    catch (error) {

        console.error(
            "ADMIN OVERVIEW EXCEPTION:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Internal server error.",

            error:
                error.message

        });

    }

};


// ==========================================================
// GET ALL SINGERS (ROSTER)
//
// GET /api/v1/admin/singers
//
// Every registered singer, regardless of payment status -
// for the "who is enrolled" roster view (name, gender, DOB,
// mobile). Not filtered by song selection / payment like
// getSingersOverview above.
// ==========================================================

const getAllSingers = async (req, res) => {

    try {

        const {
            data: singers,
            error
        } = await supabase

            .from("singers")

            .select(
                "id,singer_name,gender,date_of_birth,mobile_number,created_at"
            )

            .order(
                "singer_name",
                { ascending: true }
            );


        if (error) {

            console.error(
                "GET ALL SINGERS:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to load singers.",

                error:
                    error.message

            });

        }


        return res.status(200).json({

            success: true,

            singers:
                singers || []

        });

    }

    catch (error) {

        console.error(
            "GET ALL SINGERS EXCEPTION:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Internal server error.",

            error:
                error.message

        });

    }

};


// ==========================================================
// BULK UPDATE SINGERS (Excel import)
//
// PUT /api/v1/admin/singers/bulk
//
// Body: { rows: [{ id, singer_name, gender, date_of_birth,
//                   mobile_number }] }
//
// Each row is matched to an existing singer by id - this
// endpoint never creates new singers (registration must go
// through the OTP flow). Rows without a recognized id are
// reported back as errors rather than silently skipped.
// ==========================================================

const ALLOWED_BULK_SINGER_FIELDS = [
    "singer_name",
    "gender",
    "date_of_birth",
    "mobile_number"
];

const bulkUpdateSingers = async (req, res) => {

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

            const id = String(row.id || "").trim();

            if (!id) {

                results.push({
                    id: null,
                    status: "error",
                    message: "Missing singer id - row skipped."
                });

                continue;

            }

            const updateData = {};

            ALLOWED_BULK_SINGER_FIELDS.forEach(field => {

                if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== "") {

                    updateData[field] = String(row[field]).trim();

                }

            });

            if (Object.keys(updateData).length === 0) {

                results.push({
                    id,
                    status: "error",
                    message: "No editable fields provided."
                });

                continue;

            }

            const { data, error } = await supabase
                .from("singers")
                .update(updateData)
                .eq("id", id)
                .select("id,singer_name")
                .maybeSingle();

            if (error) {

                results.push({
                    id,
                    status: "error",
                    message: error.message
                });

                continue;

            }

            if (!data) {

                results.push({
                    id,
                    status: "error",
                    message: "Singer not found."
                });

                continue;

            }

            results.push({
                id,
                status: "updated",
                message: `Updated ${data.singer_name}.`
            });

        }

        const updated = results.filter(row => row.status === "updated").length;
        const failed = results.length - updated;

        return res.status(200).json({
            success: true,
            message: `${updated} singer(s) updated, ${failed} failed.`,
            results
        });

    }

    catch (error) {

        console.error(
            "BULK UPDATE SINGERS EXCEPTION:",
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
    getSingersOverview,
    getAllSingers,
    bulkUpdateSingers
};
