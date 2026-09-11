const { supabase } = require("../../config/supabase");

// ==========================================================
// BEATS INFINITY - SUPER ADMIN STATS CONTROLLER
// ==========================================================
//
// Cross-event analytics for the Super Admin dashboard:
//   - Singers who registered (Pending or Paid), per event
//   - Revenue vs expenses, per event
// both scoped to events held in the last 6 months. Both are
// read-only aggregations over existing tables - no new schema
// required.
// ==========================================================

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

const getRecentEvents = async () => {

    const cutoff = new Date(Date.now() - SIX_MONTHS_MS);

    const { data: events, error } = await supabase
        .from("events")
        .select("id,name,event_date,created_at")
        .order("event_date", { ascending: true, nullsFirst: false });

    if (error) {
        throw error;
    }

    return (events || []).filter(event => {
        const reference = event.event_date ? new Date(event.event_date) : new Date(event.created_at);
        return reference >= cutoff;
    });

};


// ==========================================================
// SINGERS PER EVENT - LAST 6 MONTHS
//
// GET /api/v1/admin/stats/singers-per-event
//
// "Participated" = has a payment for that event that isn't
// Rejected - a singer who has registered and is mid-pipeline
// (Pending) still counts, not just fully confirmed (Paid) ones.
// ==========================================================

const getSingersPerEvent = async (req, res) => {

    try {

        const recentEvents = await getRecentEvents();

        if (recentEvents.length === 0) {
            return res.status(200).json({
                success: true,
                events: []
            });
        }

        const eventIds = recentEvents.map(event => event.id);

        const { data: payments, error: paymentsError } = await supabase
            .from("payments")
            .select("event_id,singer_id,status")
            .in("event_id", eventIds)
            .neq("status", "Rejected");

        if (paymentsError) {
            console.error("SINGERS PER EVENT - PAYMENTS:", paymentsError);

            return res.status(500).json({
                success: false,
                message: "Unable to load payments.",
                error: paymentsError.message
            });
        }

        const singersByEvent = new Map();

        (payments || []).forEach(payment => {
            if (!singersByEvent.has(payment.event_id)) {
                singersByEvent.set(payment.event_id, new Set());
            }

            singersByEvent.get(payment.event_id).add(payment.singer_id);
        });

        const result = recentEvents.map(event => ({
            event_id: event.id,
            event_name: event.name,
            event_date: event.event_date || event.created_at,
            singer_count: singersByEvent.get(event.id)?.size || 0
        }));

        return res.status(200).json({
            success: true,
            events: result
        });

    }
    catch (error) {
        console.error("SINGERS PER EVENT EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }

};


// ==========================================================
// FINANCE BY EVENT - LAST 6 MONTHS
//
// GET /api/v1/admin/stats/finance-by-event
//
// Revenue = sum of amount on Paid payments for that event.
// Expenses = sum of event_expenses for that event. One row per
// event held in the last 6 months, for a direct event-to-event
// comparison rather than a calendar-month breakdown.
// ==========================================================

const getFinanceByEvent = async (req, res) => {

    try {

        const recentEvents = await getRecentEvents();

        if (recentEvents.length === 0) {
            return res.status(200).json({
                success: true,
                events: []
            });
        }

        const eventIds = recentEvents.map(event => event.id);

        const [paymentsResult, expensesResult] = await Promise.all([

            supabase
                .from("payments")
                .select("event_id,amount,status")
                .in("event_id", eventIds),

            supabase
                .from("event_expenses")
                .select("event_id,amount")
                .in("event_id", eventIds)

        ]);

        if (paymentsResult.error) {
            console.error("FINANCE BY EVENT - PAYMENTS:", paymentsResult.error);

            return res.status(500).json({
                success: false,
                message: "Unable to load revenue.",
                error: paymentsResult.error.message
            });
        }

        if (expensesResult.error) {
            console.error("FINANCE BY EVENT - EXPENSES:", expensesResult.error);

            return res.status(500).json({
                success: false,
                message: "Unable to load expenses.",
                error: expensesResult.error.message
            });
        }

        const revenueByEvent = new Map();
        const expenseByEvent = new Map();

        (paymentsResult.data || []).forEach(payment => {
            if (payment.status !== "Paid") {
                return;
            }

            revenueByEvent.set(
                payment.event_id,
                (revenueByEvent.get(payment.event_id) || 0) + Number(payment.amount || 0)
            );
        });

        (expensesResult.data || []).forEach(expense => {
            expenseByEvent.set(
                expense.event_id,
                (expenseByEvent.get(expense.event_id) || 0) + Number(expense.amount || 0)
            );
        });

        const result = recentEvents.map(event => {
            const revenue = revenueByEvent.get(event.id) || 0;
            const expenses = expenseByEvent.get(event.id) || 0;

            return {
                event_id: event.id,
                event_name: event.name,
                event_date: event.event_date || event.created_at,
                revenue,
                expenses,
                balance: revenue - expenses
            };
        });

        return res.status(200).json({
            success: true,
            events: result
        });

    }
    catch (error) {
        console.error("FINANCE BY EVENT EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }

};


// ==========================================================
// EVENT ANALYTICS - LAST 6 MONTHS
//
// GET /api/v1/admin/stats/event-analytics
//
// One consolidated bundle per event for the Comparison Dashboard -
// payment status breakdown, gender split, pairing completion,
// revenue/expense detail (with expense categories), song counts.
// Built from the same tables as the two endpoints above, just
// joined and broken out further so the dashboard can offer several
// angles on the same events without extra round trips.
// ==========================================================

const getEventAnalytics = async (req, res) => {

    try {

        const recentEvents = await getRecentEvents();

        if (recentEvents.length === 0) {
            return res.status(200).json({ success: true, events: [] });
        }

        const eventIds = recentEvents.map(event => event.id);

        const [
            paymentsResult,
            expensesResult,
            pairingsResult,
            songsResult,
            singersResult
        ] = await Promise.all([

            supabase
                .from("payments")
                .select("event_id,singer_id,amount,status")
                .in("event_id", eventIds),

            supabase
                .from("event_expenses")
                .select("event_id,amount,category")
                .in("event_id", eventIds),

            supabase
                .from("pairings")
                .select("event_id,male_singer_id,female_singer_id,status")
                .in("event_id", eventIds),

            supabase
                .from("songs")
                .select("event_id,karaoke_available")
                .in("event_id", eventIds),

            supabase
                .from("singers")
                .select("id,gender")

        ]);

        for (const [label, result] of [
            ["payments", paymentsResult],
            ["expenses", expensesResult],
            ["pairings", pairingsResult],
            ["songs", songsResult],
            ["singers", singersResult]
        ]) {
            if (result.error) {
                console.error(`EVENT ANALYTICS - ${label.toUpperCase()}:`, result.error);
                return res.status(500).json({
                    success: false,
                    message: `Unable to load ${label} for analytics.`,
                    error: result.error.message
                });
            }
        }

        const genderById = new Map((singersResult.data || []).map(s => [s.id, s.gender || "Unknown"]));

        // Group everything by event_id first, one pass each.
        const byEvent = new Map(eventIds.map(id => [id, {
            paymentsByStatus: { Paid: new Set(), Pending: new Set(), Rejected: new Set() },
            revenue: 0,
            expenses: 0,
            expenseByCategory: new Map(),
            pairedSingerIds: new Set(),
            pairingCount: 0,
            songCount: 0,
            karaokeCount: 0,
            genderCount: { Male: 0, Female: 0, Other: 0 }
        }]));

        (paymentsResult.data || []).forEach(p => {
            const bucket = byEvent.get(p.event_id);
            if (!bucket) return;

            if (bucket.paymentsByStatus[p.status]) {
                bucket.paymentsByStatus[p.status].add(p.singer_id);
            }

            if (p.status === "Paid") {
                bucket.revenue += Number(p.amount || 0);
            }
        });

        (expensesResult.data || []).forEach(e => {
            const bucket = byEvent.get(e.event_id);
            if (!bucket) return;

            const amount = Number(e.amount || 0);
            bucket.expenses += amount;

            const category = e.category || "Uncategorized";
            bucket.expenseByCategory.set(category, (bucket.expenseByCategory.get(category) || 0) + amount);
        });

        (pairingsResult.data || []).forEach(p => {
            const bucket = byEvent.get(p.event_id);
            if (!bucket) return;

            bucket.pairingCount += 1;
            bucket.pairedSingerIds.add(p.male_singer_id);
            bucket.pairedSingerIds.add(p.female_singer_id);
        });

        (songsResult.data || []).forEach(s => {
            const bucket = byEvent.get(s.event_id);
            if (!bucket) return;

            bucket.songCount += 1;
            if (s.karaoke_available) bucket.karaokeCount += 1;
        });

        // Gender split is computed off the PAID singer set (the people who
        // actually confirmed participation), resolved through the singers
        // table loaded above.
        byEvent.forEach(bucket => {
            bucket.paymentsByStatus.Paid.forEach(singerId => {
                const gender = genderById.get(singerId);
                if (gender === "Male") bucket.genderCount.Male += 1;
                else if (gender === "Female") bucket.genderCount.Female += 1;
                else bucket.genderCount.Other += 1;
            });
        });

        const result = recentEvents.map(event => {

            const b = byEvent.get(event.id);

            const paidCount = b.paymentsByStatus.Paid.size;
            const pendingCount = b.paymentsByStatus.Pending.size;
            const rejectedCount = b.paymentsByStatus.Rejected.size;

            const pairedPaidSingers = [...b.paymentsByStatus.Paid].filter(id => b.pairedSingerIds.has(id)).length;
            const balance = b.revenue - b.expenses;

            return {
                event_id: event.id,
                event_name: event.name,
                event_date: event.event_date || event.created_at,

                singer_count: paidCount + pendingCount,
                payment_breakdown: { paid: paidCount, pending: pendingCount, rejected: rejectedCount },

                gender_breakdown: b.genderCount,

                revenue: b.revenue,
                expenses: b.expenses,
                balance,
                profit_margin_pct: b.revenue > 0 ? Math.round((balance / b.revenue) * 1000) / 10 : 0,
                avg_revenue_per_singer: paidCount > 0 ? Math.round(b.revenue / paidCount) : 0,
                expense_by_category: [...b.expenseByCategory.entries()].map(([category, amount]) => ({ category, amount })),

                pairing_count: b.pairingCount,
                paired_paid_singers: pairedPaidSingers,
                unpaired_paid_singers: Math.max(0, paidCount - pairedPaidSingers),
                pairing_completion_pct: paidCount > 0 ? Math.round((pairedPaidSingers / paidCount) * 1000) / 10 : 0,

                song_count: b.songCount,
                karaoke_available_count: b.karaokeCount
            };

        });

        return res.status(200).json({ success: true, events: result });

    }
    catch (error) {
        console.error("EVENT ANALYTICS EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }

};


module.exports = {
    getSingersPerEvent,
    getFinanceByEvent,
    getEventAnalytics
};
