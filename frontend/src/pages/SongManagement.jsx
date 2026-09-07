import { useCallback, useEffect, useMemo, useState } from "react";

import AdminTopbar from "../components/admin/AdminTopbar";
import ExcelToolbar from "../components/admin/ExcelToolbar";
import { getSongs, createSong, updateSong, deleteSong, bulkUpsertSongs } from "../services/songService";

import "../styles/adminTheme.css";
import "./SongManagement.css";

const SONG_TYPES = ["Solo", "Duet", "Male Duet", "Female Duet"];

const SONG_COLUMNS = [
    { key: "id", header: "ID (leave blank to add a new song)", width: 38 },
    { key: "title", header: "Song Name", width: 30 },
    { key: "music_director", header: "Music Director", width: 22 },
    { key: "movie", header: "Movie", width: 22 },
    { key: "language", header: "Language", width: 14 },
    { key: "difficulty", header: "Difficulty", width: 12 },
    { key: "song_type", header: "Type (Solo/Duet/Male Duet/Female Duet)", width: 30 },
    { key: "male_singers", header: "Original Male Singer(s)", width: 26 },
    { key: "female_singers", header: "Original Female Singer(s)", width: 26 },
    { key: "karaoke_available", header: "Karaoke Available (TRUE/FALSE)", width: 24 }
];

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

// song_type is a directly admin-set field (not derived) - this
// is just a defensive fallback for any pre-existing row that
// predates the column.
const getSongType = song => song.song_type || "Solo";

const getTypeBadgeClass = type => {
    if (type === "Duet") return "table-badge duet";
    if (type === "Male Duet") return "table-badge male-duet";
    if (type === "Female Duet") return "table-badge female-duet";
    return "table-badge";
};

const parseNames = value =>
    value
        .split(",")
        .map(name => name.trim())
        .filter(Boolean);

function SongManagement() {

    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("All");

    const [showForm, setShowForm] = useState(false);
    const [editingSong, setEditingSong] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    // ==========================================================
    // LOAD SONGS
    // ==========================================================

    const loadSongs = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const result = await getSongs();

            setSongs(result.songs || []);
        }
        catch (requestError) {
            console.error("Load songs error:", requestError);
            setError(
                requestError.message ||
                "Unable to load songs."
            );
        }
        finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSongs();
    }, [loadSongs]);

    // ==========================================================
    // FORM HANDLING
    // ==========================================================

    const handleChange = event => {
        const { name, value, type, checked } = event.target;

        setFormData(current => ({
            ...current,
            [name]: type === "checkbox" ? checked : value
        }));
    };

    const openAddForm = () => {
        setEditingSong(null);
        setFormData(EMPTY_FORM);
        setShowForm(true);
    };

    const openEditForm = song => {
        setEditingSong(song);
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
    };

    const closeForm = () => {
        if (saving) {
            return;
        }

        setShowForm(false);
        setEditingSong(null);
    };

    const saveSong = async event => {
        event.preventDefault();

        if (!formData.title.trim()) {
            alert("Please enter the song name.");
            return;
        }

        setSaving(true);
        setError("");

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
            if (editingSong) {
                await updateSong(editingSong.id, payload);
            }
            else {
                await createSong(payload);
            }

            setShowForm(false);
            setEditingSong(null);
            await loadSongs();
        }
        catch (requestError) {
            console.error("Save song error:", requestError);
            setError(
                requestError.message ||
                "Unable to save song."
            );
        }
        finally {
            setSaving(false);
        }
    };

    const handleDelete = async songId => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this song from the catalog?"
        );

        if (!confirmed) {
            return;
        }

        try {
            await deleteSong(songId);
            await loadSongs();
        }
        catch (requestError) {
            console.error("Delete song error:", requestError);
            setError(
                requestError.message ||
                "Unable to delete song."
            );
        }
    };

    // ==========================================================
    // FILTER / SEARCH
    // ==========================================================

    const filteredSongs = useMemo(() => {
        const searchText = search.toLowerCase().trim();

        return songs.filter(song => {
            const matchesSearch =
                !searchText ||
                (song.title || "").toLowerCase().includes(searchText) ||
                (song.music_director || "").toLowerCase().includes(searchText);

            const matchesFilter =
                filter === "All" ||
                getSongType(song) === filter;

            return matchesSearch && matchesFilter;
        });
    }, [songs, search, filter]);

    const soloCount = songs.filter(song => getSongType(song) === "Solo").length;
    const duetCount = songs.filter(song => getSongType(song) !== "Solo").length;
    const karaokeCount = songs.filter(song => song.karaoke_available !== false).length;

    // ==========================================================
    // EXCEL EXPORT / IMPORT
    // ==========================================================

    const excelRows = useMemo(
        () => filteredSongs.map(song => ({
            id: song.id,
            title: song.title || "",
            music_director: song.music_director || "",
            movie: song.movie || "",
            language: song.language || "Tamil",
            difficulty: song.difficulty || "Medium",
            song_type: getSongType(song),
            male_singers: (song.male_singers || []).join(", "),
            female_singers: (song.female_singers || []).join(", "),
            karaoke_available: song.karaoke_available !== false ? "TRUE" : "FALSE"
        })),
        [filteredSongs]
    );

    const handleImportRows = async parsedRows => {

        const rows = parsedRows.map(row => ({
            id: row.id || undefined,
            title: row.title,
            music_director: row.music_director,
            movie: row.movie,
            language: row.language,
            difficulty: row.difficulty,
            song_type: row.song_type,
            male_singers: row.male_singers,
            female_singers: row.female_singers,
            karaoke_available: row.karaoke_available
        }));

        const response = await bulkUpsertSongs(rows);

        await loadSongs();

        return { message: response.message };

    };

    // ==========================================================
    // RENDER
    // ==========================================================

    return (
        <div className="admin-shell">
            <AdminTopbar />

            <section className="song-management">
            <div className="song-management-header">
                <div>
                    <span className="admin-section-label">🎵 SONG LIBRARY</span>
                    <h1>Song Management</h1>
                    <p>Manage the Beats ∞ Infinity song library</p>
                </div>

                <button type="button" className="add-song-btn" onClick={openAddForm}>
                    ＋ Add New Song
                </button>
            </div>

            {error && (
                <div className="empty-table" style={{ color: "#ff6b6b", marginBottom: "20px" }}>
                    ⚠️ {error}
                </div>
            )}

            <ExcelToolbar
                columns={SONG_COLUMNS}
                rows={excelRows}
                filename="beats-infinity-songs"
                onImportRows={handleImportRows}
                hint="Export, edit any field (or add new rows with the ID column blank), then re-upload the same file to bulk-save. Rows with a matching ID update that song; blank-ID rows create new songs."
            />

            <div className="song-summary">
                <div className="summary-card">
                    <span>🎵</span>
                    <div>
                        <strong>{songs.length}</strong>
                        <small>Total Songs</small>
                    </div>
                </div>

                <div className="summary-card">
                    <span>🎶</span>
                    <div>
                        <strong>{duetCount}</strong>
                        <small>Duet Songs</small>
                    </div>
                </div>

                <div className="summary-card">
                    <span>🎤</span>
                    <div>
                        <strong>{soloCount}</strong>
                        <small>Solo Songs</small>
                    </div>
                </div>

                <div className="summary-card">
                    <span>🎧</span>
                    <div>
                        <strong>{karaokeCount}</strong>
                        <small>Karaoke Available</small>
                    </div>
                </div>
            </div>

            <div className="song-toolbar">
                <div className="admin-song-search">
                    <span>🔎</span>
                    <input
                        type="text"
                        placeholder="Search song or music director..."
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                    />
                    {search && (
                        <button type="button" onClick={() => setSearch("")}>✕</button>
                    )}
                </div>

                <div className="admin-filters">
                    {["All", "Solo", "Duet", "Male Duet", "Female Duet"].map(item => (
                        <button
                            key={item}
                            type="button"
                            className={filter === item ? "admin-filter active" : "admin-filter"}
                            onClick={() => setFilter(item)}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </div>

            <div className="song-table-container">
                <table className="song-table">
                    <thead>
                        <tr>
                            <th>Song</th>
                            <th>Music Director</th>
                            <th>Movie</th>
                            <th>Language</th>
                            <th>Type</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="empty-table">
                                    <strong>Loading songs...</strong>
                                </td>
                            </tr>
                        ) : filteredSongs.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="empty-table">
                                    🎵
                                    <strong>No songs found</strong>
                                    <span>Try another search or filter.</span>
                                </td>
                            </tr>
                        ) : (
                            filteredSongs.map(song => (
                                <tr key={song.id}>
                                    <td>
                                        <div className="song-title-cell">
                                            <div className="table-song-icon">🎵</div>
                                            <strong>{song.title}</strong>
                                        </div>
                                    </td>
                                    <td>{song.music_director || "—"}</td>
                                    <td>{song.movie || "—"}</td>
                                    <td>{song.language || "—"}</td>
                                    <td>
                                        <span className={getTypeBadgeClass(getSongType(song))}>
                                            {getSongType(song)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="table-actions">
                                            <button
                                                type="button"
                                                className="edit-btn"
                                                onClick={() => openEditForm(song)}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                type="button"
                                                className="delete-btn"
                                                onClick={() => handleDelete(song.id)}
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

            {showForm && (
                <div className="song-modal-overlay">
                    <div className="song-modal">
                        <div className="modal-header">
                            <div>
                                <span>🎵</span>
                                <h2>{editingSong ? "Edit Song" : "Add New Song"}</h2>
                            </div>
                            <button type="button" className="modal-close" onClick={closeForm}>✕</button>
                        </div>

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
                                    {saving ? "Saving..." : editingSong ? "Update Song" : "Save Song"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </section>
        </div>
    );
}

export default SongManagement;
