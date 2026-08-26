import { useMemo, useState } from "react";
import "./SongManagement.css";

function SongManagement() {

    // ==========================================================
    // SAMPLE SONG LIBRARY
    // Later this will come from the database
    // ==========================================================

    const [songs, setSongs] = useState([
        {
            id: 1,
            title: "Song Name One",
            artist: "Artist Name",
            gender: "Male",
            language: "Tamil",
            category: "Melody",
            status: "Active"
        },
        {
            id: 2,
            title: "Song Name Two",
            artist: "Artist Name",
            gender: "Female",
            language: "Tamil",
            category: "Melody",
            status: "Active"
        },
        {
            id: 3,
            title: "Song Name Three",
            artist: "Artist Name",
            gender: "Duet",
            language: "Tamil",
            category: "Duet",
            status: "Active"
        }
    ]);

    // ==========================================================
    // STATES
    // ==========================================================

    const [search, setSearch] = useState("");

    const [filter, setFilter] = useState("All");

    const [showForm, setShowForm] = useState(false);

    const [editingSong, setEditingSong] = useState(null);

    const [formData, setFormData] = useState({
        title: "",
        artist: "",
        gender: "Male",
        language: "Tamil",
        category: "Melody",
        status: "Active"
    });

    // ==========================================================
    // FORM CHANGE
    // ==========================================================

    const handleChange = (event) => {

        const { name, value } = event.target;

        setFormData((current) => ({
            ...current,
            [name]: value
        }));

    };

    // ==========================================================
    // OPEN ADD FORM
    // ==========================================================

    const openAddForm = () => {

        setEditingSong(null);

        setFormData({
            title: "",
            artist: "",
            gender: "Male",
            language: "Tamil",
            category: "Melody",
            status: "Active"
        });

        setShowForm(true);

    };

    // ==========================================================
    // OPEN EDIT FORM
    // ==========================================================

    const openEditForm = (song) => {

        setEditingSong(song);

        setFormData({
            title: song.title,
            artist: song.artist,
            gender: song.gender,
            language: song.language,
            category: song.category,
            status: song.status
        });

        setShowForm(true);

    };

    // ==========================================================
    // SAVE SONG
    // ==========================================================

    const saveSong = (event) => {

        event.preventDefault();

        if (!formData.title.trim()) {

            alert("Please enter the song name.");

            return;

        }

        if (!formData.artist.trim()) {

            alert("Please enter the artist name.");

            return;

        }

        // EDIT EXISTING SONG

        if (editingSong) {

            setSongs((currentSongs) =>
                currentSongs.map((song) =>
                    song.id === editingSong.id
                        ? {
                            ...song,
                            ...formData
                        }
                        : song
                )
            );

            alert("Song updated successfully.");

        }

        // ADD NEW SONG

        else {

            const newSong = {

                id: Date.now(),

                ...formData

            };

            setSongs((currentSongs) => [

                ...currentSongs,

                newSong

            ]);

            alert("Song added successfully.");

        }

        setShowForm(false);

        setEditingSong(null);

    };

    // ==========================================================
    // DELETE SONG
    // ==========================================================

    const deleteSong = (songId) => {

        const confirmDelete = window.confirm(
            "Are you sure you want to delete this song?"
        );

        if (!confirmDelete) {

            return;

        }

        setSongs((currentSongs) =>
            currentSongs.filter(
                (song) => song.id !== songId
            )
        );

    };

    // ==========================================================
    // FILTER SONGS
    // ==========================================================

    const filteredSongs = useMemo(() => {

        const searchText = search
            .toLowerCase()
            .trim();

        return songs.filter((song) => {

            const matchesSearch =

                song.title
                    .toLowerCase()
                    .includes(searchText)

                ||

                song.artist
                    .toLowerCase()
                    .includes(searchText);

            let matchesFilter = true;

            if (filter === "Male") {

                matchesFilter =
                    song.gender === "Male";

            }

            if (filter === "Female") {

                matchesFilter =
                    song.gender === "Female";

            }

            if (filter === "Duet") {

                matchesFilter =
                    song.gender === "Duet";

            }

            if (filter === "Active") {

                matchesFilter =
                    song.status === "Active";

            }

            if (filter === "Inactive") {

                matchesFilter =
                    song.status === "Inactive";

            }

            return (
                matchesSearch &&
                matchesFilter
            );

        });

    }, [songs, search, filter]);

    // ==========================================================
    // CLOSE FORM
    // ==========================================================

    const closeForm = () => {

        setShowForm(false);

        setEditingSong(null);

    };

    // ==========================================================
    // RENDER
    // ==========================================================

    return (

        <section className="song-management">

            {/* ==================================================
                HEADER
            ================================================== */}

            <div className="song-management-header">

                <div>

                    <span className="admin-section-label">

                        🎵 SONG LIBRARY

                    </span>

                    <h1>

                        Song Management

                    </h1>

                    <p>

                        Manage the Beats ∞ Infinity song library

                    </p>

                </div>

                <button
                    type="button"
                    className="add-song-btn"
                    onClick={openAddForm}
                >

                    ＋ Add New Song

                </button>

            </div>


            {/* ==================================================
                SUMMARY
            ================================================== */}

            <div className="song-summary">

                <div className="summary-card">

                    <span>🎵</span>

                    <div>

                        <strong>
                            {songs.length}
                        </strong>

                        <small>
                            Total Songs
                        </small>

                    </div>

                </div>


                <div className="summary-card">

                    <span>🟢</span>

                    <div>

                        <strong>
                            {
                                songs.filter(
                                    (song) =>
                                        song.status === "Active"
                                ).length
                            }
                        </strong>

                        <small>
                            Active Songs
                        </small>

                    </div>

                </div>


                <div className="summary-card">

                    <span>🎤</span>

                    <div>

                        <strong>
                            {
                                songs.filter(
                                    (song) =>
                                        song.gender === "Male"
                                ).length
                            }
                        </strong>

                        <small>
                            Male Songs
                        </small>

                    </div>

                </div>


                <div className="summary-card">

                    <span>🎶</span>

                    <div>

                        <strong>
                            {
                                songs.filter(
                                    (song) =>
                                        song.gender === "Duet"
                                ).length
                            }
                        </strong>

                        <small>
                            Duet Songs
                        </small>

                    </div>

                </div>

            </div>


            {/* ==================================================
                SEARCH & FILTER
            ================================================== */}

            <div className="song-toolbar">

                <div className="admin-song-search">

                    <span>

                        🔎

                    </span>

                    <input

                        type="text"

                        placeholder="Search song or artist..."

                        value={search}

                        onChange={(event) =>
                            setSearch(event.target.value)
                        }

                    />

                    {search && (

                        <button

                            type="button"

                            onClick={() =>
                                setSearch("")
                            }

                        >

                            ✕

                        </button>

                    )}

                </div>


                <div className="admin-filters">

                    {[
                        "All",
                        "Active",
                        "Inactive",
                        "Male",
                        "Female",
                        "Duet"
                    ].map((item) => (

                        <button

                            key={item}

                            type="button"

                            className={
                                filter === item
                                    ? "admin-filter active"
                                    : "admin-filter"
                            }

                            onClick={() =>
                                setFilter(item)
                            }

                        >

                            {item}

                        </button>

                    ))}

                </div>

            </div>


            {/* ==================================================
                SONG TABLE
            ================================================== */}

            <div className="song-table-container">

                <table className="song-table">

                    <thead>

                        <tr>

                            <th>
                                Song
                            </th>

                            <th>
                                Artist
                            </th>

                            <th>
                                Type
                            </th>

                            <th>
                                Language
                            </th>

                            <th>
                                Category
                            </th>

                            <th>
                                Status
                            </th>

                            <th>
                                Actions
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        {filteredSongs.length === 0 ? (

                            <tr>

                                <td
                                    colSpan="7"
                                    className="empty-table"
                                >

                                    🎵

                                    <strong>
                                        No songs found
                                    </strong>

                                    <span>
                                        Try another search or filter.
                                    </span>

                                </td>

                            </tr>

                        ) : (

                            filteredSongs.map((song) => (

                                <tr key={song.id}>

                                    <td>

                                        <div className="song-title-cell">

                                            <div className="table-song-icon">

                                                🎵

                                            </div>

                                            <strong>

                                                {song.title}

                                            </strong>

                                        </div>

                                    </td>


                                    <td>

                                        {song.artist}

                                    </td>


                                    <td>

                                        <span
                                            className={
                                                song.gender === "Duet"
                                                    ? "table-badge duet"
                                                    : "table-badge"
                                            }
                                        >

                                            {song.gender}

                                        </span>

                                    </td>


                                    <td>

                                        {song.language}

                                    </td>


                                    <td>

                                        {song.category}

                                    </td>


                                    <td>

                                        <span
                                            className={
                                                song.status === "Active"
                                                    ? "status-badge active"
                                                    : "status-badge inactive"
                                            }
                                        >

                                            {song.status}

                                        </span>

                                    </td>


                                    <td>

                                        <div className="table-actions">

                                            <button

                                                type="button"

                                                className="edit-btn"

                                                onClick={() =>
                                                    openEditForm(song)
                                                }

                                            >

                                                ✏️

                                            </button>


                                            <button

                                                type="button"

                                                className="delete-btn"

                                                onClick={() =>
                                                    deleteSong(song.id)
                                                }

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


            {/* ==================================================
                ADD / EDIT MODAL
            ================================================== */}

            {showForm && (

                <div className="song-modal-overlay">

                    <div className="song-modal">

                        <div className="modal-header">

                            <div>

                                <span>
                                    🎵
                                </span>

                                <h2>

                                    {
                                        editingSong
                                            ? "Edit Song"
                                            : "Add New Song"
                                    }

                                </h2>

                            </div>

                            <button

                                type="button"

                                className="modal-close"

                                onClick={closeForm}

                            >

                                ✕

                            </button>

                        </div>


                        <form onSubmit={saveSong}>


                            {/* SONG NAME */}

                            <div className="form-group">

                                <label>
                                    Song Name
                                </label>

                                <input

                                    type="text"

                                    name="title"

                                    placeholder="Enter song name"

                                    value={formData.title}

                                    onChange={handleChange}

                                />

                            </div>


                            {/* ARTIST */}

                            <div className="form-group">

                                <label>
                                    Artist / Singer
                                </label>

                                <input

                                    type="text"

                                    name="artist"

                                    placeholder="Enter artist name"

                                    value={formData.artist}

                                    onChange={handleChange}

                                />

                            </div>


                            {/* TYPE */}

                            <div className="form-row">

                                <div className="form-group">

                                    <label>
                                        Song Type
                                    </label>

                                    <select

                                        name="gender"

                                        value={formData.gender}

                                        onChange={handleChange}

                                    >

                                        <option value="Male">
                                            Male
                                        </option>

                                        <option value="Female">
                                            Female
                                        </option>

                                        <option value="Duet">
                                            Duet
                                        </option>

                                    </select>

                                </div>


                                {/* LANGUAGE */}

                                <div className="form-group">

                                    <label>
                                        Language
                                    </label>

                                    <select

                                        name="language"

                                        value={formData.language}

                                        onChange={handleChange}

                                    >

                                        <option value="Tamil">
                                            Tamil
                                        </option>

                                        <option value="Telugu">
                                            Telugu
                                        </option>

                                        <option value="Malayalam">
                                            Malayalam
                                        </option>

                                        <option value="Kannada">
                                            Kannada
                                        </option>

                                        <option value="Hindi">
                                            Hindi
                                        </option>

                                        <option value="English">
                                            English
                                        </option>

                                    </select>

                                </div>

                            </div>


                            {/* CATEGORY */}

                            <div className="form-row">

                                <div className="form-group">

                                    <label>
                                        Category
                                    </label>

                                    <select

                                        name="category"

                                        value={formData.category}

                                        onChange={handleChange}

                                    >

                                        <option value="Melody">
                                            Melody
                                        </option>

                                        <option value="Fast">
                                            Fast
                                        </option>

                                        <option value="Duet">
                                            Duet
                                        </option>

                                        <option value="Folk">
                                            Folk
                                        </option>

                                        <option value="Classical">
                                            Classical
                                        </option>

                                        <option value="Devotional">
                                            Devotional
                                        </option>

                                    </select>

                                </div>


                                {/* STATUS */}

                                <div className="form-group">

                                    <label>
                                        Status
                                    </label>

                                    <select

                                        name="status"

                                        value={formData.status}

                                        onChange={handleChange}

                                    >

                                        <option value="Active">
                                            Active
                                        </option>

                                        <option value="Inactive">
                                            Inactive
                                        </option>

                                    </select>

                                </div>

                            </div>


                            {/* ACTIONS */}

                            <div className="modal-actions">

                                <button

                                    type="button"

                                    className="cancel-btn"

                                    onClick={closeForm}

                                >

                                    Cancel

                                </button>


                                <button

                                    type="submit"

                                    className="save-song-btn"

                                >

                                    {
                                        editingSong
                                            ? "Update Song"
                                            : "Save Song"
                                    }

                                </button>

                            </div>

                        </form>

                    </div>

                </div>

            )}

        </section>

    );

}

export default SongManagement;