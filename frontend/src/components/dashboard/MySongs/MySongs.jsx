import {
    useEffect,
    useRef,
    useState
} from "react";

import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button
} from "@mui/material";


const API_URL =
    "http://localhost:5000/api/v1";


const MAX_SONGS =
    5;


function MySongs() {

    // ==========================================================
    // SEARCH STATE
    // ==========================================================

    const [search, setSearch] =
        useState("");

    const [searchResults, setSearchResults] =
        useState([]);

    const [searching, setSearching] =
        useState(false);

    const [searchError, setSearchError] =
        useState("");


    // ==========================================================
    // FINAL LOCAL SELECTION
    //
    // IMPORTANT:
    //
    // Selecting/removing songs does NOT touch the database.
    //
    // Database is updated ONLY after:
    //
    //     1. Exactly 5 songs selected
    //     2. User clicks Submit
    //     3. User clicks Confirm & Submit
    //
    // ==========================================================

    const [selectedSongs, setSelectedSongs] =
        useState([]);


    // Used only for UI duplicate detection.

    const [selectedSongKeys, setSelectedSongKeys] =
        useState([]);


    // ==========================================================
    // FAVORITES
    // ==========================================================

    const [favorites, setFavorites] =
        useState([]);


    // ==========================================================
    // ACTION STATE
    // ==========================================================

    const [requestingSongId, setRequestingSongId] =
        useState(null);

    const [removingRequestId, setRemovingRequestId] =
        useState(null);


    // ==========================================================
    // SUBMISSION STATE
    // ==========================================================

    const [submitDialogOpen, setSubmitDialogOpen] =
        useState(false);

    const [submittingSongs, setSubmittingSongs] =
        useState(false);

    const [submissionComplete, setSubmissionComplete] =
        useState(false);

    const [submissionMessage, setSubmissionMessage] =
        useState("");

    const [submissionError, setSubmissionError] =
        useState("");


    // ==========================================================
    // SEARCH TIMER
    // ==========================================================

    const searchTimer =
        useRef(null);


    // ==========================================================
    // GET CURRENT SINGER ID
    //
    // Supports the storage formats already used by
    // the Beats Infinity login flow.
    // ==========================================================

    const getSingerId =
        () => {

            const directKeys = [

                "singer_id",

                "singerId",

                "singerID",

                "loggedInSingerId",

                "currentSingerId",

                "beatsInfinitySingerId"

            ];


            for (
                const key of directKeys
            ) {

                const value =
                    localStorage.getItem(
                        key
                    );


                if (
                    value
                ) {

                    return String(
                        value
                    );

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


            for (
                const key of objectKeys
            ) {

                try {

                    const raw =
                        localStorage.getItem(
                            key
                        );


                    if (
                        !raw
                    ) {

                        continue;

                    }


                    const parsed =
                        JSON.parse(
                            raw
                        );


                    const id =
                        parsed?.id ||
                        parsed?.singer_id ||
                        parsed?.singerId ||
                        parsed?.user_id ||
                        parsed?.userId;


                    if (
                        id
                    ) {

                        return String(
                            id
                        );

                    }

                }

                catch (
                    error
                ) {

                    // Ignore invalid JSON.

                }

            }


            return null;

        };


    // ==========================================================
    // NORMALIZE SEARCH SONG
    // ==========================================================

    const normalizeSong =
        (
            song,
            index = 0
        ) => {

            /*
             * IMPORTANT:
             *
             * YouTube search results have videoId,
             * not a Supabase UUID.
             *
             * We therefore keep the provider ID as a
             * local ID only.
             */

            const providerId =
                song?.videoId ||
                song?.trackId ||
                song?.providerId ||
                song?.id ||
                `temporary-song-${index}`;


            return {

                id:
                    String(
                        providerId
                    ),

                title:
                    song?.title ||
                    song?.trackName ||
                    song?.name ||
                    "Unknown Song",

                artist:
                    song?.artist ||
                    song?.artistName ||
                    song?.channel ||
                    song?.music_director ||
                    song?.musicDirector ||
                    "Unknown Artist",

                movie:
                    song?.movie ||
                    song?.collectionName ||
                    song?.album ||
                    "",

                album:
                    song?.album ||
                    song?.collectionName ||
                    "",

                provider:
                    song?.provider ||
                    "YouTube",

                thumbnail:
                    song?.thumbnail ||
                    song?.artworkUrl100 ||
                    song?.artworkUrl ||
                    "",

                videoId:
                    song?.videoId ||
                    "",

                isDuet:
                    Boolean(
                        song?.isDuet ||
                        song?.is_duet
                    ),

                original:
                    song

            };

        };


    // ==========================================================
    // LOAD EXISTING FINAL SUBMISSION
    //
    // If this singer already has exactly 5 submitted songs,
    // display them and lock the selection.
    //
    // IMPORTANT:
    //
    // Requested / Cancelled / temporary records are NOT loaded.
    //
    // ==========================================================

    const loadSubmittedSongs =
        async () => {

            const singerId =
                getSingerId();


            if (
                !singerId
            ) {

                setSelectedSongs([]);

                setSelectedSongKeys([]);

                setSubmissionComplete(
                    false
                );

                return;

            }


            try {

                const url =
                    `${API_URL}/song-requests?status=${encodeURIComponent(
                        "Submitted for Pairing"
                    )}&singer_id=${encodeURIComponent(
                        singerId
                    )}`;


                const response =
                    await fetch(
                        url
                    );


                const data =
                    await response.json();


                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.message ||
                        "Unable to load submitted songs."
                    );

                }


                const requests =
                    Array.isArray(
                        data.requests
                    )
                        ? data.requests
                        : [];


                const finalRequests =
                    requests.slice(
                        0,
                        MAX_SONGS
                    );


                if (
                    finalRequests.length === 0
                ) {

                    setSelectedSongs([]);

                    setSelectedSongKeys([]);

                    setSubmissionComplete(
                        false
                    );

                    return;

                }


                const enrichedSongs =
                    await Promise.all(

                        finalRequests.map(
                            async request => {

                                try {

                                    const response =
                                        await fetch(
                                            `${API_URL}/songs/${request.song_id}`
                                        );


                                    const data =
                                        await response.json();


                                    if (
                                        !response.ok ||
                                        !data.success ||
                                        !data.song
                                    ) {

                                        return null;

                                    }


                                    const databaseSong =
                                        data.song;


                                    return {

                                        requestId:
                                            request.id,

                                        songId:
                                            String(
                                                databaseSong.id
                                            ),

                                        status:
                                            request.status ||
                                            "Submitted for Pairing",

                                        requestedAt:
                                            request.requested_at,

                                        notes:
                                            request.notes,

                                        song:
                                            normalizeSong(
                                                databaseSong
                                            )

                                    };

                                }

                                catch (
                                    error
                                ) {

                                    console.error(
                                        "Unable to load submitted song:",
                                        error
                                    );

                                    return null;

                                }

                            }

                        )

                    );


                const validSongs =
                    enrichedSongs.filter(
                        item =>
                            item !== null
                    );


                setSelectedSongs(
                    validSongs
                );


                setSelectedSongKeys(
                    validSongs.map(
                        item =>
                            String(
                                item.songId
                            )
                    )
                );


                if (
                    validSongs.length ===
                    MAX_SONGS
                ) {

                    setSubmissionComplete(
                        true
                    );

                    setSubmissionMessage(
                        "Your 5 songs have already been submitted for pairing."
                    );

                }

                else {

                    setSubmissionComplete(
                        false
                    );

                }

            }

            catch (
                error
            ) {

                console.error(
                    "Load submitted songs failed:",
                    error
                );

                /*
                 * Do not display a false submission.
                 */

                setSelectedSongs([]);

                setSelectedSongKeys([]);

                setSubmissionComplete(
                    false
                );

            }

        };


    // ==========================================================
    // INITIAL LOAD
    // ==========================================================

    useEffect(
        () => {

            loadSubmittedSongs();


            return () => {

                if (
                    searchTimer.current
                ) {

                    clearTimeout(
                        searchTimer.current
                    );

                }

            };

        },
        []
    );


    // ==========================================================
    // SEARCH
    // ==========================================================

    useEffect(
        () => {

            const searchText =
                search.trim();


            if (
                searchTimer.current
            ) {

                clearTimeout(
                    searchTimer.current
                );

            }


            if (
                !searchText
            ) {

                setSearchResults([]);

                setSearching(false);

                setSearchError("");

                return;

            }


            searchTimer.current =
                setTimeout(
                    async () => {

                        try {

                            setSearching(
                                true
                            );

                            setSearchError("");


                            const searchUrl =
                                `${API_URL}/song-search?q=${encodeURIComponent(
                                    searchText
                                )}`;


                            console.log(
                                "🔎 Searching:",
                                searchText
                            );


                            const response =
                                await fetch(
                                    searchUrl
                                );


                            const data =
                                await response.json();


                            console.log(
                                "📦 Search response:",
                                data
                            );


                            if (
                                !response.ok ||
                                !data.success
                            ) {

                                throw new Error(
                                    data.message ||
                                    "Song search failed."
                                );

                            }


                            const songs =
                                data.songs ||
                                data.results ||
                                data.data ||
                                [];


                            const normalized =
                                songs.map(
                                    (
                                        song,
                                        index
                                    ) =>
                                        normalizeSong(
                                            song,
                                            index
                                        )
                                );


                            setSearchResults(
                                normalized
                            );

                        }

                        catch (
                            error
                        ) {

                            console.error(
                                "❌ Search error:",
                                error
                            );


                            setSearchResults([]);

                            setSearchError(
                                error.message ||
                                "Unable to search songs."
                            );

                        }

                        finally {

                            setSearching(
                                false
                            );

                        }

                    },
                    350
                );


            return () => {

                if (
                    searchTimer.current
                ) {

                    clearTimeout(
                        searchTimer.current
                    );

                }

            };

        },
        [search]
    );


    // ==========================================================
    // FAVORITE
    // ==========================================================

    const toggleFavorite =
        songId => {

            setFavorites(
                current => {

                    if (
                        current.includes(
                            songId
                        )
                    ) {

                        return current.filter(
                            id =>
                                id !==
                                songId
                        );

                    }


                    return [

                        ...current,

                        songId

                    ];

                }
            );

        };


    // ==========================================================
    // SELECT SONG
    //
    // NO DATABASE WRITE.
    // ==========================================================

    const requestSong =
        async song => {

            if (
                !song ||
                !song.id
            ) {

                return;

            }


            if (
                submissionComplete
            ) {

                return;

            }


            if (
                selectedSongs.length >=
                MAX_SONGS
            ) {

                alert(
                    "You can select a maximum of 5 songs."
                );

                return;

            }


            const songKey =
                String(
                    song.id
                );


            // --------------------------------------------------
            // DUPLICATE CHECK
            // --------------------------------------------------

            if (
                selectedSongKeys.includes(
                    songKey
                )
            ) {

                return;

            }


            setRequestingSongId(
                songKey
            );


            try {

                const newSelectedSong = {

                    /*
                     * Temporary frontend ID.
                     *
                     * This is NEVER sent as song_id
                     * to Supabase.
                     */

                    requestId:
                        `local-${Date.now()}-${songKey}`,

                    songId:
                        songKey,

                    status:
                        "Selected",

                    requestedAt:
                        null,

                    notes:
                        null,

                    song:
                        song

                };


                setSelectedSongs(
                    current => [

                        ...current,

                        newSelectedSong

                    ]
                );


                setSelectedSongKeys(
                    current => [

                        ...current,

                        songKey

                    ]
                );


                console.log(
                    "🎵 SONG SELECTED LOCALLY:",
                    song.title
                );

            }

            catch (
                error
            ) {

                console.error(
                    "Select song failed:",
                    error
                );


                alert(
                    error.message ||
                    "Unable to select this song."
                );

            }

            finally {

                setRequestingSongId(
                    null
                );

            }

        };


    // ==========================================================
    // REMOVE SELECTED SONG
    //
    // NO DATABASE DELETE.
    // ==========================================================

    const removeSelectedSong =
        async requestId => {

            if (
                !requestId
            ) {

                return;

            }


            if (
                submissionComplete
            ) {

                return;

            }


            const confirmed =
                window.confirm(
                    "Remove this song from your selected songs?"
                );


            if (
                !confirmed
            ) {

                return;

            }


            setRemovingRequestId(
                requestId
            );


            try {

                const removedSong =
                    selectedSongs.find(
                        item =>
                            item.requestId ===
                            requestId
                    );


                if (
                    !removedSong
                ) {

                    return;

                }


                setSelectedSongs(
                    current =>
                        current.filter(
                            item =>
                                item.requestId !==
                                requestId
                        )
                );


                setSelectedSongKeys(
                    current =>
                        current.filter(
                            id =>
                                id !==
                                String(
                                    removedSong.songId
                                )
                        )
                );


                console.log(
                    "🗑️ SONG REMOVED LOCALLY:",
                    removedSong.song?.title
                );

            }

            catch (
                error
            ) {

                console.error(
                    "Remove song failed:",
                    error
                );


                alert(
                    error.message ||
                    "Unable to remove song."
                );

            }

            finally {

                setRemovingRequestId(
                    null
                );

            }

        };


    // ==========================================================
    // OPEN SUBMISSION DIALOG
    //
    // EXACTLY 5 REQUIRED.
    // ==========================================================

    const openSubmitDialog =
        () => {

            setSubmissionError("");


            if (
                selectedSongs.length <
                MAX_SONGS
            ) {

                setSubmissionError(
                    `Please select all 5 songs before submitting. You currently have ${selectedSongs.length}/5.`
                );

                return;

            }


            if (
                selectedSongs.length >
                MAX_SONGS
            ) {

                setSubmissionError(
                    "You can submit a maximum of 5 songs."
                );

                return;

            }


            if (
                submissionComplete
            ) {

                return;

            }


            setSubmitDialogOpen(
                true
            );

        };


    // ==========================================================
    // CLOSE SUBMISSION DIALOG
    // ==========================================================

    const closeSubmitDialog =
        () => {

            if (
                submittingSongs
            ) {

                return;

            }


            setSubmitDialogOpen(
                false
            );

        };


    // ==========================================================
    // BUILD SONG PAYLOAD
    //
    // Converts the YouTube result into the format expected
    // by POST /songs.
    // ==========================================================

    const buildSongPayload =
        song => {

            return {

                title:
                    song?.title ||
                    "Unknown Song",

                movie:
                    song?.movie ||
                    null,

                album:
                    song?.album ||
                    song?.movie ||
                    null,

                music_director:
                    song?.artist ||
                    null,

                language:
                    "Tamil",

                year:
                    null,

                duration:
                    null,

                thumbnail:
                    song?.thumbnail ||
                    "",

                provider:
                    song?.provider ||
                    "YouTube",

                karaoke_available:
                    true,

                difficulty:
                    "Medium",

                male_singers:
                    [],

                female_singers:
                    [],

                theme_tags:
                    [],

                is_duet:
                    Boolean(
                        song?.isDuet ||
                        song?.is_duet
                    )

            };

        };


    // ==========================================================
    // SAVE ONE SONG AND RETURN REAL DATABASE UUID
    // ==========================================================

    const saveSongAndGetDatabaseId =
        async song => {

            const payload =
                buildSongPayload(
                    song
                );


            console.log(
                "💾 Saving final song:",
                payload
            );


            const response =
                await fetch(
                    `${API_URL}/songs`,
                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify(
                                payload
                            )

                    }
                );


            const data =
                await response.json();


            console.log(
                "💾 Song save response:",
                data
            );


            if (
                !response.ok ||
                !data.success ||
                !data.song ||
                !data.song.id
            ) {

                throw new Error(
                    data.message ||
                    `Unable to save song "${song?.title || "Unknown Song"}".`
                );

            }


            /*
             * THIS IS THE IMPORTANT PART.
             *
             * The frontend YouTube ID is NOT used as song_id.
             *
             * Supabase returns the actual UUID here.
             */

            return data.song;

        };


    // ==========================================================
    // CREATE ONE SONG REQUEST
    // ==========================================================

    const createFinalSongRequest =
        async (
            databaseSongId,
            singerId
        ) => {

            const response =
                await fetch(
                    `${API_URL}/song-requests`,
                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                song_id:
                                    databaseSongId,

                                singer_id:
                                    singerId,

                                notes:
                                    "Final 5-song selection submitted for pairing"

                            })

                    }
                );


            const data =
                await response.json();


            console.log(
                "🎤 Song request response:",
                data
            );


            if (
                !response.ok ||
                !data.success ||
                !data.request
            ) {

                throw new Error(
                    data.message ||
                    "Unable to create final song request."
                );

            }


            return data.request;

        };


    // ==========================================================
    // SUBMIT FINAL FIVE
    //
    // THIS IS THE ONLY DATABASE SUBMISSION PATH.
    // ==========================================================

    const submitSongsForPairing =
        async () => {

            // --------------------------------------------------
            // HARD VALIDATION
            // --------------------------------------------------

            if (
                selectedSongs.length !==
                MAX_SONGS
            ) {

                setSubmissionError(
                    `Please select all 5 songs before submitting. You currently have ${selectedSongs.length}/5.`
                );

                return;

            }


            const singerId =
                getSingerId();


            console.log(
                "🎤 FINAL SUBMISSION SINGER ID:",
                singerId
            );


            if (
                !singerId
            ) {

                setSubmissionError(
                    "Unable to identify the logged-in singer. Please log in again."
                );

                return;

            }


            setSubmittingSongs(
                true
            );

            setSubmissionError("");


            try {

                // --------------------------------------------------
                // STEP 1
                // SAVE ALL FIVE SONGS
                //
                // This converts temporary YouTube IDs into
                // REAL Supabase UUIDs.
                // --------------------------------------------------

                const databaseSongs =
                    [];


                for (
                    const selectedItem
                    of selectedSongs
                ) {

                    const song =
                        selectedItem.song ||
                        {};


                    const databaseSong =
                        await saveSongAndGetDatabaseId(
                            song
                        );


                    if (
                        !databaseSong.id
                    ) {

                        throw new Error(
                            `Unable to validate song "${song.title}".`
                        );

                    }


                    databaseSongs.push(
                        databaseSong
                    );

                }


                // --------------------------------------------------
                // HARD CHECK
                // --------------------------------------------------

                if (
                    databaseSongs.length !==
                    MAX_SONGS
                ) {

                    throw new Error(
                        "Unable to validate selected songs."
                    );

                }


                // --------------------------------------------------
                // STEP 2
                // CREATE EXACTLY FIVE REQUESTS
                // --------------------------------------------------

                const createdRequests =
                    [];


                for (
                    let index = 0;
                    index < MAX_SONGS;
                    index++
                ) {

                    const databaseSong =
                        databaseSongs[index];


                    const request =
                        await createFinalSongRequest(
                            databaseSong.id,
                            singerId
                        );


                    createdRequests.push(
                        request
                    );

                }


                // --------------------------------------------------
                // HARD CHECK
                // --------------------------------------------------

                if (
                    createdRequests.length !==
                    MAX_SONGS
                ) {

                    throw new Error(
                        "Unable to create all 5 final song requests."
                    );

                }


                // --------------------------------------------------
                // STEP 3
                // MARK EXACTLY THESE FIVE FOR PAIRING
                // --------------------------------------------------

                const requestIds =
                    createdRequests.map(
                        request =>
                            request.id
                    );


                console.log(
                    "========================================"
                );

                console.log(
                    "🎵 FINAL 5 SONG SUBMISSION"
                );

                console.log(
                    "Singer:",
                    singerId
                );

                console.log(
                    "Request IDs:",
                    requestIds
                );

                console.log(
                    "========================================"
                );


                const pairingResponse =
                    await fetch(
                        `${API_URL}/song-requests/submit-for-pairing`,
                        {

                            method:
                                "PUT",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify({

                                    request_ids:
                                        requestIds

                                })

                        }
                    );


                const pairingData =
                    await pairingResponse.json();


                console.log(
                    "📦 Pairing response:",
                    pairingData
                );


                if (
                    !pairingResponse.ok ||
                    !pairingData.success
                ) {

                    throw new Error(
                        pairingData.message ||
                        "Unable to submit songs for pairing."
                    );

                }


                // --------------------------------------------------
                // STEP 4
                // UPDATE LOCAL UI
                // --------------------------------------------------

                setSelectedSongs(
                    currentSongs =>
                        currentSongs.map(
                            (
                                item,
                                index
                            ) => {

                                const databaseSong =
                                    databaseSongs[index];

                                const request =
                                    createdRequests[index];


                                return {

                                    ...item,

                                    requestId:
                                        request.id,

                                    songId:
                                        databaseSong.id,

                                    status:
                                        "Submitted for Pairing",

                                    requestedAt:
                                        request.requested_at ||
                                        new Date().toISOString(),

                                    notes:
                                        request.notes ||
                                        "Final 5-song selection submitted for pairing",

                                    song:
                                        normalizeSong(
                                            databaseSong
                                        )

                                };

                            }

                        )
                );


                setSelectedSongKeys(
                    databaseSongs.map(
                        song =>
                            String(
                                song.id
                            )
                    )
                );


                setSubmissionComplete(
                    true
                );


                setSubmissionMessage(
                    pairingData.message ||
                    "Your 5 selected songs have been submitted successfully for pairing."
                );


                setSubmitDialogOpen(
                    false
                );


                console.log(
                    "✅ FINAL 5 SONGS SUBMITTED SUCCESSFULLY"
                );

            }

            catch (
                error
            ) {

                console.error(
                    "❌ FINAL SUBMISSION ERROR:",
                    error
                );


                setSubmissionError(
                    error.message ||
                    "Unable to submit songs for pairing."
                );

            }

            finally {

                setSubmittingSongs(
                    false
                );

            }

        };


    // ==========================================================
    // RENDER
    // ==========================================================

    return (

        <section
            className="my-songs-section"
        >

            {/* ==================================================
                SELECTED SONGS
            ================================================== */}

            <div
                className="selected-songs-section"
            >

                <div
                    className="selected-songs-header"
                >

                    <div>

                        <span
                            className="section-label"
                        >

                            🎵 SELECTED SONGS

                        </span>


                        <h2>
                            My Selected Songs
                        </h2>

                    </div>


                    <div
                        className="selected-count"
                    >

                        {selectedSongs.length}
                        /{MAX_SONGS}

                    </div>

                </div>


                {/* ==================================================
                    EMPTY
                ================================================== */}

                {selectedSongs.length === 0 && (

                    <div
                        className="no-songs"
                    >

                        <div>
                            🎤
                        </div>

                        <h3>
                            No songs selected yet
                        </h3>

                        <p>
                            Search for a song below and click
                            Request Song.
                        </p>

                    </div>

                )}


                {/* ==================================================
                    SELECTED SONG CARDS
                ================================================== */}

                {selectedSongs.length > 0 && (

                    <>

                        <div
                            className="songs-grid"
                        >

                            {selectedSongs.map(
                                item => {

                                    const song =
                                        item.song ||
                                        {};

                                    const isRemoving =
                                        removingRequestId ===
                                        item.requestId;

                                    const isSubmitted =
                                        item.status ===
                                        "Submitted for Pairing";


                                    return (

                                        <article
                                            className="song-card selected-card"
                                            key={
                                                item.requestId
                                            }
                                        >

                                            <div
                                                className="song-card-top"
                                            >

                                                {song.thumbnail ? (

                                                    <img
                                                        src={
                                                            song.thumbnail
                                                        }
                                                        alt={
                                                            song.title
                                                        }
                                                        className="song-thumbnail"
                                                    />

                                                ) : (

                                                    <div
                                                        className="song-icon"
                                                    >
                                                        🎵
                                                    </div>

                                                )}

                                            </div>


                                            <div
                                                className="song-info"
                                            >

                                                <h3>
                                                    {
                                                        song.title ||
                                                        "Unknown Song"
                                                    }
                                                </h3>


                                                <p>
                                                    {
                                                        song.artist ||
                                                        song.music_director ||
                                                        "Unknown Artist"
                                                    }
                                                </p>


                                                {song.movie && (

                                                    <small>
                                                        🎬{" "}
                                                        {
                                                            song.movie
                                                        }
                                                    </small>

                                                )}

                                            </div>


                                            <div
                                                className="song-meta"
                                            >

                                                <span
                                                    className="song-type"
                                                >

                                                    {
                                                        song.isDuet ||
                                                        song.is_duet
                                                            ? "Duet"
                                                            : "Song"
                                                    }

                                                </span>


                                                <span
                                                    className="song-status"
                                                >

                                                    {
                                                        isSubmitted
                                                            ? "🟢 Submitted for Pairing"
                                                            : "🟡 Selected"
                                                    }

                                                </span>

                                            </div>


                                            {!submissionComplete && (

                                                <button
                                                    type="button"
                                                    className="request-btn remove-btn"
                                                    onClick={() =>
                                                        removeSelectedSong(
                                                            item.requestId
                                                        )
                                                    }
                                                    disabled={
                                                        isRemoving
                                                    }
                                                >

                                                    {
                                                        isRemoving
                                                            ? "⏳ Removing..."
                                                            : "🗑️ Remove"
                                                    }

                                                </button>

                                            )}

                                        </article>

                                    );

                                }

                            )}

                        </div>


                        {/* ==================================================
                            SUBMISSION AREA
                        ================================================== */}

                        <div
                            style={{

                                marginTop:
                                    "30px",

                                padding:
                                    "24px",

                                borderRadius:
                                    "16px",

                                background:
                                    "rgba(255,255,255,0.04)",

                                border:
                                    "1px solid rgba(255,255,255,0.12)",

                                textAlign:
                                    "center"

                            }}
                        >

                            {!submissionComplete ? (

                                <>

                                    <h3
                                        style={{
                                            margin:
                                                "0 0 8px",
                                            color:
                                                "#FFFFFF"
                                        }}
                                    >
                                        Ready to submit your songs?
                                    </h3>


                                    <p
                                        style={{
                                            margin:
                                                "0 0 18px",
                                            color:
                                                "#BBBBBB"
                                        }}
                                    >

                                        You have selected{" "}

                                        <strong>
                                            {selectedSongs.length}
                                        </strong>

                                        {" "}of{" "}

                                        <strong>
                                            {MAX_SONGS}
                                        </strong>

                                        {" "}songs.

                                    </p>


                                    {/* ======================================
                                        LESS THAN FIVE
                                    ====================================== */}

                                    {selectedSongs.length < MAX_SONGS && (

                                        <div
                                            style={{

                                                marginBottom:
                                                    "18px",

                                                padding:
                                                    "14px 18px",

                                                borderRadius:
                                                    "10px",

                                                background:
                                                    "rgba(255,183,77,0.10)",

                                                border:
                                                    "1px solid rgba(255,183,77,0.30)",

                                                color:
                                                    "#FFB74D",

                                                fontWeight:
                                                    600

                                            }}
                                        >

                                            ⚠️ Please add{" "}

                                            <strong>
                                                {
                                                    MAX_SONGS -
                                                    selectedSongs.length
                                                }
                                            </strong>

                                            {" "}

                                            {
                                                MAX_SONGS -
                                                selectedSongs.length ===
                                                1
                                                    ? "more song"
                                                    : "more songs"
                                            }

                                            {" "}before submitting.

                                        </div>

                                    )}


                                    {/* ======================================
                                        EXACTLY FIVE
                                    ====================================== */}

                                    {selectedSongs.length === MAX_SONGS && (

                                        <div
                                            style={{

                                                marginBottom:
                                                    "18px",

                                                padding:
                                                    "14px 18px",

                                                borderRadius:
                                                    "10px",

                                                background:
                                                    "rgba(76,175,80,0.10)",

                                                border:
                                                    "1px solid rgba(76,175,80,0.30)",

                                                color:
                                                    "#4CAF50",

                                                fontWeight:
                                                    600

                                            }}
                                        >

                                            ✅ All 5 songs selected.

                                            <br />

                                            You can now submit them
                                            for pairing.

                                        </div>

                                    )}


                                    {/* ======================================
                                        ERROR
                                    ====================================== */}

                                    {submissionError && (

                                        <div
                                            style={{

                                                marginBottom:
                                                    "16px",

                                                color:
                                                    "#ff6b6b",

                                                fontWeight:
                                                    600

                                            }}
                                        >

                                            ⚠️{" "}
                                            {
                                                submissionError
                                            }

                                        </div>

                                    )}


                                    {/* ======================================
                                        SUBMIT BUTTON
                                    ====================================== */}

                                    <button
                                        type="button"
                                        className="request-btn"
                                        onClick={
                                            openSubmitDialog
                                        }
                                        disabled={
                                            submittingSongs ||
                                            selectedSongs.length !==
                                            MAX_SONGS
                                        }
                                        style={{

                                            minWidth:
                                                "280px",

                                            minHeight:
                                                "48px",

                                            fontSize:
                                                "16px",

                                            fontWeight:
                                                700,

                                            opacity:
                                                selectedSongs.length ===
                                                MAX_SONGS
                                                    ? 1
                                                    : 0.45,

                                            cursor:
                                                selectedSongs.length ===
                                                MAX_SONGS
                                                    ? "pointer"
                                                    : "not-allowed"

                                        }}
                                    >

                                        📤 SUBMIT SONGS FOR PAIRING

                                    </button>

                                </>

                            ) : (

                                <>

                                    <div
                                        style={{

                                            fontSize:
                                                "38px",

                                            marginBottom:
                                                "10px"

                                        }}
                                    >
                                        ✅
                                    </div>


                                    <h3
                                        style={{

                                            margin:
                                                "0 0 8px",

                                            color:
                                                "#FFFFFF"

                                        }}
                                    >

                                        Songs Submitted Successfully

                                    </h3>


                                    <p
                                        style={{

                                            margin:
                                                0,

                                            color:
                                                "#BBBBBB"

                                        }}
                                    >

                                        {
                                            submissionMessage
                                        }

                                    </p>

                                </>

                            )}

                        </div>

                    </>

                )}

            </div>


            {/* ==================================================
                SEARCH SONGS
            ================================================== */}

            <div
                className="song-search-section"
            >

                <div
                    className="selected-songs-header"
                >

                    <div>

                        <span
                            className="section-label"
                        >

                            🔎 SEARCH SONGS

                        </span>


                        <h2>
                            Choose Your Song
                        </h2>

                    </div>

                </div>


                {/* ==================================================
                    LARGE SEARCH INPUT
                ================================================== */}

                <input
                    type="text"
                    value={search}
                    onChange={
                        event =>
                            setSearch(
                                event.target.value
                            )
                    }
                    placeholder="Search any song, singer or movie..."
                    className="song-search-input"
                    disabled={
                        submissionComplete
                    }
                    style={{

                        width:
                            "100%",

                        minHeight:
                            "58px",

                        padding:
                            "0 20px",

                        fontSize:
                            "18px",

                        lineHeight:
                            "1.4",

                        borderRadius:
                            "12px",

                        boxSizing:
                            "border-box",

                        marginBottom:
                            "20px"

                    }}
                />


                {/* ==================================================
                    SEARCHING
                ================================================== */}

                {search &&
                    searching && (

                    <div
                        className="no-songs"
                    >

                        <div>
                            🔎
                        </div>

                        <h3>
                            Searching...
                        </h3>

                    </div>

                )}


                {/* ==================================================
                    SEARCH ERROR
                ================================================== */}

                {search &&
                    !searching &&
                    searchError && (

                    <div
                        className="no-songs"
                    >

                        <div>
                            ⚠️
                        </div>

                        <h3>
                            Search failed
                        </h3>

                        <p>
                            {
                                searchError
                            }
                        </p>

                    </div>

                )}


                {/* ==================================================
                    SEARCH RESULTS
                ================================================== */}

                {search &&
                    !searching &&
                    !searchError &&
                    searchResults.length > 0 && (

                    <div>

                        <div
                            className="songs-grid"
                        >

                            {searchResults.map(
                                song => {

                                    const songKey =
                                        String(
                                            song.id
                                        );


                                    const isRequesting =
                                        requestingSongId ===
                                        songKey;


                                    const isRequested =
                                        selectedSongKeys.includes(
                                            songKey
                                        );


                                    const isFavorite =
                                        favorites.includes(
                                            songKey
                                        );


                                    return (

                                        <article
                                            className="song-card"
                                            key={
                                                songKey
                                            }
                                        >

                                            {/* IMAGE */}

                                            <div
                                                className="song-card-top"
                                            >

                                                {song.thumbnail ? (

                                                    <img
                                                        src={
                                                            song.thumbnail
                                                        }
                                                        alt={
                                                            song.title
                                                        }
                                                        className="song-thumbnail"
                                                    />

                                                ) : (

                                                    <div
                                                        className="song-icon"
                                                    >
                                                        🎵
                                                    </div>

                                                )}


                                                {/* FAVORITE */}

                                                <button
                                                    type="button"
                                                    className={
                                                        isFavorite
                                                            ? "favorite-btn favorite"
                                                            : "favorite-btn"
                                                    }
                                                    onClick={() =>
                                                        toggleFavorite(
                                                            songKey
                                                        )
                                                    }
                                                    disabled={
                                                        submissionComplete
                                                    }
                                                >

                                                    {
                                                        isFavorite
                                                            ? "★"
                                                            : "☆"
                                                    }

                                                </button>

                                            </div>


                                            {/* SONG INFO */}

                                            <div
                                                className="song-info"
                                            >

                                                <h3>
                                                    {
                                                        song.title
                                                    }
                                                </h3>


                                                <p>
                                                    {
                                                        song.artist
                                                    }
                                                </p>


                                                {song.movie && (

                                                    <small>
                                                        🎬{" "}
                                                        {
                                                            song.movie
                                                        }
                                                    </small>

                                                )}

                                            </div>


                                            {/* META */}

                                            <div
                                                className="song-meta"
                                            >

                                                <span
                                                    className="song-type"
                                                >

                                                    {
                                                        song.isDuet
                                                            ? "Duet"
                                                            : "Song"
                                                    }

                                                </span>


                                                <span
                                                    className="song-status"
                                                >

                                                    {
                                                        song.provider
                                                    }

                                                </span>

                                            </div>


                                            {/* SELECT */}

                                            <button
                                                type="button"
                                                className={
                                                    isRequested
                                                        ? "request-btn requested"
                                                        : "request-btn"
                                                }
                                                onClick={() =>
                                                    requestSong(
                                                        song
                                                    )
                                                }
                                                disabled={
                                                    submissionComplete ||
                                                    isRequesting ||
                                                    isRequested ||
                                                    selectedSongs.length >=
                                                    MAX_SONGS
                                                }
                                            >

                                                {
                                                    isRequesting

                                                        ? "⏳ Selecting..."

                                                        : isRequested

                                                            ? "✓ Selected"

                                                            : selectedSongs.length >=
                                                              MAX_SONGS

                                                                ? "5 Songs Selected"

                                                                : "🎤 Request Song"
                                                }

                                            </button>

                                        </article>

                                    );

                                }

                            )}

                        </div>

                    </div>

                )}


                {/* ==================================================
                    NO RESULTS
                ================================================== */}

                {search &&
                    !searching &&
                    !searchError &&
                    searchResults.length === 0 && (

                    <div
                        className="no-songs"
                    >

                        <div>
                            🎵
                        </div>

                        <h3>
                            No songs found
                        </h3>

                        <p>
                            Try another song, artist or movie.
                        </p>

                    </div>

                )}


                {/* ==================================================
                    INFORMATION
                ================================================== */}

                <div
                    className="song-request-info"
                >

                    <span
                        className="request-info-icon"
                    >
                        💡
                    </span>


                    <div>

                        <strong>
                            Can't find your song?
                        </strong>


                        <p>
                            Search by song name,
                            singer, movie or artist.
                        </p>

                    </div>

                </div>

            </div>


            {/* ==================================================
                CONFIRMATION DIALOG
            ================================================== */}

            <Dialog
                open={
                    submitDialogOpen
                }
                onClose={
                    closeSubmitDialog
                }
                fullWidth
                maxWidth="sm"
            >

                <DialogTitle>
                    Submit Songs for Pairing?
                </DialogTitle>


                <DialogContent>

                    <div
                        style={{
                            paddingTop:
                                "8px"
                        }}
                    >

                        <p>

                            You are about to submit{" "}

                            <strong>
                                {selectedSongs.length}
                            </strong>

                            {" "}songs.

                        </p>


                        <p>

                            These 5 songs will be submitted
                            for the pairing process.

                        </p>


                        <p>

                            Once submitted, your selection
                            cannot be changed.

                        </p>


                        <p>

                            Please make sure your song
                            selection is correct before
                            confirming.

                        </p>


                        {submissionError && (

                            <p
                                style={{

                                    color:
                                        "#d32f2f",

                                    fontWeight:
                                        600

                                }}
                            >

                                ⚠️{" "}
                                {
                                    submissionError
                                }

                            </p>

                        )}

                    </div>

                </DialogContent>


                <DialogActions>

                    <Button
                        onClick={
                            closeSubmitDialog
                        }
                        disabled={
                            submittingSongs
                        }
                    >
                        CANCEL
                    </Button>


                    <Button
                        variant="contained"
                        onClick={
                            submitSongsForPairing
                        }
                        disabled={
                            submittingSongs ||
                            selectedSongs.length !==
                            MAX_SONGS
                        }
                    >

                        {
                            submittingSongs
                                ? "SUBMITTING..."
                                : "CONFIRM & SUBMIT"
                        }

                    </Button>

                </DialogActions>

            </Dialog>

        </section>

    );

}


export default MySongs;