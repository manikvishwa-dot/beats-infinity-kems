const { supabase } = require("../config/supabase");

// ==========================================================
// ACTIVE EVENT HELPER
// ==========================================================
//
// Shared by any controller that needs to stamp new rows
// (songs, payments, pairings) with the currently active
// event, or scope a read to it. Returns null if no event is
// active yet (e.g. before the very first event is created) -
// callers should treat that as "unscoped/legacy", not an
// error.
// ==========================================================

const getActiveEventId = async () => {

    const { data, error } = await supabase
        .from("events")
        .select("id")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {

        console.error("GET ACTIVE EVENT ID:", error);
        return null;

    }

    return data?.id || null;

};

module.exports = { getActiveEventId };
