import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ExcelToolbar from "./ExcelToolbar";
import AddSingerDialog from "./AddSingerDialog";
import UploadReviewDialog from "./UploadReviewDialog";
import { analyzeUpload, normalizeName, resolveUpload } from "../../utils/pairingImport";
import {
    getFinalPairingList,
    registerEventSingers,
    saveFinalPairingList,
    setFinalRowCompleted
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


const ADD_SINGER = "__add_singer__";

// Only this event's singers, then "+ Add a singer..." last
function SingerSelect({ value, singers, onChange, onAddSinger, emptyLabel, ariaLabel }) {

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
                    {singer.singer_name}
                </option>
            ))}

            <option value={ADD_SINGER}>＋ Add a singer...</option>
        </select>
    );

}


function FinalPairingList({ eventId, onSaved, onDirtyChange }) {

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

    // Event day: rows ticked as sung turn green. Saved at once,
    // separate from "Save final list".
    const [completionReady, setCompletionReady] = useState(true);
    const [onlyRemaining, setOnlyRemaining] = useState(false);
    const [togglingRef, setTogglingRef] = useState("");

    const applyResult = useCallback(result => {

        const loaded = (result.rows || []).map(withKey);

        setRows(loaded);
        setServerRows(result.rows || []);
        setSavedSnapshot(comparable(loaded));
        setSingers(result.singers || []);
        setEventName(result.event_name || "");
        setCompletionReady(result.completion_ready !== false);

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

    const genderById = useMemo(
        () => new Map(singers.map(singer => [singer.id, singer.gender])),
        [singers]
    );

    // A dropdown's list plus whoever is picked in it, so a man on a
    // two-men song still shows in the second column
    const withCurrent = (list, id) =>
        !id || list.some(singer => singer.id === id)
            ? list
            : [...list, ...singers.filter(singer => singer.id === id)];

    const dirty = comparable(rows) !== savedSnapshot;

    // Let the Pairing page know, so changing tab asks first
    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

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

    // Asks first - except for a brand-new row with nothing typed in it
    const removeRow = key => {
        const row = rows.find(item => item.key === key);
        if (!row) return;

        const isBlank = !row.ref && !row.male_singer_id && !row.female_singer_id &&
            !row.song_title.trim() && !row.movie.trim();

        if (!isBlank) {
            const singersText = [row.male_singer_id, row.female_singer_id]
                .filter(Boolean)
                .map(id => nameById.get(id) || "a singer")
                .join(" + ");
            const what = [singersText, row.song_title.trim()].filter(Boolean).join(" - ") || "this row";

            if (!window.confirm(
                `Remove ${what} from the list?\n\n` +
                (row.ref
                    ? "It comes off the list when you click Save final list."
                    : "This row hasn't been saved yet.")
            )) return;
        }

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
                    ref, male_singer_id, female_singer_id, song_title, movie,
                    // Two men / two women together - confirmed on upload
                    same_gender: Boolean(male_singer_id && female_singer_id) &&
                        normalize(genderById.get(male_singer_id)) === normalize(genderById.get(female_singer_id))
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
    // Names not registered yet, two men / two women on one song and
    // songs listed twice go through UploadReviewDialog first.
    const [pendingUpload, setPendingUpload] = useState(null);
    const [uploadBusy, setUploadBusy] = useState(false);
    const [uploadError, setUploadError] = useState("");

    // Rows that match an existing one keep it (same two singers, same
    // song, either order), so unchanged rows aren't logged as
    // removed + added.
    const applyUploadedRows = (resolvedRows, idForKey) => {

        const unusedServer = [...serverRows];
        const pairOf = (a, b) => [a, b].filter(Boolean).sort().join("|");

        const imported = resolvedRows.map(row => {

            const maleId = row.male ? (row.male.id || idForKey(row.male.key)) : "";
            const femaleId = row.female ? (row.female.id || idForKey(row.female.key)) : "";

            const matchIndex = unusedServer.findIndex(existing =>
                pairOf(existing.male_singer_id, existing.female_singer_id) === pairOf(maleId, femaleId) &&
                normalize(existing.song_title) === normalize(row.title)
            );

            const ref = matchIndex >= 0 ? unusedServer.splice(matchIndex, 1)[0].ref : null;

            return withKey({
                ref,
                male_singer_id: maleId || "",
                female_singer_id: femaleId || "",
                song_title: row.title,
                movie: row.movie
            });

        });

        setSuccess(`${imported.length} rows loaded from Excel - check them, then click "Save final list".`);
        setRows(imported);

        return imported.length;

    };

    const handleImportRows = async parsedRows => {

        const analysis = analyzeUpload(parsedRows, singers);

        if (analysis.rows.length === 0) {
            return { error: true, message: "No pairing rows found in that file." };
        }

        const { resolved, duplicates } = resolveUpload(analysis.rows, singers, analysis.newSingers);
        const needsReview =
            analysis.newSingers.length > 0 ||
            duplicates.length > 0 ||
            resolved.some(row => row.sameGender);

        if (needsReview) {
            setUploadError("");
            setPendingUpload(analysis);
            return { message: "Check the questions in the window that opened." };
        }

        if (analysis.problems.length > 0) {
            return {
                error: true,
                message: `Nothing loaded - ${analysis.problems.slice(0, 5).join(" ")}`
            };
        }

        const count = applyUploadedRows(resolved, () => "");

        return { message: `${count} rows loaded from Excel - check them, then click "Save final list".` };

    };

    const handleUploadConfirmed = async ({ rows: chosenRows, newSingers }) => {

        setUploadBusy(true);
        setUploadError("");

        try {

            const idByKey = new Map();
            let note = "";

            const stillNeeded = newSingers.filter(singer =>
                chosenRows.some(row => row.male?.key === singer.key || row.female?.key === singer.key)
            );

            if (stillNeeded.length > 0) {

                const result = await registerEventSingers(
                    eventId,
                    stillNeeded.map(singer => ({ singer_name: singer.name, gender: singer.gender }))
                );

                (result.singers || []).forEach(singer => {
                    idByKey.set(normalizeName(singer.singer_name), singer.id);
                });

                setSingers(current => {
                    const byId = new Map(current.map(item => [item.id, item]));
                    (result.singers || []).forEach(singer => byId.set(singer.id, { ...byId.get(singer.id), ...singer, in_event: true }));
                    return [...byId.values()].sort((a, b) => a.singer_name.localeCompare(b.singer_name));
                });

                note = ` ${result.message}`;

            }

            const count = applyUploadedRows(chosenRows, key => idByKey.get(key) || "");

            setSuccess(`${count} rows loaded from Excel - check them, then click "Save final list".${note}`);
            setPendingUpload(null);

        }
        catch (requestError) {

            setUploadError(requestError.message || "Unable to register the new singers.");

        }
        finally {

            setUploadBusy(false);

        }

    };

    // ------------------------------------------------------
    // COMPLETED TICK - saved straight away; on failure the tick
    // is put back.
    // ------------------------------------------------------

    const savedCount = rows.filter(row => row.ref).length;
    const doneCount = rows.filter(row => row.ref && row.completed).length;

    const toggleCompleted = async (row, completed) => {

        if (!row.ref) return;

        const setTick = value => setRows(current =>
            current.map(item => item.ref === row.ref ? { ...item, completed: value } : item)
        );

        setTick(completed);
        setTogglingRef(row.ref);
        setError("");

        try {
            await setFinalRowCompleted(eventId, row.ref, completed);
        }
        catch (requestError) {
            setTick(!completed);
            setError(requestError.message || "Unable to update the song.");
        }
        finally {
            setTogglingRef("");
        }

    };

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
                hint="Export, edit in Excel and upload to replace the whole list on screen - nothing is saved until you click Save final list. Saved a wrong list? Use Roll back last save on the Change Log tab."
            />

            {error && <div className="pairing-error">⚠️ {error}</div>}
            {success && <div className="pairing-success">✅ {success}</div>}

            {!completionReady && (
                <div className="pairing-error">
                    ⚠️ The "Completed" ticks need a one-time database update - run
                    {" "}<b>backend/migrations/2026-11-25_final_list_progress.sql</b> in the Supabase SQL editor.
                </div>
            )}

            {savedCount > 0 && (
                <div className="final-progress">
                    <div className="final-progress-text">
                        <b>{doneCount}</b> of <b>{savedCount}</b> songs sung
                        <span className="final-progress-left">· {savedCount - doneCount} to go</span>
                    </div>
                    <div className="final-progress-track" aria-hidden="true">
                        <div className="final-progress-fill" style={{ width: `${(doneCount / savedCount) * 100}%` }} />
                    </div>
                    <label className="final-progress-filter">
                        <input
                            type="checkbox"
                            checked={onlyRemaining}
                            onChange={event => setOnlyRemaining(event.target.checked)}
                        />
                        Show only songs still to sing
                    </label>
                </div>
            )}

            <div className="final-table-wrap">
                <table className="final-table">
                    <thead>
                        <tr>
                            <th className="final-col-num">#</th>
                            <th className="final-col-done">Completed</th>
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
                                <td colSpan={7} className="final-empty">
                                    No pairings yet - click <b>+ Add row</b> or approve pairings on the Review tab.
                                </td>
                            </tr>
                        )}

                        {rows.map((row, index) => {
                            const isSolo = !(row.male_singer_id && row.female_singer_id) &&
                                Boolean(row.male_singer_id || row.female_singer_id);
                            const isDuo = Boolean(row.male_singer_id && row.female_singer_id) &&
                                normalize(genderById.get(row.male_singer_id)) === normalize(genderById.get(row.female_singer_id));

                            return (
                                <tr
                                    key={row.key}
                                    className={[row.ref ? "" : "is-new", row.completed ? "is-done" : ""].join(" ").trim()}
                                    hidden={onlyRemaining && row.completed}
                                >
                                    <td className="final-col-num">
                                        {index + 1}
                                        {isSolo && <span className="final-solo-tag">Solo</span>}
                                        {isDuo && <span className="final-solo-tag duo" title="Two singers of the same gender singing together">Together</span>}
                                    </td>
                                    <td className="final-col-done">
                                        <label
                                            className="final-done-check"
                                            title={
                                                !row.ref
                                                    ? "Save the list first"
                                                    : !completionReady
                                                        ? "Needs a one-time database update"
                                                        : row.completed ? "Sung - click to undo" : "Tick once this song is sung"
                                            }
                                        >
                                            <input
                                                type="checkbox"
                                                checked={Boolean(row.completed)}
                                                disabled={!row.ref || !completionReady || togglingRef === row.ref}
                                                onChange={event => toggleCompleted(row, event.target.checked)}
                                                aria-label={`Row ${index + 1} completed`}
                                            />
                                            <span aria-hidden="true">✓</span>
                                        </label>
                                    </td>
                                    <td>
                                        <SingerSelect
                                            value={row.male_singer_id}
                                            singers={withCurrent(maleSingers, row.male_singer_id)}
                                            emptyLabel={row.female_singer_id ? "★ Solo" : "Select male singer"}
                                            ariaLabel={`Row ${index + 1} male singer`}
                                            onChange={value => updateRow(row.key, "male_singer_id", value)}
                                            onAddSinger={() => setAddingSinger({ rowKey: row.key, field: "male_singer_id", gender: "male" })}
                                        />
                                    </td>
                                    <td>
                                        <SingerSelect
                                            value={row.female_singer_id}
                                            singers={withCurrent(femaleSingers, row.female_singer_id)}
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

            {pendingUpload && (
                <UploadReviewDialog
                    analysis={pendingUpload}
                    singers={singers}
                    busy={uploadBusy}
                    error={uploadError}
                    onConfirm={handleUploadConfirmed}
                    onCancel={() => setPendingUpload(null)}
                />
            )}

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
