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
import { getActiveEvent } from "../../../services/eventService";

import "./MySongs.css";


const API_URL =
    API_V1_URL;


const MAX_SONGS =
    5;


function MySongs() {

    const navigate = useNavigate();

    // Cached for the lifetime of this mount so both the "already
    // submitted?" check and the eventual song-creation payload use
    // the exact same event, fetched only once.
    const activeEventIdRef = useRef(undefined);

    const getOrFetchActiveEventId = async () => {

        if (activeEventIdRef.current !== undefined) {

            return activeEventIdRef.current;

        }

        try {

            const result = await getActiveEvent();
            activeEventIdRef.current = result.event?.id || null;

        }
        catch {

            // Best-effort - proceed unscoped rather than block on
            // this lookup failing.
            activeEventIdRef.current = null;

        }

        return activeEventIdRef.current;

    };


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

                // videoId is the stable identifier the YouTube search
                // API actually returns - falling back to the array
                // index (as this used to) meant two DIFFERENT songs
                // from two DIFFERENT searches could collide on the
                // same id whenever they happened to land at the same
                // results-grid position, wrongly showing "✓ Selected"
                // for an unrelated song.
                id:
                    String(
                        song?.id ||
                        song?.videoId ||
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


                const activeEventId =
                    await getOrFetchActiveEventId();


                // Scoped to the currently active event, so a
                // singer's OLD submission from a past event never
                // shows up (or locks the form) under a new one.
                const url =
                    `${API_URL}/song-requests?status=${encodeURIComponent(
                        "Submitted for Pairing"
                    )}&singer_id=${encodeURIComponent(
                        singerId
                    )}${
                        activeEventId
                            ? `&event_id=${encodeURIComponent(activeEventId)}`
                            : ""
                    }`;


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
                    await restorePendingPaymentSelection();

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

    const restorePendingPaymentSelection = async () => {
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

            // A pending selection saved under a past event is
            // stale once a new event goes live - discard it rather
            // than restoring last cycle's picks.
            const activeEventId = await getOrFetchActiveEventId();

            if (
                pending.eventId !==
                undefined &&
                pending.eventId !==
                activeEventId
            ) {

                sessionStorage.removeItem(
                    "beatsInfinityPendingSongSelection"
                );

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

            // Scope any newly-created songs rows to whichever event
            // is currently active, so pairing/reporting can tell
            // this selection cycle apart from past events. Falls
            // back to null (unscoped/legacy) if none is active yet.
            const activeEventId = await getOrFetchActiveEventId();


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
                        ),
                    event_id:
                        activeEventId
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
                eventId:
                    activeEventId,
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

    const remaining = MAX_SONGS - selectedSongs.length;
    const progressPercent = (selectedSongs.length / MAX_SONGS) * 100;

    const renderSongRow = (item, { onAction, actionLabel, actionBusy, actionDisabled, actionVariant, statusLabel }) => {

        const song = item.song || {};

        return (

            <div className="song-row" key={item.requestId || item.id}>

                {song.thumbnail ? (
                    <img src={song.thumbnail} alt={song.title} className="song-row-thumb" />
                ) : (
                    <div className="song-row-thumb song-row-thumb-fallback">🎵</div>
                )}

                <div className="song-row-info">
                    <div className="song-row-title">{song.title || "Unknown Song"}</div>
                    <div className="song-row-subtitle">
                        {song.music_director || song.artist || "Unknown Artist"}
                        {song.movie ? ` · ${song.movie}` : ""}
                    </div>
                    {statusLabel && (
                        <div className="song-row-status">{statusLabel}</div>
                    )}
                </div>

                <button
                    type="button"
                    className={`song-row-action ${actionVariant || ""}`}
                    onClick={onAction}
                    disabled={actionDisabled}
                >
                    {actionBusy ? "..." : actionLabel}
                </button>

            </div>

        );

    };

    return (

        <section className="my-songs-section">

            {/* ==================================================
                SELECTED SONGS
            ================================================== */}

            <div className="selected-songs-section">

                <div className="my-songs-panel-header">
                    <h2>My Songs</h2>
                    <span className="my-songs-panel-count">{selectedSongs.length}/{MAX_SONGS}</span>
                </div>

                <div className="songs-progress-track">
                    <div className="songs-progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>

                {loadingSelectedSongs && (
                    <div className="no-songs-compact">Loading your songs...</div>
                )}

                {!loadingSelectedSongs && selectedSongs.length === 0 && (
                    <div className="no-songs-compact">
                        No songs selected yet - search below to add your first one.
                    </div>
                )}

                {!loadingSelectedSongs && selectedSongs.length > 0 && (

                    <div className="song-row-list">

                        {selectedSongs.map(item => {

                            const isRemoving = removingRequestId === item.requestId;
                            const isSubmitted = item.status === "Submitted for Pairing";

                            return renderSongRow(item, {
                                onAction: () => removeSelectedSong(item.requestId),
                                actionLabel: isRemoving ? "Removing" : "Remove",
                                actionBusy: isRemoving,
                                actionDisabled: submissionComplete || isRemoving,
                                actionVariant: "danger",
                                statusLabel: isSubmitted ? "Submitted for pairing" : "Selected"
                            });

                        })}

                    </div>

                )}

                {!loadingSelectedSongs && selectedSongs.length > 0 && (

                    submissionComplete ? (

                        <div className="songs-status-banner success">
                            ✅ Songs submitted - {submissionMessage}
                        </div>

                    ) : (

                        <>

                            {submissionError && (
                                <div className="songs-status-banner error">{submissionError}</div>
                            )}

                            <button
                                type="button"
                                className="proceed-payment-btn"
                                onClick={openSubmitDialog}
                                disabled={submittingSongs || selectedSongs.length !== MAX_SONGS}
                            >
                                {selectedSongs.length === MAX_SONGS
                                    ? "Proceed to Payment"
                                    : `Select ${remaining} more song${remaining === 1 ? "" : "s"} to continue`}
                            </button>

                        </>

                    )

                )}

            </div>


            {/* ==================================================
                SEARCH SONGS
            ================================================== */}

            <div className="song-search-section">

                <div className="my-songs-panel-header">
                    <h2>Add a Song</h2>
                </div>

                <div className="song-search-row">

                    <input
                        type="text"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === "Enter") {
                                handleSearchClick();
                            }
                        }}
                        placeholder="Search song, singer or movie..."
                        className="song-search-input"
                        disabled={submissionComplete}
                    />

                </div>

                {search && searching && (
                    <div className="no-songs-compact">Searching...</div>
                )}

                {search && !searching && searchError && (
                    <div className="no-songs-compact error">{searchError}</div>
                )}

                {search && !searching && !searchError && searchResults.length > 0 && (

                    <div className="song-row-list">

                        {searchResults.map(song => {

                            const isRequesting = requestingSongId === song.id;
                            const isRequested = requestedSongs.includes(String(song.id));

                            return renderSongRow({ requestId: `search-${song.id}`, song }, {
                                onAction: () => requestSong(song),
                                actionLabel: isRequested
                                    ? "Added"
                                    : selectedSongs.length >= MAX_SONGS
                                        ? "Full"
                                        : "Add",
                                actionBusy: isRequesting,
                                actionDisabled:
                                    submissionComplete ||
                                    isRequesting ||
                                    isRequested ||
                                    selectedSongs.length >= MAX_SONGS,
                                actionVariant: isRequested ? "added" : "primary"
                            });

                        })}

                    </div>

                )}

                {search && !searching && !searchError && searchResults.length === 0 && (
                    <div className="no-songs-compact">No songs found - try another search.</div>
                )}

                {!search && (
                    <p className="song-search-hint">
                        💡 Can't find your song? Try the singer, movie, or exact song name.
                    </p>
                )}

            </div>


            {/* ==================================================
                SUBMISSION CONFIRMATION DIALOG
            ================================================== */}

            <Dialog open={submitDialogOpen} onClose={closeSubmitDialog} fullWidth maxWidth="sm">

                <DialogTitle>Confirm Your 5 Songs</DialogTitle>

                <DialogContent>
                    <p>You're about to lock in your {selectedSongs.length} songs for payment and pairing.</p>
                    <p>Make sure your selection is correct - it can't be changed after this.</p>

                    {submissionError && (
                        <p className="dialog-error-text">{submissionError}</p>
                    )}
                </DialogContent>

                <DialogActions>

                    <Button onClick={closeSubmitDialog} disabled={submittingSongs}>
                        Cancel
                    </Button>

                    <Button
                        variant="contained"
                        onClick={submitSongsForPairing}
                        disabled={submittingSongs || selectedSongs.length !== MAX_SONGS}
                    >
                        {submittingSongs ? "Submitting..." : "Proceed to Payment"}
                    </Button>

                </DialogActions>

            </Dialog>

        </section>

    );

}


export default MySongs;
