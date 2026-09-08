import { useCallback, useEffect, useState } from "react";

import AdminTopbar from "../components/admin/AdminTopbar";
import { getEvents, getFinanceSummary, createExpense, deleteExpense } from "../services/eventService";

import "../styles/adminTheme.css";
import "./SuperAdminDashboard.css";

const formatCurrency = value =>
    `₹${Number(value || 0).toLocaleString("en-IN")}`;

const formatDate = value => {

    if (!value) {

        return "—";

    }

    try {

        return new Date(value).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });

    }
    catch {

        return value;

    }

};

const EMPTY_EXPENSE_FORM = { description: "", amount: "", category: "" };

function SuperAdminDashboard() {

    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE_FORM);
    const [savingExpense, setSavingExpense] = useState(false);

    const loadEvents = useCallback(async () => {

        try {

            const result = await getEvents();
            const allEvents = result.events || [];

            setEvents(allEvents);

            const active = allEvents.find(item => item.is_active);
            setSelectedEventId(current => current || active?.id || allEvents[0]?.id || "");

        }
        catch (requestError) {

            console.error("Load events error:", requestError);
            setError(requestError.message || "Unable to load events.");

        }

    }, []);

    const loadFinance = useCallback(async eventId => {

        if (!eventId) {

            setSummary(null);
            setLoading(false);
            return;

        }

        try {

            setLoading(true);
            setError("");

            const result = await getFinanceSummary(eventId);
            setSummary(result);

        }
        catch (requestError) {

            console.error("Load finance error:", requestError);
            setError(requestError.message || "Unable to load finance summary.");

        }
        finally {

            setLoading(false);

        }

    }, []);

    useEffect(() => {

        loadEvents();

    }, [loadEvents]);

    useEffect(() => {

        loadFinance(selectedEventId);

    }, [selectedEventId, loadFinance]);

    const handleAddExpense = async event => {

        event.preventDefault();

        if (!expenseForm.description.trim() || !expenseForm.amount) {

            alert("Please enter both a description and an amount.");
            return;

        }

        setSavingExpense(true);
        setError("");

        try {

            await createExpense(selectedEventId, {
                description: expenseForm.description,
                amount: expenseForm.amount,
                category: expenseForm.category
            });

            setExpenseForm(EMPTY_EXPENSE_FORM);
            await loadFinance(selectedEventId);

        }
        catch (requestError) {

            console.error("Add expense error:", requestError);
            setError(requestError.message || "Unable to add expense.");

        }
        finally {

            setSavingExpense(false);

        }

    };

    const handleDeleteExpense = async expenseId => {

        const confirmed = window.confirm("Delete this expense entry?");

        if (!confirmed) {

            return;

        }

        try {

            await deleteExpense(selectedEventId, expenseId);
            await loadFinance(selectedEventId);

        }
        catch (requestError) {

            console.error("Delete expense error:", requestError);
            setError(requestError.message || "Unable to delete expense.");

        }

    };

    const selectedEvent = events.find(item => item.id === selectedEventId);

    return (
        <div className="admin-shell">
            <AdminTopbar loginPath="/superadmin/login" />

            <div className="admin-shell-content">
                <h1 className="admin-page-title">Super Admin Dashboard</h1>
                <p className="admin-page-subtitle">
                    Revenue, expenses and balance sheet, per event.
                </p>

                {error && <div className="finance-error">⚠️ {error}</div>}

                <div className="finance-event-picker">
                    <label>Event</label>
                    <select
                        value={selectedEventId}
                        onChange={changeEvent => setSelectedEventId(changeEvent.target.value)}
                    >
                        {events.length === 0 && <option value="">No events yet</option>}
                        {events.map(item => (
                            <option key={item.id} value={item.id}>
                                {item.name}{item.is_active ? " (Active)" : ""}
                            </option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="finance-empty">Loading finance summary...</div>
                ) : !selectedEvent ? (
                    <div className="finance-empty">
                        No events yet - create one on the Events page first.
                    </div>
                ) : (
                    <>
                        <div className="finance-summary-grid">
                            <div className="admin-card finance-stat">
                                <span className="finance-stat-label">Revenue Received</span>
                                <strong className="finance-stat-value positive">
                                    {formatCurrency(summary?.summary?.revenue)}
                                </strong>
                                <span className="finance-stat-sub">
                                    {summary?.summary?.paid_count || 0} paid registration(s)
                                </span>
                            </div>

                            <div className="admin-card finance-stat">
                                <span className="finance-stat-label">Total Expenses</span>
                                <strong className="finance-stat-value negative">
                                    {formatCurrency(summary?.summary?.expense_total)}
                                </strong>
                                <span className="finance-stat-sub">
                                    {summary?.expenses?.length || 0} expense entr{summary?.expenses?.length === 1 ? "y" : "ies"}
                                </span>
                            </div>

                            <div className="admin-card finance-stat">
                                <span className="finance-stat-label">Balance</span>
                                <strong className={`finance-stat-value ${(summary?.summary?.balance || 0) >= 0 ? "positive" : "negative"}`}>
                                    {formatCurrency(summary?.summary?.balance)}
                                </strong>
                                <span className="finance-stat-sub">
                                    {(summary?.summary?.balance || 0) >= 0 ? "In surplus" : "In deficit"}
                                </span>
                            </div>

                            <div className="admin-card finance-stat">
                                <span className="finance-stat-label">Pending / Rejected</span>
                                <strong className="finance-stat-value neutral">
                                    {summary?.summary?.pending_count || 0} / {summary?.summary?.rejected_count || 0}
                                </strong>
                                <span className="finance-stat-sub">
                                    {summary?.summary?.total_payment_count || 0} total payment request(s)
                                </span>
                            </div>
                        </div>

                        <div className="finance-section">
                            <h2>Add Expense</h2>

                            <form className="finance-expense-form" onSubmit={handleAddExpense}>
                                <div className="finance-expense-field finance-expense-field-wide">
                                    <label>Description</label>
                                    <input
                                        type="text"
                                        value={expenseForm.description}
                                        onChange={event => setExpenseForm(current => ({ ...current, description: event.target.value }))}
                                        placeholder="e.g. Venue rental, sound system, catering"
                                    />
                                </div>

                                <div className="finance-expense-field">
                                    <label>Amount (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={expenseForm.amount}
                                        onChange={event => setExpenseForm(current => ({ ...current, amount: event.target.value }))}
                                    />
                                </div>

                                <div className="finance-expense-field">
                                    <label>Category</label>
                                    <input
                                        type="text"
                                        value={expenseForm.category}
                                        onChange={event => setExpenseForm(current => ({ ...current, category: event.target.value }))}
                                        placeholder="e.g. Venue (optional)"
                                    />
                                </div>

                                <button type="submit" className="admin-btn admin-btn-primary" disabled={savingExpense}>
                                    {savingExpense ? "Adding..." : "+ Add Expense"}
                                </button>
                            </form>
                        </div>

                        <div className="finance-section">
                            <h2>Expense Log</h2>

                            {(summary?.expenses || []).length === 0 ? (
                                <div className="finance-empty">No expenses recorded for this event yet.</div>
                            ) : (
                                <div className="admin-table-shell">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Description</th>
                                                <th>Category</th>
                                                <th>Amount</th>
                                                <th>Date</th>
                                                <th></th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {summary.expenses.map(expense => (
                                                <tr key={expense.id}>
                                                    <td>{expense.description}</td>
                                                    <td>{expense.category || "—"}</td>
                                                    <td>{formatCurrency(expense.amount)}</td>
                                                    <td>{formatDate(expense.created_at)}</td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="admin-btn admin-btn-danger admin-btn-sm"
                                                            onClick={() => handleDeleteExpense(expense.id)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );

}

export default SuperAdminDashboard;
