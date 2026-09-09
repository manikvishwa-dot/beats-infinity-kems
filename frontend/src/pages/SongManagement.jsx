import { useCallback, useEffect, useMemo, useState } from "react";

import AdminTopbar from "../components/admin/AdminTopbar";
import EventSelector from "../components/admin/EventSelector";
import {
    getSongById,
    createSong,
    updateSong,
    searchSongCatalog
} from "../services/songService";
import { getAllSingers, getSingersOverview } from "../services/adminDashboardService";
import { getEvents, getActiveEvent } from "../services/eventService";
import {
    createPayment,
    addSongToPayment,
    removeSongFromPayment,
    replaceSongInPayment,
    reassignSongToSinger
} from "../services/paymentService";

import "../styles/adminTheme.css";
import "./SongManagement.css";

const SONG_TYPES = ["Solo", "Duet", "Male Duet", "Female Duet"];

const normalizeSearchResult = (song, index = 0) => ({
    id: String(song?.videoId || song?.id || `search-${index}`),
    title: song?.title || "Untitled",
    movie: song?.movie || "",
    artist: song?.channel || song?.artist || "",
    thumbnail: song?.thumbnail || "",
    provider: song?.provider || "YouTube"
});

const EMPTY_FORM = {
    title: "",
    music_director: "",
    movie: "",
    language: "Tamil",
    difficulty: "Medium",
    song_type: "Solo",
    male_singers: "",
    female_singers: "",
    karaoke_available: true
};

const parseNames = value =>
    value
        .split(",")
        .map(name => name.trim())
        .filter(Boolean);

function SongManagement() {

    // Event scope - controls the "Songs Selected By Singers" table
    const [events, setEvents] = useState([]);
    const [selectedEventIds, setSelectedEventIds] = useState([]);
    const [eventsReady, setEventsReady] = useState(false);

    const [selectedSongRows, setSelectedSongRows] = useState([]);
    const [loadingSelected, setLoadingSelected] = useState(true);
    const [selectedError, setSelectedError] = useState("");

    // Edit Song modal (triggered from the selections table)
    const [showForm, setShowForm] = useState(false);
    const [editingSongId, setEditingSongId] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    // Replace Song modal (swap one song for another, same singer)
    const [showReplaceModal, setShowReplaceModal] = useState(false);
    const [replaceRow, setReplaceRow] = useState(null);
    const [replaceQuery, setReplaceQuery] = useState("");
    const [replaceResults, setReplaceResults] = useState([]);
    const [replaceSearching, setReplaceSearching] = useState(false);
    const [replaceSaving, setReplaceSaving] = useState(false);
    const [replaceError, setReplaceError] = useState("");

    // Reassign Song modal (move a song to a different singer)
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [reassignRow, setReassignRow] = useState(null);
    const [reassignTargetId, setReassignTargetId] = useState("");
    const [reassignSaving, setReassignSaving] = useState(false);
    const [reassignError, setReassignError] = useState("");

    // Add New Song modal (a new row in the table - new singer, or
    // one more song for a singer who has fewer than 5)
    const [showAddModal, setShowAddModal] = useState(false);
    const [singerRoster, setSingerRoster] = useState([]);
    const [singerSearch, setSingerSearch] = useState("");
    const [addSingerId, setAddSingerId] = useState("");
    const [addQuery, setAddQuery] = useState("");
    const [addResults, setAddResults] = useState([]);
    const [addSearching, setAddSearching] = useState(false);
    const [addSaving, setAddSaving] = useState(false);
    const [addError, setAddError] = useState("");

    useEffect(() => {

        getEvents()
            .then(result => {

                const allEvents = result.events || [];
                setEvents(allEvents);

                const active = allEvents.find(item => item.is_active);
                setSelectedEventIds(current =>
                    current.length > 0 ? current : (active ? [active.id] : [])
                );

            })
            .catch(requestError => {

                console.error("Load events error:", requestError);

            })
            .finally(() => {

                // Gates the first data fetch below - without this, an
                // unscoped "all events" request fires immediately on
                // mount (selectedEventIds still []), racing the later,
                // correctly-scoped one. If the heavier unscoped request
                // resolves last, it silently overwrites the scoped
                // result with mixed-event data.
                setEventsReady(true);

            });

        getAllSingers()
            .then(result => {

                setSingerRoster(result.singers || []);

            })
            .catch(requestError => {

                console.error("Load singer roster error:", requestError);

            });

    }, []);

    // ==========================================================
    // LOAD SONGS SELECTED BY SINGERS (scoped to selected event(s))
    // ==========================================================

    const loadSelectedSongs = useCallback(async () => {
        if (!eventsReady) {
            return;
        }

        try {
            setLoadingSelected(true);
            setSelectedError("");

            const result = await getSingersOverview(selectedEventIds.join(","));

            const rows = (result.singers || []).flatMap(singer =>
                (singer.songs || [])
                    .filter(song => song.title)
                    .map(song => ({
                        song_id: song.song_id,
                        song_title: song.title,
                        singer_id: singer.singer_id,
                        singer_name: singer.singer_name,
                        gender: singer.gender,
                        payment_id: singer.payment_id,
                        payment_status: singer.payment_status,
                        event_id: singer.event_id,
                        event_name: singer.event_name
                    }))
            );

            setSelectedSongRows(rows);
        }
        catch (requestError) {
            console.error("Load selected songs error:", requestError);
            setSelectedError(
                requestError.message ||
                "Unable to load songs selected by singers."
            );
        }
        finally {
            setLoadingSelected(false);
        }
    }, [selectedEventIds, eventsReady]);

    useEffect(() => {
        loadSelectedSongs();
    }, [loadSelectedSongs]);

    // ==========================================================
    // EDIT SONG (triggered from the selections table)
    // ==========================================================

    const handleChange = event => {
        const { name, value, type, checked } = event.target;

        setFormData(current => ({
            ...current,
            [name]: type === "checkbox" ? checked : value
        }));
    };

    const openEditForm = async songId => {
        setFormError("");

        try {
            const result = await getSongById(songId);
            const song = result.song || {};

            setEditingSongId(songId);
            setFormData({
                title: song.title || "",
                music_director: song.music_director || "",
                movie: song.movie || "",
                language: song.language || "Tamil",
                difficulty: song.difficulty || "Medium",
                song_type: song.song_type || "Solo",
                male_singers: (song.male_singers || []).join(", "),
                female_singers: (song.female_singers || []).join(", "),
                karaoke_available: song.karaoke_available !== false
            });
            setShowForm(true);
        }
        catch (requestError) {
            console.error("Load song error:", requestError);
            setSelectedError(
                requestError.message ||
                "Unable to load this song for editing."
            );
        }
    };

    const closeForm = () => {
        if (saving) {
            return;
        }

        setShowForm(false);
        setEditingSongId(null);
    };

    const saveSong = async event => {
        event.preventDefault();

        if (!formData.title.trim()) {
            alert("Please enter the song name.");
            return;
        }

        setSaving(true);
        setFormError("");

        const maleSingers = parseNames(formData.male_singers);
        const femaleSingers = parseNames(formData.female_singers);

        const payload = {
            title: formData.title,
            music_director: formData.music_director,
            movie: formData.movie,
            language: formData.language,
            difficulty: formData.difficulty,
            karaoke_available: formData.karaoke_available,
            song_type: formData.song_type,
            male_singers: maleSingers,
            female_singers: femaleSingers,
            // Kept in sync for anything else that still reads this
            // flag (e.g. the singer-facing song search badge).
            is_duet: formData.song_type !== "Solo"
        };

        try {
            await updateSong(editingSongId, payload);

            setShowForm(false);
            setEditingSongId(null);
            await loadSelectedSongs();
        }
        catch (requestError) {
            console.error("Save song error:", requestError);
            setFormError(
                requestError.message ||
                "Unable to save song."
            );
        }
        finally {
            setSaving(false);
        }
    };

    const handleDeleteSelectedSong = async row => {
        const confirmed = window.confirm(
            `Remove "${row.song_title}" from ${row.singer_name}'s selection? The song itself isn't deleted, just unlinked from this singer.`
        );

        if (!confirmed) {
            return;
        }

        try {
            await removeSongFromPayment(row.payment_id, row.song_id);
            await loadSelectedSongs();
        }
        catch (requestError) {
            console.error("Remove song error:", requestError);
            setSelectedError(
                requestError.message ||
                "Unable to remove this song."
            );
        }
    };

    // ==========================================================
    // REPLACE SONG (swap one song for another, same singer -
    // the array length never changes, so no 5-song conflict)
    // ==========================================================

    const openReplaceModal = row => {
        setReplaceRow(row);
        setReplaceQuery("");
        setReplaceResults([]);
        setReplaceError("");
        setShowReplaceModal(true);
    };

    const closeReplaceModal = () => {
        if (replaceSaving) {
            return;
        }

        setShowReplaceModal(false);
        setReplaceRow(null);
    };

    const runReplaceSearch = async event => {
        event.preventDefault();

        const query = replaceQuery.trim();

        if (!query) {
            return;
        }

        try {
            setReplaceSearching(true);
            setReplaceError("");

            const results = await searchSongCatalog(query);
            setReplaceResults(results.map(normalizeSearchResult));
        }
        catch (requestError) {
            console.error("Replace search error:", requestError);
            setReplaceResults([]);
            setReplaceError(
                requestError.message ||
                "Unable to search songs."
            );
        }
        finally {
            setReplaceSearching(false);
        }
    };

    const chooseReplacement = async result => {
        if (!replaceRow) {
            return;
        }

        setReplaceSaving(true);
        setReplaceError("");

        try {
            const songResult = await createSong({
                title: result.title,
                movie: result.movie || null,
                music_director: result.artist || null,
                thumbnail: result.thumbnail || "",
                provider: result.provider || "YouTube",
                karaoke_available: true,
                difficulty: "Medium",
                male_singers: [],
                female_singers: [],
                event_id: replaceRow.event_id
            });

            if (!songResult.song?.id) {
                throw new Error(`Unable to save song "${result.title}".`);
            }

            await replaceSongInPayment(
                replaceRow.payment_id,
                replaceRow.song_id,
                songResult.song.id
            );

            setShowReplaceModal(false);
            setReplaceRow(null);
            await loadSelectedSongs();
        }
        catch (requestError) {
            console.error("Replace song error:", requestError);
            setReplaceError(
                requestError.message ||
                "Unable to replace this song."
            );
        }
        finally {
            setReplaceSaving(false);
        }
    };

    // ==========================================================
    // REASSIGN SONG TO A DIFFERENT SINGER
    // ==========================================================

    const openReassignModal = row => {
        setReassignRow(row);
        setReassignTargetId("");
        setReassignError("");
        setShowReassignModal(true);
    };

    const closeReassignModal = () => {
        if (reassignSaving) {
            return;
        }

        setShowReassignModal(false);
        setReassignRow(null);
    };

    const submitReassign = async () => {
        if (!reassignRow || !reassignTargetId) {
            setReassignError("Please choose a singer.");
            return;
        }

        setReassignSaving(true);
        setReassignError("");

        try {
            await reassignSongToSinger(
                reassignRow.song_id,
                reassignRow.singer_id,
                reassignTargetId,
                reassignRow.event_id
            );

            setShowReassignModal(false);
            setReassignRow(null);
            await loadSelectedSongs();
        }
        catch (requestError) {
            console.error("Reassign song error:", requestError);
            setReassignError(
                requestError.message ||
                "Unable to reassign this song."
            );
        }
        finally {
            setReassignSaving(false);
        }
    };

    // Other singers already registered for the SAME event as the
    // row being reassigned - mirrors the Pairing/Payments pages'
    // event-scoped dropdown instead of the full global roster.
    const reassignTargetOptions = useMemo(() => {
        if (!reassignRow) {
            return [];
        }

        const seen = new Map();

        selectedSongRows
            .filter(row =>
                row.event_id === reassignRow.event_id &&
                row.singer_id !== reassignRow.singer_id
            )
            .forEach(row => {
                if (!seen.has(row.singer_id)) {
                    seen.set(row.singer_id, row.singer_name);
                }
            });

        return [...seen.entries()].map(([singer_id, singer_name]) => ({ singer_id, singer_name }));
    }, [selectedSongRows, reassignRow]);

    // ==========================================================
    // ADD NEW SONG (a new row - a brand-new singer for this event,
    // or one more song for a singer who has fewer than 5)
    // ==========================================================

    const openAddModal = () => {
        setShowAddModal(true);
        setSingerSearch("");
        setAddSingerId("");
        setAddQuery("");
        setAddResults([]);
        setAddError("");
    };

    const closeAddModal = () => {
        if (addSaving) {
            return;
        }

        setShowAddModal(false);
    };

    const runAddSearch = async event => {
        event.preventDefault();

        const query = addQuery.trim();

        if (!query) {
            return;
        }

        try {
            setAddSearching(true);
            setAddError("");

            const results = await searchSongCatalog(query);
            setAddResults(results.map(normalizeSearchResult));
        }
        catch (requestError) {
            console.error("Add search error:", requestError);
            setAddResults([]);
            setAddError(
                requestError.message ||
                "Unable to search songs."
            );
        }
        finally {
            setAddSearching(false);
        }
    };

    const filteredSingerRoster = useMemo(() => {
        const searchText = singerSearch.toLowerCase().trim();

        if (!searchText) {
            return singerRoster;
        }

        return singerRoster.filter(singer =>
            (singer.singer_name || "").toLowerCase().includes(searchText) ||
            (singer.mobile_number || "").includes(searchText)
        );
    }, [singerRoster, singerSearch]);

    const chooseNewSong = async result => {
        if (!addSingerId) {
            setAddError("Please select a singer first.");
            return;
        }

        setAddSaving(true);
        setAddError("");

        try {
            const activeEvent = selectedEventIds.length > 0
                ? null
                : await getActiveEvent();

            const targetEventId = selectedEventIds[0] || activeEvent?.event?.id || null;

            const songResult = await createSong({
                title: result.title,
                movie: result.movie || null,
                music_director: result.artist || null,
                thumbnail: result.thumbnail || "",
                provider: result.provider || "YouTube",
                karaoke_available: true,
                difficulty: "Medium",
                male_singers: [],
                female_singers: [],
                event_id: targetEventId
            });

            if (!songResult.song?.id) {
                throw new Error(`Unable to save song "${result.title}".`);
            }

            const existingRows = selectedSongRows.filter(row =>
                row.singer_id === addSingerId &&
                row.event_id === targetEventId
            );

            if (existingRows.length === 0) {
                await createPayment(addSingerId, [songResult.song.id]);
            }
            else if (existingRows.length >= 5) {
                throw new Error("This singer already has 5 songs - use Replace instead.");
            }
            else {
                await addSongToPayment(existingRows[0].payment_id, songResult.song.id);
            }

            setShowAddModal(false);
            await loadSelectedSongs();
        }
        catch (requestError) {
            console.error("Add song error:", requestError);
            setAddError(
                requestError.message ||
                "Unable to add this song."
            );
        }
        finally {
            setAddSaving(false);
        }
    };

    // ==========================================================
    // RENDER
    // ==========================================================

    return (
        <div className="admin-shell">
            <AdminTopbar />

            <section className="song-management">
            <div className="song-hero">
                <div className="song-hero-art">🎵</div>
                <div className="song-hero-text">
                    <span className="admin-section-label">🎤 SINGER SELECTIONS</span>
                    <h1>Song Selections</h1>
                    <p>Every song singers have picked, scoped to the event below — edit, replace or reassign any pick.</p>
                </div>
            </div>

            <div className="song-selected-section">
                <div className="admin-dashboard-event-row song-selected-toolbar">
                    <EventSelector
                        events={events}
                        selectedIds={selectedEventIds}
                        onChange={setSelectedEventIds}
                    />

                    <button type="button" className="add-song-btn" onClick={openAddModal}>
                        ＋ Add New Song
                    </button>
                </div>

                {selectedError && (
                    <div className="empty-table" style={{ color: "#ff6b6b", marginBottom: "20px" }}>
                        ⚠️ {selectedError}
                    </div>
                )}

                <div className="song-table-container">
                    <table className="song-table">
                        <thead>
                            <tr>
                                <th>Song</th>
                                <th>Singer</th>
                                <th>Gender</th>
                                <th>Event</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loadingSelected ? (
                                <tr>
                                    <td colSpan="5" className="empty-table">
                                        <strong>Loading selections...</strong>
                                    </td>
                                </tr>
                            ) : selectedSongRows.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-table">
                                        🎤
                                        <strong>No songs selected yet</strong>
                                        <span>Nothing selected for the chosen event(s) so far.</span>
                                    </td>
                                </tr>
                            ) : (
                                selectedSongRows.map((row, index) => (
                                    <tr key={`${row.singer_id}-${row.song_id}-${index}`}>
                                        <td>
                                            <div className="song-title-cell">
                                                <div className="table-song-icon">🎵</div>
                                                <strong>{row.song_title}</strong>
                                            </div>
                                        </td>
                                        <td>{row.singer_name}</td>
                                        <td>{row.gender || "—"}</td>
                                        <td>{row.event_name || "—"}</td>
                                        <td>
                                            <div className="table-actions">
                                                <button
                                                    type="button"
                                                    className="edit-btn"
                                                    title="Edit song details"
                                                    onClick={() => openEditForm(row.song_id)}
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    type="button"
                                                    className="edit-btn"
                                                    title="Replace with a different song"
                                                    onClick={() => openReplaceModal(row)}
                                                >
                                                    🔁
                                                </button>
                                                <button
                                                    type="button"
                                                    className="edit-btn"
                                                    title="Reassign to a different singer"
                                                    onClick={() => openReassignModal(row)}
                                                >
                                                    👤
                                                </button>
                                                <button
                                                    type="button"
                                                    className="delete-btn"
                                                    title="Remove from this singer's selection"
                                                    onClick={() => handleDeleteSelectedSong(row)}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showForm && (
                <div className="song-modal-overlay">
                    <div className="song-modal">
                        <div className="modal-header">
                            <div>
                                <span>🎵</span>
                                <h2>Edit Song</h2>
                            </div>
                            <button type="button" className="modal-close" onClick={closeForm}>✕</button>
                        </div>

                        {formError && (
                            <div className="empty-table" style={{ color: "#ff6b6b", marginBottom: "14px" }}>
                                ⚠️ {formError}
                            </div>
                        )}

                        <form onSubmit={saveSong}>
                            <div className="form-group">
                                <label>Song Name</label>
                                <input
                                    type="text"
                                    name="title"
                                    placeholder="Enter song name"
                                    value={formData.title}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group">
                                <label>Music Director</label>
                                <input
                                    type="text"
                                    name="music_director"
                                    placeholder="Enter music director"
                                    value={formData.music_director}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group">
                                <label>Movie</label>
                                <input
                                    type="text"
                                    name="movie"
                                    placeholder="Enter movie name (optional)"
                                    value={formData.movie}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Language</label>
                                    <select name="language" value={formData.language} onChange={handleChange}>
                                        <option value="Tamil">Tamil</option>
                                        <option value="Telugu">Telugu</option>
                                        <option value="Malayalam">Malayalam</option>
                                        <option value="Kannada">Kannada</option>
                                        <option value="Hindi">Hindi</option>
                                        <option value="English">English</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Difficulty</label>
                                    <select name="difficulty" value={formData.difficulty} onChange={handleChange}>
                                        <option value="Easy">Easy</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Hard">Hard</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Type</label>
                                <select name="song_type" value={formData.song_type} onChange={handleChange}>
                                    {SONG_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Original Male Singer(s) <small>(optional)</small></label>
                                <input
                                    type="text"
                                    name="male_singers"
                                    placeholder="e.g. Sid Sriram, Karthik (comma-separated)"
                                    value={formData.male_singers}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group">
                                <label>Original Female Singer(s) <small>(optional)</small></label>
                                <input
                                    type="text"
                                    name="female_singers"
                                    placeholder="e.g. Shreya Ghoshal (comma-separated)"
                                    value={formData.female_singers}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="karaoke_available"
                                            checked={formData.karaoke_available}
                                            onChange={handleChange}
                                            style={{ marginRight: "8px" }}
                                        />
                                        Karaoke Available
                                    </label>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={closeForm} disabled={saving}>
                                    Cancel
                                </button>
                                <button type="submit" className="save-song-btn" disabled={saving}>
                                    {saving ? "Saving..." : "Update Song"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showReplaceModal && replaceRow && (
                <div className="song-modal-overlay">
                    <div className="song-modal assign-song-modal">
                        <div className="modal-header">
                            <div>
                                <span>🔁</span>
                                <h2>Replace Song</h2>
                            </div>
                            <button type="button" className="modal-close" onClick={closeReplaceModal}>✕</button>
                        </div>

                        <div className="assign-modal-body">
                            <p className="song-assign-hint">
                                Replacing <strong>{replaceRow.song_title}</strong> for <strong>{replaceRow.singer_name}</strong>.
                                The rest of their songs stay the same.
                            </p>

                            {replaceError && (
                                <div className="empty-table" style={{ color: "#ff6b6b", marginBottom: "14px" }}>
                                    ⚠️ {replaceError}
                                </div>
                            )}

                            <form className="assign-search-row" onSubmit={runReplaceSearch}>
                                <div className="admin-song-search">
                                    <span>🔎</span>
                                    <input
                                        type="text"
                                        placeholder="Search for the replacement song..."
                                        value={replaceQuery}
                                        onChange={event => setReplaceQuery(event.target.value)}
                                    />
                                </div>

                                <button type="submit" className="save-song-btn" disabled={replaceSearching}>
                                    {replaceSearching ? "Searching..." : "Search"}
                                </button>
                            </form>

                            {replaceResults.length > 0 && (
                                <div className="assign-results-list">
                                    {replaceResults.map(result => (
                                        <div key={result.id} className="assign-result-row">
                                            <span>{result.title}{result.artist ? ` — ${result.artist}` : ""}</span>
                                            <button
                                                type="button"
                                                className="add-song-btn"
                                                disabled={replaceSaving}
                                                onClick={() => chooseReplacement(result)}
                                            >
                                                {replaceSaving ? "Saving..." : "Use This"}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="cancel-btn" onClick={closeReplaceModal} disabled={replaceSaving}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showReassignModal && reassignRow && (
                <div className="song-modal-overlay">
                    <div className="song-modal">
                        <div className="modal-header">
                            <div>
                                <span>👤</span>
                                <h2>Reassign Song</h2>
                            </div>
                            <button type="button" className="modal-close" onClick={closeReassignModal}>✕</button>
                        </div>

                        <p className="song-assign-hint">
                            Moving <strong>{reassignRow.song_title}</strong> from <strong>{reassignRow.singer_name}</strong> to
                            another singer registered for {reassignRow.event_name || "this event"}.
                        </p>

                        {reassignError && (
                            <div className="empty-table" style={{ color: "#ff6b6b", marginBottom: "14px" }}>
                                ⚠️ {reassignError}
                            </div>
                        )}

                        <div className="form-group">
                            <label>Move to Singer</label>
                            <select
                                value={reassignTargetId}
                                onChange={event => setReassignTargetId(event.target.value)}
                            >
                                <option value="">Select a singer...</option>
                                {reassignTargetOptions.map(option => (
                                    <option key={option.singer_id} value={option.singer_id}>
                                        {option.singer_name}
                                    </option>
                                ))}
                            </select>

                            {reassignTargetOptions.length === 0 && (
                                <small>No other singers registered for this event yet.</small>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="cancel-btn" onClick={closeReassignModal} disabled={reassignSaving}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="save-song-btn"
                                onClick={submitReassign}
                                disabled={reassignSaving || !reassignTargetId}
                            >
                                {reassignSaving ? "Reassigning..." : "Reassign"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="song-modal-overlay">
                    <div className="song-modal assign-song-modal">
                        <div className="modal-header">
                            <div>
                                <span>🎵</span>
                                <h2>Add New Song</h2>
                            </div>
                            <button type="button" className="modal-close" onClick={closeAddModal}>✕</button>
                        </div>

                        <div className="assign-modal-body">
                            {addError && (
                                <div className="empty-table" style={{ color: "#ff6b6b", marginBottom: "14px" }}>
                                    ⚠️ {addError}
                                </div>
                            )}

                            <div className="form-group">
                                <label>Singer</label>
                                <input
                                    type="text"
                                    placeholder="Search singer by name or mobile..."
                                    value={singerSearch}
                                    onChange={event => setSingerSearch(event.target.value)}
                                />

                                <select
                                    value={addSingerId}
                                    onChange={event => setAddSingerId(event.target.value)}
                                    style={{ marginTop: "10px" }}
                                >
                                    <option value="">Select a singer...</option>
                                    {filteredSingerRoster.map(singer => (
                                        <option key={singer.id} value={singer.id}>
                                            {singer.singer_name} — {singer.mobile_number}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <form className="assign-search-row" onSubmit={runAddSearch}>
                                <div className="admin-song-search">
                                    <span>🔎</span>
                                    <input
                                        type="text"
                                        placeholder="Search song, singer or movie..."
                                        value={addQuery}
                                        onChange={event => setAddQuery(event.target.value)}
                                    />
                                </div>

                                <button type="submit" className="save-song-btn" disabled={addSearching}>
                                    {addSearching ? "Searching..." : "Search"}
                                </button>
                            </form>

                            {addResults.length > 0 && (
                                <div className="assign-results-list">
                                    {addResults.map(result => (
                                        <div key={result.id} className="assign-result-row">
                                            <span>{result.title}{result.artist ? ` — ${result.artist}` : ""}</span>
                                            <button
                                                type="button"
                                                className="add-song-btn"
                                                disabled={addSaving || !addSingerId}
                                                onClick={() => chooseNewSong(result)}
                                            >
                                                {addSaving ? "Saving..." : "Use This"}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="cancel-btn" onClick={closeAddModal} disabled={addSaving}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </section>
        </div>
    );
}

export default SongManagement;
