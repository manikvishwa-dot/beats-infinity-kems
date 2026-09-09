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


module.exports = {
    getSingersPerEvent,
    getFinanceByEvent
};
