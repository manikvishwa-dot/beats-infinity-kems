import { useEffect, useState } from "react";
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
    Legend
} from "recharts";

import AdminTopbar from "../components/admin/AdminTopbar";
import { getSingersPerEvent, getFinanceByEvent } from "../services/adminDashboardService";
import { exportToExcel } from "../utils/excel";

import "../styles/adminTheme.css";
import "./ComparisonDashboard.css";

const formatCurrency = value =>
    `₹${Number(value || 0).toLocaleString("en-IN")}`;

const REVENUE_COLUMNS = [
    { key: "event_name", header: "Event", width: 26 },
    { key: "revenue", header: "Amount Collected", width: 20 },
    { key: "expenses", header: "Expenses", width: 20 },
    { key: "balance", header: "Profit / Loss", width: 20 }
];

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) {
        return null;
    }

    return (
        <div className="comparison-tooltip">
            <strong>{label}</strong>
            {payload.map(item => (
                <div key={item.dataKey} style={{ color: item.color }}>
                    {item.name}: {formatCurrency(item.value)}
                </div>
            ))}
        </div>
    );
};

function ComparisonDashboard() {

    const [singerStats, setSingerStats] = useState([]);
    const [financeByEvent, setFinanceByEvent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {

        Promise.all([
            getSingersPerEvent(),
            getFinanceByEvent()
        ])
            .then(([singersResult, financeResult]) => {

                setSingerStats(singersResult.events || []);
                setFinanceByEvent(financeResult.events || []);

            })
            .catch(requestError => {

                console.error("Comparison dashboard load error:", requestError);
                setError(
                    requestError.message ||
                    "Unable to load comparison data."
                );

            })
            .finally(() => {

                setLoading(false);

            });

    }, []);

    const handleDownloadRevenue = () => {

        exportToExcel(REVENUE_COLUMNS, financeByEvent, "beats-infinity-revenue-by-event");

    };

    const totalSingers = singerStats.reduce((sum, event) => sum + event.singer_count, 0);
    const totalRevenue = financeByEvent.reduce((sum, event) => sum + event.revenue, 0);
    const totalExpenses = financeByEvent.reduce((sum, event) => sum + event.expenses, 0);

    return (
        <div className="admin-shell">
            <AdminTopbar />

            <div className="admin-shell-content">
                <h1 className="admin-page-title">Comparison Dashboard</h1>
                <p className="admin-page-subtitle">
                    Singer participation and finances across the last 6 months.
                </p>

                {error && <div className="finance-error">⚠️ {error}</div>}

                {loading ? (
                    <div className="finance-empty">Loading comparison data...</div>
                ) : (
                    <>
                        <div className="comparison-summary-row">
                            <div className="comparison-summary-card">
                                <span>Total Singers (6 mo)</span>
                                <strong>{totalSingers}</strong>
                            </div>
                            <div className="comparison-summary-card">
                                <span>Total Revenue (6 mo)</span>
                                <strong className="positive">{formatCurrency(totalRevenue)}</strong>
                            </div>
                            <div className="comparison-summary-card">
                                <span>Total Expenses (6 mo)</span>
                                <strong className="negative">{formatCurrency(totalExpenses)}</strong>
                            </div>
                        </div>

                        <section className="finance-section comparison-chart-card">
                            <h2>🎤 Singers Participated Per Event</h2>

                            {singerStats.length === 0 ? (
                                <div className="finance-empty">No events in the last 6 months yet.</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={320}>
                                    <BarChart data={singerStats} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                                        <XAxis dataKey="event_name" stroke="#999" tick={{ fill: "#ccc", fontSize: 12 }} />
                                        <YAxis stroke="#999" tick={{ fill: "#ccc", fontSize: 12 }} allowDecimals={false} />
                                        <Tooltip
                                            contentStyle={{ background: "#1D1D1D", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }}
                                            labelStyle={{ color: "#fff" }}
                                        />
                                        <Bar dataKey="singer_count" name="Singers" fill="#1DB954" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </section>

                        <section className="finance-section comparison-chart-card">
                            <div className="comparison-chart-header">
                                <h2>💰 Revenue vs Expenses By Event</h2>

                                <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={handleDownloadRevenue}>
                                    ⬇ Download Revenue Excel
                                </button>
                            </div>

                            {financeByEvent.length === 0 ? (
                                <div className="finance-empty">No events in the last 6 months yet.</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={340}>
                                    <ComposedChart data={financeByEvent} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                                        <XAxis dataKey="event_name" stroke="#999" tick={{ fill: "#ccc", fontSize: 12 }} />
                                        <YAxis stroke="#999" tick={{ fill: "#ccc", fontSize: 12 }} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Legend wrapperStyle={{ color: "#ccc" }} />
                                        <Bar dataKey="revenue" name="Amount Collected" fill="#1DB954" radius={[6, 6, 0, 0]} />
                                        <Bar dataKey="expenses" name="Expenses" fill="#ff6b6b" radius={[6, 6, 0, 0]} />
                                        <Line type="monotone" dataKey="balance" name="Profit / Loss" stroke="#FFD54A" strokeWidth={2} dot={{ r: 4 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            )}
                        </section>
                    </>
                )}
            </div>
        </div>
    );

}

export default ComparisonDashboard;
