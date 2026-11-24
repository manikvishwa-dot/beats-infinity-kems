import { useEffect, useMemo, useRef, useState } from "react";

import { addEventSinger } from "../../services/adminDashboardService";

// ==========================================================
// ADD A SINGER TO THIS EVENT (last-minute walk-ins)
//
// Either pick someone already registered (from another event),
// or register a brand-new singer with name + mobile number.
// ==========================================================

function AddSingerDialog({ eventId, gender, otherSingers, onAdded, onClose }) {

    const [mode, setMode] = useState(otherSingers.length > 0 ? "existing" : "new");
    const [search, setSearch] = useState("");
    const [pickedId, setPickedId] = useState("");
    const [name, setName] = useState("");
    const [mobile, setMobile] = useState("");
    const [dob, setDob] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const firstFieldRef = useRef(null);

    const label = gender === "female" ? "female" : "male";

    useEffect(() => {
        firstFieldRef.current?.focus();
    }, [mode]);

    useEffect(() => {
        const onKey = event => { if (event.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const matches = useMemo(() => {
        const wanted = search.trim().toLowerCase();
        return otherSingers.filter(singer =>
            !wanted || singer.singer_name.toLowerCase().includes(wanted)
        );
    }, [otherSingers, search]);

    const handleSubmit = async event => {

        event.preventDefault();
        setError("");

        const payload = mode === "existing"
            ? { singer_id: pickedId }
            : {
                singer_name: name.trim(),
                gender: label,
                mobile_number: mobile,
                date_of_birth: dob
            };

        if (mode === "existing" && !pickedId) {
            setError("Pick a singer from the list.");
            return;
        }

        if (mode === "new") {
            if (payload.singer_name.length < 2) {
                setError("Enter the singer's name.");
                return;
            }
            if (!/^\d{10}$/.test(mobile.replace(/\D/g, "").slice(-10))) {
                setError("Enter a 10-digit mobile number.");
                return;
            }
        }

        setSaving(true);

        try {
            const result = await addEventSinger(eventId, payload);
            onAdded(result.singer, result.message);
        }
        catch (requestError) {
            setError(requestError.message || "Unable to add the singer.");
            setSaving(false);
        }

    };

    return (
        <div className="add-singer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
            <form
                className="add-singer-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-singer-title"
                onSubmit={handleSubmit}
            >
                <h3 id="add-singer-title">Add a {label} singer to this event</h3>

                <div className="add-singer-modes" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === "existing"}
                        className={mode === "existing" ? "is-active" : ""}
                        onClick={() => { setMode("existing"); setError(""); }}
                        disabled={otherSingers.length === 0}
                    >
                        Already registered
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === "new"}
                        className={mode === "new" ? "is-active" : ""}
                        onClick={() => { setMode("new"); setError(""); }}
                    >
                        New singer
                    </button>
                </div>

                {mode === "existing" ? (
                    <>
                        <input
                            ref={firstFieldRef}
                            className="final-input"
                            placeholder={`Search ${label} singers...`}
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                        />
                        <div className="add-singer-list" role="listbox" aria-label="Registered singers">
                            {matches.length === 0 ? (
                                <p className="add-singer-none">
                                    No match - use <b>New singer</b> to register them.
                                </p>
                            ) : matches.map(singer => (
                                <button
                                    key={singer.id}
                                    type="button"
                                    role="option"
                                    aria-selected={pickedId === singer.id}
                                    className={pickedId === singer.id ? "is-picked" : ""}
                                    onClick={() => setPickedId(singer.id)}
                                    onDoubleClick={() => setPickedId(singer.id)}
                                >
                                    {singer.singer_name}
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="add-singer-fields">
                        <label>
                            Name
                            <input
                                ref={firstFieldRef}
                                className="final-input"
                                value={name}
                                onChange={event => setName(event.target.value)}
                                autoComplete="off"
                            />
                        </label>
                        <label>
                            Mobile number
                            <input
                                className="final-input"
                                value={mobile}
                                inputMode="numeric"
                                placeholder="10 digits"
                                onChange={event => setMobile(event.target.value)}
                                autoComplete="off"
                            />
                        </label>
                        <label>
                            <span>Date of birth <span className="add-singer-optional">(optional)</span></span>
                            <input
                                className="final-input"
                                type="date"
                                value={dob}
                                onChange={event => setDob(event.target.value)}
                            />
                        </label>
                        <p className="add-singer-note">
                            They can log in later with this mobile number. If it's already
                            registered, that singer is added instead of a duplicate.
                        </p>
                    </div>
                )}

                {error && <div className="pairing-error">⚠️ {error}</div>}

                <div className="add-singer-actions">
                    <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm" disabled={saving}>
                        {saving ? "Adding..." : "Add to event"}
                    </button>
                </div>
            </form>
        </div>
    );

}

export default AddSingerDialog;
