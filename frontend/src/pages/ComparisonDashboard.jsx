import { useEffect, useMemo, useRef, useState } from "react";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Legend,
    Tooltip,
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
    teal: "#4DD0C4",
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

// Animates a number counting up from 0 to `value` whenever `value`
// changes - purely cosmetic, the underlying number is always correct
// even if a viewer's browser skips the animation (prefers-reduced-motion).
function CountUp({ value, duration = 700, formatter = v => v }) {

    const [display, setDisplay] = useState(0);
    const startRef = useRef(null);

    useEffect(() => {

        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            setDisplay(value);
            return;
        }

        startRef.current = null;
        let frame;

        const step = timestamp => {
            if (startRef.current === null) startRef.current = timestamp;
            const progress = Math.min((timestamp - startRef.current) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(value * eased);
            if (progress < 1) frame = requestAnimationFrame(step);
        };

        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);

    }, [value, duration]);

    return formatter(display);

}

function KpiTile({ label, value, tone, raw, formatter }) {
    return (
        <div className="comparison-summary-card">
            <span>{label}</span>
            <strong className={tone}>
                {raw !== undefined ? <CountUp value={raw} formatter={formatter} /> : value}
            </strong>
        </div>
    );
}

// Vertical capsule gauge - fills from the bottom to `percent`, with the
// number bold above and the label below, matching the "battery level"
// style used for at-a-glance percentage metrics elsewhere in reporting
// decks. Animates its own fill height on mount/update.
function GaugeBar({ percent, label, color }) {

    const clamped = Math.max(0, Math.min(100, percent));
    const [filled, setFilled] = useState(0);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setFilled(clamped));
        return () => cancelAnimationFrame(frame);
    }, [clamped]);

    return (
        <div className="gauge">
            <div className="gauge-percent" style={{ color }}>
                <CountUp value={clamped} formatter={v => `${Math.round(v)}%`} />
            </div>
            <div className="gauge-capsule">
                <div className="gauge-fill" style={{ height: `${filled}%`, background: color }} />
            </div>
            <div className="gauge-label">{label}</div>
        </div>
    );
}

// One row per event: a wide rounded pill divided into Paid/Pending/
// Rejected segments proportional to their share, growing in on mount.
// Clickable - ties into the same drill-down selection as the other tabs.
function StatusSegmentBar({ event, selected, onClick }) {

    const total = event.paid + event.pending + event.rejected;
    const [grown, setGrown] = useState(false);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setGrown(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    const pct = n => total > 0 ? (n / total) * 100 : 0;

    return (
        <button type="button" className={selected ? "status-row selected" : "status-row"} onClick={onClick}>
            <div className="status-row-top">
                <span className="status-row-name">{event.event_name}</span>
                <span className="status-row-total">{total} singer{total === 1 ? "" : "s"}</span>
            </div>
            <div className="status-segment-track">
                <div className="status-segment" style={{ width: grown ? `${pct(event.paid)}%` : 0, background: COLOR.green }} title={`Paid: ${event.paid}`} />
                <div className="status-segment" style={{ width: grown ? `${pct(event.pending)}%` : 0, background: COLOR.gold }} title={`Pending: ${event.pending}`} />
                <div className="status-segment" style={{ width: grown ? `${pct(event.rejected)}%` : 0, background: COLOR.red }} title={`Rejected: ${event.rejected}`} />
            </div>
            <div className="status-row-counts">
                <span style={{ color: COLOR.green }}>{event.paid} Paid</span>
                <span style={{ color: COLOR.gold }}>{event.pending} Pending</span>
                <span style={{ color: COLOR.red }}>{event.rejected} Rejected</span>
            </div>
        </button>
    );

}

// Same row layout as StatusSegmentBar, for money instead of headcount -
// a thin track split into what was kept as Profit vs spent as Expenses,
// with the Revenue total as the headline number. Avoids handing a
// single sparse category to a full Recharts BarChart, which has no
// good way to size a bar sensibly when there's only one or two events.
function RevenueBar({ event, selected, onClick }) {

    const total = event.revenue;
    const [grown, setGrown] = useState(false);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setGrown(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    const pct = n => total > 0 ? (n / total) * 100 : 0;

    return (
        <button type="button" className={selected ? "status-row selected" : "status-row"} onClick={onClick}>
            <div className="status-row-top">
                <span className="status-row-name">{event.event_name}</span>
                <span className="status-row-total revenue-total">{formatCurrency(total)}</span>
            </div>
            <div className="status-segment-track">
                <div className="status-segment" style={{ width: grown ? `${pct(event.balance)}%` : 0, background: COLOR.gold }} title={`Profit: ${formatCurrency(event.balance)}`} />
                <div className="status-segment" style={{ width: grown ? `${pct(event.expenses)}%` : 0, background: COLOR.red }} title={`Expenses: ${formatCurrency(event.expenses)}`} />
            </div>
            <div className="status-row-counts">
                <span style={{ color: COLOR.gold }}>{formatCurrency(event.balance)} Profit</span>
                <span style={{ color: COLOR.red }}>{formatCurrency(event.expenses)} Expenses</span>
            </div>
        </button>
    );

}

function RevenueKpiCard({ icon, iconBg, label, raw, formatter = formatCurrency, text, highlight, sub }) {
    return (
        <div className={highlight ? "revenue-kpi-card highlight" : "revenue-kpi-card"}>
            <span className="revenue-kpi-icon" style={{ background: iconBg }}>{icon}</span>
            <div className="revenue-kpi-body">
                <span className="revenue-kpi-label">{label}</span>
                <strong className="revenue-kpi-value">
                    {text !== undefined ? text : raw !== undefined ? <CountUp value={raw} formatter={formatter} /> : "—"}
                </strong>
                {sub && <span className="revenue-kpi-sub">{sub}</span>}
            </div>
        </div>
    );
}

// Three thin bars for one event - Revenue in, Expenses out, Net Profit
// left over. Plain divs rather than a Recharts chart, same reasoning
// as RevenueBar: a 3-category chart in a wide card has no good default
// sizing, a fixed-width custom layout does.
function FinancialFlowMini({ event }) {

    const [grown, setGrown] = useState(false);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setGrown(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    const max = Math.max(event.revenue, event.expenses, event.balance, 1);
    const heightPct = v => grown ? `${Math.max((v / max) * 100, 4)}%` : "0%";

    const bars = [
        { label: "Total Revenue", value: event.revenue, display: formatCurrency(event.revenue), color: COLOR.green },
        { label: "Expenses", value: event.expenses, display: `-${formatCurrency(event.expenses)}`, color: COLOR.red },
        { label: "Net Profit", value: event.balance, display: formatCurrency(event.balance), color: COLOR.blue }
    ];

    return (
        <div className="flow-mini">
            {bars.map(bar => (
                <div className="flow-mini-col" key={bar.label}>
                    <span className="flow-mini-value" style={{ color: bar.color }}>{bar.display}</span>
                    <div className="flow-mini-track">
                        <div className="flow-mini-fill" style={{ height: heightPct(bar.value), background: bar.color }} />
                    </div>
                    <span className="flow-mini-label">{bar.label}</span>
                </div>
            ))}
        </div>
    );

}

// Polar-to-cartesian helper for the speedometer below. 0deg = right,
// 90deg = straight up, 180deg = left - a standard math angle, just
// flipped to SVG's y-down coordinate system so the dome opens upward.
function polarPoint(cx, cy, r, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
    const start = polarPoint(cx, cy, r, startAngle);
    const end = polarPoint(cx, cy, r, endAngle);
    const largeArcFlag = startAngle - endAngle >= 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

// A car-dashboard-style speedometer: a half-circle dial from 0 to 100,
// a colored arc filled to the current value, a needle that sweeps into
// place on mount, and tick labels at the low/high ends.
function SpeedometerGauge({ percent, label, color }) {

    const clamped = Math.max(0, Math.min(100, percent));
    const [needleValue, setNeedleValue] = useState(0);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setNeedleValue(clamped));
        return () => cancelAnimationFrame(frame);
    }, [clamped]);

    const width = 260;
    const height = 150;
    const cx = width / 2;
    const cy = 128;
    const radius = 95;
    const stroke = 18;

    // 180deg (left, value 0) sweeping down to 0deg (right, value 100)
    const angleFor = value => 180 - (value / 100) * 180;

    const needleAngleRad = (angleFor(needleValue) * Math.PI) / 180;
    const needleLength = radius - 30;
    const needleTip = {
        x: cx + needleLength * Math.cos(needleAngleRad),
        y: cy - needleLength * Math.sin(needleAngleRad)
    };

    return (
        <div className="speedo-wrap">
            <svg width={width} height={height + 10} viewBox={`0 0 ${width} ${height + 10}`}>

                <path d={arcPath(cx, cy, radius, 180, 0)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} strokeLinecap="round" />

                <path
                    d={arcPath(cx, cy, radius, 180, angleFor(needleValue))}
                    fill="none"
                    stroke={color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    style={{ transition: "d 1s cubic-bezier(0.16, 1, 0.3, 1)" }}
                />

                <text x={polarPoint(cx, cy, radius + 18, 180).x} y={polarPoint(cx, cy, radius + 18, 180).y} textAnchor="middle" fontSize="11" fill="#777">0</text>
                <text x={polarPoint(cx, cy, radius + 18, 0).x} y={polarPoint(cx, cy, radius + 18, 0).y} textAnchor="middle" fontSize="11" fill="#777">100</text>

                <line
                    x1={cx}
                    y1={cy}
                    x2={needleTip.x}
                    y2={needleTip.y}
                    stroke="#fff"
                    strokeWidth={3}
                    strokeLinecap="round"
                    style={{ transition: "x2 1s cubic-bezier(0.16, 1, 0.3, 1), y2 1s cubic-bezier(0.16, 1, 0.3, 1)" }}
                />
                <circle cx={cx} cy={cy} r={8} fill="#fff" />
                <circle cx={cx} cy={cy} r={4} fill="#111" />

            </svg>
            <div className="speedo-readout">
                <strong style={{ color }}><CountUp value={clamped} formatter={v => `${Math.round(v)}%`} /></strong>
                <span>{label}</span>
            </div>
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
    const [revenueScope, setRevenueScope] = useState("all");

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

    // "All Events" or one specific event, via the scope dropdown on the
    // Revenue tab - drives the KPI row and the Profit vs Expenses chart.
    const revenueScopedData = useMemo(
        () => revenueScope === "all" ? chartData : chartData.filter(e => e.event_id === revenueScope),
        [chartData, revenueScope]
    );

    const revenueTotals = useMemo(() => {
        const revenue = revenueScopedData.reduce((sum, e) => sum + e.revenue, 0);
        const expenses = revenueScopedData.reduce((sum, e) => sum + e.expenses, 0);
        return { revenue, expenses, profit: revenue - expenses };
    }, [revenueScopedData]);

    const mostProfitableEvent = useMemo(
        () => chartData.reduce((best, e) => (!best || e.balance > best.balance ? e : best), null),
        [chartData]
    );

    // Same events, oldest first - a trend line only reads left-to-right
    // as "over time" if the x-axis is chronological.
    const trendData = useMemo(
        () => [...chartData].sort((a, b) => new Date(a.event_date) - new Date(b.event_date)),
        [chartData]
    );

    const selectedEvent = events.find(e => e.event_id === selectedEventId) || null;

    const handleDownload = () => {
        exportToExcel(ANALYTICS_COLUMNS, events, "beats-infinity-event-analytics");
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
                            <KpiTile label="Total Singers (Paid)" raw={totals.totalSingers} formatter={v => Math.round(v)} />
                            <KpiTile label="Total Revenue" raw={totals.totalRevenue} formatter={formatCurrency} tone="positive" />
                            <KpiTile label="Total Expenses" raw={totals.totalExpenses} formatter={formatCurrency} tone="negative" />
                        </div>

                        {selectedEvent && (
                            <section className="finance-section comparison-gauge-card">
                                <div className="comparison-gauge-header">
                                    <h2>📊 {selectedEvent.event_name} — Event Health</h2>
                                    <span className="comparison-gauge-hint">Updates when you select a different event below</span>
                                </div>
                                <div className="gauge-row">
                                    <GaugeBar percent={selectedEvent.profit_margin_pct} label="Profit Margin" color={COLOR.gold} />
                                    <GaugeBar percent={selectedEvent.pairing_completion_pct} label="Pairing Completion" color={COLOR.green} />
                                    <GaugeBar
                                        percent={selectedEvent.song_count > 0 ? Math.round((selectedEvent.karaoke_available_count / selectedEvent.song_count) * 1000) / 10 : 0}
                                        label="Karaoke Coverage"
                                        color={COLOR.blue}
                                    />
                                    <GaugeBar
                                        percent={selectedEvent.singer_count > 0 ? Math.round((selectedEvent.payment_breakdown.paid / selectedEvent.singer_count) * 1000) / 10 : 0}
                                        label="Payment Confirmed"
                                        color={COLOR.teal}
                                    />
                                </div>
                            </section>
                        )}

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

                                <div className="revenue-dash" style={{ display: activeTab === "revenue" ? "block" : "none" }}>

                                    <div className="revenue-dash-header">
                                        <div className="revenue-dash-header-icon">📊</div>
                                        <div>
                                            <h2>Revenue by Event</h2>
                                            <p>A quick view of revenue, expenses and profit across all events</p>
                                        </div>
                                        <select
                                            className="revenue-scope-select"
                                            value={revenueScope}
                                            onChange={event => setRevenueScope(event.target.value)}
                                        >
                                            <option value="all">All Events</option>
                                            {chartData.map(e => (
                                                <option key={e.event_id} value={e.event_id}>{e.event_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="revenue-kpi-row">
                                        <RevenueKpiCard icon="💰" iconBg="rgba(79,195,247,0.18)" label="Total Revenue" raw={revenueTotals.revenue} />
                                        <RevenueKpiCard icon="💸" iconBg="rgba(255,107,107,0.18)" label="Total Expenses" raw={revenueTotals.expenses} />
                                        <RevenueKpiCard icon="📈" iconBg="rgba(29,185,84,0.18)" label="Total Profit" raw={revenueTotals.profit} />
                                        {mostProfitableEvent && (
                                            <RevenueKpiCard
                                                icon="⭐"
                                                iconBg="rgba(255,213,74,0.18)"
                                                label="Most Profitable Event"
                                                text={mostProfitableEvent.event_name}
                                                sub={`Profit ${formatCurrency(mostProfitableEvent.balance)}`}
                                                highlight
                                            />
                                        )}
                                    </div>

                                    <div className="revenue-dash-row two-col">

                                        <section className="finance-section comparison-chart-card">
                                            <h2>Profit vs Expenses by Event</h2>

                                            <div className="status-legend-row">
                                                <span><i style={{ background: COLOR.gold }} /> Profit</span>
                                                <span><i style={{ background: COLOR.red }} /> Expenses</span>
                                            </div>

                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 10 }} maxBarSize={54} barGap={4}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                                    <XAxis dataKey="event_name" stroke={COLOR.muted} tick={{ fill: COLOR.ink, fontSize: 11 }} />
                                                    <YAxis stroke={COLOR.muted} tick={{ fill: COLOR.ink, fontSize: 12 }} tickFormatter={v => `₹${v / 1000}K`} />
                                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                                    <Bar
                                                        dataKey="balance"
                                                        name="Profit"
                                                        fill={COLOR.gold}
                                                        radius={[6, 6, 0, 0]}
                                                        cursor="pointer"
                                                        onClick={d => setSelectedEventId(d.event_id)}
                                                        label={{ position: "top", fill: COLOR.gold, fontSize: 11, fontWeight: 700, formatter: formatCurrency }}
                                                    />
                                                    <Bar
                                                        dataKey="expenses"
                                                        name="Expenses"
                                                        fill={COLOR.red}
                                                        radius={[6, 6, 0, 0]}
                                                        cursor="pointer"
                                                        onClick={d => setSelectedEventId(d.event_id)}
                                                        label={{ position: "top", fill: COLOR.red, fontSize: 11, fontWeight: 700, formatter: formatCurrency }}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </section>

                                        <section className="finance-section comparison-chart-card">
                                            <div className="revenue-panel-header">
                                                <div>
                                                    <h2>{selectedEvent ? selectedEvent.event_name : "Select an event"}</h2>
                                                    <span className="comparison-chart-subhint">Revenue Breakdown</span>
                                                </div>
                                                <select
                                                    className="revenue-scope-select"
                                                    value={selectedEventId || ""}
                                                    onChange={event => setSelectedEventId(event.target.value)}
                                                >
                                                    {chartData.map(e => (
                                                        <option key={e.event_id} value={e.event_id}>{e.event_name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {selectedEvent && selectedEvent.revenue > 0 ? (
                                                <div className="gender-donut-layout">
                                                    <div className="donut-wrap">
                                                    <ResponsiveContainer width={260} height={260}>
                                                        <PieChart>
                                                            <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
                                                            <Pie
                                                                data={[
                                                                    { name: "Expenses", value: selectedEvent.expenses },
                                                                    { name: "Profit", value: selectedEvent.balance }
                                                                ]}
                                                                dataKey="value"
                                                                nameKey="name"
                                                                innerRadius={70}
                                                                outerRadius={110}
                                                                paddingAngle={3}
                                                                cornerRadius={6}
                                                                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                                                    const radius = innerRadius + (outerRadius - innerRadius) / 2;
                                                                    const angle = -midAngle * (Math.PI / 180);
                                                                    const x = cx + radius * Math.cos(angle);
                                                                    const y = cy + radius * Math.sin(angle);
                                                                    return (
                                                                        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize={13} fontWeight={700}>
                                                                            {Math.round(percent * 100)}%
                                                                        </text>
                                                                    );
                                                                }}
                                                                labelLine={false}
                                                            >
                                                                <Cell fill={COLOR.red} stroke="none" />
                                                                <Cell fill={COLOR.gold} stroke="none" />
                                                            </Pie>
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                    <div className="donut-center-total">
                                                        <strong>{formatCurrency(selectedEvent.revenue)}</strong>
                                                        <span>Total</span>
                                                    </div>
                                                    </div>

                                                    <div className="gender-donut-legend">
                                                        <div className="gender-donut-stat">
                                                            <span className="dot" style={{ background: COLOR.red }} />
                                                            Expenses
                                                            <strong>{formatCurrency(selectedEvent.expenses)}</strong>
                                                        </div>
                                                        <div className="gender-donut-stat">
                                                            <span className="dot" style={{ background: COLOR.gold }} />
                                                            Profit
                                                            <strong>{formatCurrency(selectedEvent.balance)}</strong>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="finance-empty">No revenue yet for this event.</div>
                                            )}
                                        </section>

                                    </div>

                                    <div className="revenue-dash-row three-col">

                                        <section className="finance-section comparison-chart-card">
                                            <h2>Revenue Trend</h2>
                                            <div className="status-legend-row">
                                                <span><i style={{ background: COLOR.green }} /> Revenue</span>
                                                <span><i style={{ background: COLOR.red }} /> Expenses</span>
                                                <span><i style={{ background: COLOR.gold }} /> Profit</span>
                                            </div>
                                            <ResponsiveContainer width="100%" height={230}>
                                                <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                                    <XAxis dataKey="event_name" stroke={COLOR.muted} tick={{ fill: COLOR.ink, fontSize: 10 }} />
                                                    <YAxis stroke={COLOR.muted} tick={{ fill: COLOR.ink, fontSize: 11 }} tickFormatter={v => `₹${v / 1000}K`} />
                                                    <Tooltip content={<ChartTooltip />} />
                                                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke={COLOR.green} strokeWidth={2} dot={{ r: 3 }} />
                                                    <Line type="monotone" dataKey="expenses" name="Expenses" stroke={COLOR.red} strokeWidth={2} dot={{ r: 3 }} />
                                                    <Line type="monotone" dataKey="balance" name="Profit" stroke={COLOR.gold} strokeWidth={2} dot={{ r: 3 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </section>

                                        <section className="finance-section comparison-chart-card">
                                            <h2>Total Revenue by Event</h2>
                                            <div className="status-legend-row">
                                                <span><i style={{ background: COLOR.gold }} /> Profit</span>
                                                <span><i style={{ background: COLOR.red }} /> Expenses</span>
                                            </div>
                                            <div className="status-bar-list compact">
                                                {chartData.map(e => (
                                                    <RevenueBar
                                                        key={e.event_id}
                                                        event={e}
                                                        selected={e.event_id === selectedEventId}
                                                        onClick={() => setSelectedEventId(e.event_id)}
                                                    />
                                                ))}
                                            </div>
                                        </section>

                                        <section className="finance-section comparison-chart-card">
                                            <h2>Event Financial Flow</h2>
                                            <p className="comparison-chart-subhint">{selectedEvent ? selectedEvent.event_name : "Select an event"}</p>
                                            {selectedEvent && <FinancialFlowMini event={selectedEvent} />}
                                        </section>

                                    </div>

                                </div>

                                <section className="finance-section comparison-chart-card" style={{ display: activeTab === "singers" ? "block" : "none" }}>
                                    <h2>Singer Payment Status By Event</h2>

                                    <div className="status-legend-row">
                                        <span><i style={{ background: COLOR.green }} /> Paid</span>
                                        <span><i style={{ background: COLOR.gold }} /> Pending</span>
                                        <span><i style={{ background: COLOR.red }} /> Rejected</span>
                                    </div>

                                    <div className="status-bar-list">
                                        {chartData.map(e => (
                                            <StatusSegmentBar
                                                key={e.event_id}
                                                event={e}
                                                selected={e.event_id === selectedEventId}
                                                onClick={() => setSelectedEventId(e.event_id)}
                                            />
                                        ))}
                                    </div>
                                </section>

                                <section className="finance-section comparison-chart-card" style={{ display: activeTab === "gender" ? "block" : "none" }}>
                                    <h2>Gender Split - {selectedEvent ? selectedEvent.event_name : "Select an event"}</h2>

                                    {selectedEvent && (selectedEvent.gender_breakdown.Male + selectedEvent.gender_breakdown.Female) > 0 ? (

                                        <div className="gender-donut-layout">

                                            <ResponsiveContainer width="100%" height={320}>
                                                <PieChart>
                                                    <Tooltip content={<ChartTooltip formatter={v => v} />} />
                                                    <Pie
                                                        data={[
                                                            { name: "Male", value: selectedEvent.gender_breakdown.Male },
                                                            { name: "Female", value: selectedEvent.gender_breakdown.Female }
                                                        ]}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        innerRadius={80}
                                                        outerRadius={130}
                                                        paddingAngle={3}
                                                        cornerRadius={6}
                                                        isAnimationActive={true}
                                                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                                            const radius = innerRadius + (outerRadius - innerRadius) / 2;
                                                            const angle = -midAngle * (Math.PI / 180);
                                                            const x = cx + radius * Math.cos(angle);
                                                            const y = cy + radius * Math.sin(angle);
                                                            return (
                                                                <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize={16} fontWeight={700}>
                                                                    {Math.round(percent * 100)}%
                                                                </text>
                                                            );
                                                        }}
                                                        labelLine={false}
                                                    >
                                                        <Cell fill={COLOR.green} stroke="none" />
                                                        <Cell fill={COLOR.blue} stroke="none" />
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>

                                            <div className="gender-donut-legend">
                                                <div className="gender-donut-stat">
                                                    <span className="dot" style={{ background: COLOR.green }} />
                                                    Male
                                                    <strong>{selectedEvent.gender_breakdown.Male}</strong>
                                                </div>
                                                <div className="gender-donut-stat">
                                                    <span className="dot" style={{ background: COLOR.blue }} />
                                                    Female
                                                    <strong>{selectedEvent.gender_breakdown.Female}</strong>
                                                </div>
                                            </div>

                                        </div>

                                    ) : (
                                        <div className="finance-empty">No paid singers yet for this event.</div>
                                    )}
                                </section>

                                <section className="finance-section comparison-chart-card" style={{ display: activeTab === "songs" ? "block" : "none" }}>
                                    <h2>Songs &amp; Karaoke - {selectedEvent ? selectedEvent.event_name : "Select an event"}</h2>

                                    {selectedEvent ? (

                                        <div className="songs-ring-layout">

                                            <SpeedometerGauge
                                                percent={selectedEvent.song_count > 0 ? (selectedEvent.karaoke_available_count / selectedEvent.song_count) * 100 : 0}
                                                label="Karaoke Coverage"
                                                color={COLOR.gold}
                                            />

                                            <div className="songs-ring-stats">
                                                <div className="songs-stat">
                                                    <span className="songs-stat-icon" style={{ background: COLOR.gold + "22", color: COLOR.gold }}>🎵</span>
                                                    <div>
                                                        <strong><CountUp value={selectedEvent.song_count} /></strong>
                                                        <span>Total Songs</span>
                                                    </div>
                                                </div>
                                                <div className="songs-stat">
                                                    <span className="songs-stat-icon" style={{ background: COLOR.green + "22", color: COLOR.green }}>🎤</span>
                                                    <div>
                                                        <strong><CountUp value={selectedEvent.karaoke_available_count} /></strong>
                                                        <span>Karaoke Available</span>
                                                    </div>
                                                </div>
                                            </div>

                                        </div>

                                    ) : (
                                        <div className="finance-empty">No song data yet for this event.</div>
                                    )}
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
