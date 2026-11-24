import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";

import AdminTopbar from "../components/admin/AdminTopbar";
import BirthdayCard from "../components/admin/BirthdayCard";
import { getSession } from "../services/adminService";
import { getDashboardOverview, getEventAnalytics } from "../services/adminDashboardService";

import "../styles/adminTheme.css";
import "./AdminDashboard.css";

// ==========================================================
// ADMIN DASHBOARD - charts for comparing events and growing
// the community.
//
//   Everyone:          members, singers per event, registration
//                      pace, gender, sign-ups, loyal singers
//   Super Admin only:  revenue vs expenses, profit / loss
//
// The singer-by-singer table lives on /admin/registrations.
// ==========================================================

// Categorical slots (dark steps, validated) - an event keeps its
// colour whatever is filtered, because colour follows the event
const EVENT_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"];

const C = {
    male: "#3987e5",
    female: "#d55181",
    other: "#9085e9",
    paid: "#0ca30c",
    free: "#3987e5",
    pending: "#fab219",
    firstTimers: "#3987e5",
    returning: "#d95926",
    revenue: "#3987e5",
    expenses: "#d95926",
    profit: "#0ca30c",
    loss: "#d03b3b",
    grid: "rgba(255,255,255,0.06)",
    axis: "#8a8a8a"
};

const BREAKDOWNS = {
    status: {
        label: "Payment status",
        series: [
            { key: "paid", label: "Paid", color: C.paid },
            { key: "free", label: "₹0 entry", color: C.free },
            { key: "pending", label: "Pending", color: C.pending }
        ]
    },
    gender: {
        label: "Gender",
        series: [
            { key: "male", label: "Male", color: C.male },
            { key: "female", label: "Female", color: C.female },
            { key: "other", label: "Other", color: C.other }
        ]
    },
    loyalty: {
        label: "New vs returning",
        series: [
            { key: "first_timers", label: "First time", color: C.firstTimers },
            { key: "returning", label: "Returning", color: C.returning }
        ]
    }
};

const DAY_MS = 24 * 60 * 60 * 1000;

const rupees = value => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;

const shortRupees = value => {
    const n = Number(value || 0);
    const sign = n < 0 ? "−" : "";
    const abs = Math.abs(n);
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(abs >= 1000000 ? 0 : 1)}L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
    return `${sign}₹${abs}`;
};

const formatDate = value =>
    value
        ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : "";

// "Cinematic Monarch - The Heroes" -> "Cinematic Monarch"
const shortName = name => (name || "Event").split(/\s[-–—|:]\s/)[0];

const daysUntil = date => Math.ceil((new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DAY_MS);

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);


// ---------- small building blocks ----------

function ChartTooltip({ active, payload, label, title, formatter = v => v, footer }) {
    if (!active || !payload?.length) return null;

    const rows = payload.filter(p => p.value !== null && p.value !== undefined);
    const heading = title ? title(payload[0]?.payload, label) : label;
    const note = footer ? footer(payload[0]?.payload) : null;

    return (
        <div className="dash-tooltip">
            {heading && <div className="dash-tooltip-title">{heading}</div>}
            {rows.map(row => (
                <div className="dash-tooltip-row" key={row.dataKey}>
                    <span className="dash-swatch" style={{ background: row.color || row.payload?.fill }} />
                    <span className="dash-tooltip-label">{row.name}</span>
                    <strong>{formatter(row.value, row)}</strong>
                </div>
            ))}
            {note && <div className="dash-tooltip-note">{note}</div>}
        </div>
    );
}

function Legend({ items, hidden, onToggle }) {
    return (
        <div className="dash-legend">
            {items.map(item => {
                const off = hidden?.has(item.key);
                const content = (
                    <>
                        <span className="dash-swatch" style={{ background: item.color }} />
                        {item.label}
                    </>
                );

                return onToggle ? (
                    <button
                        type="button"
                        key={item.key}
                        className={off ? "dash-legend-item off" : "dash-legend-item"}
                        onClick={() => onToggle(item.key)}
                        aria-pressed={!off}
                        title={off ? "Show" : "Hide"}
                    >
                        {content}
                    </button>
                ) : (
                    <span key={item.key} className="dash-legend-item static">{content}</span>
                );
            })}
        </div>
    );
}

function Segmented({ options, value, onChange, label }) {
    return (
        <div className="dash-segmented" role="group" aria-label={label}>
            {options.map(option => (
                <button
                    type="button"
                    key={option.value}
                    className={option.value === value ? "active" : ""}
                    onClick={() => onChange(option.value)}
                    aria-pressed={option.value === value}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function Card({ title, subtitle, actions, children, className = "" }) {
    return (
        <section className={`dash-card ${className}`}>
            <header className="dash-card-head">
                <div>
                    <h2>{title}</h2>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {actions}
            </header>
            {children}
        </section>
    );
}

function Kpi({ icon, label, value, sub, tone, to, meter, text = false }) {
    const body = (
        <>
            <div className="dash-kpi-top">
                <span className="dash-kpi-icon" aria-hidden="true">{icon}</span>
                <span className="dash-kpi-label">{label}</span>
            </div>
            <div className={text ? "dash-kpi-value text" : "dash-kpi-value"} title={text ? String(value) : undefined}>{value}</div>
            {meter !== undefined && (
                <div className="dash-meter" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, meter)}%` }} />
                </div>
            )}
            {sub && <div className={`dash-kpi-sub ${tone || ""}`}>{sub}</div>}
        </>
    );

    return to ? (
        <Link to={to} className="dash-kpi link">{body}</Link>
    ) : (
        <div className="dash-kpi">{body}</div>
    );
}

const axisProps = {
    tick: { fill: C.axis, fontSize: 12 },
    tickLine: false,
    axisLine: { stroke: C.grid }
};

const yAxisProps = {
    tick: { fill: C.axis, fontSize: 12 },
    tickLine: false,
    axisLine: false,
    width: 40,
    allowDecimals: false
};


// ==========================================================

function AdminDashboard() {

    const isSuperAdmin = getSession()?.admin?.role === "super_admin";

    const [overview, setOverview] = useState(null);
    const [money, setMoney] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [moneyError, setMoneyError] = useState("");

    const [visibleIds, setVisibleIds] = useState(null);   // null = all events
    const [breakdown, setBreakdown] = useState("status");
    const [spotlightId, setSpotlightId] = useState(null);
    const [hiddenPace, setHiddenPace] = useState(new Set());
    const [hoverGender, setHoverGender] = useState(null);

    const fetchAll = useCallback(() => Promise.allSettled([
        getDashboardOverview(),
        isSuperAdmin ? getEventAnalytics() : Promise.resolve(null)
    ]), [isSuperAdmin]);

    const applyResults = useCallback(([overviewResult, moneyResult]) => {
        if (overviewResult.status === "fulfilled") {
            setOverview(overviewResult.value);
            setError("");
        }
        else {
            setError(overviewResult.reason?.message || "Unable to load the dashboard.");
        }

        if (moneyResult.status === "fulfilled") {
            setMoney(moneyResult.value?.events || null);
            setMoneyError("");
        }
        else {
            setMoneyError(moneyResult.reason?.message || "Unable to load the money figures.");
        }

        setLoading(false);
    }, []);

    // First load
    useEffect(() => {
        let alive = true;
        fetchAll().then(results => {
            if (alive) applyResults(results);
        });
        return () => {
            alive = false;
        };
    }, [fetchAll, applyResults]);

    // Refresh button
    const load = async () => {
        setLoading(true);
        applyResults(await fetchAll());
    };

    // ---------- derived data ----------

    const allEvents = useMemo(() => (overview?.events || []).map((event, index) => ({
        ...event,
        short: shortName(event.event_name),
        color: EVENT_COLORS[index % EVENT_COLORS.length],
        upcoming: daysUntil(event.event_date) >= 0
    })), [overview]);

    const events = useMemo(
        () => (visibleIds ? allEvents.filter(e => visibleIds.has(e.event_id)) : allEvents),
        [allEvents, visibleIds]
    );

    // The event everyone is working towards: the next upcoming
    // one, else the most recent
    const focusEvent = useMemo(() => {
        const upcoming = allEvents.filter(e => e.upcoming);
        return upcoming[0] || allEvents[allEvents.length - 1] || null;
    }, [allEvents]);

    const previousEvent = useMemo(() => {
        if (!focusEvent) return null;
        const index = allEvents.findIndex(e => e.event_id === focusEvent.event_id);
        return index > 0 ? allEvents[index - 1] : null;
    }, [allEvents, focusEvent]);

    const spotlight = allEvents.find(e => e.event_id === spotlightId) || focusEvent;

    const toggleEvent = id => {
        setVisibleIds(current => {
            const next = new Set(current || allEvents.map(e => e.event_id));
            if (next.has(id)) {
                if (next.size === 1) return next;   // keep at least one
                next.delete(id);
            }
            else {
                next.add(id);
            }
            return next.size === allEvents.length ? null : next;
        });
    };

    // Registration pace: cumulative sign-ups by days before the event
    const pace = useMemo(() => {
        if (events.length === 0) return { rows: [], maxDay: 0 };

        const maxDay = Math.min(
            90,
            Math.max(14, ...events.flatMap(e => e.registration_days_before))
        );

        const rows = [];
        for (let day = maxDay; day >= 0; day -= 1) {
            const row = { day };
            events.forEach(event => {
                const togo = daysUntil(event.event_date);
                // An upcoming event has no data for days still ahead
                row[event.event_id] = event.upcoming && day < togo
                    ? null
                    : event.registration_days_before.filter(d => d >= day).length;
            });
            rows.push(row);
        }

        return { rows, maxDay };
    }, [events]);

    const signups = useMemo(() => {
        const months = overview?.members?.monthly_signups || [];
        const first = months.findIndex(m => m.count > 0);
        const start = first === -1 ? months.length - 6 : Math.min(first, months.length - 6);
        return months.slice(Math.max(0, start)).map(m => ({
            ...m,
            label: new Date(`${m.month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
        }));
    }, [overview]);

    const moneyRows = useMemo(() => (money || []).map(row => {
        const match = allEvents.find(e => e.event_id === row.event_id);
        return {
            ...row,
            short: shortName(row.event_name),
            color: match?.color || EVENT_COLORS[0],
            upcoming: daysUntil(row.event_date) >= 0
        };
    }).filter(row => !visibleIds || visibleIds.has(row.event_id)), [money, allEvents, visibleIds]);

    // ---------- render ----------

    const members = overview?.members;
    const sungEver = members ? members.engagement.once + members.engagement.repeat : 0;
    const genderData = members ? [
        { key: "male", label: "Male", value: members.gender.male, color: C.male },
        { key: "female", label: "Female", value: members.gender.female, color: C.female },
        { key: "other", label: "Other", value: members.gender.other, color: C.other }
    ].filter(g => g.value > 0) : [];

    const loyalSingers = (members?.top_singers || []).filter(s => s.events >= 2);

    const focusDays = focusEvent ? daysUntil(focusEvent.event_date) : null;
    const comparingPace = Boolean(focusEvent?.upcoming && previousEvent);
    const previousCount = !previousEvent
        ? null
        : comparingPace
            ? previousEvent.registration_days_before.filter(d => d >= focusDays).length
            : previousEvent.registered;
    const focusDelta = previousCount === null ? null : focusEvent.registered - previousCount;

    const breakdownSeries = BREAKDOWNS[breakdown].series;

    return (
        <div className="admin-shell">
            <AdminTopbar />

            <div className="admin-shell-content dash-page">

                <div className="dash-header">
                    <div>
                        <h1 className="admin-page-title">Dashboard</h1>
                        <p className="admin-page-subtitle">
                            How each event compares and how the Beats Infinity family is growing.
                        </p>
                    </div>
                    <div className="dash-header-actions">
                        <Link to="/admin/registrations" className="admin-btn admin-btn-ghost admin-btn-sm">📝 Registrations</Link>
                        <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={load} disabled={loading}>
                            {loading ? "Loading…" : "↻ Refresh"}
                        </button>
                    </div>
                </div>

                {error && <div className="dash-error">⚠️ {error}</div>}

                {!overview && loading && (
                    <div className="dash-skeleton-grid" aria-label="Loading">
                        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="dash-skeleton" />)}
                    </div>
                )}

                {overview && (
                    <>
                        {/* ---------- headline numbers ---------- */}
                        <div className="dash-kpis">
                            <Kpi
                                icon="👥"
                                label="Total members"
                                value={members.total.toLocaleString("en-IN")}
                                sub={members.new_last_30_days > 0 ? `+${members.new_last_30_days} joined in the last 30 days` : "No new sign-ups in 30 days"}
                                tone={members.new_last_30_days > 0 ? "up" : ""}
                                to="/admin/singers"
                            />

                            {focusEvent && (
                                <Kpi
                                    icon="🎤"
                                    label={focusEvent.upcoming ? "Next event" : "Latest event"}
                                    value={focusEvent.short}
                                    text
                                    meter={focusEvent.max_seats ? pct(focusEvent.registered, focusEvent.max_seats) : undefined}
                                    sub={[
                                        focusEvent.max_seats
                                            ? `${focusEvent.registered}/${focusEvent.max_seats} seats`
                                            : `${focusEvent.registered} singers`,
                                        focusDays > 0 ? `in ${focusDays} day${focusDays === 1 ? "" : "s"}` : focusDays === 0 ? "today" : formatDate(focusEvent.event_date)
                                    ].join(" · ")}
                                />
                            )}

                            {focusEvent && (
                                <Kpi
                                    icon="📈"
                                    label="Singers registered"
                                    value={focusEvent.registered}
                                    sub={focusDelta === null
                                        ? "First event - nothing to compare yet"
                                        : comparingPace
                                            ? `${focusDelta >= 0 ? "▲" : "▼"} ${Math.abs(focusDelta)} vs ${previousEvent.short} at the same point (${previousCount} with ${focusDays} days to go)`
                                            : `${focusDelta >= 0 ? "▲" : "▼"} ${Math.abs(focusDelta)} vs ${previousEvent.short} (${previousCount})`}
                                    tone={focusDelta === null ? "" : focusDelta >= 0 ? "up" : "down"}
                                />
                            )}

                            <Kpi
                                icon="🔁"
                                label="Came back for more"
                                value={`${pct(members.engagement.repeat, sungEver)}%`}
                                sub={`${members.engagement.repeat} of ${sungEver} singers sang at 2+ events`}
                            />

                            {focusEvent && (
                                <Kpi
                                    icon="⏳"
                                    label="Waiting for approval"
                                    value={focusEvent.pending}
                                    sub={focusEvent.pending > 0 ? "Review on Payments →" : "All caught up"}
                                    tone={focusEvent.pending > 0 ? "warn" : "up"}
                                    to="/admin/payments"
                                />
                            )}
                        </div>

                        <BirthdayCard />

                        {/* ---------- event filter ---------- */}
                        {allEvents.length > 1 && (
                            <div className="dash-filter">
                                <span className="dash-filter-label">Compare</span>
                                <button
                                    type="button"
                                    className={!visibleIds ? "dash-chip active" : "dash-chip"}
                                    onClick={() => setVisibleIds(null)}
                                >
                                    All events
                                </button>
                                {allEvents.map(event => {
                                    const on = !visibleIds || visibleIds.has(event.event_id);
                                    return (
                                        <button
                                            type="button"
                                            key={event.event_id}
                                            className={on ? "dash-chip on" : "dash-chip"}
                                            onClick={() => toggleEvent(event.event_id)}
                                            aria-pressed={on}
                                            title={`${event.event_name} · ${formatDate(event.event_date)}`}
                                        >
                                            <span className="dash-swatch" style={{ background: event.color }} />
                                            {event.short}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {allEvents.length === 0 ? (
                            <div className="dash-empty">No events yet - create one on the Events page to see comparisons here.</div>
                        ) : (
                            <div className="dash-grid">

                                {/* ---------- singers per event ---------- */}
                                <Card
                                    className="span-2"
                                    title="Singers per event"
                                    subtitle="Click a bar to see that event's details"
                                    actions={(
                                        <Segmented
                                            label="Break down by"
                                            value={breakdown}
                                            onChange={setBreakdown}
                                            options={Object.entries(BREAKDOWNS).map(([value, b]) => ({ value, label: b.label }))}
                                        />
                                    )}
                                >
                                    <Legend items={breakdownSeries} />
                                    <div className="dash-chart tall">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={events} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                                                <CartesianGrid vertical={false} stroke={C.grid} />
                                                <XAxis dataKey="short" {...axisProps} interval={0} />
                                                <YAxis {...yAxisProps} />
                                                <Tooltip
                                                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                                                    content={(
                                                        <ChartTooltip
                                                            title={row => `${row?.event_name} · ${formatDate(row?.event_date)}`}
                                                            footer={row => `${row?.registered} registered in total`}
                                                        />
                                                    )}
                                                />
                                                {breakdownSeries.map((series, index) => (
                                                    <Bar
                                                        key={series.key}
                                                        dataKey={series.key}
                                                        name={series.label}
                                                        stackId="a"
                                                        fill={series.color}
                                                        stroke="#141414"
                                                        strokeWidth={2}
                                                        radius={index === breakdownSeries.length - 1 ? [4, 4, 0, 0] : 0}
                                                        maxBarSize={88}
                                                        cursor="pointer"
                                                        onClick={data => setSpotlightId(data?.payload?.event_id || data?.event_id)}
                                                    />
                                                ))}
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>

                                {/* ---------- event spotlight ---------- */}
                                {spotlight && (
                                    <Card
                                        title={spotlight.short}
                                        subtitle={`${formatDate(spotlight.event_date)}${spotlight.upcoming ? " · upcoming" : ""}`}
                                        className="dash-spotlight"
                                        actions={<span className="dash-swatch big" style={{ background: spotlight.color }} />}
                                    >
                                        <div className="dash-spot-hero">
                                            <strong>{spotlight.registered}</strong>
                                            <span>singers registered</span>
                                        </div>

                                        {spotlight.max_seats ? (
                                            <div className="dash-spot-seats">
                                                <div className="dash-meter big" aria-hidden="true">
                                                    <span style={{ width: `${Math.min(100, pct(spotlight.registered, spotlight.max_seats))}%` }} />
                                                </div>
                                                <small>{pct(spotlight.registered, spotlight.max_seats)}% of {spotlight.max_seats} seats filled</small>
                                            </div>
                                        ) : null}

                                        <dl className="dash-spot-stats">
                                            <div><dt>Songs</dt><dd>{spotlight.songs}</dd></div>
                                            <div><dt>Pairings</dt><dd>{spotlight.pairings}</dd></div>
                                            <div><dt>Songs / singer</dt><dd>{spotlight.registered ? (spotlight.songs / spotlight.registered).toFixed(1) : "–"}</dd></div>
                                            <div><dt>Walk-ins</dt><dd>{spotlight.walk_ins}</dd></div>
                                            <div><dt>First timers</dt><dd>{spotlight.first_timers}</dd></div>
                                            <div><dt>Male : Female</dt><dd>{spotlight.male} : {spotlight.female}</dd></div>
                                        </dl>
                                    </Card>
                                )}

                                {/* ---------- registration pace ---------- */}
                                <Card
                                    className="span-3"
                                    title="Registration pace"
                                    subtitle="Total singers signed up by each day before the event - is the next event on track?"
                                >
                                    <Legend
                                        items={events.map(e => ({ key: e.event_id, label: e.short, color: e.color }))}
                                        hidden={hiddenPace}
                                        onToggle={key => setHiddenPace(current => {
                                            const next = new Set(current);
                                            if (next.has(key)) next.delete(key); else next.add(key);
                                            return next;
                                        })}
                                    />
                                    <div className="dash-chart">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={pace.rows} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                                                <CartesianGrid vertical={false} stroke={C.grid} />
                                                <XAxis
                                                    dataKey="day"
                                                    {...axisProps}
                                                    interval="preserveStartEnd"
                                                    minTickGap={28}
                                                    tickFormatter={d => (d === 0 ? "Event day" : `${d}d`)}
                                                />
                                                <YAxis {...yAxisProps} />
                                                <Tooltip
                                                    cursor={{ stroke: "rgba(255,255,255,0.25)", strokeWidth: 1 }}
                                                    content={(
                                                        <ChartTooltip
                                                            title={(_, day) => (day === 0 ? "On event day" : `${day} day${day === 1 ? "" : "s"} before`)}
                                                            formatter={v => `${v} singers`}
                                                        />
                                                    )}
                                                />
                                                {events.filter(e => !hiddenPace.has(e.event_id)).map(event => (
                                                    <Line
                                                        key={event.event_id}
                                                        type="monotone"
                                                        dataKey={event.event_id}
                                                        name={event.short}
                                                        stroke={event.color}
                                                        strokeWidth={2}
                                                        dot={false}
                                                        activeDot={{ r: 5, stroke: "#141414", strokeWidth: 2 }}
                                                        connectNulls={false}
                                                        isAnimationActive
                                                    />
                                                ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>

                                {/* ---------- members ---------- */}
                                <Card title="Members by gender" subtitle={`${members.total} people have signed up`}>
                                    <div className="dash-donut">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={genderData}
                                                    dataKey="value"
                                                    nameKey="label"
                                                    innerRadius="62%"
                                                    outerRadius="88%"
                                                    paddingAngle={2}
                                                    stroke="#141414"
                                                    strokeWidth={2}
                                                    onMouseEnter={(_, index) => setHoverGender(index)}
                                                    onMouseLeave={() => setHoverGender(null)}
                                                >
                                                    {genderData.map((g, index) => (
                                                        <Cell
                                                            key={g.key}
                                                            fill={g.color}
                                                            opacity={hoverGender === null || hoverGender === index ? 1 : 0.35}
                                                        />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="dash-donut-center">
                                            {hoverGender !== null && genderData[hoverGender] ? (
                                                <>
                                                    <strong>{pct(genderData[hoverGender].value, members.total)}%</strong>
                                                    <span>{genderData[hoverGender].label} · {genderData[hoverGender].value}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <strong>{members.total}</strong>
                                                    <span>members</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <Legend items={genderData.map(g => ({ ...g, label: `${g.label} · ${g.value}` }))} />
                                </Card>

                                <Card title="New sign-ups" subtitle="Members joining each month">
                                    <div className="dash-chart short">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={signups} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                                                <CartesianGrid vertical={false} stroke={C.grid} />
                                                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
                                                <YAxis {...yAxisProps} width={32} />
                                                <Tooltip
                                                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                                                    content={<ChartTooltip formatter={v => `${v} joined`} />}
                                                />
                                                <Bar dataKey="count" name="New members" fill={C.male} radius={[4, 4, 0, 0]} maxBarSize={36} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>

                                <Card title="Member engagement" subtitle="How many events each member has sung at">
                                    <EngagementBar engagement={members.engagement} total={members.total} />

                                    <h3 className="dash-subhead">🏅 Loyal singers</h3>
                                    {loyalSingers.length === 0 ? (
                                        <p className="dash-muted">Nobody has sung at two events yet - they'll appear here.</p>
                                    ) : (
                                        <ul className="dash-loyal">
                                            {loyalSingers.map(singer => (
                                                <li key={singer.singer_name}>
                                                    <span className="dash-loyal-name">{singer.singer_name}</span>
                                                    <span className="dash-loyal-bar">
                                                        <span
                                                            style={{
                                                                width: `${pct(singer.events, loyalSingers[0].events)}%`,
                                                                background: singer.gender === "Female" ? C.female : singer.gender === "Male" ? C.male : C.other
                                                            }}
                                                        />
                                                    </span>
                                                    <strong>{singer.events} events</strong>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </Card>

                            </div>
                        )}

                        {/* ---------- money (super admin only) ---------- */}
                        {isSuperAdmin && (
                            <MoneySection rows={moneyRows} error={moneyError} />
                        )}

                        <p className="dash-updated">
                            Updated {new Date(overview.generated_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}


// ---------- engagement: never / once / repeat ----------

function EngagementBar({ engagement, total }) {
    const parts = [
        { key: "never", label: "Not sung yet", value: engagement.never, color: "#55554f" },
        { key: "once", label: "1 event", value: engagement.once, color: C.male },
        { key: "repeat", label: "2+ events", value: engagement.repeat, color: C.returning }
    ];

    return (
        <div className="dash-engage">
            <div className="dash-engage-bar">
                {parts.filter(p => p.value > 0).map(part => (
                    <span
                        key={part.key}
                        style={{ flexGrow: part.value, background: part.color }}
                        title={`${part.label}: ${part.value} (${pct(part.value, total)}%)`}
                    />
                ))}
            </div>
            <div className="dash-engage-legend">
                {parts.map(part => (
                    <div key={part.key}>
                        <span className="dash-swatch" style={{ background: part.color }} />
                        <span>{part.label}</span>
                        <strong>{part.value}</strong>
                        <em>{pct(part.value, total)}%</em>
                    </div>
                ))}
            </div>
        </div>
    );
}


// ---------- money ----------

function MoneySection({ rows, error }) {

    const completed = rows.filter(r => !r.upcoming);
    const totals = rows.reduce((acc, r) => ({
        revenue: acc.revenue + r.revenue,
        expenses: acc.expenses + r.expenses,
        balance: acc.balance + r.balance
    }), { revenue: 0, expenses: 0, balance: 0 });

    const profitable = completed.filter(r => r.balance > 0);
    const inLoss = completed.filter(r => r.balance < 0);
    const upcomingCount = rows.length - completed.length;

    const best = [...completed].sort((a, b) => b.balance - a.balance)[0];

    return (
        <section className="dash-money">
            <div className="dash-money-head">
                <div>
                    <h2>💰 Money <span className="dash-super-tag">SUPER ADMIN</span></h2>
                    <p>Revenue, costs and profit for events in the last 6 months. Only Super Admins can see this.</p>
                </div>
                <Link to="/superadmin" className="admin-btn admin-btn-ghost admin-btn-sm">Open Finance →</Link>
            </div>

            {error && <div className="dash-error">⚠️ {error}</div>}

            {!error && rows.length === 0 && (
                <div className="dash-empty">No events with money figures in the last 6 months.</div>
            )}

            {rows.length > 0 && (
                <>
                    <div className="dash-kpis">
                        <Kpi icon="💵" label="Revenue" value={rupees(totals.revenue)} sub={`${rows.length} event${rows.length === 1 ? "" : "s"}`} />
                        <Kpi icon="🧾" label="Expenses" value={rupees(totals.expenses)} sub={`${pct(totals.expenses, totals.revenue)}% of revenue`} />
                        <Kpi
                            icon={totals.balance >= 0 ? "📈" : "📉"}
                            label={totals.balance >= 0 ? "Net profit" : "Net loss"}
                            value={rupees(Math.abs(totals.balance))}
                            sub={totals.revenue > 0 ? `${pct(totals.balance, totals.revenue)}% margin` : "No revenue yet"}
                            tone={totals.balance >= 0 ? "up" : "down"}
                        />
                        <Kpi
                            icon="✅"
                            label="Events in profit"
                            value={profitable.length}
                            sub={best && best.balance > 0 ? `Best: ${best.short} (${rupees(best.balance)})` : "None yet"}
                            tone="up"
                        />
                        <Kpi
                            icon="⚠️"
                            label="Events in loss"
                            value={inLoss.length}
                            sub={inLoss.length ? inLoss.map(r => r.short).join(", ") : upcomingCount ? `${upcomingCount} upcoming not counted yet` : "None 🎉"}
                            tone={inLoss.length ? "down" : "up"}
                        />
                    </div>

                    <div className="dash-grid two">
                        <Card title="Revenue vs expenses" subtitle="Per event, same ₹ scale">
                            <Legend items={[
                                { key: "revenue", label: "Revenue", color: C.revenue },
                                { key: "expenses", label: "Expenses", color: C.expenses }
                            ]} />
                            <div className="dash-chart">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={rows} margin={{ top: 16, right: 8, left: 8, bottom: 0 }} barGap={2} barCategoryGap="30%">
                                        <CartesianGrid vertical={false} stroke={C.grid} />
                                        <XAxis dataKey="short" {...axisProps} interval={0} />
                                        <YAxis {...yAxisProps} width={52} tickFormatter={shortRupees} />
                                        <Tooltip
                                            cursor={{ fill: "rgba(255,255,255,0.04)" }}
                                            content={(
                                                <ChartTooltip
                                                    title={row => `${row?.event_name}${row?.upcoming ? " · upcoming, so far" : ""}`}
                                                    formatter={rupees}
                                                    footer={row => `${row?.balance >= 0 ? "Profit" : "Loss"} ${rupees(Math.abs(row?.balance))} · ₹${(row?.avg_revenue_per_singer || 0).toLocaleString("en-IN")} per paying singer`}
                                                />
                                            )}
                                        />
                                        <Bar dataKey="revenue" name="Revenue" fill={C.revenue} radius={[4, 4, 0, 0]} maxBarSize={48} />
                                        <Bar dataKey="expenses" name="Expenses" fill={C.expenses} radius={[4, 4, 0, 0]} maxBarSize={48} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        <Card title="Profit or loss" subtitle="Above the line = profit, below = loss">
                            <div className="dash-chart">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={rows} margin={{ top: 24, right: 8, left: 8, bottom: 0 }} barCategoryGap="34%">
                                        <CartesianGrid vertical={false} stroke={C.grid} />
                                        <XAxis dataKey="short" {...axisProps} interval={0} />
                                        <YAxis {...yAxisProps} width={52} tickFormatter={shortRupees} />
                                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.35)" />
                                        <Tooltip
                                            cursor={{ fill: "rgba(255,255,255,0.04)" }}
                                            content={(
                                                <ChartTooltip
                                                    title={row => `${row?.event_name}${row?.upcoming ? " · upcoming, so far" : ""}`}
                                                    formatter={(v, row) => `${v >= 0 ? "▲ Profit" : "▼ Loss"} ${rupees(Math.abs(v))} (${row?.payload?.profit_margin_pct ?? 0}%)`}
                                                />
                                            )}
                                        />
                                        <Bar
                                            dataKey="balance"
                                            name="Result"
                                            maxBarSize={56}
                                            radius={[4, 4, 4, 4]}
                                            label={{ position: "top", fill: "#cfcfcf", fontSize: 12, formatter: shortRupees }}
                                        >
                                            {rows.map(row => (
                                                <Cell
                                                    key={row.event_id}
                                                    fill={row.balance >= 0 ? C.profit : C.loss}
                                                    fillOpacity={row.upcoming ? 0.55 : 1}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            {upcomingCount > 0 && (
                                <p className="dash-muted small">Faded bars are upcoming events - their figures will change.</p>
                            )}
                        </Card>
                    </div>
                </>
            )}
        </section>
    );
}

export default AdminDashboard;
