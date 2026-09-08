const { supabase } = require("../../config/supabase");

// ==========================================================
// BEATS INFINITY - EVENT CONTROLLER
// ==========================================================
//
// A single "active" event drives both the public /events page
// and the Home page hero banner. Only one event is active at a
// time - activating one deactivates every other row (enforced
// in application code, not a DB constraint).
// ==========================================================

const BANNER_BUCKET = "event-banners";

const uploadBanner = async file => {

    const extension = (file.originalname.split(".").pop() || "jpg").toLowerCase();
    const path = `banners/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const { error: uploadError } = await supabase.storage
        .from(BANNER_BUCKET)
        .upload(path, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });

    if (uploadError) {

        throw new Error(uploadError.message || "Unable to upload banner image.");

    }

    const { data } = supabase.storage.from(BANNER_BUCKET).getPublicUrl(path);

    return data.publicUrl;

};

const toIntOrZero = value => {

    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;

};


// ==========================================================
// GET ACTIVE EVENT (public)
//
// GET /api/v1/events/active
// ==========================================================

const getActiveEvent = async (req, res) => {

    try {

        const { data, error } = await supabase
            .from("events")
            .select("*")
            .eq("is_active", true)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {

            console.error("GET ACTIVE EVENT:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load the active event.",
                error: error.message
            });

        }

        return res.status(200).json({
            success: true,
            event: data || null
        });

    }

    catch (error) {

        console.error("GET ACTIVE EVENT EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });

    }

};


// ==========================================================
// GET ALL EVENTS (admin)
//
// GET /api/v1/events
// ==========================================================

const getEvents = async (req, res) => {

    try {

        const { data, error } = await supabase
            .from("events")
            .select("*")
            .order("event_date", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });

        if (error) {

            console.error("GET EVENTS:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load events.",
                error: error.message
            });

        }

        return res.status(200).json({
            success: true,
            events: data || []
        });

    }

    catch (error) {

        console.error("GET EVENTS EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });

    }

};


// ==========================================================
// CREATE EVENT (admin)
//
// POST /api/v1/events (multipart/form-data)
// Fields: name, event_date, event_time, venue, max_seats,
//         filled_seats, is_active, banner (file, optional)
// ==========================================================

const createEvent = async (req, res) => {

    try {

        const {
            name,
            event_date,
            event_time,
            venue,
            max_seats,
            filled_seats,
            is_active
        } = req.body;

        if (!name || !String(name).trim()) {

            return res.status(400).json({
                success: false,
                message: "Event name is required."
            });

        }

        let bannerUrl = null;

        if (req.file) {

            bannerUrl = await uploadBanner(req.file);

        }

        const shouldActivate = is_active === "true" || is_active === true;

        if (shouldActivate) {

            await supabase.from("events").update({ is_active: false }).eq("is_active", true);

        }

        const { data, error } = await supabase
            .from("events")
            .insert({
                name: String(name).trim(),
                banner_image_url: bannerUrl,
                event_date: event_date || null,
                event_time: event_time || null,
                venue: venue || null,
                max_seats: toIntOrZero(max_seats),
                filled_seats: toIntOrZero(filled_seats),
                is_active: shouldActivate
            })
            .select()
            .single();

        if (error) {

            console.error("CREATE EVENT:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to create event.",
                error: error.message
            });

        }

        return res.status(201).json({
            success: true,
            message: "Event created.",
            event: data
        });

    }

    catch (error) {

        console.error("CREATE EVENT EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error."
        });

    }

};


// ==========================================================
// UPDATE EVENT (admin)
//
// PUT /api/v1/events/:id (multipart/form-data)
// ==========================================================

const updateEvent = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            name,
            event_date,
            event_time,
            venue,
            max_seats,
            filled_seats,
            is_active
        } = req.body;

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (name !== undefined) {

            if (!String(name).trim()) {

                return res.status(400).json({
                    success: false,
                    message: "Event name cannot be empty."
                });

            }

            updateData.name = String(name).trim();

        }

        if (event_date !== undefined) updateData.event_date = event_date || null;
        if (event_time !== undefined) updateData.event_time = event_time || null;
        if (venue !== undefined) updateData.venue = venue || null;
        if (max_seats !== undefined) updateData.max_seats = toIntOrZero(max_seats);
        if (filled_seats !== undefined) updateData.filled_seats = toIntOrZero(filled_seats);

        if (req.file) {

            updateData.banner_image_url = await uploadBanner(req.file);

        }

        if (is_active !== undefined) {

            const shouldActivate = is_active === "true" || is_active === true;

            if (shouldActivate) {

                await supabase.from("events").update({ is_active: false }).eq("is_active", true);

            }

            updateData.is_active = shouldActivate;

        }

        const { data, error } = await supabase
            .from("events")
            .update(updateData)
            .eq("id", id)
            .select()
            .maybeSingle();

        if (error) {

            console.error("UPDATE EVENT:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to update event.",
                error: error.message
            });

        }

        if (!data) {

            return res.status(404).json({
                success: false,
                message: "Event not found."
            });

        }

        return res.status(200).json({
            success: true,
            message: "Event updated.",
            event: data
        });

    }

    catch (error) {

        console.error("UPDATE EVENT EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error."
        });

    }

};


// ==========================================================
// ACTIVATE EVENT (admin)
//
// PUT /api/v1/events/:id/activate
// ==========================================================

const activateEvent = async (req, res) => {

    try {

        const { id } = req.params;

        await supabase.from("events").update({ is_active: false }).eq("is_active", true);

        const { data, error } = await supabase
            .from("events")
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .maybeSingle();

        if (error) {

            console.error("ACTIVATE EVENT:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to activate event.",
                error: error.message
            });

        }

        if (!data) {

            return res.status(404).json({
                success: false,
                message: "Event not found."
            });

        }

        return res.status(200).json({
            success: true,
            message: `"${data.name}" is now the active event.`,
            event: data
        });

    }

    catch (error) {

        console.error("ACTIVATE EVENT EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });

    }

};


// ==========================================================
// DELETE EVENT (admin)
//
// DELETE /api/v1/events/:id
// ==========================================================

const deleteEvent = async (req, res) => {

    try {

        const { id } = req.params;

        const { error } = await supabase
            .from("events")
            .delete()
            .eq("id", id);

        if (error) {

            console.error("DELETE EVENT:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to delete event.",
                error: error.message
            });

        }

        return res.status(200).json({
            success: true,
            message: "Event deleted."
        });

    }

    catch (error) {

        console.error("DELETE EVENT EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });

    }

};

module.exports = {
    getActiveEvent,
    getEvents,
    createEvent,
    updateEvent,
    activateEvent,
    deleteEvent
};
