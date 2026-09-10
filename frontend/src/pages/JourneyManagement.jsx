import { useEffect, useState } from "react";

import AdminTopbar from "../components/admin/AdminTopbar";
import {
    getAllJourneyEvents,
    createJourneyEvent,
    updateJourneyEvent,
    deleteJourneyEvent
} from "../services/journeyService";

import "../styles/adminTheme.css";
import "./JourneyManagement.css";

const EMPTY_FORM = {
    title: "",
    month_label: "",
    date_label: "",
    venue: "",
    sort_date: ""
};

function JourneyManagement() {

    const [events, setEvents] = useState([]);
    const [displayLimit, setDisplayLimit] = useState(6);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);

    const loadEvents = () => {

        setLoading(true);

        getAllJourneyEvents()
            .then(data => {
                setEvents(data.events || []);
                setDisplayLimit(data.display_limit || 6);
                setError("");
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));

    };

    useEffect(() => {
        loadEvents();
    }, []);

    const handleChange = e => {
        const { name, value } = e.target;
        setFormData(current => ({ ...current, [name]: value }));
    };

    const handleImageChange = e => {

        const file = e.target.files?.[0] || null;
        setImageFile(file);

        if (file) {
            setImagePreview(URL.createObjectURL(file));
        }
        else {
            setImagePreview(null);
        }

    };

    const startEdit = event => {

        setEditingId(event.id);

        setFormData({
            title: event.title || "",
            month_label: event.month_label || "",
            date_label: event.date_label || "",
            venue: event.venue || "",
            sort_date: event.sort_date || ""
        });

        setImageFile(null);
        setImagePreview(event.image_url || null);
        setSuccess("");
        setError("");

        window.scrollTo({ top: 0, behavior: "smooth" });

    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData(EMPTY_FORM);
        setImageFile(null);
        setImagePreview(null);
    };

    const handleSubmit = async e => {

        e.preventDefault();
        setError("");
        setSuccess("");

        if (!editingId && !imageFile) {
            setError("Please choose an event image.");
            return;
        }

        setSaving(true);

        const fields = { ...formData };
        if (imageFile) {
            fields.image = imageFile;
        }

        try {

            if (editingId) {
                await updateJourneyEvent(editingId, fields);
                setSuccess("Event updated.");
            }
            else {
                await createJourneyEvent(fields);
                setSuccess("Event added to the musical journey.");
            }

            cancelEdit();
            loadEvents();

        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setSaving(false);
        }

    };

    const handleDelete = async event => {

        if (!window.confirm(`Remove "${event.title}" from the musical journey? This can't be undone.`)) {
            return;
        }

        try {
            await deleteJourneyEvent(event.id);
            setSuccess("Event removed.");
            loadEvents();
        }
        catch (err) {
            setError(err.message);
        }

    };

    return (

        <div className="admin-shell">
            <AdminTopbar />

            <section className="journey-mgmt">

                <h1 className="admin-page-title">Our Musical Journey</h1>
                <p className="admin-page-subtitle">
                    Manage the events shown in the "Our Musical Journey" carousel on the Home page.
                    Only the {displayLimit} most recent (by date below) appear on the homepage - older
                    ones stay here so you can edit or bring them back anytime.
                </p>

                {error && <div className="journey-mgmt-alert error">{error}</div>}
                {success && <div className="journey-mgmt-alert success">{success}</div>}

                <form className="admin-card journey-mgmt-form" onSubmit={handleSubmit}>

                    <h2>{editingId ? "Edit Event" : "Add New Event"}</h2>

                    <div className="journey-mgmt-form-grid">

                        <label>
                            Title
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="e.g. Autumn Anthem"
                                required
                            />
                        </label>

                        <label>
                            Month badge text
                            <input
                                type="text"
                                name="month_label"
                                value={formData.month_label}
                                onChange={handleChange}
                                placeholder="e.g. October 2026"
                                required
                            />
                        </label>

                        <label>
                            Date text (shown under the title)
                            <input
                                type="text"
                                name="date_label"
                                value={formData.date_label}
                                onChange={handleChange}
                                placeholder="e.g. 18 October 2026"
                                required
                            />
                        </label>

                        <label>
                            Venue (optional)
                            <input
                                type="text"
                                name="venue"
                                value={formData.venue}
                                onChange={handleChange}
                                placeholder="e.g. Star Singers Studio, Vadapalani"
                            />
                        </label>

                        <label>
                            Timeline date
                            <input
                                type="date"
                                name="sort_date"
                                value={formData.sort_date}
                                onChange={handleChange}
                                required
                            />
                            <span className="journey-mgmt-hint">
                                Controls ordering and which {displayLimit} events show on the homepage.
                            </span>
                        </label>

                        <label>
                            Event image
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                            />
                        </label>

                    </div>

                    {imagePreview && (
                        <img src={imagePreview} alt="Preview" className="journey-mgmt-preview" />
                    )}

                    <div className="journey-mgmt-form-actions">
                        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                            {saving ? "Saving..." : editingId ? "Save Changes" : "Add Event"}
                        </button>

                        {editingId && (
                            <button type="button" className="admin-btn admin-btn-ghost" onClick={cancelEdit}>
                                Cancel
                            </button>
                        )}
                    </div>

                </form>

                <div className="journey-mgmt-list">

                    {loading && <p>Loading...</p>}

                    {!loading && events.length === 0 && (
                        <p className="admin-card">No events yet - add your first one above.</p>
                    )}

                    {!loading && events.map((event, index) => (

                        <div className="admin-card journey-mgmt-row" key={event.id}>

                            <img src={event.image_url} alt={event.title} className="journey-mgmt-thumb" />

                            <div className="journey-mgmt-row-info">
                                <div className="journey-mgmt-row-title">
                                    {event.title}
                                    {index < displayLimit ? (
                                        <span className="journey-mgmt-badge live">On homepage</span>
                                    ) : (
                                        <span className="journey-mgmt-badge hidden">Not shown</span>
                                    )}
                                </div>
                                <div className="journey-mgmt-row-meta">
                                    {event.month_label} &middot; {event.date_label}
                                    {event.venue ? ` · ${event.venue}` : ""}
                                </div>
                            </div>

                            <div className="journey-mgmt-row-actions">
                                <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => startEdit(event)}>
                                    Edit
                                </button>
                                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(event)}>
                                    Delete
                                </button>
                            </div>

                        </div>

                    ))}

                </div>

            </section>
        </div>

    );

}

export default JourneyManagement;
