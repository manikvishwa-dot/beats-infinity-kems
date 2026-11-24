const { supabase } = require("../../config/supabase");

// ==========================================================
// BEATS INFINITY - ADMIN DASHBOARD INSIGHTS
//
// GET /api/v1/admin/stats/overview   (any admin)
//
// One bundle for the chart-based Admin Dashboard. Deliberately
// money-free - revenue / expenses / profit stay behind the
// Super Admin endpoints (stats/event-analytics).
//
// "Registered" for an event = a singer with a Paid or Pending
// payment for it (Rejected doesn't count). A Paid payment of
// Rs 0 is a free entry (guest / management team).
// ==========================================================

const DAY_MS = 24 * 60 * 60 * 1000;

const genderKey = gender =>
    gender === "Male" ? "male" : gender === "Female" ? "female" : "other";

const monthKey = date => {
    const d = new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const getDashboardOverview = async (req, res) => {

    try {

        const [eventsResult, singersResult, paymentsResult, pairingsResult, songsResult] = await Promise.all([
            supabase
                .from("events")
                .select("id,name,event_date,created_at,is_active,max_seats"),
            supabase
                .from("singers")
                .select("id,singer_name,gender,created_at"),
            supabase
                .from("payments")
                .select("event_id,singer_id,status,amount,payment_type,created_at"),
            supabase
                .from("pairings")
                .select("event_id"),
            supabase
                .from("songs")
                .select("event_id")
        ]);

        for (const [label, result] of [
            ["events", eventsResult],
            ["singers", singersResult],
            ["payments", paymentsResult],
            ["pairings", pairingsResult],
            ["songs", songsResult]
        ]) {
            if (result.error) {
                console.error(`DASHBOARD OVERVIEW - ${label.toUpperCase()}:`, result.error);
                return res.status(500).json({
                    success: false,
                    message: `Unable to load ${label}.`,
                    error: result.error.message
                });
            }
        }

        const singers = singersResult.data || [];
        const singerById = new Map(singers.map(s => [s.id, s]));

        // Oldest event first - "returning" means seen at an earlier one
        const events = (eventsResult.data || [])
            .map(e => ({ ...e, date: e.event_date || e.created_at }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const countBy = rows => {
            const map = new Map();
            (rows || []).forEach(r => map.set(r.event_id, (map.get(r.event_id) || 0) + 1));
            return map;
        };
        const pairingsByEvent = countBy(pairingsResult.data);
        const songsByEvent = countBy(songsResult.data);

        // One record per (event, singer): its best status and the
        // first time they registered for it
        const STATUS_RANK = { Paid: 3, Pending: 2, Rejected: 1 };
        const entries = new Map();

        (paymentsResult.data || []).forEach(p => {
            if (!p.event_id || !p.singer_id) return;

            const key = `${p.event_id}|${p.singer_id}`;
            const current = entries.get(key);

            if (!current) {
                entries.set(key, {
                    event_id: p.event_id,
                    singer_id: p.singer_id,
                    status: p.status,
                    amount: Number(p.amount || 0),
                    walkIn: p.payment_type === "Walk-in",
                    firstAt: p.created_at
                });
                return;
            }

            if ((STATUS_RANK[p.status] || 0) > (STATUS_RANK[current.status] || 0)) {
                current.status = p.status;
                current.amount = Number(p.amount || 0);
            }
            if (p.payment_type === "Walk-in") current.walkIn = true;
            if (p.created_at < current.firstAt) current.firstAt = p.created_at;
        });

        const entriesByEvent = new Map(events.map(e => [e.id, []]));
        entries.forEach(entry => entriesByEvent.get(entry.event_id)?.push(entry));

        // --------------------------------------------------
        // PER EVENT
        // --------------------------------------------------

        const seenBefore = new Set();
        const eventsAttended = new Map();   // singer -> events registered for

        const eventRows = events.map(event => {

            const list = entriesByEvent.get(event.id) || [];
            const registered = list.filter(e => e.status === "Paid" || e.status === "Pending");
            const eventDate = new Date(event.date).getTime();

            const row = {
                event_id: event.id,
                event_name: event.name,
                event_date: event.date,
                is_active: Boolean(event.is_active),
                max_seats: event.max_seats || null,

                registered: registered.length,
                paid: registered.filter(e => e.status === "Paid" && e.amount > 0).length,
                free: registered.filter(e => e.status === "Paid" && e.amount <= 0).length,
                pending: registered.filter(e => e.status === "Pending").length,
                rejected: list.filter(e => e.status === "Rejected").length,
                walk_ins: registered.filter(e => e.walkIn).length,

                male: 0,
                female: 0,
                other: 0,
                first_timers: 0,
                returning: 0,

                songs: songsByEvent.get(event.id) || 0,
                pairings: pairingsByEvent.get(event.id) || 0,

                // How many days before the event each singer signed
                // up - the dashboard turns this into a pace curve
                registration_days_before: []
            };

            registered.forEach(entry => {
                row[genderKey(singerById.get(entry.singer_id)?.gender)] += 1;

                if (seenBefore.has(entry.singer_id)) row.returning += 1;
                else row.first_timers += 1;

                eventsAttended.set(entry.singer_id, (eventsAttended.get(entry.singer_id) || 0) + 1);

                const days = Math.max(0, Math.ceil((eventDate - new Date(entry.firstAt).getTime()) / DAY_MS));
                row.registration_days_before.push(days);
            });

            registered.forEach(entry => seenBefore.add(entry.singer_id));

            return row;

        });

        // --------------------------------------------------
        // MEMBERS (everyone who has signed up)
        // --------------------------------------------------

        const now = Date.now();
        const gender = { male: 0, female: 0, other: 0 };
        const signupsByMonth = new Map();

        singers.forEach(s => {
            gender[genderKey(s.gender)] += 1;
            const key = monthKey(s.created_at);
            signupsByMonth.set(key, (signupsByMonth.get(key) || 0) + 1);
        });

        // Last 12 months, oldest first, zero-filled
        const monthly_signups = [];
        const cursor = new Date();
        cursor.setUTCDate(1);
        cursor.setUTCMonth(cursor.getUTCMonth() - 11);
        for (let i = 0; i < 12; i += 1) {
            const key = monthKey(cursor);
            monthly_signups.push({ month: key, count: signupsByMonth.get(key) || 0 });
            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }

        const engagement = { never: 0, once: 0, repeat: 0 };
        singers.forEach(s => {
            const n = eventsAttended.get(s.id) || 0;
            if (n === 0) engagement.never += 1;
            else if (n === 1) engagement.once += 1;
            else engagement.repeat += 1;
        });

        const top_singers = [...eventsAttended.entries()]
            .filter(([id]) => singerById.has(id))
            .map(([id, count]) => ({
                singer_name: singerById.get(id).singer_name,
                gender: singerById.get(id).gender || "Other",
                events: count
            }))
            .sort((a, b) => b.events - a.events || a.singer_name.localeCompare(b.singer_name))
            .slice(0, 8);

        return res.status(200).json({
            success: true,
            generated_at: new Date().toISOString(),
            members: {
                total: singers.length,
                new_last_30_days: singers.filter(s => now - new Date(s.created_at).getTime() <= 30 * DAY_MS).length,
                gender,
                engagement,
                monthly_signups,
                top_singers
            },
            events: eventRows
        });

    }
    catch (error) {
        console.error("DASHBOARD OVERVIEW EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }

};

module.exports = {
    getDashboardOverview
};
