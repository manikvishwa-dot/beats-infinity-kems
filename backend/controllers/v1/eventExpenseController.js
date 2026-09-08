const { supabase } = require("../../config/supabase");

// ==========================================================
// BEATS INFINITY - EVENT EXPENSE / FINANCE CONTROLLER
// ==========================================================
//
// Super Admin only. Revenue is derived from Paid payments
// scoped to the event (payments.event_id, stamped at
// creation time from whichever event was active). Expenses
// are manually entered line items against the same event.
// ==========================================================


// ==========================================================
// GET EXPENSES FOR AN EVENT
//
// GET /api/v1/events/:eventId/expenses
// ==========================================================

const getExpenses = async (req, res) => {

    try {

        const { eventId } = req.params;

        const { data, error } = await supabase
            .from("event_expenses")
            .select("*")
            .eq("event_id", eventId)
            .order("created_at", { ascending: false });

        if (error) {

            console.error("GET EVENT EXPENSES:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load expenses.",
                error: error.message
            });

        }

        return res.status(200).json({
            success: true,
            expenses: data || []
        });

    }

    catch (error) {

        console.error("GET EVENT EXPENSES EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });

    }

};


// ==========================================================
// CREATE EXPENSE
//
// POST /api/v1/events/:eventId/expenses
// Body: { description, amount, category }
// ==========================================================

const createExpense = async (req, res) => {

    try {

        const { eventId } = req.params;
        const { description, amount, category } = req.body || {};

        if (!description || !String(description).trim()) {

            return res.status(400).json({
                success: false,
                message: "Expense description is required."
            });

        }

        const numericAmount = Number(amount);

        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {

            return res.status(400).json({
                success: false,
                message: "Expense amount must be a positive number."
            });

        }

        const { data, error } = await supabase
            .from("event_expenses")
            .insert({
                event_id: eventId,
                description: String(description).trim(),
                amount: numericAmount,
                category: category || null,
                created_by: req.admin?.id || null
            })
            .select()
            .single();

        if (error) {

            console.error("CREATE EVENT EXPENSE:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to add expense.",
                error: error.message
            });

        }

        return res.status(201).json({
            success: true,
            message: "Expense added.",
            expense: data
        });

    }

    catch (error) {

        console.error("CREATE EVENT EXPENSE EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });

    }

};


// ==========================================================
// DELETE EXPENSE
//
// DELETE /api/v1/events/:eventId/expenses/:expenseId
// ==========================================================

const deleteExpense = async (req, res) => {

    try {

        const { expenseId } = req.params;

        const { error } = await supabase
            .from("event_expenses")
            .delete()
            .eq("id", expenseId);

        if (error) {

            console.error("DELETE EVENT EXPENSE:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to delete expense.",
                error: error.message
            });

        }

        return res.status(200).json({
            success: true,
            message: "Expense deleted."
        });

    }

    catch (error) {

        console.error("DELETE EVENT EXPENSE EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });

    }

};


// ==========================================================
// FINANCE SUMMARY FOR AN EVENT
//
// GET /api/v1/events/:eventId/finance
//
// Revenue = sum of amount on Paid payments for this event.
// Expenses = sum of event_expenses for this event.
// Balance = Revenue - Expenses.
// ==========================================================

const getFinanceSummary = async (req, res) => {

    try {

        const { eventId } = req.params;

        const [paymentsResult, expensesResult] = await Promise.all([

            supabase
                .from("payments")
                .select("status,amount")
                .eq("event_id", eventId),

            supabase
                .from("event_expenses")
                .select("*")
                .eq("event_id", eventId)
                .order("created_at", { ascending: false })

        ]);

        if (paymentsResult.error) {

            console.error("FINANCE SUMMARY - PAYMENTS:", paymentsResult.error);

            return res.status(500).json({
                success: false,
                message: "Unable to load revenue.",
                error: paymentsResult.error.message
            });

        }

        if (expensesResult.error) {

            console.error("FINANCE SUMMARY - EXPENSES:", expensesResult.error);

            return res.status(500).json({
                success: false,
                message: "Unable to load expenses.",
                error: expensesResult.error.message
            });

        }

        const payments = paymentsResult.data || [];
        const expenses = expensesResult.data || [];

        const paidPayments = payments.filter(payment => payment.status === "Paid");
        const pendingCount = payments.filter(payment => payment.status === "Pending").length;
        const rejectedCount = payments.filter(payment => payment.status === "Rejected").length;

        const revenue = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

        return res.status(200).json({

            success: true,

            summary: {
                revenue,
                expense_total: expenseTotal,
                balance: revenue - expenseTotal,
                paid_count: paidPayments.length,
                pending_count: pendingCount,
                rejected_count: rejectedCount,
                total_payment_count: payments.length
            },

            expenses

        });

    }

    catch (error) {

        console.error("FINANCE SUMMARY EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });

    }

};


module.exports = {
    getExpenses,
    createExpense,
    deleteExpense,
    getFinanceSummary
};
