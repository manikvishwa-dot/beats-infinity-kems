// ==========================================================
// BEATS INFINITY - FORGOT PIN REQUESTS (ADMIN)
// ==========================================================
//
// Forgot-PIN OTPs are never shown to the person who asked -
// anyone can type any mobile number. Instead an admin sees the
// request here and sends the OTP on WhatsApp to the singer's
// REGISTERED number, so only the real owner receives it.
//
// GET  /api/v1/admin/pin-resets           - last 24 hours
// POST /api/v1/admin/pin-resets/:id/sent  - mark as sent
// ==========================================================

const { supabase } = require("../../config/supabase");

const MAX_OTP_ATTEMPTS = 5;

const statusOf = (row, now) => {

    if (row.used_at) return "done";
    if (new Date(row.expires_at).getTime() < now) return "expired";
    if ((Number(row.attempts) || 0) >= MAX_OTP_ATTEMPTS) return "locked";
    if (row.verified_at) return "entered";
    if (row.sent_at) return "sent";
    return "waiting";

};


const listPinResets = async (req, res) => {

    try {

        const since =
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: rows, error } = await supabase
            .from("singer_otps")
            .select("id,mobile_number,otp,expires_at,verified_at,used_at,sent_at,attempts,created_at")
            .eq("purpose", "reset_pin")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(200);

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Unable to load PIN reset requests.",
                error: error.message
            });
        }

        const mobiles = [...new Set((rows || []).map((r) => r.mobile_number))];

        let singersByMobile = {};

        if (mobiles.length > 0) {

            const { data: singers } = await supabase
                .from("singers")
                .select("mobile_number,singer_name")
                .in("mobile_number", mobiles);

            singersByMobile = Object.fromEntries(
                (singers || []).map((s) => [s.mobile_number, s.singer_name])
            );

        }

        const now = Date.now();

        const requests = (rows || []).map((row) => {

            const status = statusOf(row, now);

            return {
                id: row.id,
                mobile_number: row.mobile_number,
                singer_name: singersByMobile[row.mobile_number] || null,
                // Only while it can still be used
                otp: ["waiting", "sent"].includes(status) ? row.otp : null,
                status,
                created_at: row.created_at,
                expires_at: row.expires_at,
                sent_at: row.sent_at
            };

        });

        return res.status(200).json({ success: true, requests });

    } catch (error) {

        console.error("❌ List PIN resets:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load PIN reset requests."
        });

    }

};


const markPinResetSent = async (req, res) => {

    try {

        const { data, error } = await supabase
            .from("singer_otps")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", req.params.id)
            .eq("purpose", "reset_pin")
            .select("id,sent_at")
            .maybeSingle();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                message: "Request not found."
            });
        }

        return res.status(200).json({ success: true, sent_at: data.sent_at });

    } catch (error) {

        console.error("❌ Mark PIN reset sent:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update the request."
        });

    }

};


module.exports = {
    listPinResets,
    markPinResetSent
};
