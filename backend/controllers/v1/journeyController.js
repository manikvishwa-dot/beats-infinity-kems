const { supabase } = require("../../config/supabase");

// ==========================================================
// BEATS INFINITY - JOURNEY CONTROLLER
// ==========================================================
//
// Backs the Home page "Our Musical Journey" carousel. Every
// event ever added stays in the table so admins can go back
// and edit/remove any of them - the public homepage just shows
// the most recent JOURNEY_DISPLAY_LIMIT by sort_date, so adding
// a new one naturally rolls the oldest one out of view without
// anyone needing to delete anything.
// ==========================================================

const JOURNEY_DISPLAY_LIMIT = 6;
const JOURNEY_BUCKET = "event-banners";

const uploadJourneyImage = async file => {

    const extension = (file.originalname.split(".").pop() || "jpg").toLowerCase();
    const path = `journey/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const { error: uploadError } = await supabase.storage
        .from(JOURNEY_BUCKET)
        .upload(path, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });

    if (uploadError) {

        throw new Error(uploadError.message || "Unable to upload event image.");

    }

    const { data } = supabase.storage.from(JOURNEY_BUCKET).getPublicUrl(path);

    return data.publicUrl;

};


// ==========================================================
// PUBLIC - MOST RECENT N EVENTS
//
// GET /api/v1/journey
// ==========================================================

const getJourneyEvents = async (req, res) => {

    const { data, error } = await supabase
        .from("journey_events")
        .select("*")
        .order("sort_date", { ascending: false })
        .limit(JOURNEY_DISPLAY_LIMIT);

    if (error) {

        console.error("GET JOURNEY EVENTS:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load the musical journey."
        });

    }

    return res.status(200).json({
        success: true,
        events: data
    });

};


// ==========================================================
// ADMIN - LIST ALL (management page)
//
// GET /api/v1/journey/all
// ==========================================================

const getAllJourneyEvents = async (req, res) => {

    const { data, error } = await supabase
        .from("journey_events")
        .select("*")
        .order("sort_date", { ascending: false });

    if (error) {

        console.error("GET ALL JOURNEY EVENTS:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load journey events."
        });

    }

    return res.status(200).json({
        success: true,
        events: data,
        display_limit: JOURNEY_DISPLAY_LIMIT
    });

};


// ==========================================================
// ADMIN - CREATE
//
// POST /api/v1/journey  (multipart: image + fields)
// ==========================================================

const createJourneyEvent = async (req, res) => {

    const { title, month_label, date_label, venue, sort_date } = req.body;

    if (!title || !String(title).trim()) {
        return res.status(400).json({ success: false, message: "Title is required." });
    }

    if (!month_label || !String(month_label).trim()) {
        return res.status(400).json({ success: false, message: "Month label is required (e.g. \"October 2026\")." });
    }

    if (!date_label || !String(date_label).trim()) {
        return res.status(400).json({ success: false, message: "Date label is required." });
    }

    if (!sort_date) {
        return res.status(400).json({ success: false, message: "A date is required to place this in the timeline." });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, message: "An event image is required." });
    }

    try {

        const imageUrl = await uploadJourneyImage(req.file);

        const { data, error } = await supabase
            .from("journey_events")
            .insert({
                title: String(title).trim(),
                month_label: String(month_label).trim(),
                date_label: String(date_label).trim(),
                venue: venue ? String(venue).trim() : null,
                image_url: imageUrl,
                sort_date
            })
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }

        return res.status(201).json({
            success: true,
            message: "Event added to the musical journey.",
            event: data
        });

    }
    catch (error) {

        console.error("CREATE JOURNEY EVENT:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to add this event."
        });

    }

};


// ==========================================================
// ADMIN - UPDATE
//
// PUT /api/v1/journey/:id  (multipart: optional new image)
// ==========================================================

const updateJourneyEvent = async (req, res) => {

    const { id } = req.params;
    const { title, month_label, date_label, venue, sort_date } = req.body;

    const updateData = {};

    if (title !== undefined) updateData.title = String(title).trim();
    if (month_label !== undefined) updateData.month_label = String(month_label).trim();
    if (date_label !== undefined) updateData.date_label = String(date_label).trim();
    if (venue !== undefined) updateData.venue = venue ? String(venue).trim() : null;
    if (sort_date !== undefined) updateData.sort_date = sort_date;

    try {

        if (req.file) {
            updateData.image_url = await uploadJourneyImage(req.file);
        }

        const { data, error } = await supabase
            .from("journey_events")
            .update(updateData)
            .eq("id", id)
            .select()
            .maybeSingle();

        if (error) {
            throw new Error(error.message);
        }

        if (!data) {
            return res.status(404).json({ success: false, message: "Journey event not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Event updated.",
            event: data
        });

    }
    catch (error) {

        console.error("UPDATE JOURNEY EVENT:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to update this event."
        });

    }

};


// ==========================================================
// ADMIN - DELETE
//
// DELETE /api/v1/journey/:id
// ==========================================================

const deleteJourneyEvent = async (req, res) => {

    const { id } = req.params;

    const { error } = await supabase
        .from("journey_events")
        .delete()
        .eq("id", id);

    if (error) {

        console.error("DELETE JOURNEY EVENT:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to remove this event."
        });

    }

    return res.status(200).json({
        success: true,
        message: "Event removed."
    });

};


module.exports = {
    getJourneyEvents,
    getAllJourneyEvents,
    createJourneyEvent,
    updateJourneyEvent,
    deleteJourneyEvent
};
