import { useCallback, useEffect, useMemo, useState } from "react";

import AdminTopbar from "../components/admin/AdminTopbar";
import EventSelector from "../components/admin/EventSelector";
import ExcelToolbar from "../components/admin/ExcelToolbar";
import FinalPairingList from "../components/admin/FinalPairingList";
import SongCountTab from "../components/admin/SongCountTab";
import PairingChangeLog from "../components/admin/PairingChangeLog";
import {
    getPairingSuggestions,
    getSingersOverview,
    decidePairing,
    bulkDecidePairings,
    decideSolo
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
        open_songs: [],
        solo_songs: []
    });

    const [singers, setSingers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [actionKey, setActionKey] = useState(null);

    const [events, setEvents] = useState([]);
    const [selectedEventIds, setSelectedEventIds] = useState([]);
    const [eventsReady, setEventsReady] = useState(false);

    // Manual pairing form state
    const [manualMaleId, setManualMaleId] = useState("");
    const [manualFemaleId, setManualFemaleId] = useState("");
    const [manualSongTitle, setManualSongTitle] = useState("");
    const [manualSubmitting, setManualSubmitting] = useState(false);

    // Open-songs partner picker: songId -> selected partner singer_id
    const [openSongPartners, setOpenSongPartners] = useState({});

    // Potential Matches ticked for a bulk Approve / Reject
    const [selectedMatchKeys, setSelectedMatchKeys] = useState(() => new Set());
    const [bulkSaving, setBulkSaving] = useState(false);

    // final | review | open | report | log
    const [activeTab, setActiveTab] = useState("final");
    // Final List has edits not saved yet (switching tab would lose them)
    const [finalDirty, setFinalDirty] = useState(false);

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

    }, []);

    // The Potential Matches / Open Songs / Manual Pairing sections
    // are a live matching engine that only ever operates on ONE
    // event - when comparing multiple, they follow the first
    // selected event. The Pairing Report below supports all of them.
    const primaryEventId = selectedEventIds[0] || null;

    const loadData = useCallback(async () => {
        if (!eventsReady) {
            return;
        }

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
                open_songs: suggestionsResult.open_songs || [],
                solo_songs: suggestionsResult.solo_songs || []
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
    }, [selectedEventIds, primaryEventId, eventsReady]);

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

    const pendingSoloCount = suggestions.solo_songs.filter(
        solo => solo.solo_status !== "Approved" && solo.solo_status !== "Rejected"
    ).length;

    // Counts show what still needs the admin's attention
    const tabs = [
        { id: "final", label: "Final List" },
        { id: "counts", label: "Song Count" },
        { id: "review", label: "To Review", count: suggestions.potential_matches.length + pendingSoloCount },
        { id: "open", label: "Open Songs & Manual", count: openSongsMale.length },
        { id: "report", label: "Report & Excel" },
        { id: "log", label: "Change Log" }
    ];

    // Songs either of the two selected singers picked. Only ONE of
    // them needs to own the song (the backend checks the same rule),
    // so a male singer can be paired with any female singer - e.g.
    // two male singers who chose the same song each get their own
    // female partner. Songs both picked are listed first.
    //
    // [{ song_id, title, owner: "both" | "male" | "female" }]
    const manualSongs = useMemo(() => {
        const male = singers.find(singer => singer.singer_id === manualMaleId);
        const female = singers.find(singer => singer.singer_id === manualFemaleId);

        if (!male || !female) {
            return [];
        }

        const key = title => String(title || "").trim().toLowerCase();

        // Solos are approved in the Solo Songs section, never paired.
        const soloIds = new Set(suggestions.solo_songs.map(solo => solo.song_id));

        const femaleByTitle = new Map(
            (female.songs || [])
                .filter(song => song.title && song.song_id && !soloIds.has(song.song_id))
                .map(song => [key(song.title), song])
        );

        const maleTitles = new Set();
        const rows = [];

        (male.songs || [])
            .filter(song => song.title && song.song_id && !soloIds.has(song.song_id))
            .forEach(song => {
                maleTitles.add(key(song.title));
                rows.push({
                    song_id: song.song_id,
                    title: song.title,
                    owner: femaleByTitle.has(key(song.title)) ? "both" : "male"
                });
            });

        femaleByTitle.forEach((song, title) => {
            if (!maleTitles.has(title)) {
                rows.push({ song_id: song.song_id, title: song.title, owner: "female" });
            }
        });

        const order = { both: 0, male: 1, female: 2 };

        return rows.sort((a, b) =>
            order[a.owner] - order[b.owner] || a.title.localeCompare(b.title)
        );
    }, [singers, manualMaleId, manualFemaleId, suggestions.solo_songs]);

    // Excel template: existing pairings (decision pre-filled with
    // their current status, so a straight re-upload is a no-op),
    // potential matches (decision left blank), and male-side open
    // songs (female singer left blank for the admin to fill in).
    //
    // event_name always comes from the backend (the ACTUAL event the
    // underlying song selection belongs to), never assumed from the
    // currently-selected dropdown - a song that's scoped to the wrong
    // event needs to be visible as such, not silently relabeled.
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
            event_name: candidate.event_name || "—",
            song_title: candidate.song_title,
            male_singer_name: candidate.male_singer_name,
            female_singer_name: candidate.female_singer_name,
            decision: "Pairing Pending",
            source: "auto",
            note: "Potential Match"
        }));

        const fromOpen = openSongsMale.map(openSong => ({
            event_name: openSong.event_name || "—",
            song_title: openSong.song_title,
            male_singer_name: openSong.singer_name,
            female_singer_name: "",
            decision: "Pairing Pending",
            source: "manual",
            note: "Open Song - fill in a female singer to pair"
        }));

        return [...fromExisting, ...fromPotential, ...fromOpen];

    }, [suggestions.existing_pairings, suggestions.potential_matches, openSongsMale]);

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

        if (
            !manualMaleId ||
            !manualFemaleId ||
            !manualSongs.some(song => song.song_id === manualSongTitle)
        ) {
            setError("Please select both singers and a song.");
            return;
        }

        // manualSongTitle holds the chosen song's own song_id (the
        // backend re-validates song membership regardless).
        const chosenSong = manualSongs.find(
            song => song.song_id === manualSongTitle
        );

        if (!chosenSong) {
            setError(
                "Unable to resolve the selected song. Please refresh the page and try again."
            );
            return;
        }

        setManualSubmitting(true);

        try {
            await decidePairing(
                chosenSong.song_id,
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
    // BULK SAVE
    //
    // Runs each pairing through the same endpoint (and the same
    // backend checks) one after another, then reloads once. A row
    // that fails doesn't stop the rest - failures are listed.
    // ==========================================================

    const matchKeyOf = candidate =>
        `${candidate.song_id}:${candidate.male_singer_id}:${candidate.female_singer_id}`;

    const runBulk = async (items, label) => {
        setBulkSaving(true);
        setError("");
        setSuccess("");

        let saved = 0;
        const failed = [];
        const failedIds = new Set();

        for (const item of items) {
            try {
                await decidePairing(
                    item.song_id,
                    item.male_singer_id,
                    item.female_singer_id,
                    item.decision,
                    item.source
                );
                saved += 1;
            }
            catch (requestError) {
                failed.push(`${item.song_title}: ${requestError.message || "failed"}`);
                failedIds.add(item.song_id);
            }
        }

        await loadData();
        setBulkSaving(false);

        if (saved > 0) {
            setSuccess(`${saved} ${saved === 1 ? "pairing" : "pairings"} ${label}.`);
        }

        if (failed.length > 0) {
            setError(`${failed.length} not saved - ${failed.join("; ")}`);
        }

        return { saved, failed, failedIds };
    };

    const toggleMatch = candidate => {
        const key = matchKeyOf(candidate);
        setSelectedMatchKeys(current => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const toggleAllMatches = () => {
        setSelectedMatchKeys(current =>
            current.size === suggestions.potential_matches.length
                ? new Set()
                : new Set(suggestions.potential_matches.map(matchKeyOf))
        );
    };

    const handleBulkDecision = async decision => {
        const chosen = suggestions.potential_matches.filter(
            candidate => selectedMatchKeys.has(matchKeyOf(candidate))
        );

        if (chosen.length === 0) {
            return;
        }

        await runBulk(
            chosen.map(candidate => ({
                song_id: candidate.song_id,
                song_title: candidate.song_title,
                male_singer_id: candidate.male_singer_id,
                female_singer_id: candidate.female_singer_id,
                decision,
                source: candidate.source || "auto"
            })),
            decision === "Approved" ? "approved" : "rejected"
        );

        setSelectedMatchKeys(new Set());
    };

    const assignedOpenSongs = openSongsMale.filter(
        openSong => openSongPartners[openSong.song_id]
    );

    const handleSaveAllOpen = async () => {
        if (assignedOpenSongs.length === 0) {
            return;
        }

        const { failedIds } = await runBulk(
            assignedOpenSongs.map(openSong => ({
                song_id: openSong.song_id,
                song_title: openSong.song_title,
                male_singer_id: openSong.singer_id,
                female_singer_id: openSongPartners[openSong.song_id],
                decision: "Approved",
                source: "manual"
            })),
            "paired"
        );

        // Keep the partner choice only on rows that failed, so they
        // can be fixed and saved again.
        setOpenSongPartners(current => {
            const next = {};
            assignedOpenSongs.forEach(openSong => {
                if (failedIds.has(openSong.song_id)) {
                    next[openSong.song_id] = current[openSong.song_id];
                }
            });
            return next;
        });
    };

    // ==========================================================
    // SOLO SONGS - approve / reject / undo (null)
    // ==========================================================

    const handleSoloDecision = async (solo, decision) => {
        setActionKey(`solo:${solo.song_id}`);
        setError("");
        setSuccess("");

        try {
            const result = await decideSolo(solo.song_id, decision);
            setSuccess(result.message || "Solo updated.");
            await loadData();
        }
        catch (requestError) {
            console.error("Solo decision error:", requestError);
            setError(requestError.message || "Unable to update the solo.");
        }
        finally {
            setActionKey(null);
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
                    Build the event's final pairing list, review new matches and track every change.
                </p>

                <div className="pairing-event-row">
                    <EventSelector
                        events={events}
                        selectedIds={selectedEventIds}
                        onChange={setSelectedEventIds}
                    />
                    {selectedEventIds.length > 1 && (
                        <span className="pairing-event-compare-hint">
                            Comparing {selectedEventIds.length} events on the Report tab. The other tabs use only the first selected event.
                        </span>
                    )}
                </div>

                <div className="pairing-tabs" role="tablist" aria-label="Pairing sections">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            className={`pairing-tab${activeTab === tab.id ? " is-active" : ""}`}
                            onClick={() => {
                                if (
                                    activeTab === "final" && tab.id !== "final" && finalDirty &&
                                    !window.confirm("The Final List has changes that aren't saved yet. Leave without saving? (Cancel, then click \"Save final list\" to keep them.)")
                                ) {
                                    return;
                                }
                                if (tab.id !== "final") setFinalDirty(false);
                                setActiveTab(tab.id);
                                setError("");
                                setSuccess("");
                            }}
                        >
                            {tab.label}
                            {tab.count > 0 && <span className="pairing-tab-count">{tab.count}</span>}
                        </button>
                    ))}
                </div>

                {activeTab !== "final" && error && <div className="pairing-error">⚠️ {error}</div>}
                {activeTab !== "final" && success && <div className="pairing-success">✅ {success}</div>}

                {activeTab === "final" && (
                    primaryEventId ? (
                        <FinalPairingList
                            key={primaryEventId}
                            eventId={primaryEventId}
                            onSaved={loadData}
                            onDirtyChange={setFinalDirty}
                        />
                    ) : (
                        <div className="pairing-empty">Select an event to see its final pairing list.</div>
                    )
                )}

                {activeTab === "counts" && (
                    primaryEventId ? (
                        <SongCountTab key={primaryEventId} eventId={primaryEventId} />
                    ) : (
                        <div className="pairing-empty">Select an event to see each singer's song count.</div>
                    )
                )}

                {activeTab === "log" && (
                    <PairingChangeLog key={primaryEventId} eventId={primaryEventId} onRolledBack={loadData} />
                )}

                {["review", "open", "report"].includes(activeTab) && (loading ? (
                    <div className="pairing-empty">Loading pairing data...</div>
                ) : (
                    <>
                    {activeTab === "review" && (<>
                    {/* ==================================================
                        POTENTIAL MATCHES
                    ================================================== */}

                    <div className="pairing-section">
                        <h2>Potential Matches</h2>

                        {suggestions.potential_matches.length > 0 && (
                            <div className="pairing-bulk-bar">
                                <label className="pairing-bulk-all">
                                    <input
                                        type="checkbox"
                                        checked={
                                            selectedMatchKeys.size > 0 &&
                                            selectedMatchKeys.size === suggestions.potential_matches.length
                                        }
                                        onChange={toggleAllMatches}
                                        disabled={bulkSaving}
                                    />
                                    Select all ({suggestions.potential_matches.length})
                                </label>

                                <span className="pairing-bulk-count">
                                    {selectedMatchKeys.size} selected
                                </span>

                                <button
                                    type="button"
                                    className="pairing-action-btn approve"
                                    disabled={bulkSaving || selectedMatchKeys.size === 0}
                                    onClick={() => handleBulkDecision("Approved")}
                                >
                                    {bulkSaving ? "Saving..." : "Approve selected"}
                                </button>

                                <button
                                    type="button"
                                    className="pairing-action-btn reject"
                                    disabled={bulkSaving || selectedMatchKeys.size === 0}
                                    onClick={() => handleBulkDecision("Rejected")}
                                >
                                    Reject selected
                                </button>
                            </div>
                        )}

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
                                                    <th className="pairing-check-col" />
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
                                                            <td className="pairing-check-col">
                                                                <input
                                                                    type="checkbox"
                                                                    aria-label={`Select ${candidate.song_title} with ${candidate.female_singer_name}`}
                                                                    checked={selectedMatchKeys.has(key)}
                                                                    onChange={() => toggleMatch(candidate)}
                                                                    disabled={bulkSaving}
                                                                />
                                                            </td>
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
                        SOLO SONGS
                        -----------------------------------------------
                        A singer's optional solo is never paired - the
                        admin approves it. Only approved solos show on
                        the singer's Song List.
                    ================================================== */}

                    <div className="pairing-section">
                        <h2>Solo Songs</h2>
                        <p className="pairing-section-hint">
                            Solos aren't paired - approve them to add them to the singer's
                            Song List as a Solo. Rejected or undecided solos stay hidden.
                        </p>

                        {suggestions.solo_songs.length === 0 ? (
                            <div className="pairing-empty">
                                No solo songs picked for this event.
                            </div>
                        ) : (
                            <div className="pairing-table-wrapper">
                                <table className="pairing-table">
                                    <thead>
                                        <tr>
                                            <th>Singer</th>
                                            <th>Song</th>
                                            <th>Movie</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {suggestions.solo_songs.map(solo => {
                                            const isActioning = actionKey === `solo:${solo.song_id}`;
                                            const decided = solo.solo_status === "Approved" || solo.solo_status === "Rejected";

                                            return (
                                                <tr key={solo.song_id}>
                                                    <td>{solo.singer_name}</td>
                                                    <td>{solo.song_title}</td>
                                                    <td>{solo.movie || "—"}</td>
                                                    <td>
                                                        <span
                                                            className={`pairing-status-pill ${
                                                                solo.solo_status === "Approved"
                                                                    ? "approved"
                                                                    : solo.solo_status === "Rejected"
                                                                        ? "rejected"
                                                                        : "potential"
                                                            }`}
                                                        >
                                                            {solo.solo_status === "Approved"
                                                                ? "Approved Solo"
                                                                : solo.solo_status === "Rejected"
                                                                    ? "Rejected"
                                                                    : "Awaiting approval"}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {decided ? (
                                                            <button
                                                                type="button"
                                                                className="pairing-action-btn"
                                                                disabled={isActioning}
                                                                onClick={() => handleSoloDecision(solo, null)}
                                                            >
                                                                {isActioning ? "..." : "Undo"}
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="pairing-action-btn approve"
                                                                    disabled={isActioning}
                                                                    onClick={() => handleSoloDecision(solo, "Approved")}
                                                                >
                                                                    {isActioning ? "..." : "Approve"}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="pairing-action-btn reject"
                                                                    disabled={isActioning}
                                                                    onClick={() => handleSoloDecision(solo, "Rejected")}
                                                                >
                                                                    {isActioning ? "..." : "Reject"}
                                                                </button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    </>)}

                    {activeTab === "open" && (<>
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

                        {openSongsMale.length > 0 && (
                            <div className="pairing-bulk-bar">
                                <span className="pairing-bulk-count">
                                    Pick a partner on as many rows as you like, then save them together.
                                </span>

                                <button
                                    type="button"
                                    className="pairing-action-btn approve"
                                    disabled={bulkSaving || assignedOpenSongs.length === 0}
                                    onClick={handleSaveAllOpen}
                                >
                                    {bulkSaving
                                        ? "Saving..."
                                        : `Save all assigned pairings (${assignedOpenSongs.length})`}
                                </button>
                            </div>
                        )}

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
                                <label>Song</label>
                                <select
                                    value={
                                        manualSongs.some(song => song.song_id === manualSongTitle)
                                            ? manualSongTitle
                                            : ""
                                    }
                                    onChange={event => setManualSongTitle(event.target.value)}
                                    disabled={!manualMaleId || !manualFemaleId}
                                >
                                    <option value="">
                                        {!manualMaleId || !manualFemaleId
                                            ? "Select both singers first"
                                            : manualSongs.length === 0
                                                ? "Neither singer has songs"
                                                : "Select a song"}
                                    </option>
                                    {manualSongs.map(song => (
                                        <option key={song.song_id} value={song.song_id}>
                                            {song.title}
                                            {song.owner === "both"
                                                ? " (both picked)"
                                                : song.owner === "male"
                                                    ? " (male singer's pick)"
                                                    : " (female singer's pick)"}
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

                    </>)}

                    {activeTab === "report" && (<>
                    <ExcelToolbar
                        columns={PAIRING_COLUMNS}
                        rows={pairingReportRows}
                        filename="beats-infinity-pairings"
                        onImportRows={handleImportRows}
                        hint="Fill in Decision (Approved/Rejected) for any row - including Open Songs, where you can also fill in the Female Singer - then re-upload. Rows left blank are skipped."
                    />

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
                    </>)}
                    </>
                ))}
            </div>
        </div>
    );
}

export default PairingManagement;
