import { useEffect, useMemo, useState } from "react";

import { resolveUpload } from "../../utils/pairingImport";

// ==========================================================
// UPLOAD REVIEW - shown when an uploaded Final List needs the
// admin's decision before it goes on screen:
//   1. names not registered yet  -> register (PIN 1234)
//   2. two men / two women on one song -> "sung together?"
//   3. same song + same pair listed twice -> count once?
// Nothing is saved to the list here - the rows go on screen and
// the admin still clicks "Save final list".
// ==========================================================

function UploadReviewDialog({ analysis, singers, busy, error, onConfirm, onCancel }) {

    const [genders, setGenders] = useState(
        () => Object.fromEntries(analysis.newSingers.map(s => [s.key, s.gender]))
    );
    // row index -> "together" | "skip"
    const [sameGenderChoice, setSameGenderChoice] = useState({});
    const [mergeDuplicates, setMergeDuplicates] = useState(true);

    const newSingers = useMemo(
        () => analysis.newSingers.map(s => ({ ...s, gender: genders[s.key] })),
        [analysis.newSingers, genders]
    );

    const { resolved, duplicates } = useMemo(
        () => resolveUpload(analysis.rows, singers, newSingers),
        [analysis.rows, singers, newSingers]
    );

    const duplicateIndexes = new Set(duplicates.map(d => d.index));

    // Same-gender rows still to decide (a dropped duplicate's copy
    // follows the decision on the row it duplicates)
    const sameGenderRows = resolved
        .map((row, index) => ({ row, index }))
        .filter(({ row, index }) => row.sameGender && !(mergeDuplicates && duplicateIndexes.has(index)));

    const undecided = sameGenderRows.filter(({ index }) => !sameGenderChoice[index]).length;

    useEffect(() => {
        const onKey = event => {
            if (event.key === "Escape" && !busy) onCancel();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [busy, onCancel]);

    const handleConfirm = () => {
        const choiceFor = index => {
            const dup = duplicates.find(d => d.index === index);
            return sameGenderChoice[dup && mergeDuplicates ? dup.of : index];
        };

        const rows = resolved
            .map((row, index) => ({ row, index }))
            .filter(({ index }) => !(mergeDuplicates && duplicateIndexes.has(index)))
            .filter(({ row, index }) => !row.sameGender || choiceFor(index) === "together")
            .map(({ row }) => row);

        onConfirm({ rows, newSingers });
    };

    const pairLabel = row => [row.first, row.second].filter(Boolean).join(" & ");
    const keptRows = resolved.length -
        (mergeDuplicates ? duplicates.length : 0) -
        sameGenderRows.filter(({ index }) => sameGenderChoice[index] === "skip").length;

    return (
        <div className="add-singer-backdrop" role="presentation">
            <div className="add-singer-dialog upload-review" role="dialog" aria-modal="true" aria-labelledby="upload-review-title">

                <h3 id="upload-review-title">Check the upload</h3>
                <p className="upload-review-lead">
                    {resolved.length} rows in the file. Nothing goes on the list until you click
                    <b> Continue</b>, and nothing is saved until you click <b>Save final list</b>.
                </p>

                {newSingers.length > 0 && (
                    <section className="upload-review-section">
                        <h4>👤 {newSingers.length} new singer{newSingers.length === 1 ? "" : "s"} to register</h4>
                        <p className="upload-review-hint">
                            Not registered yet. They'll get temporary PIN <b>1234</b> and a temporary phone number -
                            update their numbers later on the Singers page. Check each gender:
                        </p>
                        <ul className="upload-review-singers">
                            {newSingers.map(singer => (
                                <li key={singer.key}>
                                    <span>{singer.name}</span>
                                    <div className="upload-review-gender" role="group" aria-label={`${singer.name} gender`}>
                                        {["Male", "Female"].map(g => (
                                            <button
                                                type="button"
                                                key={g}
                                                className={singer.gender === g ? `is-active ${g.toLowerCase()}` : ""}
                                                onClick={() => setGenders(current => ({ ...current, [singer.key]: g }))}
                                                aria-pressed={singer.gender === g}
                                                disabled={busy}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {sameGenderRows.length > 0 && (
                    <section className="upload-review-section">
                        <h4>🎤 {sameGenderRows.length} song{sameGenderRows.length === 1 ? "" : "s"} with two {
                            sameGenderRows.every(({ row }) => (row.male?.gender || "").toLowerCase() === "female") ? "women" : "men"
                        }</h4>
                        <p className="upload-review-hint">
                            Is this a solo song they sing together? Choose for each one.
                        </p>
                        <ul className="upload-review-rows">
                            {sameGenderRows.map(({ row, index }) => (
                                <li key={index}>
                                    <div>
                                        <strong>{pairLabel(row)}</strong>
                                        <small>{row.title}{row.movie ? ` · ${row.movie}` : ""} · row {row.line}</small>
                                    </div>
                                    <div className="upload-review-choice" role="group" aria-label={`${pairLabel(row)} - ${row.title}`}>
                                        <button
                                            type="button"
                                            className={sameGenderChoice[index] === "together" ? "is-active yes" : ""}
                                            onClick={() => setSameGenderChoice(current => ({ ...current, [index]: "together" }))}
                                            disabled={busy}
                                        >
                                            Yes, sung together
                                        </button>
                                        <button
                                            type="button"
                                            className={sameGenderChoice[index] === "skip" ? "is-active no" : ""}
                                            onClick={() => setSameGenderChoice(current => ({ ...current, [index]: "skip" }))}
                                            disabled={busy}
                                        >
                                            Leave out
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {duplicates.length > 0 && (
                    <section className="upload-review-section">
                        <h4>🔁 {duplicates.length} song{duplicates.length === 1 ? "" : "s"} listed twice</h4>
                        <ul className="upload-review-rows compact">
                            {duplicates.map(d => (
                                <li key={d.index}>
                                    <div>
                                        <strong>{resolved[d.index].title}</strong>
                                        <small>{pairLabel(resolved[d.of])} · rows {resolved[d.of].line} and {resolved[d.index].line}</small>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <label className="upload-review-check">
                            <input
                                type="checkbox"
                                checked={mergeDuplicates}
                                onChange={event => setMergeDuplicates(event.target.checked)}
                                disabled={busy}
                            />
                            Count each as one performance (recommended)
                        </label>
                    </section>
                )}

                {analysis.problems.length > 0 && (
                    <div className="pairing-error">
                        ⚠️ {analysis.problems.slice(0, 4).join(" ")}
                        {analysis.problems.length > 4 ? ` (+${analysis.problems.length - 4} more)` : ""} Those rows will need fixing before you can save.
                    </div>
                )}

                {error && <div className="pairing-error">⚠️ {error}</div>}

                <div className="add-singer-actions upload-review-actions">
                    <span className="upload-review-count">{keptRows} rows will go on the list</span>
                    <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={onCancel} disabled={busy}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="admin-btn admin-btn-primary admin-btn-sm"
                        onClick={handleConfirm}
                        disabled={busy || undecided > 0}
                        title={undecided > 0 ? "Answer every two-singer question first" : undefined}
                    >
                        {busy
                            ? "Registering…"
                            : newSingers.length > 0
                                ? `Register ${newSingers.length} & continue`
                                : "Continue"}
                    </button>
                </div>
                {undecided > 0 && (
                    <p className="upload-review-wait">Answer {undecided} more question{undecided === 1 ? "" : "s"} above to continue.</p>
                )}

            </div>
        </div>
    );
}

export default UploadReviewDialog;
