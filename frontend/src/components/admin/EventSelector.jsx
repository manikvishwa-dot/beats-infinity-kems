import { useEffect, useRef, useState } from "react";

import "./EventSelector.css";

const MAX_SELECTABLE = 3;

// Multi-select event picker, capped at MAX_SELECTABLE - used to
// scope an admin view to one event, or compare up to 3 side by
// side. `events` is the full list ({id, name, is_active, ...}).
// Optional: loading (events still on their way), loadError (why
// they couldn't be loaded) and onRetry - so a failed load isn't
// mistaken for "there are no events".
function EventSelector({ events, selectedIds, onChange, loading = false, loadError = "", onRetry }) {

    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {

        const handleClickOutside = event => {

            if (containerRef.current && !containerRef.current.contains(event.target)) {

                setOpen(false);

            }

        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);

    }, []);

    const toggleEvent = eventId => {

        if (selectedIds.includes(eventId)) {

            onChange(selectedIds.filter(id => id !== eventId));
            return;

        }

        if (selectedIds.length >= MAX_SELECTABLE) {

            return;

        }

        onChange([...selectedIds, eventId]);

    };

    const selectedNames = events
        .filter(event => selectedIds.includes(event.id))
        .map(event => event.name);

    const label =
        loading && events.length === 0
            ? "Loading events..."
            : loadError && events.length === 0
                ? "Events couldn't load"
                : selectedNames.length === 0
            ? "Select event(s)"
            : selectedNames.length === 1
                ? selectedNames[0]
                : `${selectedNames.length} events selected`;

    return (
        <div className="event-selector" ref={containerRef}>
            <button type="button" className="event-selector-trigger" onClick={() => setOpen(current => !current)}>
                <span>{label}</span>
                <span className="event-selector-count">{selectedIds.length}/{MAX_SELECTABLE}</span>
            </button>

            {open && (
                <div className="event-selector-panel">
                    {events.length === 0 ? (
                        loading ? (
                            <div className="event-selector-empty">Loading events...</div>
                        ) : loadError ? (
                            <div className="event-selector-empty">
                                ⚠️ {loadError}
                                {onRetry && (
                                    <button
                                        type="button"
                                        className="admin-btn admin-btn-outline admin-btn-sm event-selector-retry"
                                        onClick={onRetry}
                                    >
                                        Retry
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="event-selector-empty">No events yet</div>
                        )
                    ) : (
                        events.map(event => {

                            const checked = selectedIds.includes(event.id);
                            const disabled = !checked && selectedIds.length >= MAX_SELECTABLE;

                            return (
                                <label
                                    key={event.id}
                                    className={disabled ? "event-selector-option disabled" : "event-selector-option"}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={disabled}
                                        onChange={() => toggleEvent(event.id)}
                                    />
                                    <span>{event.name}</span>
                                    {event.is_active && <span className="event-selector-active-tag">Active</span>}
                                </label>
                            );

                        })
                    )}

                    <p className="event-selector-hint">Select up to {MAX_SELECTABLE} events to compare.</p>
                </div>
            )}
        </div>
    );

}

export default EventSelector;
