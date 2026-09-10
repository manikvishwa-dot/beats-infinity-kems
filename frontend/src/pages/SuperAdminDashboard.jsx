import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AdminTopbar from "../components/admin/AdminTopbar";
import PasswordToggleInput from "../components/common/PasswordToggleInput";
import { getEvents, getFinanceSummary, createExpense, deleteExpense } from "../services/eventService";
import { getSession, logout, listAdminUsers, changeAdminPassword } from "../services/adminService";

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

const EMPTY_PASSWORD_FORM = { currentPassword: "", newPassword: "", confirmPassword: "" };

function SuperAdminDashboard() {

    const navigate = useNavigate();

    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE_FORM);
    const [savingExpense, setSavingExpense] = useState(false);

    // Change Password
    const session = getSession();
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState("");
    const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");

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

    useEffect(() => {

        listAdminUsers()
            .then(result => {

                const users = result.users || [];
                setAccounts(users);

                setSelectedAccountId(current =>
                    current || session?.admin?.id || users[0]?.id || ""
                );

            })
            .catch(requestError => {

                console.error("Load admin accounts error:", requestError);

            });

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const isOwnAccount = selectedAccountId === session?.admin?.id;

    const handleChangePassword = async event => {

        event.preventDefault();

        setPasswordError("");
        setPasswordSuccess("");

        if (!selectedAccountId) {

            setPasswordError("Please select an account.");
            return;

        }

        if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {

            setPasswordError("New password must be at least 6 characters.");
            return;

        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {

            setPasswordError("New password and confirmation do not match.");
            return;

        }

        if (isOwnAccount && !passwordForm.currentPassword) {

            setPasswordError("Please enter your current password.");
            return;

        }

        setSavingPassword(true);

        try {

            const result = await changeAdminPassword(
                selectedAccountId,
                passwordForm.newPassword,
                isOwnAccount ? passwordForm.currentPassword : undefined
            );

            setPasswordSuccess(result.message || "Password updated.");
            setPasswordForm(EMPTY_PASSWORD_FORM);

            if (result.forced_logout) {

                setTimeout(async () => {

                    await logout();
                    navigate("/superadmin/login");

                }, 1800);

            }

        }
        catch (requestError) {

            console.error("Change password error:", requestError);
            setPasswordError(requestError.message || "Unable to change password.");

        }
        finally {

            setSavingPassword(false);

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
                                <span className="finance-stat-label">Total Singers Registered</span>
                                <strong className="finance-stat-value neutral">
                                    {summary?.summary?.total_payment_count || 0}
                                </strong>
                                <span className="finance-stat-sub">
                                    {summary?.summary?.rejected_count || 0} rejected
                                </span>
                            </div>

                            <div className="admin-card finance-stat">
                                <span className="finance-stat-label">Total Paid</span>
                                <strong className="finance-stat-value positive">
                                    {summary?.summary?.paid_count || 0}
                                </strong>
                                <span className="finance-stat-sub">confirmed by admin</span>
                            </div>

                            <div className="admin-card finance-stat">
                                <span className="finance-stat-label">Total Pending</span>
                                <strong className="finance-stat-value neutral">
                                    {summary?.summary?.pending_count || 0}
                                </strong>
                                <span className="finance-stat-sub">awaiting confirmation</span>
                            </div>

                            <div className="admin-card finance-stat">
                                <span className="finance-stat-label">Amount Received</span>
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
                                <span className="finance-stat-label">
                                    {(summary?.summary?.balance || 0) >= 0 ? "Profit" : "Loss"}
                                </span>
                                <strong className={`finance-stat-value ${(summary?.summary?.balance || 0) >= 0 ? "positive" : "negative"}`}>
                                    {formatCurrency(Math.abs(summary?.summary?.balance || 0))}
                                </strong>
                                <span className="finance-stat-sub">
                                    Amount Received − Expenses
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

                <div className="finance-section">
                    <h2>🔐 Change Password</h2>

                    {passwordError && <div className="finance-error">⚠️ {passwordError}</div>}
                    {passwordSuccess && (
                        <div className="finance-error password-success">
                            ✅ {passwordSuccess}
                            {isOwnAccount && " Redirecting to login..."}
                        </div>
                    )}

                    <form className="finance-expense-form" onSubmit={handleChangePassword}>

                        <div className="finance-expense-field finance-expense-field-wide">
                            <label>Account</label>
                            <select
                                value={selectedAccountId}
                                onChange={event => {
                                    setSelectedAccountId(event.target.value);
                                    setPasswordForm(EMPTY_PASSWORD_FORM);
                                    setPasswordError("");
                                    setPasswordSuccess("");
                                }}
                            >
                                {accounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.full_name || account.username}
                                        {" "}({account.role === "super_admin" ? "Super Admin" : "Admin"})
                                        {account.id === session?.admin?.id ? " — You" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {isOwnAccount && (
                            <div className="finance-expense-field finance-expense-field-wide">
                                <label>Current Password</label>
                                <PasswordToggleInput
                                    value={passwordForm.currentPassword}
                                    onChange={event => setPasswordForm(current => ({ ...current, currentPassword: event.target.value }))}
                                    autoComplete="current-password"
                                />
                            </div>
                        )}

                        <div className="finance-expense-field">
                            <label>New Password</label>
                            <PasswordToggleInput
                                value={passwordForm.newPassword}
                                onChange={event => setPasswordForm(current => ({ ...current, newPassword: event.target.value }))}
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="finance-expense-field">
                            <label>Confirm New Password</label>
                            <PasswordToggleInput
                                value={passwordForm.confirmPassword}
                                onChange={event => setPasswordForm(current => ({ ...current, confirmPassword: event.target.value }))}
                                autoComplete="new-password"
                            />
                        </div>

                        <button type="submit" className="admin-btn admin-btn-primary" disabled={savingPassword}>
                            {savingPassword ? "Updating..." : "Update Password"}
                        </button>

                    </form>
                </div>
            </div>
        </div>
    );

}

export default SuperAdminDashboard;
