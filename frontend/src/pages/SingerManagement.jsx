import { useCallback, useEffect, useMemo, useState } from "react";

import AdminTopbar from "../components/admin/AdminTopbar";
import EventSelector from "../components/admin/EventSelector";
import ExcelToolbar from "../components/admin/ExcelToolbar";
import { getAllSingers, getFinalPairingList, bulkUpdateSingers } from "../services/adminDashboardService";
import { getEvents } from "../services/eventService";

import "../styles/adminTheme.css";
import "./SingerManagement.css";

const SINGER_COLUMNS = [
    { key: "id", header: "ID", width: 38 },
    { key: "singer_name", header: "Singer Name", width: 26 },
    { key: "gender", header: "Gender", width: 12 },
    { key: "date_of_birth", header: "Date of Birth (YYYY-MM-DD)", width: 24 },
    { key: "mobile_number", header: "Mobile Number", width: 18 },
    // Reference only - ignored when the file is uploaded again
    { key: "songs", header: "Songs (from Final List - not imported)", width: 70 }
];

const formatDate = value => {
    if (!value) {
        return "—";
    }

    try {
        return new Date(value).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }
    catch {
        return value;
    }
};

const getGenderClass = gender => {
    const normalized = String(gender || "").trim().toLowerCase();

    if (normalized === "male") return "male";
    if (normalized === "female") return "female";
    return "other";
};

function SingerManagement() {

    const [singers, setSingers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    // Event scope - the singers table itself has no event_id (a
    // singer's account is shared across every event), so "enrolled
    // for this event" is derived from who has a payment for it.
    const [events, setEvents] = useState([]);
    const [selectedEventIds, setSelectedEventIds] = useState([]);
    const [enrolledIds, setEnrolledIds] = useState(null);
    const [enrolledLoading, setEnrolledLoading] = useState(false);
    const [songsBySinger, setSongsBySinger] = useState(() => new Map());

    const loadSingers = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const result = await getAllSingers();

            setSingers(result.singers || []);
        }
        catch (requestError) {
            console.error("Load singers error:", requestError);
            setError(
                requestError.message ||
                "Unable to load singers."
            );
        }
        finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSingers();
    }, [loadSingers]);

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

            });

    }, []);

    // Who's in the selected event(s) and their songs, from each
    // event's Final List: registered (paid / pending), added to the
    // event (walk-ins, uploaded list) or on the list itself.
    useEffect(() => {

        if (selectedEventIds.length === 0) {
            setEnrolledIds(null);
            setSongsBySinger(new Map());
            return undefined;
        }

        let alive = true;
        setEnrolledLoading(true);

        Promise.all(selectedEventIds.map(id => getFinalPairingList(id)))
            .then(results => {

                if (!alive) return;

                const ids = new Set();
                const songs = new Map();
                const many = results.length > 1;

                results.forEach(result => {

                    const nameById = new Map((result.singers || []).map(singer => [singer.id, singer.singer_name]));

                    (result.singers || []).forEach(singer => {
                        if (singer.in_event) ids.add(singer.id);
                    });

                    (result.rows || []).forEach(row => {
                        const pair = [row.male_singer_id, row.female_singer_id].filter(Boolean);
                        pair.forEach(id => {
                            ids.add(id);
                            const partnerId = pair.find(other => other !== id);
                            if (!songs.has(id)) songs.set(id, []);
                            songs.get(id).push({
                                title: row.song_title,
                                movie: row.movie,
                                partner: partnerId ? nameById.get(partnerId) || "" : "",
                                event: many ? result.event_name : ""
                            });
                        });
                    });

                });

                setEnrolledIds(ids);
                setSongsBySinger(songs);

            })
            .catch(requestError => {

                console.error("Load event singers error:", requestError);
                if (alive) {
                    setEnrolledIds(new Set());
                    setSongsBySinger(new Map());
                }

            })
            .finally(() => {

                if (alive) setEnrolledLoading(false);

            });

        return () => {
            alive = false;
        };

    }, [selectedEventIds]);

    const songText = song =>
        `${song.title}${song.partner ? ` (with ${song.partner})` : " (solo)"}${song.event ? ` - ${song.event}` : ""}`;

    const filteredSingers = useMemo(() => {
        const query = search.trim().toLowerCase();

        return singers.filter(singer => {

            const matchesSearch =
                !query ||
                (singer.singer_name || "").toLowerCase().includes(query) ||
                (singer.mobile_number || "").includes(query);

            const matchesEvent =
                !enrolledIds ||
                enrolledIds.has(singer.id);

            return matchesSearch && matchesEvent;

        });
    }, [singers, search, enrolledIds]);

    // ------------------------------------------------------
    // INLINE EDIT - mobile number and date of birth
    // ------------------------------------------------------

    const [editing, setEditing] = useState(null);   // { id, mobile, dob }
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState("");
    const [editNotice, setEditNotice] = useState("");

    const startEdit = singer => {
        setEditError("");
        setEditNotice("");
        setEditing({
            id: singer.id,
            mobile: singer.mobile_number || "",
            dob: String(singer.date_of_birth || "").slice(0, 10)
        });
    };

    const saveEdit = async () => {

        const mobile = editing.mobile.replace(/\D/g, "").slice(-10);

        if (!/^\d{10}$/.test(mobile)) {
            setEditError("Mobile number must have 10 digits.");
            return;
        }

        if (!editing.dob) {
            setEditError("Pick a date of birth.");
            return;
        }

        setEditSaving(true);
        setEditError("");

        try {
            const response = await bulkUpdateSingers([
                { id: editing.id, mobile_number: mobile, date_of_birth: editing.dob }
            ]);
            const result = (response.results || [])[0];

            if (!result || result.status !== "updated") {
                setEditError(result?.message || "Couldn't save the changes.");
                return;
            }

            setSingers(current => current.map(singer =>
                singer.id === editing.id
                    ? { ...singer, mobile_number: mobile, date_of_birth: editing.dob }
                    : singer
            ));
            setEditNotice(result.message);
            setEditing(null);
        }
        catch (requestError) {
            setEditError(requestError.message || "Couldn't save the changes.");
        }
        finally {
            setEditSaving(false);
        }

    };

    const onEditKey = event => {
        if (event.key === "Enter") saveEdit();
        if (event.key === "Escape") setEditing(null);
    };

    const handleImportRows = async parsedRows => {

        const rows = parsedRows.map(row => ({
            id: row.id,
            singer_name: row.singer_name,
            gender: row.gender,
            date_of_birth: row.date_of_birth,
            mobile_number: row.mobile_number
        }));

        const response = await bulkUpdateSingers(rows);

        await loadSingers();

        return { message: response.message };

    };

    return (
        <div className="admin-shell">
            <AdminTopbar />

            <div className="admin-shell-content">
                <h1 className="admin-page-title">Singers</h1>
                <p className="admin-page-subtitle">
                    Full roster of registered singers - filter by event to see who's enrolled where.
                </p>

                <div className="admin-dashboard-event-row">
                    <EventSelector
                        events={events}
                        selectedIds={selectedEventIds}
                        onChange={setSelectedEventIds}
                    />
                </div>

                <ExcelToolbar
                    columns={SINGER_COLUMNS}
                    rows={filteredSingers.map(singer => ({
                        ...singer,
                        songs: (songsBySinger.get(singer.id) || []).map(songText).join("; ")
                    }))}
                    filename="beats-infinity-singers"
                    onImportRows={handleImportRows}
                    hint="Export, edit Name/Gender/Date of Birth/Mobile Number, then re-upload the same file to bulk-update. Leave the ID column untouched - it's how each row is matched."
                />

                {error && <div className="singer-mgmt-error">⚠️ {error}</div>}
                {editNotice && <div className="singer-mgmt-notice">✅ {editNotice}</div>}

                <div className="singer-mgmt-toolbar">
                    <span className="singer-mgmt-count">
                        {enrolledLoading ? (
                            "Loading enrollment for selected event(s)..."
                        ) : enrolledIds ? (
                            <><strong>{filteredSingers.length}</strong> singer{filteredSingers.length === 1 ? "" : "s"} enrolled for the selected event(s)</>
                        ) : (
                            <><strong>{filteredSingers.length}</strong> of {singers.length} singers (all events)</>
                        )}
                    </span>

                    <input
                        type="text"
                        className="singer-mgmt-search"
                        placeholder="Search by name or mobile number..."
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                    />
                </div>

                {loading ? (
                    <div className="singer-mgmt-empty">Loading singers...</div>
                ) : filteredSingers.length === 0 ? (
                    <div className="singer-mgmt-empty">
                        {singers.length === 0
                            ? "No singers have registered yet."
                            : "No singers match your search."}
                    </div>
                ) : (
                    <div className="singer-mgmt-table-wrapper">
                        <table className="singer-mgmt-table">
                            <thead>
                                <tr>
                                    <th>Singer Name</th>
                                    <th>Gender</th>
                                    <th>Date of Birth</th>
                                    <th>Mobile Number</th>
                                    {enrolledIds && <th>Songs</th>}
                                    <th aria-label="Edit" />
                                </tr>
                            </thead>

                            <tbody>
                                {filteredSingers.map(singer => (
                                    <tr key={singer.id}>
                                        <td className="name-cell">{singer.singer_name}</td>
                                        <td>
                                            <span className={`gender-pill ${getGenderClass(singer.gender)}`}>
                                                {singer.gender || "—"}
                                            </span>
                                        </td>
                                        {editing?.id === singer.id ? (
                                            <>
                                                <td>
                                                    <input
                                                        type="date"
                                                        className="singer-edit-input"
                                                        value={editing.dob}
                                                        max={new Date().toISOString().slice(0, 10)}
                                                        onChange={event => setEditing(current => ({ ...current, dob: event.target.value }))}
                                                        onKeyDown={onEditKey}
                                                        aria-label={`${singer.singer_name} date of birth`}
                                                        disabled={editSaving}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="tel"
                                                        inputMode="numeric"
                                                        className="singer-edit-input"
                                                        value={editing.mobile}
                                                        placeholder="10-digit mobile"
                                                        maxLength={14}
                                                        onChange={event => setEditing(current => ({ ...current, mobile: event.target.value }))}
                                                        onKeyDown={onEditKey}
                                                        aria-label={`${singer.singer_name} mobile number`}
                                                        disabled={editSaving}
                                                        autoFocus
                                                    />
                                                    {editError && <div className="singer-edit-error">{editError}</div>}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td>{formatDate(singer.date_of_birth)}</td>
                                                <td>
                                                    {singer.mobile_number || "—"}
                                                    {String(singer.mobile_number || "").startsWith("00000") && (
                                                        <span className="singer-temp-tag" title="Temporary number - replace with the real one">temporary</span>
                                                    )}
                                                </td>
                                            </>
                                        )}
                                        {enrolledIds && (
                                            <td className="songs-cell">
                                                {(songsBySinger.get(singer.id) || []).length === 0 ? (
                                                    <span className="songs-none">No songs on the Final List yet</span>
                                                ) : (
                                                    <ul>
                                                        {songsBySinger.get(singer.id).map((song, index) => (
                                                            <li key={`${song.title}-${index}`} title={songText(song)}>
                                                                <span>{song.title}</span>
                                                                <em>{song.partner ? `with ${song.partner}` : "solo"}{song.event ? ` · ${song.event}` : ""}</em>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </td>
                                        )}
                                        <td className="singer-edit-cell">
                                            {editing?.id === singer.id ? (
                                                <div className="singer-edit-actions">
                                                    <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={saveEdit} disabled={editSaving}>
                                                        {editSaving ? "Saving…" : "Save"}
                                                    </button>
                                                    <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setEditing(null)} disabled={editSaving}>
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="singer-edit-btn"
                                                    onClick={() => startEdit(singer)}
                                                    title="Edit mobile number and date of birth"
                                                    aria-label={`Edit ${singer.singer_name}`}
                                                    disabled={Boolean(editing)}
                                                >
                                                    ✏️
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SingerManagement;
