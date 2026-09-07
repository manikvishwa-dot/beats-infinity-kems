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

import {
    useNavigate
} from "react-router-dom";

import { API_V1_URL } from "../../../config/api";

import "./MySongs.css";


const API_URL =
    API_V1_URL;


const MAX_SONGS =
    5;


function MySongs() {

    const navigate = useNavigate();


    // ==========================================================
    // STATE
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
    // SELECTED SONGS
    //
    // IMPORTANT:
    //
    // These are LOCAL selections.
    //
    // Nothing is written to song_requests until the user
    // clicks CONTINUE TO PAYMENT.
    // ==========================================================

    const [selectedSongs, setSelectedSongs] =
        useState([]);

    const [requestedSongs, setRequestedSongs] =
        useState([]);


    // ==========================================================
    // FAVORITES
    // ==========================================================

    const [favorites, setFavorites] =
        useState([]);


    // ==========================================================
    // SONG ACTION STATE
    // ==========================================================

    const [requestingSongId, setRequestingSongId] =
        useState(null);

    const [removingRequestId, setRemovingRequestId] =
        useState(null);


    // ==========================================================
    // LOADING
    // ==========================================================

    const [loadingSelectedSongs, setLoadingSelectedSongs] =
        useState(false);


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
    // Supports the common storage formats used by the
    // Beats Infinity login flow.
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

                    return value;

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
                        parsed?.singerId;


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

                    // Ignore invalid localStorage JSON.

                }

            }


            return null;

        };


    // ==========================================================
    // NORMALIZE SONG
    // ==========================================================

    const normalizeSong =
        (
            song,
            index = 0
        ) => {

            return {

                id:
                    String(
                        song?.id ||
                        song?.trackId ||
                        song?.providerId ||
                        `song-${index}`
                    ),

                title:
                    song?.title ||
                    song?.trackName ||
                    song?.name ||
                    "Unknown Song",

                artist:
                    song?.artist ||
                    song?.artistName ||
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
                    "Music Provider",

                thumbnail:
                    song?.thumbnail ||
                    song?.artworkUrl100 ||
                    song?.artworkUrl ||
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
    // LOAD FINAL SUBMITTED SONGS
    //
    // We DO NOT load Requested / Cancelled / old temporary
    // records.
    //
    // Only "Submitted for Pairing" records belong here.
    // ==========================================================

    const loadSubmittedSongs =
        async () => {

            const singerId =
                getSingerId();


            // --------------------------------------------------
            // If login information is unavailable, start fresh.
            //
            // This prevents another singer's songs appearing.
            // --------------------------------------------------

            if (
                !singerId
            ) {

                setSelectedSongs([]);

                setRequestedSongs([]);

                setSubmissionComplete(
                    false
                );

                setLoadingSelectedSongs(
                    false
                );

                return;

            }


            try {

                setLoadingSelectedSongs(
                    true
                );


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


                // ------------------------------------------------
                // Only the final five are relevant.
                // ------------------------------------------------

                const finalRequests =
                    requests.slice(
                        0,
                        MAX_SONGS
                    );


                if (
                    finalRequests.length ===
                    0
                ) {

                    setSelectedSongs([]);

                    setRequestedSongs([]);

                    setSubmissionComplete(
                        false
                    );

                    return;

                }


                // ------------------------------------------------
                // Load actual song records.
                // ------------------------------------------------

                const enriched =
                    await Promise.all(

                        finalRequests.map(
                            async request => {

                                try {

                                    const songResponse =
                                        await fetch(
                                            `${API_URL}/songs/${request.song_id}`
                                        );


                                    const songData =
                                        await songResponse.json();


                                    if (
                                        !songResponse.ok ||
                                        !songData.success ||
                                        !songData.song
                                    ) {

                                        return null;

                                    }


                                    return {

                                        requestId:
                                            request.id,

                                        songId:
                                            String(
                                                request.song_id
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
                                                songData.song
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
                    enriched.filter(
                        item =>
                            item !== null
                    );


                setSelectedSongs(
                    validSongs
                );


                setRequestedSongs(

                    validSongs.map(
                        item =>
                            String(
                                item.songId
                            )
                    )

                );


                // ------------------------------------------------
                // If five final songs already exist, lock the
                // selection.
                // ------------------------------------------------

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


                const restored =
                    restorePendingPaymentSelection();

                if (!restored) {
                    setSelectedSongs([]);

                    setRequestedSongs([]);

                    setSubmissionComplete(
                        false
                    );
                }

            }

            finally {

                setLoadingSelectedSongs(
                    false
                );

            }

        };


    // ==========================================================
    // RESTORE LOCAL PENDING PAYMENT SELECTION
    // ==========================================================

    const restorePendingPaymentSelection = () => {
        try {
            const raw = sessionStorage.getItem(
                "beatsInfinityPendingSongSelection"
            );

            if (!raw) {
                return false;
            }

            const pending = JSON.parse(raw);

            if (
                !Array.isArray(pending?.songs) ||
                pending.songs.length !== MAX_SONGS
            ) {
                return false;
            }

            const restoredSongs =
                pending.songs.map(
                    item => ({
                        requestId:
                            item.requestId ||
                            `pending-${item.songId}`,
                        songId:
                            String(item.songId),
                        databaseSongId:
                            item.databaseSongId ||
                            String(item.songId),
                        status:
                            "Selected",
                        requestedAt:
                            null,
                        notes:
                            "Payment pending admin confirmation",
                        song:
                            normalizeSong(
                                item.song ||
                                item
                            )
                    })
                );

            setSelectedSongs(
                restoredSongs
            );

            setRequestedSongs(
                restoredSongs.map(
                    item =>
                        String(item.songId)
                )
            );

            setSubmissionComplete(
                false
            );

            setSubmissionMessage(
                "Your payment notification is pending admin confirmation."
            );

            return true;
        }
        catch (error) {
            console.error(
                "Unable to restore pending payment selection:",
                error
            );

            return false;
        }
    };


    // ==========================================================
    // INITIAL LOAD
    // ==========================================================

    useEffect(() => {

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

    }, []);


    // ==========================================================
    // SEARCH
    // ==========================================================

    const performSearch =
        async searchText => {

            try {

                setSearching(true);

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
                        normalizeSong
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

                setSearching(false);

            }

        };


    // --------------------------------------------------------
    // SEARCH BUTTON CLICK
    //
    // Cancels any pending debounced search and runs
    // immediately with the current input value.
    // --------------------------------------------------------

    const handleSearchClick =
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


            performSearch(
                searchText
            );

        };


    useEffect(() => {

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
                () => {

                    performSearch(
                        searchText
                    );

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


    }, [search]);


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
    // IMPORTANT:
    //
    // NO DATABASE REQUEST HERE.
    //
    // The song is stored only in React state.
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
                requestingSongId
            ) {

                return;

            }


            const songId =
                String(
                    song.id
                );


            // --------------------------------------------------
            // DUPLICATE
            // --------------------------------------------------

            if (
                requestedSongs.includes(
                    songId
                )
            ) {

                return;

            }


            // --------------------------------------------------
            // MAXIMUM FIVE
            // --------------------------------------------------

            if (
                selectedSongs.length >=
                MAX_SONGS
            ) {

                alert(
                    "You can select a maximum of 5 songs."
                );

                return;

            }


            setRequestingSongId(
                song.id
            );


            try {

                // ------------------------------------------------
                // LOCAL SELECTION ONLY
                // ------------------------------------------------

                const newSelectedSong = {

                    requestId:
                        `local-${Date.now()}-${songId}`,

                    songId:
                        songId,

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


                setRequestedSongs(
                    current => [

                        ...current,

                        songId

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
    // IMPORTANT:
    //
    // NO DATABASE DELETE.
    //
    // The song has not been submitted yet.
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


                // ------------------------------------------------
                // LOCAL REMOVE ONLY
                // ------------------------------------------------

                setSelectedSongs(
                    current =>
                        current.filter(
                            item =>
                                item.requestId !==
                                requestId
                        )
                );


                if (
                    removedSong
                ) {

                    setRequestedSongs(
                        current =>
                            current.filter(
                                id =>
                                    id !==
                                    String(
                                        removedSong.songId
                                    )
                            )
                    );

                }


                console.log(
                    "🗑️ SONG REMOVED LOCALLY:",
                    removedSong?.song?.title
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
    // EXACTLY FIVE REQUIRED.
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
    // PROCEED TO PAYMENT
    //
    // IMPORTANT:
    //
    // Selecting songs does NOT create song_requests.
    //
    // Here we only make sure the five songs exist in `songs`,
    // save their real database UUIDs locally, and open the
    // payment page.
    //
    // song_requests are created ONLY after admin confirms payment.
    // ==========================================================

    const submitSongsForPairing =
    async () => {

        if (
            selectedSongs.length !== MAX_SONGS
        ) {
            setSubmissionError(
                `Please select all 5 songs before continuing. You currently have ${selectedSongs.length}/${MAX_SONGS}.`
            );

            return;
        }


        const singerId =
            getSingerId();


        if (!singerId) {
            setSubmissionError(
                "Unable to identify the logged-in singer. Please log in again."
            );

            return;
        }


        setSubmittingSongs(true);
        setSubmissionError("");


        try {
            const databaseSongs = [];


            // --------------------------------------------------
            // SAVE / VALIDATE THE FIVE SONGS
            // --------------------------------------------------

            for (
                const selectedItem
                of selectedSongs
            ) {
                const song =
                    selectedItem.song ||
                    {};

                // If this item already has a real database UUID,
                // do not create another songs row.
                if (
                    selectedItem.databaseSongId
                ) {
                    databaseSongs.push({
                        localItem:
                            selectedItem,
                        databaseSong:
                            song,
                        databaseSongId:
                            String(
                                selectedItem.databaseSongId
                            )
                    });

                    continue;
                }


                const songPayload = {
                    title:
                        song.title ||
                        "Unknown Song",
                    movie:
                        song.movie ||
                        null,
                    album:
                        song.album ||
                        song.movie ||
                        null,
                    music_director:
                        song.artist ||
                        null,
                    language:
                        "Tamil",
                    year:
                        null,
                    duration:
                        null,
                    thumbnail:
                        song.thumbnail ||
                        "",
                    provider:
                        song.provider ||
                        "Music Provider",
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
                            song.isDuet
                        )
                };


                const songResponse =
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
                                    songPayload
                                )
                        }
                    );


                const songData =
                    await songResponse.json();


                if (
                    !songResponse.ok ||
                    !songData.success ||
                    !songData.song?.id
                ) {
                    throw new Error(
                        songData.message ||
                        `Unable to save song "${song.title}".`
                    );
                }


                databaseSongs.push({
                    localItem:
                        selectedItem,
                    databaseSong:
                        songData.song,
                    databaseSongId:
                        String(
                            songData.song.id
                        )
                });
            }


            if (
                databaseSongs.length !==
                MAX_SONGS
            ) {
                throw new Error(
                    "Unable to validate the 5 selected songs."
                );
            }


            // --------------------------------------------------
            // SAVE PAYMENT-PENDING SELECTION
            // --------------------------------------------------

            const pendingSelection = {
                singerId,
                createdAt:
                    new Date().toISOString(),
                songs:
                    databaseSongs.map(
                        (item, index) => ({
                            requestId:
                                `payment-${Date.now()}-${index}`,
                            songId:
                                item.databaseSongId,
                            databaseSongId:
                                item.databaseSongId,
                            title:
                                item.databaseSong?.title ||
                                item.localItem?.song?.title ||
                                "Selected Song",
                            movie:
                                item.databaseSong?.movie ||
                                item.localItem?.song?.movie ||
                                "",
                            song:
                                item.databaseSong ||
                                item.localItem?.song ||
                                {}
                        })
                    )
            };


            sessionStorage.setItem(
                "beatsInfinityPendingSongSelection",
                JSON.stringify(
                    pendingSelection
                )
            );


            console.log(
                "💳 Five songs prepared for payment:",
                pendingSelection
            );


            setSubmitDialogOpen(false);


            navigate(
                "/singer-payment"
            );
        }
        catch (error) {
            console.error(
                "❌ PAYMENT PREPARATION ERROR:",
                error
            );

            setSubmissionError(
                error.message ||
                "Unable to continue to payment."
            );
        }
        finally {
            setSubmittingSongs(false);
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
                    LOADING
                ================================================== */}

                {loadingSelectedSongs && (

                    <div
                        className="no-songs"
                    >

                        <div>
                            ⏳
                        </div>

                        <h3>
                            Loading selected songs...
                        </h3>

                    </div>

                )}


                {/* ==================================================
                    EMPTY
                ================================================== */}

                {!loadingSelectedSongs &&
                    selectedSongs.length === 0 && (

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
                                Search for a song below
                                and click Request Song.
                            </p>

                        </div>

                    )}


                {/* ==================================================
                    SELECTED SONG CARDS
                ================================================== */}

                {!loadingSelectedSongs &&
                    selectedSongs.length > 0 && (

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

                                                {/* ----------------------------
                                                    IMAGE
                                                ---------------------------- */}

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


                                                {/* ----------------------------
                                                    INFORMATION
                                                ---------------------------- */}

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
                                                            song.music_director ||
                                                            song.artist ||
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


                                                {/* ----------------------------
                                                    META
                                                ---------------------------- */}

                                                <div
                                                    className="song-meta"
                                                >

                                                    <span
                                                        className="song-type"
                                                    >

                                                        {
                                                            song.is_duet ||
                                                            song.isDuet

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


                                                {/* ----------------------------
                                                    REMOVE
                                                ---------------------------- */}

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
                                                {
                                                    selectedSongs.length
                                                }
                                            </strong>

                                            {" "}of{" "}

                                            <strong>
                                                {MAX_SONGS}
                                            </strong>

                                            {" "}songs.

                                        </p>


                                        {/* ==================================================
                                            LESS THAN FIVE
                                        ================================================== */}

                                        {selectedSongs.length < MAX_SONGS && (

                                            <div
                                                style={{
                                                    marginBottom:
                                                        "18px",

                                                    padding:
                                                        "12px 16px",

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


                                        {/* ==================================================
                                            EXACTLY FIVE
                                        ================================================== */}

                                        {selectedSongs.length === MAX_SONGS && (

                                            <div
                                                style={{
                                                    marginBottom:
                                                        "18px",

                                                    padding:
                                                        "12px 16px",

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

                                                You can now proceed to payment.

                                            </div>

                                        )}


                                        {/* ==================================================
                                            ERROR
                                        ================================================== */}

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


                                        {/* ==================================================
                                            SUBMIT BUTTON
                                        ================================================== */}

                                        <button
                                            type="button"
                                            className="request-btn"
                                            onClick={
                                                openSubmitDialog
                                            }
                                            disabled={
                                                submittingSongs ||
                                                selectedSongs.length !==
                                                MAX_SONGS ||
                                                submissionComplete
                                            }
                                            style={{
                                                minWidth:
                                                    "240px",

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

                                            💳 PROCEED TO PAYMENT

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
                    SEARCH INPUT + SEARCH BUTTON
                ================================================== */}

                <div
                    style={{

                        display:
                            "flex",

                        gap:
                            "12px",

                        marginBottom:
                            "20px"

                    }}
                >

                    <input
                        type="text"
                        value={search}
                        onChange={
                            event =>
                                setSearch(
                                    event.target.value
                                )
                        }
                        onKeyDown={
                            event => {

                                if (
                                    event.key ===
                                    "Enter"
                                ) {

                                    handleSearchClick();

                                }

                            }
                        }
                        placeholder="Search any song, singer or movie..."
                        className="song-search-input"
                        disabled={
                            submissionComplete
                        }
                        style={{

                            flex:
                                1,

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
                                "border-box"

                        }}
                    />

                    <button
                        type="button"
                        onClick={
                            openSubmitDialog
                        }
                        disabled={
                            submittingSongs ||
                            submissionComplete ||
                            selectedSongs.length !==
                            MAX_SONGS
                        }
                        title={
                            selectedSongs.length !==
                            MAX_SONGS
                                ? `Select all 5 songs to proceed (${selectedSongs.length}/${MAX_SONGS})`
                                : "Proceed to payment"
                        }
                        style={{

                            minHeight:
                                "58px",

                            padding:
                                "0 28px",

                            fontSize:
                                "16px",

                            fontWeight:
                                700,

                            whiteSpace:
                                "nowrap",

                            border:
                                "none",

                            borderRadius:
                                "12px",

                            cursor:
                                submissionComplete ||
                                selectedSongs.length !==
                                MAX_SONGS
                                    ? "not-allowed"
                                    : "pointer",

                            opacity:
                                selectedSongs.length ===
                                MAX_SONGS &&
                                !submissionComplete
                                    ? 1
                                    : 0.45,

                            color:
                                "#FFFFFF",

                            background:
                                "linear-gradient(135deg, #1DB954, #37E977)"

                        }}
                    >

                        💳 Proceed to Payment
                        {" "}
                        ({selectedSongs.length}/{MAX_SONGS})

                    </button>

                </div>


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

                                        const isRequesting =
                                            requestingSongId ===
                                            song.id;


                                        const isRequested =
                                            requestedSongs.includes(
                                                String(
                                                    song.id
                                                )
                                            );


                                        const isFavorite =
                                            favorites.includes(
                                                song.id
                                            );


                                        return (

                                            <article
                                                className="song-card"
                                                key={
                                                    song.id
                                                }
                                            >

                                                {/* ----------------------------
                                                    IMAGE
                                                ---------------------------- */}

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


                                                    {/* ----------------------------
                                                        FAVORITE
                                                    ---------------------------- */}

                                                    <button
                                                        type="button"
                                                        className={
                                                            isFavorite

                                                                ? "favorite-btn favorite"

                                                                : "favorite-btn"
                                                        }
                                                        onClick={() =>
                                                            toggleFavorite(
                                                                song.id
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


                                                {/* ----------------------------
                                                    SONG INFO
                                                ---------------------------- */}

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


                                                {/* ----------------------------
                                                    META
                                                ---------------------------- */}

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


                                                {/* ----------------------------
                                                    SELECT SONG
                                                ---------------------------- */}

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
                                Try another song,
                                artist or movie.
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
                SUBMISSION CONFIRMATION DIALOG
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

                    Beats Infinity Says

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

                            These 5 songs are ready for payment and pairing.

                        </p>


                        <p>

                            Once you continue, your 5-song selection will be locked for payment.

                        </p>


                        <p>

                            Please make sure your song selection is correct before continuing.

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

                                : "PROCEED TO PAYMENT"
                        }

                    </Button>

                </DialogActions>

            </Dialog>


        </section>

    );

}


export default MySongs;
