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

import SongPicker from "./SongPicker";

import "./MySongs.css";


const API_URL =
    API_V1_URL;


// 6 duet songs are required (sent to pairing). Male singers may
// also add 1 optional solo, which is stored separately and never
// paired. Female singers have duets only.
const MAX_SONGS =
    6;

const isSolo = item => item?.kind === "solo";

const songKey = (title, movie) =>
    `${String(title || "").toLowerCase().replace(/[^a-z0-9]/g, "")}|${String(movie || "").toLowerCase().replace(/[^a-z0-9]/g, "")}`;


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

    const [, setRequestedSongs] =
        useState([]);


    // ==========================================================
    // SONG ACTION STATE
    // ==========================================================

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
    // SINGER GENDER - solo songs are for male singers only
    // ==========================================================

    const [isMaleSinger] = useState(() => {

        try {

            const singer = JSON.parse(
                localStorage.getItem("beatsInfinitySinger") || "null"
            );

            return String(singer?.gender || "").toLowerCase() === "male";

        }
        catch {

            return false;

        }

    });


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
                // Submitted requests are the duets (6, or 5 for
                // singers who submitted before the 6-duet rule).
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

                                        kind:
                                            "duet",

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


                // ------------------------------------------------
                // The optional solo lives on the payment, not in
                // song_requests (so pairing never sees it).
                // ------------------------------------------------

                try {

                    const paymentResponse =
                        await fetch(
                            `${API_URL}/payments/my?singer_id=${encodeURIComponent(singerId)}`
                        );

                    const paymentData =
                        await paymentResponse.json();

                    const soloSongId =
                        paymentData?.payment?.status === "Paid"
                            ? paymentData.payment.solo_song_id
                            : null;

                    if (soloSongId) {

                        const soloResponse =
                            await fetch(`${API_URL}/songs/${soloSongId}`);

                        const soloData =
                            await soloResponse.json();

                        if (soloResponse.ok && soloData.song) {

                            validSongs.push({
                                requestId: `solo-${soloSongId}`,
                                kind: "solo",
                                songId: String(soloSongId),
                                status: "Submitted",
                                requestedAt: null,
                                notes: null,
                                song: normalizeSong(soloData.song)
                            });

                        }

                    }

                }
                catch (soloError) {

                    console.error("Unable to load solo song:", soloError);

                }


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
                // Any submitted songs mean the selection is final -
                // lock it.
                // ------------------------------------------------

                if (
                    validSongs.length > 0
                ) {

                    setSubmissionComplete(
                        true
                    );

                    setSubmissionMessage(
                        "Your songs have already been submitted for pairing."
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
                pending.songs.filter(item => item.kind !== "solo").length !== MAX_SONGS
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
                        kind:
                            item.kind === "solo" ? "solo" : "duet",
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

    }, []);


    // ==========================================================
    // ADD A PICKED SONG (from SongPicker)
    //
    // Local only - nothing is saved until Proceed to Payment.
    // Returns an error message, or null when added.
    // ==========================================================

    const addPickedSong =
        ({ title, movie, kind }) => {

            if (submissionComplete) {
                return "Your songs are already submitted.";
            }

            const key = songKey(title, movie);

            if (
                selectedSongs.some(
                    item => songKey(item.song?.title, item.song?.movie) === key
                )
            ) {
                return "You've already added this song.";
            }

            const duetsSoFar =
                selectedSongs.filter(item => !isSolo(item)).length;

            if (kind === "solo") {

                if (!isMaleSinger) {
                    return "Solo songs are only for male singers.";
                }

                if (selectedSongs.some(isSolo)) {
                    return "You've already added your solo song.";
                }

            }
            else if (duetsSoFar >= MAX_SONGS) {

                return `You've already added all ${MAX_SONGS} duet songs.`;

            }

            const localId = `pick-${key}`;

            const song = {
                id: localId,
                title,
                movie,
                album: movie,
                artist: "",
                provider: "Beats Infinity",
                thumbnail: "",
                isDuet: kind !== "solo"
            };

            setSelectedSongs(current => [
                ...current,
                {
                    requestId: `local-${Date.now()}-${localId}`,
                    songId: localId,
                    kind,
                    status: "Selected",
                    requestedAt: null,
                    notes: null,
                    song
                }
            ]);

            setRequestedSongs(current => [...current, localId]);

            return null;

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
    // EXACTLY 6 DUETS REQUIRED (solo optional).
    // ==========================================================

    const openSubmitDialog =
        () => {

            setSubmissionError("");


            const duetTotal =
                selectedSongs.filter(item => !isSolo(item)).length;

            if (
                duetTotal !==
                MAX_SONGS
            ) {

                setSubmissionError(
                    `Please add all ${MAX_SONGS} duet songs before submitting. You currently have ${duetTotal}/${MAX_SONGS}.`
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
    // Here we only make sure the selected songs exist in `songs`,
    // save their real database UUIDs locally, and open the
    // payment page.
    //
    // song_requests are created ONLY after admin confirms payment.
    // ==========================================================

    const submitSongsForPairing =
    async () => {

        const duetTotal =
            selectedSongs.filter(item => !isSolo(item)).length;

        if (
            duetTotal !== MAX_SONGS
        ) {
            setSubmissionError(
                `Please add all ${MAX_SONGS} duet songs before continuing. You currently have ${duetTotal}/${MAX_SONGS}.`
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
                        !isSolo(selectedItem),
                    song_type:
                        isSolo(selectedItem)
                            ? "Solo"
                            : "Duet",
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
                selectedSongs.length
            ) {
                throw new Error(
                    "Unable to save the selected songs."
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
                            kind:
                                isSolo(item.localItem)
                                    ? "solo"
                                    : "duet",
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
                "💳 Songs prepared for payment:",
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

    const duetSongs = selectedSongs.filter(item => !isSolo(item));
    const soloSong = selectedSongs.find(isSolo) || null;

    const remaining = Math.max(MAX_SONGS - duetSongs.length, 0);
    const progressPercent = Math.min((duetSongs.length / MAX_SONGS) * 100, 100);

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
                        {song.movie
                            ? `Movie: ${song.movie}`
                            : song.music_director || song.artist || ""}
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

    const renderSelectedRow = item => {

        const isRemoving = removingRequestId === item.requestId;
        const isSubmitted =
            item.status === "Submitted for Pairing" ||
            item.status === "Submitted";

        return renderSongRow(item, {
            onAction: () => removeSelectedSong(item.requestId),
            actionLabel: isRemoving ? "Removing" : "Remove",
            actionBusy: isRemoving,
            actionDisabled: submissionComplete || isRemoving,
            actionVariant: "danger",
            statusLabel: isSubmitted
                ? isSolo(item) ? "Submitted (solo)" : "Submitted for pairing"
                : "Added"
        });

    };

    return (

        <section className="my-songs-section">

            {/* ==================================================
                SELECTED SONGS
            ================================================== */}

            <div className="selected-songs-section">

                <div className="my-songs-panel-header">
                    <h2>My Songs</h2>
                    <span className="my-songs-panel-count">
                        {duetSongs.length}/{MAX_SONGS} duets
                        {isMaleSinger ? ` · ${soloSong ? 1 : 0}/1 solo` : ""}
                    </span>
                </div>

                <div className="songs-progress-track">
                    <div className="songs-progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>

                <p className="song-search-hint">
                    {isMaleSinger
                        ? `Add ${MAX_SONGS} duet songs. You can also add 1 solo song (optional).`
                        : `Add ${MAX_SONGS} duet songs.`}
                    {" "}More choices help us find you the best duet partners.
                </p>

                {loadingSelectedSongs && (
                    <div className="no-songs-compact">Loading your songs...</div>
                )}

                {!loadingSelectedSongs && selectedSongs.length === 0 && (
                    <div className="no-songs-compact">
                        No songs added yet - type a song name below to add your first one.
                    </div>
                )}

                {!loadingSelectedSongs && duetSongs.length > 0 && (

                    <>

                        <h3 className="my-songs-group-title">Duet songs</h3>

                        <div className="song-row-list">
                            {duetSongs.map(item => renderSelectedRow(item))}
                        </div>

                    </>

                )}

                {!loadingSelectedSongs && soloSong && (

                    <>

                        <h3 className="my-songs-group-title">Solo song (optional)</h3>

                        <div className="song-row-list">
                            {renderSelectedRow(soloSong)}
                        </div>

                    </>

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
                                disabled={submittingSongs || duetSongs.length !== MAX_SONGS}
                            >
                                {duetSongs.length === MAX_SONGS
                                    ? "Proceed to Payment"
                                    : `Add ${remaining} more duet song${remaining === 1 ? "" : "s"} to continue`}
                            </button>

                        </>

                    )

                )}

            </div>


            {/* ==================================================
                ADD A SONG
            ================================================== */}

            {!submissionComplete && !loadingSelectedSongs && (

                <div className="song-search-section">

                    <div className="my-songs-panel-header">
                        <h2>Add a Song</h2>
                    </div>

                    <SongPicker
                        isMale={isMaleSinger}
                        duetCount={duetSongs.length}
                        duetLimit={MAX_SONGS}
                        hasSolo={Boolean(soloSong)}
                        disabled={submittingSongs}
                        onAdd={addPickedSong}
                    />

                    {duetSongs.length >= MAX_SONGS && (!isMaleSinger || soloSong) && (
                        <p className="song-search-hint">
                            ✅ All songs added - tap Proceed to Payment above.
                        </p>
                    )}

                </div>

            )}


            {/* ==================================================
                SUBMISSION CONFIRMATION DIALOG
            ================================================== */}

            <Dialog open={submitDialogOpen} onClose={closeSubmitDialog} fullWidth maxWidth="sm">

                <DialogTitle>Confirm Your Songs</DialogTitle>

                <DialogContent>
                    <p>
                        You're about to lock in your {duetSongs.length} duet songs
                        {soloSong ? " and 1 solo song" : ""} for payment and pairing.
                    </p>
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
                        disabled={submittingSongs || duetSongs.length !== MAX_SONGS}
                    >
                        {submittingSongs ? "Submitting..." : "Proceed to Payment"}
                    </Button>

                </DialogActions>

            </Dialog>

        </section>

    );

}


export default MySongs;
