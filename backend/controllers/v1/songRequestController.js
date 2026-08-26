const { supabase } =
    require("../../config/supabase");


// ==========================================================
// SONG REQUEST CONTROLLER
//
// FINAL-SELECTION ARCHITECTURE
//
// The frontend selects songs.
// On final submission:
//   1. Validate singer
//   2. Validate exactly 5 songs
//   3. Validate every song
//   4. Create/find songs using real UUIDs
//   5. Delete previous requests for this singer
//   6. Create exactly 5 requests
//   7. Mark them "Submitted for Pairing"
// ==========================================================


// ==========================================================
// HELPERS
// ==========================================================

const isValidUuid = value => {

    if (
        typeof value !== "string"
    ) {

        return false;

    }

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(value);

};


// ==========================================================
// GET ALL SONG REQUESTS
//
// GET /api/v1/song-requests
// ==========================================================

const getSongRequests =
    async (
        req,
        res
    ) => {

        try {

            const singerId =
                req.query.singer_id ||
                req.query.singerId ||
                null;


            let query =
                supabase
                    .from("song_requests")
                    .select("*")
                    .order(
                        "requested_at",
                        {
                            ascending: false
                        }
                    );


            if (
                singerId
            ) {

                query =
                    query.eq(
                        "singer_id",
                        singerId
                    );

            }


            const {
                data,
                error
            } = await query;


            if (
                error
            ) {

                console.error(
                    "GET SONG REQUESTS:",
                    error
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to load song requests.",

                    error:
                        error.message

                });

            }


            return res.status(200).json({

                success: true,

                count:
                    data?.length || 0,

                requests:
                    data || []

            });

        }

        catch (
            error
        ) {

            console.error(
                "GET SONG REQUESTS EXCEPTION:",
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
// CREATE SINGLE SONG REQUEST
//
// POST /api/v1/song-requests
// ==========================================================

const createSongRequest =
    async (
        req,
        res
    ) => {

        try {

            const {

                song_id,

                singer_id,

                notes

            } = req.body;


            if (
                !song_id
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "song_id is required."

                });

            }


            if (
                !isValidUuid(song_id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid song_id. A valid database UUID is required."

                });

            }


            if (
                !singer_id
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "singer_id is required."

                });

            }


            if (
                !isValidUuid(singer_id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid singer_id."

                });

            }


            // --------------------------------------------------
            // VERIFY SONG EXISTS
            // --------------------------------------------------

            const {
                data: song,
                error: songError
            } = await supabase

                .from("songs")

                .select("id")

                .eq(
                    "id",
                    song_id
                )

                .maybeSingle();


            if (
                songError
            ) {

                console.error(
                    "CREATE REQUEST SONG LOOKUP:",
                    songError
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to validate song.",

                    error:
                        songError.message

                });

            }


            if (
                !song
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Song does not exist."

                });

            }


            // --------------------------------------------------
            // CREATE REQUEST
            // --------------------------------------------------

            const {
                data,
                error
            } = await supabase

                .from("song_requests")

                .insert([{

                    song_id:

                        song_id,

                    singer_id:

                        singer_id,

                    status:

                        "Requested",

                    notes:

                        notes ||
                        null

                }])

                .select("*")

                .single();


            if (
                error
            ) {

                console.error(
                    "CREATE SONG REQUEST:",
                    error
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to create song request.",

                    error:
                        error.message

                });

            }


            console.log(
                "SONG REQUEST CREATED:",
                data
            );


            return res.status(201).json({

                success: true,

                message:
                    "Song request created successfully.",

                request:
                    data

            });

        }

        catch (
            error
        ) {

            console.error(
                "CREATE SONG REQUEST EXCEPTION:",
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
// UPDATE SONG REQUEST
//
// PUT /api/v1/song-requests/:id
// ==========================================================

const updateSongRequest =
    async (
        req,
        res
    ) => {

        try {

            const {
                id
            } = req.params;


            const {
                status,
                notes
            } = req.body;


            if (
                !id ||
                !isValidUuid(id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid request id."

                });

            }


            const updateData = {};


            if (
                status !== undefined
            ) {

                const allowedStatuses = [

                    "Requested",

                    "Approved",

                    "Rejected",

                    "Cancelled",

                    "Submitted for Pairing"

                ];


                if (
                    !allowedStatuses.includes(
                        status
                    )
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Invalid song request status."

                    });

                }


                updateData.status =
                    status;

            }


            if (
                notes !== undefined
            ) {

                updateData.notes =
                    notes;

            }


            const {
                data,
                error
            } = await supabase

                .from("song_requests")

                .update(
                    updateData
                )

                .eq(
                    "id",
                    id
                )

                .select("*")

                .single();


            if (
                error
            ) {

                console.error(
                    "UPDATE SONG REQUEST:",
                    error
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to update song request.",

                    error:
                        error.message

                });

            }


            return res.status(200).json({

                success: true,

                message:
                    "Song request updated successfully.",

                request:
                    data

            });

        }

        catch (
            error
        ) {

            console.error(
                "UPDATE SONG REQUEST EXCEPTION:",
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
// SUBMIT SINGLE SONG FOR PAIRING
//
// PUT /api/v1/song-requests/:id/submit
// ==========================================================

const submitSongRequestForPairing =
    async (
        req,
        res
    ) => {

        try {

            const {
                id
            } = req.params;


            if (
                !id ||
                !isValidUuid(id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid request id."

                });

            }


            const {
                data,
                error
            } = await supabase

                .from("song_requests")

                .update({

                    status:
                        "Submitted for Pairing"

                })

                .eq(
                    "id",
                    id
                )

                .select("*")

                .single();


            if (
                error
            ) {

                console.error(
                    "SUBMIT SINGLE REQUEST:",
                    error
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to submit song for pairing.",

                    error:
                        error.message

                });

            }


            return res.status(200).json({

                success: true,

                message:
                    "Song submitted for pairing.",

                request:
                    data

            });

        }

        catch (
            error
        ) {

            console.error(
                "SUBMIT SINGLE REQUEST EXCEPTION:",
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
// SUBMIT MULTIPLE EXISTING REQUESTS
//
// PUT /api/v1/song-requests/submit-for-pairing
//
// Body:
//
// {
//     request_ids: [
//         UUID,
//         UUID,
//         UUID,
//         UUID,
//         UUID
//     ]
// }
//
// ==========================================================

const submitMultipleSongRequestsForPairing =
    async (
        req,
        res
    ) => {

        try {

            const {
                request_ids
            } = req.body;


            if (
                !Array.isArray(request_ids)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "request_ids must be an array."

                });

            }


            if (
                request_ids.length !== 5
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Exactly 5 songs must be submitted."

                });

            }


            const invalidIds =
                request_ids.filter(
                    id =>
                        !isValidUuid(
                            id
                        )
                );


            if (
                invalidIds.length > 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "All request_ids must be valid database UUIDs.",

                    invalid_ids:
                        invalidIds

                });

            }


            const uniqueIds =
                [
                    ...new Set(
                        request_ids
                    )
                ];


            if (
                uniqueIds.length !== 5
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "The 5 submitted requests must be unique."

                });

            }


            console.log(
                "SUBMIT MULTIPLE REQUESTS:",
                request_ids
            );


            // --------------------------------------------------
            // VERIFY REQUESTS EXIST
            // --------------------------------------------------

            const {
                data: requests,
                error: requestError
            } = await supabase

                .from("song_requests")

                .select(
                    "id, song_id, singer_id, status"
                )

                .in(
                    "id",
                    request_ids
                );


            if (
                requestError
            ) {

                console.error(
                    "VALIDATE REQUESTS:",
                    requestError
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to validate selected songs.",

                    error:
                        requestError.message

                });

            }


            if (
                !requests ||
                requests.length !== 5
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "One or more selected song requests could not be found."

                });

            }


            // --------------------------------------------------
            // UPDATE ONLY THESE FIVE REQUESTS
            // --------------------------------------------------

            const {
                data,
                error
            } = await supabase

                .from("song_requests")

                .update({

                    status:
                        "Submitted for Pairing"

                })

                .in(
                    "id",
                    request_ids
                )

                .select("*");


            if (
                error
            ) {

                console.error(
                    "SUBMIT MULTIPLE REQUESTS:",
                    error
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to submit songs for pairing.",

                    error:
                        error.message

                });

            }


            return res.status(200).json({

                success: true,

                message:
                    "5 songs submitted for pairing.",

                requests:
                    data || []

            });

        }

        catch (
            error
        ) {

            console.error(
                "SUBMIT MULTIPLE REQUESTS EXCEPTION:",
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
// FINAL SELECTION
//
// PUT /api/v1/song-requests/submit-final-selection
//
// This is the preferred endpoint for MySongs.jsx.
//
// Body:
//
// {
//     singer_id: "...",
//     songs: [
//         {
//             song_id: "...",
//             title: "...",
//             thumbnail: "...",
//             provider: "...",
//             notes: "..."
//         }
//     ]
// }
//
// EXACTLY 5 SONGS
// ==========================================================

const submitFinalSelection =
    async (
        req,
        res
    ) => {

        try {

            const {

                singer_id,

                songs

            } = req.body;


            console.log(
                "========================================"
            );

            console.log(
                "🎵 FINAL 5 SONG SUBMISSION"
            );

            console.log(
                "Singer:",
                singer_id
            );

            console.log(
                "Songs:",
                songs
            );

            console.log(
                "========================================"
            );


            // --------------------------------------------------
            // VALIDATE SINGER
            // --------------------------------------------------

            if (
                !singer_id ||
                !isValidUuid(
                    singer_id
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid or missing singer_id."

                });

            }


            const {
                data: singer,
                error: singerError
            } = await supabase

                .from("singers")

                .select("id")

                .eq(
                    "id",
                    singer_id
                )

                .maybeSingle();


            if (
                singerError
            ) {

                console.error(
                    "SINGER VALIDATION:",
                    singerError
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to validate singer.",

                    error:
                        singerError.message

                });

            }


            if (
                !singer
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Singer does not exist."

                });

            }


            // --------------------------------------------------
            // VALIDATE SONG ARRAY
            // --------------------------------------------------

            if (
                !Array.isArray(songs)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "songs must be an array."

                });

            }


            if (
                songs.length !== 5
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Exactly 5 songs must be selected."

                });

            }


            // --------------------------------------------------
            // EXTRACT SONG IDS
            // --------------------------------------------------

            const submittedSongIds =
                songs.map(
                    item =>
                        item?.song_id ||
                        item?.songId ||
                        item?.id ||
                        null
                );


            console.log(
                "FINAL SONG IDS:",
                submittedSongIds
            );


            // --------------------------------------------------
            // NO FAKE IDs SUCH AS song-0
            // --------------------------------------------------

            const invalidSongIds =
                submittedSongIds.filter(
                    id =>
                        !isValidUuid(
                            id
                        )
                );


            if (
                invalidSongIds.length > 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Unable to validate selected songs. Invalid database song ID detected.",

                    invalid_song_ids:
                        invalidSongIds

                });

            }


            const uniqueSongIds =
                [
                    ...new Set(
                        submittedSongIds
                    )
                ];


            if (
                uniqueSongIds.length !== 5
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "The 5 selected songs must be unique."

                });

            }


            // --------------------------------------------------
            // VERIFY ALL FIVE SONGS EXIST
            // --------------------------------------------------

            const {
                data: databaseSongs,
                error: songsError
            } = await supabase

                .from("songs")

                .select("*")

                .in(
                    "id",
                    submittedSongIds
                );


            if (
                songsError
            ) {

                console.error(
                    "FINAL SONG VALIDATION:",
                    songsError
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to validate selected songs.",

                    error:
                        songsError.message

                });

            }


            if (
                !databaseSongs ||
                databaseSongs.length !== 5
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "One or more selected songs do not exist in the database."

                });

            }


            // --------------------------------------------------
            // DELETE OLD REQUESTS FOR THIS SINGER
            //
            // This guarantees that only the current final
            // selection remains in song_requests.
            // --------------------------------------------------

            const {
                error: deleteError
            } = await supabase

                .from("song_requests")

                .delete()

                .eq(
                    "singer_id",
                    singer_id
                );


            if (
                deleteError
            ) {

                console.error(
                    "DELETE OLD SONG REQUESTS:",
                    deleteError
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to clear previous song selection.",

                    error:
                        deleteError.message

                });

            }


            // --------------------------------------------------
            // CREATE EXACTLY FIVE NEW REQUESTS
            // --------------------------------------------------

            const requestRows =
                submittedSongIds.map(
                    songId => ({

                        song_id:
                            songId,

                        singer_id:
                            singer_id,

                        status:
                            "Submitted for Pairing",

                        notes:
                            "Final 5-song selection submitted for pairing"

                    })
                );


            console.log(
                "FINAL REQUEST ROWS:",
                requestRows
            );


            const {
                data: createdRequests,
                error: insertError
            } = await supabase

                .from("song_requests")

                .insert(
                    requestRows
                )

                .select("*");


            if (
                insertError
            ) {

                console.error(
                    "FINAL REQUEST INSERT:",
                    insertError
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to save final song selection.",

                    error:
                        insertError.message

                });

            }


            console.log(
                "========================================"
            );

            console.log(
                "✅ FINAL 5 SONGS SAVED"
            );

            console.log(
                createdRequests
            );

            console.log(
                "========================================"
            );


            return res.status(200).json({

                success: true,

                message:
                    "Your 5 songs have been submitted for pairing.",

                count:
                    createdRequests?.length || 0,

                requests:
                    createdRequests || []

            });

        }

        catch (
            error
        ) {

            console.error(
                "FINAL SONG SUBMISSION EXCEPTION:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to submit songs for pairing.",

                error:
                    error.message

            });

        }

    };


// ==========================================================
// DELETE SONG REQUEST
//
// DELETE /api/v1/song-requests/:id
// ==========================================================

const deleteSongRequest =
    async (
        req,
        res
    ) => {

        try {

            const {
                id
            } = req.params;


            if (
                !id ||
                !isValidUuid(id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid request id."

                });

            }


            const {
                data,
                error
            } = await supabase

                .from("song_requests")

                .delete()

                .eq(
                    "id",
                    id
                )

                .select("*");


            if (
                error
            ) {

                console.error(
                    "DELETE SONG REQUEST:",
                    error
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to delete song request.",

                    error:
                        error.message

                });

            }


            if (
                !data ||
                data.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Song request not found."

                });

            }


            console.log(
                "🗑️ SONG REQUEST DELETED:",
                data[0]
            );


            return res.status(200).json({

                success: true,

                message:
                    "Song request deleted successfully.",

                deleted:
                    data[0]

            });

        }

        catch (
            error
        ) {

            console.error(
                "DELETE SONG REQUEST EXCEPTION:",
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
// EXPORTS
// ==========================================================

module.exports = {

    createSongRequest,

    getSongRequests,

    updateSongRequest,

    submitSongRequestForPairing,

    submitMultipleSongRequestsForPairing,

    submitFinalSelection,

    deleteSongRequest

};