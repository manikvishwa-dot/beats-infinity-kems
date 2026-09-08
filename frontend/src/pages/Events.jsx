import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaCalendarAlt,
    FaMapMarkerAlt,
    FaClock,
    FaCheckCircle,
    FaImage
} from "react-icons/fa";

import Navbar from "../common/Navbar/Navbar";
import { getSession } from "../services/adminService";
import {
    getActiveEvent,
    getEvents,
    createEvent,
    updateEvent,
    activateEvent,
    deleteEvent
} from "../services/eventService";

import "../styles/adminTheme.css";
import "./Events.css";

const formatDate = value => {

    if (!value) {

        return "Date to be announced";

    }

    try {

        return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });

    }
    catch {

        return value;

    }

};

const formatTime = value => {

    if (!value) {

        return "Time to be announced";

    }

    const [hourStr, minuteStr] = value.split(":");
    const hour = parseInt(hourStr, 10);

    if (Number.isNaN(hour)) {

        return value;

    }

    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;

    return `${displayHour}:${minuteStr} ${period}`;

};

const EMPTY_FORM = {
    name: "",
    event_date: "",
    event_time: "",
    venue: "",
    max_seats: "",
    filled_seats: ""
};

function Events() {

    const navigate = useNavigate();

    // Kept as state (not a plain derived const) so the page can
    // react when the admin session changes without a full reload -
    // e.g. logging out in another tab, or on the admin dashboard
    // while this page was already open in the background.
    const [isAdmin, setIsAdmin] = useState(() => Boolean(getSession()?.admin));

    const [activeEvent, setActiveEvent] = useState(null);
    const [otherEvents, setOtherEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [editing, setEditing] = useState(false);
    const [creatingNew, setCreatingNew] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [bannerFile, setBannerFile] = useState(null);
    const [bannerPreview, setBannerPreview] = useState(null);
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {

        try {

            setLoading(true);
            setError("");

            const activeResult = await getActiveEvent();
            setActiveEvent(activeResult.event || null);

            if (isAdmin) {

                const allResult = await getEvents();
                const active = activeResult.event;

                setOtherEvents(
                    (allResult.events || []).filter(item => !active || item.id !== active.id)
                );

            }

        }
        catch (requestError) {

            console.error("Load events error:", requestError);
            setError(requestError.message || "Unable to load event details.");

        }
        finally {

            setLoading(false);

        }

    }, [isAdmin]);

    useEffect(() => {

        loadData();

    }, [loadData]);

    // Re-check the admin session on: a "storage" event (logout/login
    // in another tab), and on window focus / tab visibility (logout
    // via the admin dashboard, then switching back to this tab).
    useEffect(() => {

        const syncAdminState = () => {

            const stillAdmin = Boolean(getSession()?.admin);

            setIsAdmin(current => {

                if (current === stillAdmin) {

                    return current;

                }

                // Session was just revoked - close any open admin
                // panel so it doesn't linger after the controls
                // that opened it are gone.
                if (!stillAdmin) {

                    setEditing(false);
                    setCreatingNew(false);
                    setOtherEvents([]);

                }

                return stillAdmin;

            });

        };

        window.addEventListener("storage", syncAdminState);
        window.addEventListener("focus", syncAdminState);
        document.addEventListener("visibilitychange", syncAdminState);

        return () => {

            window.removeEventListener("storage", syncAdminState);
            window.removeEventListener("focus", syncAdminState);
            document.removeEventListener("visibilitychange", syncAdminState);

        };

    }, []);

    const seatsFilled = activeEvent?.filled_seats || 0;
    const seatsMax = activeEvent?.max_seats || 0;
    const seatsPercent = seatsMax > 0 ? Math.min(100, (seatsFilled / seatsMax) * 100) : 0;

    const openEditForm = () => {

        setCreatingNew(false);
        setFormData({
            name: activeEvent?.name || "",
            event_date: activeEvent?.event_date || "",
            event_time: activeEvent?.event_time || "",
            venue: activeEvent?.venue || "",
            max_seats: activeEvent?.max_seats ?? "",
            filled_seats: activeEvent?.filled_seats ?? ""
        });
        setBannerFile(null);
        setBannerPreview(null);
        setEditing(true);

    };

    const openCreateForm = () => {

        setCreatingNew(true);
        setFormData(EMPTY_FORM);
        setBannerFile(null);
        setBannerPreview(null);
        setEditing(true);

    };

    const closeForm = () => {

        if (saving) {

            return;

        }

        setEditing(false);
        setCreatingNew(false);

    };

    const handleChange = event => {

        const { name, value } = event.target;
        setFormData(current => ({ ...current, [name]: value }));

    };

    const handleBannerChange = event => {

        const file = event.target.files?.[0];

        if (!file) {

            return;

        }

        setBannerFile(file);
        setBannerPreview(URL.createObjectURL(file));

    };

    const handleSave = async event => {

        event.preventDefault();

        if (!formData.name.trim()) {

            alert("Please enter the event name.");
            return;

        }

        setSaving(true);
        setError("");

        const fields = {
            name: formData.name,
            event_date: formData.event_date,
            event_time: formData.event_time,
            venue: formData.venue,
            max_seats: formData.max_seats || 0,
            filled_seats: formData.filled_seats || 0
        };

        if (bannerFile) {

            fields.banner = bannerFile;

        }

        try {

            if (creatingNew || !activeEvent) {

                await createEvent({ ...fields, is_active: !activeEvent });

            }
            else {

                await updateEvent(activeEvent.id, fields);

            }

            setEditing(false);
            setCreatingNew(false);
            await loadData();

        }
        catch (requestError) {

            console.error("Save event error:", requestError);
            setError(requestError.message || "Unable to save event.");

        }
        finally {

            setSaving(false);

        }

    };

    const handleActivate = async eventId => {

        try {

            await activateEvent(eventId);
            await loadData();

        }
        catch (requestError) {

            console.error("Activate event error:", requestError);
            setError(requestError.message || "Unable to activate event.");

        }

    };

    const handleDelete = async eventId => {

        const confirmed = window.confirm("Delete this event permanently?");

        if (!confirmed) {

            return;

        }

        try {

            await deleteEvent(eventId);
            await loadData();

        }
        catch (requestError) {

            console.error("Delete event error:", requestError);
            setError(requestError.message || "Unable to delete event.");

        }

    };

    const bannerSrc = useMemo(
        () => bannerPreview || activeEvent?.banner_image_url || null,
        [bannerPreview, activeEvent]
    );

    return (
        <div className="events-page">
            <Navbar />

            <div className="events-page-inner">

                {isAdmin && (
                    <button
                        type="button"
                        className="admin-btn admin-btn-ghost admin-btn-sm events-back-to-admin-btn"
                        onClick={() => navigate("/admin")}
                    >
                        ← Back to Admin Dashboard
                    </button>
                )}

                <div className="events-page-header">
                    <span className="events-page-eyebrow">BEATS ∞ INFINITY</span>
                    <h1>Upcoming Event</h1>
                </div>

                {error && <div className="events-page-error">⚠️ {error}</div>}

                {loading ? (
                    <div className="events-empty-state">Loading event details...</div>
                ) : !activeEvent ? (
                    <div className="events-empty-state">
                        <FaCalendarAlt size={32} />
                        <p>No event scheduled yet. Check back soon!</p>
                    </div>
                ) : (
                    <div className="event-showcase-card">
                        {activeEvent.banner_image_url ? (
                            <img
                                src={activeEvent.banner_image_url}
                                alt={activeEvent.name}
                                className="event-showcase-banner"
                            />
                        ) : (
                            <div className="event-showcase-banner-placeholder">
                                <FaImage size={36} />
                            </div>
                        )}

                        <div className="event-showcase-content">
                            <h2>{activeEvent.name}</h2>

                            <div className="event-showcase-info">
                                <div className="event-showcase-row">
                                    <FaCalendarAlt />
                                    <span>{formatDate(activeEvent.event_date)}</span>
                                </div>
                                <div className="event-showcase-row">
                                    <FaClock />
                                    <span>{formatTime(activeEvent.event_time)}</span>
                                </div>
                                <div className="event-showcase-row">
                                    <FaMapMarkerAlt />
                                    <span>{activeEvent.venue || "Venue to be announced"}</span>
                                </div>
                            </div>

                            <div className="event-showcase-registration">
                                <div className="event-showcase-registration-header">
                                    <div className="event-showcase-status">
                                        <FaCheckCircle />
                                        <span>Registration Open</span>
                                    </div>
                                    <span>{seatsFilled} / {seatsMax} Seats Filled</span>
                                </div>

                                <div className="event-showcase-progress">
                                    <div
                                        className="event-showcase-progress-fill"
                                        style={{ width: `${seatsPercent}%` }}
                                    />
                                </div>

                                <button
                                    type="button"
                                    className="event-showcase-register-btn"
                                    onClick={() => navigate("/login")}
                                >
                                    Register for Event
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isAdmin && !editing && (
                    <div className="events-admin-actions">
                        {activeEvent && (
                            <button type="button" className="admin-btn admin-btn-primary" onClick={openEditForm}>
                                ✎ Edit Event Details
                            </button>
                        )}
                        <button type="button" className="admin-btn admin-btn-outline" onClick={openCreateForm}>
                            + Create New Event
                        </button>
                    </div>
                )}

                {isAdmin && editing && (
                    <form className="event-edit-form" onSubmit={handleSave}>
                        <h3>{creatingNew || !activeEvent ? "Create Event" : "Edit Event Details"}</h3>

                        <div className="event-edit-banner-row">
                            {bannerSrc ? (
                                <img src={bannerSrc} alt="Banner preview" className="event-edit-banner-preview" />
                            ) : (
                                <div className="event-edit-banner-placeholder">
                                    <FaImage size={24} />
                                </div>
                            )}

                            <label className="admin-btn admin-btn-ghost admin-btn-sm event-edit-upload-btn">
                                Upload Banner Image
                                <input type="file" accept="image/*" hidden onChange={handleBannerChange} />
                            </label>
                        </div>

                        <div className="event-edit-grid">
                            <div className="event-edit-field event-edit-field-full">
                                <label>Event Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Beats Kondattam" />
                            </div>

                            <div className="event-edit-field">
                                <label>Date of Event</label>
                                <input type="date" name="event_date" value={formData.event_date} onChange={handleChange} />
                            </div>

                            <div className="event-edit-field">
                                <label>Time of Event</label>
                                <input type="time" name="event_time" value={formData.event_time} onChange={handleChange} />
                            </div>

                            <div className="event-edit-field event-edit-field-full">
                                <label>Venue</label>
                                <input type="text" name="venue" value={formData.venue} onChange={handleChange} placeholder="e.g. Star Singers Studio, Vadapalani" />
                            </div>

                            <div className="event-edit-field">
                                <label>Maximum Seats</label>
                                <input type="number" min="0" name="max_seats" value={formData.max_seats} onChange={handleChange} />
                            </div>

                            <div className="event-edit-field">
                                <label>Filled Seats</label>
                                <input type="number" min="0" name="filled_seats" value={formData.filled_seats} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="event-edit-actions">
                            <button type="button" className="admin-btn admin-btn-ghost" onClick={closeForm} disabled={saving}>
                                Cancel
                            </button>
                            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                                {saving ? "Saving..." : "Save Event"}
                            </button>
                        </div>
                    </form>
                )}

                {isAdmin && otherEvents.length > 0 && (
                    <div className="events-other-list">
                        <h3>Other Events</h3>

                        {otherEvents.map(item => (
                            <div className="events-other-row" key={item.id}>
                                <div>
                                    <strong>{item.name}</strong>
                                    <span>{formatDate(item.event_date)}</span>
                                </div>

                                <div className="events-other-row-actions">
                                    <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => handleActivate(item.id)}>
                                        Set Active
                                    </button>
                                    <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(item.id)}>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );

}

export default Events;
