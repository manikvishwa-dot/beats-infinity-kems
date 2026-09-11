import { useEffect, useMemo, useState } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Cell
} from "recharts";

import AdminTopbar from "../components/admin/AdminTopbar";
import { getEventAnalytics } from "../services/adminDashboardService";
import { exportToExcel } from "../utils/excel";

import "../styles/adminTheme.css";
import "./ComparisonDashboard.css";

// ==========================================================
// BRAND / STATUS COLORS
//
// Reused from the rest of the admin theme, not invented fresh -
// green/gold/red already carry "good/warning/critical" meaning
// throughout the app (Finance profit/loss, Payments statuses).
// Blue is the one additional categorical hue, used only for the
// Female series so gender identity never overloads the status set.
// ==========================================================

const COLOR = {
    green: "#1DB954",
    greenBright: "#39EF79",
    gold: "#FFD54A",
    red: "#ff6b6b",
    blue: "#4FC3F7",
    ink: "#ccc",
    muted: "#999"
};

const formatCurrency = value => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const formatPct = value => `${Number(value || 0).toLocaleString("en-IN")}%`;

const TABS = [
    { key: "revenue", label: "💰 Revenue & Profit" },
    { key: "singers", label: "🎤 Singer Status" },
    { key: "gender", label: "⚧ Gender Split" },
    { key: "songs", label: "🎵 Songs & Karaoke" }
];

const ANALYTICS_COLUMNS = [
    { key: "event_name", header: "Event", width: 24 },
    { key: "singer_count", header: "Singers (Paid+Pending)", width: 20 },
    { key: "revenue", header: "Revenue", width: 16 },
    { key: "expenses", header: "Expenses", width: 16 },
    { key: "balance", header: "Profit / Loss", width: 16 },
    { key: "profit_margin_pct", header: "Margin %", width: 12 },
    { key: "avg_revenue_per_singer", header: "Avg ₹ / Singer", width: 16 },
    { key: "pairing_completion_pct", header: "Pairing %", width: 12 },
    { key: "song_count", header: "Songs", width: 10 },
    { key: "karaoke_available_count", header: "Karaoke Available", width: 16 }
];

function ChartTooltip({ active, payload, label, formatter = formatCurrency }) {

    if (!active || !payload || payload.length === 0) return null;

    return (
        <div className="comparison-tooltip">
            <strong>{label}</strong>
            {payload.map(item => (
                <div key={item.dataKey} style={{ color: item.color }}>
                    {item.name}: {formatter(item.value)}
                </div>
            ))}
        </div>
    );

}

function KpiTile({ label, value, tone }) {
    return (
        <div className="comparison-summary-card">
            <span>{label}</span>
            <strong className={tone}>{value}</strong>
        </div>
    );
}

function DetailRow({ label, value }) {
    return (
        <div className="comparison-detail-row">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function ComparisonDashboard() {

    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("revenue");
    const [selectedEventId, setSelectedEventId] = useState(null);
    const [showTable, setShowTable] = useState(false);

    useEffect(() => {

        getEventAnalytics()
            .then(result => {
                const rows = result.events || [];
                setEvents(rows);
                setSelectedEventId(current => current || rows[rows.length - 1]?.event_id || null);
            })
            .catch(requestError => {
                console.error("Comparison dashboard load error:", requestError);
                setError(requestError.message || "Unable to load comparison data.");
            })
            .finally(() => setLoading(false));

    }, []);

    const totals = useMemo(() => {

        const totalSingers = events.reduce((sum, e) => sum + e.payment_breakdown.paid, 0);
        const totalRevenue = events.reduce((sum, e) => sum + e.revenue, 0);
        const totalExpenses = events.reduce((sum, e) => sum + e.expenses, 0);
        const totalPaired = events.reduce((sum, e) => sum + e.paired_paid_singers, 0);
        const totalSongs = events.reduce((sum, e) => sum + e.song_count, 0);

        return {
            totalSingers,
            totalRevenue,
            totalExpenses,
            avgMargin: totalRevenue > 0 ? Math.round(((totalRevenue - totalExpenses) / totalRevenue) * 1000) / 10 : 0,
            pairingRate: totalSingers > 0 ? Math.round((totalPaired / totalSingers) * 1000) / 10 : 0,
            totalSongs
        };

    }, [events]);

    // Recharts' stacking/grouping bookkeeping needs a flat top-level key per
    // series - a dot-path string or a function accessor both silently fail
    // to render for stacked bars, so the nested API shape gets flattened
    // here once rather than fought inside every chart.
    const chartData = useMemo(() => events.map(e => ({
        ...e,
        paid: e.payment_breakdown.paid,
        pending: e.payment_breakdown.pending,
        rejected: e.payment_breakdown.rejected,
        male: e.gender_breakdown.Male,
        female: e.gender_breakdown.Female
    })), [events]);


    const selectedEvent = events.find(e => e.event_id === selectedEventId) || null;

    const handleDownload = () => {
        exportToExcel(ANALYTICS_COLUMNS, events, "beats-infinity-event-analytics");
    };

    const handleBarClick = data => {
        if (data?.activePayload?.[0]?.payload?.event_id) {
            setSelectedEventId(data.activePayload[0].payload.event_id);
        }
    };

    return (
        <div className="admin-shell">
            <AdminTopbar />

            <div className="admin-shell-content">
                <h1 className="admin-page-title">Comparison Dashboard</h1>
                <p className="admin-page-subtitle">
                    Every event in the last 6 months, compared across revenue, singer participation,
                    pairing completion, gender split, and song coverage. Click any bar to drill into that event.
                </p>

                {error && <div className="finance-error">⚠️ {error}</div>}

                {loading ? (
                    <div className="finance-empty">Loading comparison data...</div>
                ) : events.length === 0 ? (
                    <div className="finance-empty">No events in the last 6 months yet.</div>
                ) : (
                    <>
                        <div className="comparison-summary-row">
                            <KpiTile label="Total Singers (Paid)" value={totals.totalSingers} />
                            <KpiTile label="Total Revenue" value={formatCurrency(totals.totalRevenue)} tone="positive" />
                            <KpiTile label="Total Expenses" value={formatCurrency(totals.totalExpenses)} tone="negative" />
                            <KpiTile label="Avg. Profit Margin" value={formatPct(totals.avgMargin)} tone={totals.avgMargin >= 0 ? "positive" : "negative"} />
                            <KpiTile label="Pairing Completion" value={formatPct(totals.pairingRate)} />
                        </div>

                        <div className="comparison-tabs">
                            {TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    className={activeTab === tab.key ? "comparison-tab active" : "comparison-tab"}
                                    onClick={() => setActiveTab(tab.key)}
                                >
                                    {tab.label}
                                </button>
                            ))}

                            <div className="comparison-tabs-actions">
                                <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => setShowTable(v => !v)}>
                                    {showTable ? "📊 Show Charts" : "📋 Show Table"}
                                </button>
                                <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={handleDownload}>
                                    ⬇ Download Excel
                                </button>
                            </div>
                        </div>

                        <section className="finance-section comparison-chart-card" style={{ display: showTable ? "block" : "none" }}>
                            <div className="comparison-table-wrap">
                                <table className="comparison-table">
                                    <thead>
                                        <tr>
                                            {ANALYTICS_COLUMNS.map(col => <th key={col.key}>{col.header}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {events.map(e => (
                                            <tr key={e.event_id}>
                                                <td>{e.event_name}</td>
                                                <td>{e.singer_count}</td>
                                                <td>{formatCurrency(e.revenue)}</td>
                                                <td>{formatCurrency(e.expenses)}</td>
                                                <td className={e.balance >= 0 ? "positive" : "negative"}>{formatCurrency(e.balance)}</td>
                                                <td>{formatPct(e.profit_margin_pct)}</td>
                                                <td>{formatCurrency(e.avg_revenue_per_singer)}</td>
                                                <td>{formatPct(e.pairing_completion_pct)}</td>
                                                <td>{e.song_count}</td>
                                                <td>{e.karaoke_available_count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <div style={{ display: showTable ? "none" : "contents" }}>

                                {/* ==================================================
                                    All four charts stay mounted at all times and are
                                    shown/hidden with CSS, rather than conditionally
                                    mounted per tab. Recharts has a real initialization-
                                    order quirk where whichever BarChart happens to be
                                    the very FIRST chart ever mounted on the page fails
                                    to draw any bars (axes/legend/tooltip all work, the
                                    bars themselves just never appear) - a ComposedChart
                                    mounting first works fine, and any chart mounted
                                    AFTER at least one other chart has already mounted
                                    also works fine. Mounting everything together up
                                    front sidesteps the ordering dependency entirely.
                                ================================================== */}

                                <section className="finance-section comparison-chart-card" style={{ display: activeTab === "revenue" ? "block" : "none" }}>
                                    <h2>Revenue vs Expenses By Event</h2>
                                    <ResponsiveContainer width="100%" height={340}>
                                        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }} onClick={handleBarClick}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                                            <XAxis dataKey="event_name" stroke={COLOR.muted} tick={{ fill: COLOR.ink, fontSize: 12 }} />
                                            <YAxis stroke={COLOR.muted} tick={{ fill: COLOR.ink, fontSize: 12 }} />
                                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                            <Legend wrapperStyle={{ color: COLOR.ink }} />
                                            <Bar dataKey="revenue" name="Revenue" fill={COLOR.green} radius={[4, 4, 0, 0]} cursor="pointer">
                                                {events.map(e => (
                                                    <Cell key={e.event_id} fillOpacity={e.event_id === selectedEventId ? 1 : 0.65} />
                                                ))}
                                            </Bar>
                                            <Bar dataKey="expenses" name="Expenses" fill={COLOR.red} radius={[4, 4, 0, 0]} cursor="pointer">
                                                {events.map(e => (
                                                    <Cell key={e.event_id} fillOpacity={e.event_id === selectedEventId ? 1 : 0.65} />
                                                ))}
                                            </Bar>
                                            <Line type="monotone" dataKey="balance" name="Profit / Loss" stroke={COLOR.gold} strokeWidth={2} dot={{ r: 4 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </section>

                                <section className="finance-section comparison-chart-card" style={{ display: activeTab === "singers" ? "block" : "none" }}>
                                    <h2>Singer Payment Status By Event</h2>
                                    <ResponsiveContainer width="100%" height={340}>
                                        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }} onClick={handleBarClick}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                                            <XAxis dataKey="event_name" stroke={COLOR.muted} tick={{ fill: COLOR.ink, fontSize: 12 }} />
                                            <YAxis stroke={COLOR.muted} tick={{ fill: COLOR.ink, fontSize: 12 }} allowDecimals={false} />
                                            <Tooltip content={<ChartTooltip formatter={v => v} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                            <Legend wrapperStyle={{ color: COLOR.ink }} />
                                            <Bar dataKey="paid" name="Paid" stackId="s" fill={COLOR.green} cursor="pointer" />
                                            <Bar dataKey="pending" name="Pending" stackId="s" fill={COLOR.gold} cursor="pointer" />
                                            <Bar dataKey="rejected" name="Rejected" stackId="s" fill={COLOR.red} radius={[4, 4, 0, 0]} cursor="pointer" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </section>

                                <section className="finance-section comparison-chart-card" style={{ display: activeTab === "gender" ? "block" : "none" }}>
                                    <h2>Gender Split By Event (Paid Singers)</h2>
                                    <ResponsiveContainer width="100%" height={340}>
                                        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }} onClick={handleBarClick}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                                            <XAxis dataKey="event_name" stroke={COLOR.muted} tick={{ fill: COLOR.ink, fontSize: 12 }} />
                                            <YAxis stroke={COLOR.muted} tick={{ fill: COLOR.ink, fontSize: 12 }} allowDecimals={false} />
                                            <Tooltip content={<ChartTooltip formatter={v => v} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                            <Legend wrapperStyle={{ color: COLOR.ink }} />
                                            <Bar dataKey="male" name="Male" fill={COLOR.green} radius={[4, 4, 0, 0]} cursor="pointer" />
                                            <Bar dataKey="female" name="Female" fill={COLOR.blue} radius={[4, 4, 0, 0]} cursor="pointer" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </section>

                                <section className="finance-section comparison-chart-card" style={{ display: activeTab === "songs" ? "block" : "none" }}>
                                    <h2>Songs &amp; Karaoke Availability By Event</h2>
                                    <ResponsiveContainer width="100%" height={340}>
                                        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }} onClick={handleBarClick}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                                            <XAxis dataKey="event_name" stroke={COLOR.muted} tick={{ fill: COLOR.ink, fontSize: 12 }} />
                                            <YAxis stroke={COLOR.muted} tick={{ fill: COLOR.ink, fontSize: 12 }} allowDecimals={false} />
                                            <Tooltip content={<ChartTooltip formatter={v => v} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                            <Legend wrapperStyle={{ color: COLOR.ink }} />
                                            <Bar dataKey="song_count" name="Total Songs" fill={COLOR.gold} radius={[4, 4, 0, 0]} cursor="pointer" />
                                            <Bar dataKey="karaoke_available_count" name="Karaoke Available" fill={COLOR.green} radius={[4, 4, 0, 0]} cursor="pointer" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </section>

                        </div>

                        {selectedEvent && !showTable && (
                            <section className="finance-section comparison-detail-card">
                                <h2>🔍 {selectedEvent.event_name} — Full Breakdown</h2>

                                <div className="comparison-detail-grid">

                                    <div className="comparison-detail-group">
                                        <h3>Finance</h3>
                                        <DetailRow label="Revenue" value={formatCurrency(selectedEvent.revenue)} />
                                        <DetailRow label="Expenses" value={formatCurrency(selectedEvent.expenses)} />
                                        <DetailRow label="Profit / Loss" value={formatCurrency(selectedEvent.balance)} />
                                        <DetailRow label="Margin" value={formatPct(selectedEvent.profit_margin_pct)} />
                                        <DetailRow label="Avg Revenue / Singer" value={formatCurrency(selectedEvent.avg_revenue_per_singer)} />
                                    </div>

                                    <div className="comparison-detail-group">
                                        <h3>Singers</h3>
                                        <DetailRow label="Paid" value={selectedEvent.payment_breakdown.paid} />
                                        <DetailRow label="Pending" value={selectedEvent.payment_breakdown.pending} />
                                        <DetailRow label="Rejected" value={selectedEvent.payment_breakdown.rejected} />
                                        <DetailRow label="Male / Female" value={`${selectedEvent.gender_breakdown.Male} / ${selectedEvent.gender_breakdown.Female}`} />
                                    </div>

                                    <div className="comparison-detail-group">
                                        <h3>Pairing</h3>
                                        <DetailRow label="Pairings Decided" value={selectedEvent.pairing_count} />
                                        <DetailRow label="Paired (of Paid)" value={selectedEvent.paired_paid_singers} />
                                        <DetailRow label="Still Unpaired" value={selectedEvent.unpaired_paid_singers} />
                                        <DetailRow label="Completion" value={formatPct(selectedEvent.pairing_completion_pct)} />
                                    </div>

                                    <div className="comparison-detail-group">
                                        <h3>Songs</h3>
                                        <DetailRow label="Total Songs" value={selectedEvent.song_count} />
                                        <DetailRow label="Karaoke Available" value={selectedEvent.karaoke_available_count} />
                                    </div>

                                    {selectedEvent.expense_by_category.length > 0 && (
                                        <div className="comparison-detail-group comparison-detail-group-wide">
                                            <h3>Expenses by Category</h3>
                                            {selectedEvent.expense_by_category.map(row => (
                                                <DetailRow key={row.category} label={row.category} value={formatCurrency(row.amount)} />
                                            ))}
                                        </div>
                                    )}

                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );

}

export default ComparisonDashboard;
