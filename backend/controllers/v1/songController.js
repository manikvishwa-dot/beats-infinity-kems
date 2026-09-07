const { supabase } =
    require("../../config/supabase");


const VALID_SONG_TYPES = [
    "Solo",
    "Duet",
    "Male Duet",
    "Female Duet"
];


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

                is_duet,

                song_type

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


            if (
                song_type !== undefined &&
                !VALID_SONG_TYPES.includes(song_type)
            ) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    message:
                        "song_type must be one of: " +
                        VALID_SONG_TYPES.join(", ")

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
                    false,

                song_type:
                    VALID_SONG_TYPES.includes(song_type)
                        ? song_type
                        : "Solo"

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

                "song_type",

                "reserved_male",

                "reserved_female"

            ];


            if (
                req.body.song_type !== undefined &&
                !VALID_SONG_TYPES.includes(req.body.song_type)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "song_type must be one of: " +
                        VALID_SONG_TYPES.join(", ")

                });

            }


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
// BULK UPSERT SONGS (Excel import)
//
// PUT /api/v1/songs/bulk
//
// Body: { rows: [{ id?, title, music_director, movie,
//                   language, difficulty, song_type,
//                   male_singers, female_singers,
//                   karaoke_available }] }
//
// A row WITH a recognized id updates that song. A row with
// no id (blank in the template) creates a new song - this
// lets the same downloaded/re-uploaded sheet both edit
// existing rows and append new ones.
// ==========================================================

const splitNames = value => {

    if (Array.isArray(value)) {

        return value.map(name => String(name).trim()).filter(Boolean);

    }

    return String(value || "")
        .split(",")
        .map(name => name.trim())
        .filter(Boolean);

};

const parseBoolean = value => {

    if (typeof value === "boolean") {

        return value;

    }

    const normalized = String(value ?? "").trim().toLowerCase();

    // Blank cell (new song, column left empty) defaults to
    // true, matching createSong's default - only an explicit
    // false/no/0 turns karaoke off.
    return !["false", "no", "0"].includes(normalized);

};

const bulkUpsertSongs = async (req, res) => {

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

            const title = String(row.title || "").trim();

            if (!title) {

                results.push({
                    id: row.id || null,
                    status: "error",
                    message: "Missing song title - row skipped."
                });

                continue;

            }

            const songType = VALID_SONG_TYPES.includes(row.song_type)
                ? row.song_type
                : "Solo";

            const songData = {
                title,
                music_director: row.music_director || null,
                movie: row.movie || null,
                language: row.language || "Tamil",
                difficulty: row.difficulty || "Medium",
                song_type: songType,
                male_singers: splitNames(row.male_singers),
                female_singers: splitNames(row.female_singers),
                karaoke_available: parseBoolean(row.karaoke_available),
                is_duet: songType !== "Solo"
            };

            const id = String(row.id || "").trim();

            if (id) {

                const { data, error } = await supabase
                    .from("songs")
                    .update(songData)
                    .eq("id", id)
                    .select("id,title")
                    .maybeSingle();

                if (error) {

                    results.push({ id, status: "error", message: error.message });
                    continue;

                }

                if (!data) {

                    results.push({ id, status: "error", message: "Song not found." });
                    continue;

                }

                results.push({ id, status: "updated", message: `Updated "${data.title}".` });

            }

            else {

                const { data, error } = await supabase
                    .from("songs")
                    .insert([songData])
                    .select("id,title")
                    .single();

                if (error) {

                    results.push({ id: null, status: "error", message: error.message });
                    continue;

                }

                results.push({ id: data.id, status: "created", message: `Created "${data.title}".` });

            }

        }

        const applied = results.filter(row => row.status !== "error").length;
        const failed = results.length - applied;

        return res.status(200).json({
            success: true,
            message: `${applied} song(s) saved, ${failed} failed.`,
            results
        });

    }

    catch (error) {

        console.error(
            "BULK UPSERT SONGS EXCEPTION:",
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
// EXPORT
// ==========================================================

module.exports = {

    getSongs,

    getSongById,

    createSong,

    updateSong,

    deleteSong,

    bulkUpsertSongs

};