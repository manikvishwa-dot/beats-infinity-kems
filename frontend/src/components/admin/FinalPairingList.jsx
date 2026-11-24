import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ExcelToolbar from "./ExcelToolbar";
import AddSingerDialog from "./AddSingerDialog";
import {
    getFinalPairingList,
    saveFinalPairingList
} from "../../services/adminDashboardService";

import "./FinalPairingList.css";

// ==========================================================
// FINAL PAIRING LIST - the event-day list, editable as a whole
// ==========================================================
//
// One row per performance: Male Singer | Female Singer | Song |
// Movie. Leave one singer blank (Female = "★ Solo") for a solo.
// Edit anything for last-minute changes, then Save once - the
// backend keeps every replaced/removed row as Rejected and logs
// each change for reports.
// ==========================================================

const EXCEL_COLUMNS = [
    { key: "male_singer_name", header: "Male Singer", width: 24 },
    { key: "female_singer_name", header: "Female Singer (blank or Solo = solo)", width: 34 },
    { key: "song_title", header: "Song", width: 34 },
    { key: "movie", header: "Movie / Album", width: 28 }
];

const normalize = value => String(value || "").trim().toLowerCase();

let keySeq = 0;
const nextKey = () => `row-${++keySeq}`;

const withKey = row => ({ ...row, key: nextKey() });

const blankRow = (maleId = "") => withKey({
    ref: null,
    male_singer_id: maleId,
    female_singer_id: "",
    song_title: "",
    movie: ""
});

const comparable = rows => JSON.stringify(
    rows.map(({ ref, male_singer_id, female_singer_id, song_title, movie }) =>
        [ref, male_singer_id, female_singer_id, song_title.trim(), movie.trim()]
    )
);


// singerId -> number of rows (songs) they're on
const countSongs = list => {
    const counts = new Map();
    list.forEach(row => {
        [row.male_singer_id, row.female_singer_id].filter(Boolean).forEach(id => {
            counts.set(id, (counts.get(id) || 0) + 1);
        });
    });
    return counts;
};


const ADD_SINGER = "__add_singer__";

// Only this event's singers, then "+ Add a singer..." last
function SingerSelect({ value, singers, counts, onChange, onAddSinger, emptyLabel, ariaLabel }) {

    const inEvent = singers.filter(singer => singer.in_event || singer.id === value);

    return (
        <select
            className={value ? "final-input" : "final-input is-empty"}
            value={value}
            onChange={event => {
                if (event.target.value === ADD_SINGER) {
                    onAddSinger();
                }
                else {
                    onChange(event.target.value);
                }
            }}
            aria-label={ariaLabel}
        >
            <option value="">{emptyLabel}</option>

            {inEvent.map(singer => (
                <option key={singer.id} value={singer.id}>
                    {singer.singer_name} ({counts.get(singer.id) || 0})
                </option>
            ))}

            <option value={ADD_SINGER}>＋ Add a singer...</option>
        </select>
    );

}


function FinalPairingList({ eventId, onSaved }) {

    const [rows, setRows] = useState([]);
    const [savedSnapshot, setSavedSnapshot] = useState("[]");
    const [serverRows, setServerRows] = useState([]);
    const [singers, setSingers] = useState([]);
    const [eventName, setEventName] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const lastInputRef = useRef(null);
    const focusNewRow = useRef(false);

    // { rowKey, field: "male_singer_id" | "female_singer_id", gender }
    const [addingSinger, setAddingSinger] = useState(null);

    const applyResult = useCallback(result => {

        const loaded = (result.rows || []).map(withKey);

        setRows(loaded);
        setServerRows(result.rows || []);
        setSavedSnapshot(comparable(loaded));
        setSingers(result.singers || []);
        setEventName(result.event_name || "");

    }, []);

    // Reload after a save (the first load happens in the effect)
    const load = useCallback(async () => {
        applyResult(await getFinalPairingList(eventId));
    }, [eventId, applyResult]);

    useEffect(() => {

        let cancelled = false;

        getFinalPairingList(eventId)
            .then(result => {
                if (!cancelled) applyResult(result);
            })
            .catch(requestError => {
                console.error("Final list load error:", requestError);
                if (!cancelled) setError(requestError.message || "Unable to load the final list.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };

    }, [eventId, applyResult]);

    useEffect(() => {
        if (focusNewRow.current && lastInputRef.current) {
            lastInputRef.current.focus();
            focusNewRow.current = false;
        }
    }, [rows.length]);

    const maleSingers = useMemo(
        () => singers.filter(singer => normalize(singer.gender) === "male"),
        [singers]
    );

    const femaleSingers = useMemo(
        () => singers.filter(singer => normalize(singer.gender) === "female"),
        [singers]
    );

    const nameById = useMemo(
        () => new Map(singers.map(singer => [singer.id, singer.singer_name])),
        [singers]
    );

    const dirty = comparable(rows) !== savedSnapshot;

    // Warn before leaving the page with unsaved edits
    useEffect(() => {
        if (!dirty) return undefined;
        const warn = event => { event.preventDefault(); event.returnValue = ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const updateRow = (key, field, value) => {
        setSuccess("");
        setRows(current => current.map(row =>
            row.key === key ? { ...row, [field]: value } : row
        ));
    };

    // A walk-in was added: show them in this event's dropdowns and
    // put them on the row the admin was editing.
    const handleSingerAdded = (singer, message) => {
        setSingers(current => {
            const exists = current.some(item => item.id === singer.id);
            return exists
                ? current.map(item => item.id === singer.id ? { ...item, in_event: true } : item)
                : [...current, singer].sort((a, b) => a.singer_name.localeCompare(b.singer_name));
        });
        if (addingSinger) {
            updateRow(addingSinger.rowKey, addingSinger.field, singer.id);
        }
        setAddingSinger(null);
        setError("");
        setSuccess(`${message} Remember to Save the final list.`);
    };

    const removeRow = key => {
        setSuccess("");
        setRows(current => current.filter(row => row.key !== key));
    };

    const addRow = () => {
        setSuccess("");
        focusNewRow.current = true;
        setRows(current => [...current, blankRow()]);
    };

    // One blank row for every male singer in this event
    const addRowPerMale = () => {
        setSuccess("");
        setRows(current => [
            ...current,
            ...maleSingers.filter(singer => singer.in_event).map(singer => blankRow(singer.id))
        ]);
    };

    const discard = () => {
        setSuccess("");
        setError("");
        setRows(serverRows.map(withKey));
    };

    const handleSave = async () => {

        setSaving(true);
        setError("");
        setSuccess("");

        try {

            const payload = rows
                // A completely empty new row is just ignored
                .filter(row =>
                    row.ref ||
                    row.male_singer_id || row.female_singer_id ||
                    row.song_title.trim() || row.movie.trim()
                )
                .map(({ ref, male_singer_id, female_singer_id, song_title, movie }) => ({
                    ref, male_singer_id, female_singer_id, song_title, movie
                }));

            const result = await saveFinalPairingList(eventId, payload);

            await load();
            setSuccess(result.message || "Final list saved.");
            onSaved?.();

        }
        catch (requestError) {

            console.error("Final list save error:", requestError);
            setError(requestError.message || "Unable to save the final list.");

        }
        finally {

            setSaving(false);

        }

    };

    // ------------------------------------------------------
    // EXCEL
    // ------------------------------------------------------

    const excelRows = rows.map(row => ({
        male_singer_name: nameById.get(row.male_singer_id) || "",
        female_singer_name: row.female_singer_id
            ? nameById.get(row.female_singer_id) || ""
            : (row.male_singer_id ? "Solo" : ""),
        song_title: row.song_title,
        movie: row.movie
    }));

    // Upload replaces what's on screen (not saved until Save).
    // Rows that match an existing one keep it, so unchanged rows
    // aren't logged as removed + added.
    const handleImportRows = async parsedRows => {

        const findSinger = (name, list) => {
            const wanted = normalize(name);
            return list.find(singer => normalize(singer.singer_name) === wanted);
        };

        const problems = [];
        const unusedServer = [...serverRows];

        const imported = parsedRows
            .filter(row => [row.male_singer_name, row.female_singer_name, row.song_title]
                .some(value => String(value || "").trim()))
            .map((row, index) => {

                const maleName = String(row.male_singer_name || "").trim();
                const femaleRaw = String(row.female_singer_name || "").trim();
                const femaleName = normalize(femaleRaw) === "solo" ? "" : femaleRaw;

                const male = maleName ? findSinger(maleName, maleSingers) : null;
                const female = femaleName ? findSinger(femaleName, femaleSingers) : null;

                if (maleName && !male) problems.push(`Row ${index + 1}: male singer "${maleName}" not found`);
                if (femaleName && !female) problems.push(`Row ${index + 1}: female singer "${femaleName}" not found`);

                const next = {
                    male_singer_id: male?.id || "",
                    female_singer_id: female?.id || "",
                    song_title: String(row.song_title || "").trim(),
                    movie: String(row.movie || "").trim()
                };

                const matchIndex = unusedServer.findIndex(existing =>
                    existing.male_singer_id === next.male_singer_id &&
                    existing.female_singer_id === next.female_singer_id &&
                    normalize(existing.song_title) === normalize(next.song_title)
                );

                const ref = matchIndex >= 0 ? unusedServer.splice(matchIndex, 1)[0].ref : null;

                return withKey({ ...next, ref });

            });

        if (problems.length > 0) {
            return {
                error: true,
                message: `Nothing loaded - ${problems.slice(0, 5).join("; ")}${problems.length > 5 ? ` (+${problems.length - 5} more)` : ""}. Use the names exactly as they appear in the dropdowns.`
            };
        }

        setSuccess("");
        setRows(imported);

        return {
            message: `${imported.length} rows loaded from Excel - check them, then click "Save final list".`
        };

    };

    // ------------------------------------------------------
    // SONGS PER SINGER
    // ------------------------------------------------------

    // Live from the rows on screen (unsaved edits included), compared
    // with the last saved list for the +1 / -1 badges.
    const songCounts = useMemo(() => countSongs(rows), [rows]);
    const savedCounts = useMemo(() => countSongs(serverRows), [serverRows]);

    // Everyone in this event (0 songs included) plus anyone on a row
    const perSinger = useMemo(() => {
        const build = list => list
            .filter(singer =>
                singer.in_event ||
                songCounts.has(singer.id) ||
                savedCounts.has(singer.id)
            )
            .map(singer => ({
                id: singer.id,
                name: singer.singer_name,
                count: songCounts.get(singer.id) || 0,
                change: (songCounts.get(singer.id) || 0) - (savedCounts.get(singer.id) || 0)
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return { male: build(maleSingers), female: build(femaleSingers) };
    }, [maleSingers, femaleSingers, songCounts, savedCounts]);

    const soloCount = rows.filter(row => !(row.male_singer_id && row.female_singer_id) && (row.male_singer_id || row.female_singer_id)).length;

    if (loading) {
        return <div className="pairing-empty">Loading the final list...</div>;
    }

    return (
        <div className="final-list">

            <div className="final-list-head">
                <div>
                    <h2>Final Pairing List{eventName ? ` - ${eventName}` : ""}</h2>
                    <p className="pairing-section-hint">
                        The event-day running list. Change any singer, song or movie for last-minute
                        changes, then <b>Save</b>. Set Female Singer to <b>★ Solo</b> for a solo.
                        Dropdowns list this event's singers - for a last-minute walk-in, choose
                        <b> ＋ Add a singer...</b> at the bottom. Every change is recorded in the Change Log.
                    </p>
                </div>
            </div>

            <ExcelToolbar
                columns={EXCEL_COLUMNS}
                rows={excelRows}
                filename={`final-pairing-list${eventName ? `-${eventName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}` : ""}`}
                onImportRows={handleImportRows}
                hint="Export, edit in Excel and upload to replace the list on screen - nothing is saved until you click Save final list."
            />

            {error && <div className="pairing-error">⚠️ {error}</div>}
            {success && <div className="pairing-success">✅ {success}</div>}

            {(perSinger.male.length > 0 || perSinger.female.length > 0) && (
                <section className="final-counts" aria-label="Songs per singer">
                    <div className="final-counts-head">
                        <h3>Songs per singer</h3>
                        <span>
                            {rows.length} {rows.length === 1 ? "song" : "songs"}
                            {soloCount > 0 ? ` · ${soloCount} solo` : ""}
                            {dirty ? " · unsaved changes shown" : ""}
                        </span>
                    </div>

                    {[
                        { label: "Male", list: perSinger.male },
                        { label: "Female", list: perSinger.female }
                    ].filter(group => group.list.length > 0).map(group => (
                        <div className="final-counts-group" key={group.label}>
                            <span className="final-counts-label">{group.label}</span>
                            <div className="final-counts-chips">
                                {group.list.map(item => (
                                    <span
                                        key={item.id}
                                        className={`final-count-chip${item.count === 0 ? " is-zero" : ""}`}
                                        title={item.change !== 0
                                            ? `${item.name}: ${item.count} songs (${item.change > 0 ? "+" : ""}${item.change} since last save)`
                                            : `${item.name}: ${item.count} songs`}
                                    >
                                        {item.name}
                                        <b>{item.count}</b>
                                        {item.change !== 0 && (
                                            <em className={item.change > 0 ? "is-up" : "is-down"}>
                                                {item.change > 0 ? `+${item.change}` : item.change}
                                            </em>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>
            )}

            <div className="final-table-wrap">
                <table className="final-table">
                    <thead>
                        <tr>
                            <th className="final-col-num">#</th>
                            <th>Male Singer</th>
                            <th>Female Singer</th>
                            <th>Song</th>
                            <th>Movie / Album</th>
                            <th aria-label="Remove" />
                        </tr>
                    </thead>

                    <tbody>
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={6} className="final-empty">
                                    No pairings yet - click <b>+ Add row</b> or approve pairings on the Review tab.
                                </td>
                            </tr>
                        )}

                        {rows.map((row, index) => {
                            const isSolo = !(row.male_singer_id && row.female_singer_id) &&
                                Boolean(row.male_singer_id || row.female_singer_id);

                            return (
                                <tr key={row.key} className={row.ref ? "" : "is-new"}>
                                    <td className="final-col-num">
                                        {index + 1}
                                        {isSolo && <span className="final-solo-tag">Solo</span>}
                                    </td>
                                    <td>
                                        <SingerSelect
                                            value={row.male_singer_id}
                                            singers={maleSingers}
                                            counts={songCounts}
                                            emptyLabel={row.female_singer_id ? "★ Solo" : "Select male singer"}
                                            ariaLabel={`Row ${index + 1} male singer`}
                                            onChange={value => updateRow(row.key, "male_singer_id", value)}
                                            onAddSinger={() => setAddingSinger({ rowKey: row.key, field: "male_singer_id", gender: "male" })}
                                        />
                                    </td>
                                    <td>
                                        <SingerSelect
                                            value={row.female_singer_id}
                                            singers={femaleSingers}
                                            counts={songCounts}
                                            emptyLabel={row.male_singer_id ? "★ Solo" : "Select female singer"}
                                            ariaLabel={`Row ${index + 1} female singer`}
                                            onChange={value => updateRow(row.key, "female_singer_id", value)}
                                            onAddSinger={() => setAddingSinger({ rowKey: row.key, field: "female_singer_id", gender: "female" })}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            ref={index === rows.length - 1 ? lastInputRef : undefined}
                                            className="final-input"
                                            value={row.song_title}
                                            placeholder="Song name"
                                            aria-label={`Row ${index + 1} song`}
                                            onChange={event => updateRow(row.key, "song_title", event.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            className="final-input"
                                            value={row.movie}
                                            placeholder="Optional"
                                            aria-label={`Row ${index + 1} movie`}
                                            onChange={event => updateRow(row.key, "movie", event.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            className="final-remove"
                                            title="Remove this row"
                                            aria-label={`Remove row ${index + 1}`}
                                            onClick={() => removeRow(row.key)}
                                        >
                                            ×
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="final-actions">
                <div className="final-actions-left">
                    <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={addRow}>
                        + Add row
                    </button>
                    <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={addRowPerMale}>
                        + One row per male singer
                    </button>
                </div>

                <div className="final-actions-right">
                    {dirty && <span className="final-unsaved">● Unsaved changes</span>}
                    <button
                        type="button"
                        className="admin-btn admin-btn-ghost admin-btn-sm"
                        onClick={discard}
                        disabled={!dirty || saving}
                    >
                        Discard changes
                    </button>
                    <button
                        type="button"
                        className="admin-btn admin-btn-primary"
                        onClick={handleSave}
                        disabled={!dirty || saving}
                    >
                        {saving ? "Saving..." : "Save final list"}
                    </button>
                </div>
            </div>

            {addingSinger && (
                <AddSingerDialog
                    eventId={eventId}
                    gender={addingSinger.gender}
                    otherSingers={(addingSinger.gender === "male" ? maleSingers : femaleSingers)
                        .filter(singer => !singer.in_event)}
                    onAdded={handleSingerAdded}
                    onClose={() => setAddingSinger(null)}
                />
            )}

        </div>
    );

}

export default FinalPairingList;
