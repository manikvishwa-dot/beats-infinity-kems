const { supabase } =
    require("../../config/supabase");


// ==========================================================
// GET ALL SONGS
//
// GET /api/v1/songs
// ==========================================================

const getSongs =
    async (
        req,
        res
    ) => {

        try {

            const {
                data,
                error
            } = await supabase

                .from("songs")

                .select("*")

                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


            if (error) {

                console.error(
                    "GET SONGS:",
                    error
                );


                return res.status(
                    500
                ).json({

                    success:
                        false,

                    message:
                        "Unable to fetch songs.",

                    error:
                        error.message

                });

            }


            return res.status(
                200
            ).json({

                success:
                    true,

                count:
                    data?.length ||
                    0,

                songs:
                    data ||
                    []

            });

        }

        catch (error) {

            console.error(
                "GET SONGS EXCEPTION:",
                error
            );


            return res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Internal server error.",

                error:
                    error.message

            });

        }

    };


// ==========================================================
// GET SONG BY ID
//
// GET /api/v1/songs/:id
// ==========================================================

const getSongById =
    async (
        req,
        res
    ) => {

        try {

            const {
                id
            } = req.params;


            if (!id) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    message:
                        "Song ID is required."

                });

            }


            const {
                data,
                error
            } = await supabase

                .from("songs")

                .select("*")

                .eq(
                    "id",
                    id
                )

                .maybeSingle();


            if (error) {

                console.error(
                    "GET SONG BY ID:",
                    error
                );


                return res.status(
                    500
                ).json({

                    success:
                        false,

                    message:
                        "Unable to fetch song.",

                    error:
                        error.message

                });

            }


            if (!data) {

                return res.status(
                    404
                ).json({

                    success:
                        false,

                    message:
                        "Song not found."

                });

            }


            return res.status(
                200
            ).json({

                success:
                    true,

                song:
                    data

            });

        }

        catch (error) {

            console.error(
                "GET SONG BY ID EXCEPTION:",
                error
            );


            return res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Internal server error.",

                error:
                    error.message

            });

        }

    };


// ==========================================================
// CREATE SONG
//
// POST /api/v1/songs
// ==========================================================

const createSong =
    async (
        req,
        res
    ) => {

        try {

            const {

                title,

                movie,

                album,

                music_director,

                language,

                year,

                duration,

                thumbnail,

                provider,

                karaoke_available,

                difficulty,

                male_singers,

                female_singers,

                theme_tags,

                is_duet

            } = req.body;


            // --------------------------------------------------
            // VALIDATION
            // --------------------------------------------------

            if (
                !title ||
                !String(title).trim()
            ) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    message:
                        "Song title is required."

                });

            }


            // --------------------------------------------------
            // PREPARE SONG DATA
            // --------------------------------------------------

            const songData = {

                title:
                    String(
                        title
                    ).trim(),

                movie:
                    movie ||
                    null,

                album:
                    album ||
                    null,

                music_director:
                    music_director ||
                    null,

                language:
                    language ||
                    "Tamil",

                year:
                    year ||
                    null,

                duration:
                    duration ||
                    null,

                thumbnail:
                    thumbnail ||
                    "",

                provider:
                    provider ||
                    "Beats Infinity",

                karaoke_available:
                    karaoke_available !==
                    undefined

                        ? karaoke_available

                        : true,

                difficulty:
                    difficulty ||
                    "Medium",

                male_singers:
                    Array.isArray(
                        male_singers
                    )
                        ? male_singers
                        : [],

                female_singers:
                    Array.isArray(
                        female_singers
                    )
                        ? female_singers
                        : [],

                theme_tags:
                    Array.isArray(
                        theme_tags
                    )
                        ? theme_tags
                        : [],

                is_duet:
                    is_duet ||
                    false

            };


            // --------------------------------------------------
            // INSERT SONG
            // --------------------------------------------------

            const {

                data,

                error

            } =
                await supabase

                    .from("songs")

                    .insert([
                        songData
                    ])

                    .select()
                    .single();


            if (error) {

                console.error(
                    "CREATE SONG:",
                    error
                );


                return res.status(
                    500
                ).json({

                    success:
                        false,

                    message:
                        "Unable to create song.",

                    error:
                        error.message

                });

            }


            console.log(
                "✅ Song created:",
                data
            );


            return res.status(
                201
            ).json({

                success:
                    true,

                message:
                    "Song created successfully.",

                song:
                    data

            });

        }

        catch (error) {

            console.error(
                "CREATE SONG EXCEPTION:",
                error
            );


            return res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Internal server error.",

                error:
                    error.message

            });

        }

    };


// ==========================================================
// UPDATE SONG
//
// PUT /api/v1/songs/:id
// ==========================================================

const updateSong =
    async (
        req,
        res
    ) => {

        try {

            const {
                id
            } = req.params;


            if (!id) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    message:
                        "Song ID is required."

                });

            }


            const allowedFields = [

                "title",

                "movie",

                "album",

                "music_director",

                "language",

                "year",

                "duration",

                "thumbnail",

                "provider",

                "karaoke_available",

                "difficulty",

                "male_singers",

                "female_singers",

                "theme_tags",

                "is_duet",

                "reserved_male",

                "reserved_female"

            ];


            const updateData = {};


            for (
                const field
                of allowedFields
            ) {

                if (
                    req.body[field] !==
                    undefined
                ) {

                    updateData[field] =
                        req.body[field];

                }

            }


            if (
                Object.keys(
                    updateData
                ).length ===
                0
            ) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    message:
                        "No fields provided for update."

                });

            }


            // --------------------------------------------------
            // VALIDATE TITLE
            // --------------------------------------------------

            if (
                updateData.title !==
                undefined
            ) {

                if (
                    !String(
                        updateData.title
                    ).trim()
                ) {

                    return res.status(
                        400
                    ).json({

                        success:
                            false,

                        message:
                            "Song title cannot be empty."

                    });

                }


                updateData.title =
                    String(
                        updateData.title
                    ).trim();

            }


            // --------------------------------------------------
            // UPDATE
            // --------------------------------------------------

            const {

                data,

                error

            } =
                await supabase

                    .from("songs")

                    .update(
                        updateData
                    )

                    .eq(
                        "id",
                        id
                    )

                    .select()
                    .single();


            if (error) {

                console.error(
                    "UPDATE SONG:",
                    error
                );


                return res.status(
                    500
                ).json({

                    success:
                        false,

                    message:
                        "Unable to update song.",

                    error:
                        error.message

                });

            }


            return res.status(
                200
            ).json({

                success:
                    true,

                message:
                    "Song updated successfully.",

                song:
                    data

            });

        }

        catch (error) {

            console.error(
                "UPDATE SONG EXCEPTION:",
                error
            );


            return res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Internal server error.",

                error:
                    error.message

            });

        }

    };


// ==========================================================
// DELETE SONG
//
// DELETE /api/v1/songs/:id
// ==========================================================

const deleteSong =
    async (
        req,
        res
    ) => {

        try {

            const {
                id
            } = req.params;


            if (!id) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    message:
                        "Song ID is required."

                });

            }


            // --------------------------------------------------
            // DELETE
            // --------------------------------------------------

            const {

                data,

                error

            } =
                await supabase

                    .from("songs")

                    .delete()

                    .eq(
                        "id",
                        id
                    )

                    .select()
                    .single();


            if (error) {

                console.error(
                    "DELETE SONG:",
                    error
                );


                return res.status(
                    500
                ).json({

                    success:
                        false,

                    message:
                        "Unable to delete song.",

                    error:
                        error.message

                });

            }


            return res.status(
                200
            ).json({

                success:
                    true,

                message:
                    "Song deleted successfully.",

                deleted:
                    data

            });

        }

        catch (error) {

            console.error(
                "DELETE SONG EXCEPTION:",
                error
            );


            return res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Internal server error.",

                error:
                    error.message

            });

        }

    };


// ==========================================================
// EXPORT
// ==========================================================

module.exports = {

    getSongs,

    getSongById,

    createSong,

    updateSong,

    deleteSong

};