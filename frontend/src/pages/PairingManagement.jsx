import { useCallback, useEffect, useMemo, useState } from "react";

import AdminTopbar from "../components/admin/AdminTopbar";
import EventSelector from "../components/admin/EventSelector";
import ExcelToolbar from "../components/admin/ExcelToolbar";
import {
    getPairingSuggestions,
    getSingersOverview,
    decidePairing,
    bulkDecidePairings
} from "../services/adminDashboardService";
import { getEvents } from "../services/eventService";

import "../styles/adminTheme.css";
import "./PairingManagement.css";

const normalizeGender = value =>
    String(value || "").trim().toLowerCase();

const PAIRING_COLUMNS = [
    { key: "event_name", header: "Event Name", width: 24 },
    { key: "male_singer_name", header: "Male Singer", width: 22 },
    { key: "female_singer_name", header: "Female Singer (fill in to pair an Open Song)", width: 36 },
    { key: "song_title", header: "Song Name", width: 30 },
    { key: "decision", header: "Decision (Approved/Rejected - leave blank to skip)", width: 36 },
    { key: "source", header: "Pairing Mode (auto/manual)", width: 20 },
    { key: "note", header: "Note (reference only, ignored on import)", width: 26 }
];

function PairingManagement() {

    const [suggestions, setSuggestions] = useState({
        potential_matches: [],
        existing_pairings: [],
        open_songs: []
    });

    const [singers, setSingers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [actionKey, setActionKey] = useState(null);

    const [events, setEvents] = useState([]);
    const [selectedEventIds, setSelectedEventIds] = useState([]);

    // Manual pairing form state
    const [manualMaleId, setManualMaleId] = useState("");
    const [manualFemaleId, setManualFemaleId] = useState("");
    const [manualSongTitle, setManualSongTitle] = useState("");
    const [manualSubmitting, setManualSubmitting] = useState(false);

    // Open-songs partner picker: songId -> selected partner singer_id
    const [openSongPartners, setOpenSongPartners] = useState({});

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

    // The Potential Matches / Open Songs / Manual Pairing sections
    // are a live matching engine that only ever operates on ONE
    // event - when comparing multiple, they follow the first
    // selected event. The Pairing Report below supports all of them.
    const primaryEventId = selectedEventIds[0] || null;

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const [suggestionsResult, overviewResult] = await Promise.all([
                getPairingSuggestions(selectedEventIds.join(",")),
                getSingersOverview(primaryEventId)
            ]);

            setSuggestions({
                potential_matches: suggestionsResult.potential_matches || [],
                existing_pairings: suggestionsResult.existing_pairings || [],
                open_songs: suggestionsResult.open_songs || []
            });

            setSingers(overviewResult.singers || []);
        }
        catch (requestError) {
            console.error("Pairing data load error:", requestError);
            setError(
                requestError.message ||
                "Unable to load pairing data."
            );
        }
        finally {
            setLoading(false);
        }
    }, [selectedEventIds, primaryEventId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const maleSingers = useMemo(
        () => singers.filter(singer => normalizeGender(singer.gender) === "male"),
        [singers]
    );

    const femaleSingers = useMemo(
        () => singers.filter(singer => normalizeGender(singer.gender) === "female"),
        [singers]
    );

    // Potential matches grouped by male singer - a match is always
    // reviewed from the male side (male + female, never same-gender).
    const matchesByMaleSinger = useMemo(() => {
        const groups = new Map();

        suggestions.potential_matches.forEach(candidate => {
            if (!groups.has(candidate.male_singer_id)) {
                groups.set(candidate.male_singer_id, {
                    male_singer_id: candidate.male_singer_id,
                    male_singer_name: candidate.male_singer_name,
                    matches: []
                });
            }

            groups.get(candidate.male_singer_id).matches.push(candidate);
        });

        return [...groups.values()].sort((a, b) =>
            a.male_singer_name.localeCompare(b.male_singer_name)
        );
    }, [suggestions.potential_matches]);

    // Open songs split by gender - only the male side gets an
    // "assign a partner" action; female singers just see what of
    // theirs is still unmatched.
    const openSongsMale = useMemo(
        () => suggestions.open_songs.filter(song => normalizeGender(song.gender) === "male"),
        [suggestions.open_songs]
    );

    const openSongsFemale = useMemo(
        () => suggestions.open_songs.filter(song => normalizeGender(song.gender) === "female"),
        [suggestions.open_songs]
    );

    // Songs common to the two currently-selected manual singers
    const commonSongs = useMemo(() => {
        const male = singers.find(singer => singer.singer_id === manualMaleId);
        const female = singers.find(singer => singer.singer_id === manualFemaleId);

        if (!male || !female) {
            return [];
        }

        const femaleSongSet = new Set(
            (female.songs || [])
                .map(song => song.title)
                .filter(Boolean)
        );

        return (male.songs || [])
            .map(song => song.title)
            .filter(Boolean)
            .filter(title => femaleSongSet.has(title));
    }, [singers, manualMaleId, manualFemaleId]);

    // Excel template: existing pairings (decision pre-filled with
    // their current status, so a straight re-upload is a no-op),
    // potential matches (decision left blank), and male-side open
    // songs (female singer left blank for the admin to fill in).
    const primaryEventName = events.find(item => item.id === primaryEventId)?.name || "—";

    const excelRows = useMemo(() => {

        const fromExisting = suggestions.existing_pairings.map(pairing => ({
            event_name: pairing.event_name || "—",
            song_title: pairing.song_title,
            male_singer_name: pairing.male_singer_name,
            female_singer_name: pairing.female_singer_name,
            decision: pairing.status,
            source: pairing.source || "manual",
            note: `Existing pairing (${pairing.status})`
        }));

        const fromPotential = suggestions.potential_matches.map(candidate => ({
            event_name: primaryEventName,
            song_title: candidate.song_title,
            male_singer_name: candidate.male_singer_name,
            female_singer_name: candidate.female_singer_name,
            decision: "Pairing Pending",
            source: "auto",
            note: "Potential Match"
        }));

        const fromOpen = openSongsMale.map(openSong => ({
            event_name: primaryEventName,
            song_title: openSong.song_title,
            male_singer_name: openSong.singer_name,
            female_singer_name: "",
            decision: "Pairing Pending",
            source: "manual",
            note: "Open Song - fill in a female singer to pair"
        }));

        return [...fromExisting, ...fromPotential, ...fromOpen];

    }, [suggestions.existing_pairings, suggestions.potential_matches, openSongsMale, primaryEventName]);

    // Same rows as the Excel export - grouped by event first (only
    // meaningful when comparing more than one), then sorted
    // alphabetically by male singer, then song, for the on-page
    // report table.
    const pairingReportRows = useMemo(
        () =>
            [...excelRows].sort((a, b) =>
                a.event_name.localeCompare(b.event_name) ||
                a.male_singer_name.localeCompare(b.male_singer_name) ||
                a.song_title.localeCompare(b.song_title)
            ),
        [excelRows]
    );

    const handleImportRows = async parsedRows => {

        const actionable = parsedRows.filter(row =>
            ["Approved", "Rejected"].includes(String(row.decision || "").trim())
        );

        const blankCount = parsedRows.length - actionable.length;

        if (actionable.length === 0) {

            return { message: `No rows had a Decision filled in - ${blankCount} row(s) skipped.` };

        }

        const rows = actionable.map(row => ({
            song_title: row.song_title,
            male_singer_name: row.male_singer_name,
            female_singer_name: row.female_singer_name,
            decision: row.decision,
            source: row.source
        }));

        const response = await bulkDecidePairings(rows, primaryEventId);

        await loadData();

        return { message: `${response.message}${blankCount > 0 ? ` (${blankCount} left blank, skipped.)` : ""}` };

    };

    const handleDecision = async (candidate, decision) => {
        const key = `${candidate.song_id}:${candidate.male_singer_id}:${candidate.female_singer_id}`;

        setActionKey(key);
        setError("");
        setSuccess("");

        try {
            await decidePairing(
                candidate.song_id,
                candidate.male_singer_id,
                candidate.female_singer_id,
                decision,
                candidate.source || "auto"
            );

            setSuccess(`Pairing ${decision.toLowerCase()}.`);
            await loadData();
        }
        catch (requestError) {
            console.error("Decide pairing error:", requestError);
            setError(
                requestError.message ||
                "Unable to update pairing."
            );
        }
        finally {
            setActionKey(null);
        }
    };

    const handleManualSubmit = async event => {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (!manualMaleId || !manualFemaleId || !manualSongTitle) {
            setError("Please select both singers and a song.");
            return;
        }

        // The overview only gives us song titles; resolve the
        // actual song_id from whatever pairing data references it
        // (the backend re-validates song membership regardless).
        const matchWithSongId =
            suggestions.potential_matches.find(
                item => item.song_title === manualSongTitle
            ) ||
            suggestions.existing_pairings.find(
                item => item.song_title === manualSongTitle
            );

        if (!matchWithSongId) {
            setError(
                "Unable to resolve the selected song. Please pick a song from the Potential Matches list, or refresh the page."
            );
            return;
        }

        setManualSubmitting(true);

        try {
            await decidePairing(
                matchWithSongId.song_id,
                manualMaleId,
                manualFemaleId,
                "Approved",
                "manual"
            );

            setSuccess("Manual pairing created.");
            setManualMaleId("");
            setManualFemaleId("");
            setManualSongTitle("");
            await loadData();
        }
        catch (requestError) {
            console.error("Manual pairing error:", requestError);
            setError(
                requestError.message ||
                "Unable to create manual pairing."
            );
        }
        finally {
            setManualSubmitting(false);
        }
    };

    // ==========================================================
    // PAIR AN OPEN (UNMATCHED) SONG
    //
    // The song's own singer already owns it - the manually
    // chosen partner does NOT need to have selected this song
    // themselves (that's exactly what "open" means).
    // ==========================================================

    const handleOpenSongPair = async openSong => {
        const partnerId = openSongPartners[openSong.song_id];

        if (!partnerId) {
            setError("Please select a partner singer first.");
            return;
        }

        const isOwnerMale = normalizeGender(openSong.gender) === "male";

        const maleSingerId = isOwnerMale ? openSong.singer_id : partnerId;
        const femaleSingerId = isOwnerMale ? partnerId : openSong.singer_id;

        setActionKey(`open:${openSong.song_id}`);
        setError("");
        setSuccess("");

        try {
            await decidePairing(
                openSong.song_id,
                maleSingerId,
                femaleSingerId,
                "Approved",
                "manual"
            );

            setSuccess(`Paired "${openSong.song_title}" manually.`);
            setOpenSongPartners(current => {
                const next = { ...current };
                delete next[openSong.song_id];
                return next;
            });
            await loadData();
        }
        catch (requestError) {
            console.error("Open song pairing error:", requestError);
            setError(
                requestError.message ||
                "Unable to create manual pairing."
            );
        }
        finally {
            setActionKey(null);
        }
    };

    return (
        <div className="admin-shell">
            <AdminTopbar />

            <div className="admin-shell-content pairing-page">
                <h1 className="admin-page-title">Pairing Management</h1>
                <p className="admin-page-subtitle">
                    Review potential matches, resolve open songs and manage pairings.
                </p>

                <div className="pairing-event-row">
                    <EventSelector
                        events={events}
                        selectedIds={selectedEventIds}
                        onChange={setSelectedEventIds}
                    />
                    {selectedEventIds.length > 1 && (
                        <span className="pairing-event-compare-hint">
                            Comparing {selectedEventIds.length} events in the Pairing Report below. Potential Matches / Open Songs / Manual Pairing use only the first selected event.
                        </span>
                    )}
                </div>

                <ExcelToolbar
                    columns={PAIRING_COLUMNS}
                    rows={pairingReportRows}
                    filename="beats-infinity-pairings"
                    onImportRows={handleImportRows}
                    hint="Fill in Decision (Approved/Rejected) for any row - including Open Songs, where you can also fill in the Female Singer - then re-upload. Rows left blank are skipped."
                />

                {error && <div className="pairing-error">⚠️ {error}</div>}
                {success && <div className="pairing-success">✅ {success}</div>}

                {loading ? (
                    <div className="pairing-empty">Loading pairing data...</div>
                ) : (
                    <>
                    {/* ==================================================
                        POTENTIAL MATCHES
                    ================================================== */}

                    <div className="pairing-section">
                        <h2>Potential Matches</h2>

                        {matchesByMaleSinger.length === 0 ? (
                            <div className="pairing-empty">
                                No potential matches right now - this appears when a male and
                                female singer have both selected the same song.
                            </div>
                        ) : (
                            matchesByMaleSinger.map(group => (
                                <div className="pairing-singer-group" key={group.male_singer_id}>
                                    <h3 className="pairing-singer-group-title">
                                        🎤 {group.male_singer_name}
                                    </h3>

                                    <div className="pairing-table-wrapper">
                                        <table className="pairing-table">
                                            <thead>
                                                <tr>
                                                    <th>Song</th>
                                                    <th>Female Singer</th>
                                                    <th>Status</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {group.matches.map(candidate => {
                                                    const key = `${candidate.song_id}:${candidate.male_singer_id}:${candidate.female_singer_id}`;
                                                    const isActioning = actionKey === key;

                                                    return (
                                                        <tr key={key}>
                                                            <td>{candidate.song_title}</td>
                                                            <td>{candidate.female_singer_name}</td>
                                                            <td>
                                                                <span className="pairing-status-pill potential">
                                                                    Potential Match
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    className="pairing-action-btn approve"
                                                                    disabled={isActioning}
                                                                    onClick={() => handleDecision(candidate, "Approved")}
                                                                >
                                                                    {isActioning ? "..." : "Approve"}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="pairing-action-btn reject"
                                                                    disabled={isActioning}
                                                                    onClick={() => handleDecision(candidate, "Rejected")}
                                                                >
                                                                    {isActioning ? "..." : "Reject"}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* ==================================================
                        OPEN SONGS
                        -----------------------------------------------
                        Songs with no live potential match and no
                        approved pairing yet - need a manually chosen
                        partner (who need not have picked this song).
                    ================================================== */}

                    <div className="pairing-section">
                        <h2>Open Songs</h2>
                        <p className="pairing-section-hint">
                            Pairing is always assigned from the male singer's side - pick a
                            female partner for each open song below. The Female Singers list
                            is just a reference of what's still unmatched for them.
                        </p>

                        <h3 className="pairing-singer-group-title">👨 Male Singers</h3>

                        {openSongsMale.length === 0 ? (
                            <div className="pairing-empty">
                                No open songs for male singers right now.
                            </div>
                        ) : (
                            <div className="pairing-table-wrapper">
                                <table className="pairing-table">
                                    <thead>
                                        <tr>
                                            <th>Song</th>
                                            <th>Singer</th>
                                            <th>Assign Female Partner</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {openSongsMale.map(openSong => {
                                            const key = `open:${openSong.song_id}`;
                                            const isActioning = actionKey === key;

                                            return (
                                                <tr key={openSong.song_id}>
                                                    <td>{openSong.song_title}</td>
                                                    <td>{openSong.singer_name}</td>
                                                    <td>
                                                        <select
                                                            value={openSongPartners[openSong.song_id] || ""}
                                                            onChange={event =>
                                                                setOpenSongPartners(current => ({
                                                                    ...current,
                                                                    [openSong.song_id]: event.target.value
                                                                }))
                                                            }
                                                        >
                                                            <option value="">Select female singer</option>
                                                            {femaleSingers.map(singer => (
                                                                <option key={singer.singer_id} value={singer.singer_id}>
                                                                    {singer.singer_name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="pairing-action-btn approve"
                                                            disabled={isActioning || !openSongPartners[openSong.song_id]}
                                                            onClick={() => handleOpenSongPair(openSong)}
                                                        >
                                                            {isActioning ? "..." : "Pair"}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <h3 className="pairing-singer-group-title" style={{ marginTop: "26px" }}>
                            👩 Female Singers
                        </h3>

                        {openSongsFemale.length === 0 ? (
                            <div className="pairing-empty">
                                No open songs for female singers right now.
                            </div>
                        ) : (
                            <div className="pairing-table-wrapper">
                                <table className="pairing-table">
                                    <thead>
                                        <tr>
                                            <th>Song</th>
                                            <th>Singer</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {openSongsFemale.map(openSong => (
                                            <tr key={openSong.song_id}>
                                                <td>{openSong.song_title}</td>
                                                <td>{openSong.singer_name}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* ==================================================
                        MANUAL PAIRING
                    ================================================== */}

                    <div className="pairing-section">
                        <h2>Manual Pairing</h2>

                        <form className="manual-pairing-form" onSubmit={handleManualSubmit}>
                            <div className="manual-pairing-field">
                                <label>Male Singer</label>
                                <select
                                    value={manualMaleId}
                                    onChange={event => {
                                        setManualMaleId(event.target.value);
                                        setManualSongTitle("");
                                    }}
                                >
                                    <option value="">Select male singer</option>
                                    {maleSingers.map(singer => (
                                        <option key={singer.singer_id} value={singer.singer_id}>
                                            {singer.singer_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="manual-pairing-field">
                                <label>Female Singer</label>
                                <select
                                    value={manualFemaleId}
                                    onChange={event => {
                                        setManualFemaleId(event.target.value);
                                        setManualSongTitle("");
                                    }}
                                >
                                    <option value="">Select female singer</option>
                                    {femaleSingers.map(singer => (
                                        <option key={singer.singer_id} value={singer.singer_id}>
                                            {singer.singer_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="manual-pairing-field">
                                <label>Common Song</label>
                                <select
                                    value={manualSongTitle}
                                    onChange={event => setManualSongTitle(event.target.value)}
                                    disabled={!manualMaleId || !manualFemaleId}
                                >
                                    <option value="">
                                        {!manualMaleId || !manualFemaleId
                                            ? "Select both singers first"
                                            : commonSongs.length === 0
                                                ? "No common songs"
                                                : "Select a song"}
                                    </option>
                                    {commonSongs.map(title => (
                                        <option key={title} value={title}>
                                            {title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="submit"
                                className="manual-pairing-submit"
                                disabled={
                                    manualSubmitting ||
                                    !manualMaleId ||
                                    !manualFemaleId ||
                                    !manualSongTitle
                                }
                            >
                                {manualSubmitting ? "Pairing..." : "Create Pairing"}
                            </button>
                        </form>
                    </div>

                    {/* ==================================================
                        PAIRING REPORT
                        -----------------------------------------------
                        Every male singer's song and its pairing
                        status in one place - decided pairings,
                        live potential matches, and open songs still
                        awaiting a partner - sorted alphabetically by
                        male singer.
                    ================================================== */}

                    <div className="pairing-section">
                        <h2>Pairing Report</h2>

                        {pairingReportRows.length === 0 ? (
                            <div className="pairing-empty">
                                No song selections to report on yet.
                            </div>
                        ) : (
                            <div className="pairing-table-wrapper">
                                <table className="pairing-table">
                                    <thead>
                                        <tr>
                                            <th>Event</th>
                                            <th>Male Singer</th>
                                            <th>Female Singer</th>
                                            <th>Song Name</th>
                                            <th>Decision</th>
                                            <th>Pairing Mode</th>
                                            <th>Note</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {pairingReportRows.map((row, index) => (
                                            <tr key={`${row.event_name}:${row.male_singer_name}:${row.song_title}:${index}`}>
                                                <td className="pairing-event-cell">{row.event_name}</td>
                                                <td>{row.male_singer_name}</td>
                                                <td>{row.female_singer_name || "—"}</td>
                                                <td>{row.song_title}</td>
                                                <td>
                                                    <span
                                                        className={`pairing-status-pill ${
                                                            row.decision === "Approved"
                                                                ? "approved"
                                                                : row.decision === "Rejected"
                                                                    ? "rejected"
                                                                    : "potential"
                                                        }`}
                                                    >
                                                        {row.decision}
                                                    </span>
                                                </td>
                                                <td>{row.source}</td>
                                                <td></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default PairingManagement;
