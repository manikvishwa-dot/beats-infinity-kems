import { useCallback, useEffect, useMemo, useState } from "react";

import { getFinalPairingList } from "../../services/adminDashboardService";
import { exportToExcel } from "../../utils/excel";

import "./SongCountTab.css";

// ==========================================================
// SONG COUNT - how many songs each singer has on the saved
// Final List, male and female side by side, with an Excel
// download. Reads the same list the Final List tab saves.
// ==========================================================

const EXCEL_COLUMNS = [
    { key: "gender", header: "Gender", width: 10 },
    { key: "singer", header: "Singer", width: 24 },
    { key: "total", header: "Total Songs", width: 12 },
    { key: "duets", header: "Duets", width: 10 },
    { key: "solos", header: "Solos", width: 10 },
    { key: "songs", header: "Songs (with partner)", width: 80 }
];

const normalize = value => String(value || "").trim().toLowerCase();

const songLine = song =>
    `${song.title || "(no title)"}${song.partner ? ` - with ${song.partner}` : " - solo"}`;

function SongCountTab({ eventId }) {

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("count");
    const [expanded, setExpanded] = useState(() => new Set());
    const [exporting, setExporting] = useState(false);

    const apply = useCallback(result => {
        setData(result);
        setError("");
        setLoading(false);
    }, []);

    const fail = useCallback(requestError => {
        setError(requestError.message || "Unable to load the final list.");
        setLoading(false);
    }, []);

    useEffect(() => {
        let alive = true;
        getFinalPairingList(eventId)
            .then(result => alive && apply(result))
            .catch(requestError => alive && fail(requestError));
        return () => {
            alive = false;
        };
    }, [eventId, apply, fail]);

    const refresh = () => {
        setLoading(true);
        getFinalPairingList(eventId).then(apply).catch(fail);
    };

    // singer -> { total, duets, solos, songs[] }
    const { male, female, totals } = useMemo(() => {
        const singers = data?.singers || [];
        const rows = data?.rows || [];
        const nameById = new Map(singers.map(s => [s.id, s.singer_name]));
        const stats = new Map();

        const statFor = id => {
            if (!stats.has(id)) stats.set(id, { total: 0, duets: 0, solos: 0, songs: [] });
            return stats.get(id);
        };

        let duets = 0;
        let solos = 0;

        rows.forEach(row => {
            const ids = [row.male_singer_id, row.female_singer_id].filter(Boolean);
            if (ids.length === 0) return;

            const isDuet = ids.length === 2;
            if (isDuet) duets += 1; else solos += 1;

            ids.forEach(id => {
                const partnerId = ids.find(other => other !== id);
                const stat = statFor(id);
                stat.total += 1;
                if (isDuet) stat.duets += 1; else stat.solos += 1;
                stat.songs.push({
                    title: row.song_title,
                    movie: row.movie,
                    partner: partnerId ? nameById.get(partnerId) || "Unknown" : ""
                });
            });
        });

        const build = gender => singers
            .filter(s => normalize(s.gender) === gender && (s.in_event || stats.has(s.id)))
            .map(s => ({
                id: s.id,
                name: s.singer_name,
                ...(stats.get(s.id) || { total: 0, duets: 0, solos: 0, songs: [] })
            }));

        return {
            male: build("male"),
            female: build("female"),
            totals: { songs: duets + solos, duets, solos }
        };
    }, [data]);

    const arrange = list => {
        const term = normalize(search);
        return list
            .filter(item => !term || normalize(item.name).includes(term))
            .sort((a, b) =>
                sortBy === "count"
                    ? b.total - a.total || a.name.localeCompare(b.name)
                    : a.name.localeCompare(b.name)
            );
    };

    const toggle = id => setExpanded(current => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const handleExport = async () => {
        setExporting(true);
        try {
            const byName = (a, b) => a.name.localeCompare(b.name);
            const rows = [
                ...[...male].sort(byName).map(item => ({ ...item, gender: "Male" })),
                ...[...female].sort(byName).map(item => ({ ...item, gender: "Female" }))
            ].map(item => ({
                gender: item.gender,
                singer: item.name,
                total: item.total,
                duets: item.duets,
                solos: item.solos,
                songs: item.songs.map(songLine).join("; ")
            }));

            const slug = (data?.event_name || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
            await exportToExcel(EXCEL_COLUMNS, rows, `song-count-${slug}`);
        }
        catch (exportError) {
            setError(exportError.message || "Unable to create the Excel file.");
        }
        finally {
            setExporting(false);
        }
    };

    if (loading && !data) {
        return <div className="pairing-empty">Loading song counts...</div>;
    }

    const everyone = [...male, ...female];
    const zeroCount = everyone.filter(item => item.total === 0).length;
    const maxSongs = Math.max(1, ...everyone.map(item => item.total));
    const average = list => (list.length ? (list.reduce((sum, item) => sum + item.total, 0) / list.length).toFixed(1) : "0");

    const renderGroup = (label, list, tone) => {
        const shown = arrange(list);
        const songs = list.reduce((sum, item) => sum + item.total, 0);

        return (
            <section className={`songcount-group ${tone}`}>
                <header>
                    <h3>{label}</h3>
                    <span>{list.length} singers · {songs} song slots · avg {average(list)}</span>
                </header>

                {shown.length === 0 ? (
                    <p className="songcount-empty">{search ? "No match." : `No ${label.toLowerCase()} on this event.`}</p>
                ) : (
                    <ul>
                        {shown.map(item => {
                            const open = expanded.has(item.id);
                            return (
                                <li key={item.id} className={item.total === 0 ? "is-zero" : ""}>
                                    <button
                                        type="button"
                                        className="songcount-row"
                                        onClick={() => toggle(item.id)}
                                        aria-expanded={open}
                                        disabled={item.total === 0}
                                        title={item.total === 0 ? "No songs yet" : open ? "Hide songs" : "Show songs"}
                                    >
                                        <span className="songcount-name">{item.name}</span>
                                        <span className="songcount-bar" aria-hidden="true">
                                            <span style={{ width: `${(item.total / maxSongs) * 100}%` }} />
                                        </span>
                                        <span className="songcount-split">
                                            {item.duets > 0 && <em>{item.duets} duet{item.duets === 1 ? "" : "s"}</em>}
                                            {item.solos > 0 && <em className="solo">{item.solos} solo</em>}
                                        </span>
                                        <b className="songcount-total">{item.total}</b>
                                        <span className={open ? "songcount-caret open" : "songcount-caret"} aria-hidden="true">›</span>
                                    </button>

                                    {open && (
                                        <ol className="songcount-songs">
                                            {item.songs.map((song, index) => (
                                                <li key={`${song.title}-${index}`}>
                                                    <span>{song.title || "(no title)"}</span>
                                                    {song.movie && <small>{song.movie}</small>}
                                                    <i>{song.partner ? `with ${song.partner}` : "solo"}</i>
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        );
    };

    return (
        <div className="songcount">

            <div className="songcount-head">
                <div>
                    <h2>Song Count{data?.event_name ? ` - ${data.event_name}` : ""}</h2>
                    <p className="pairing-section-hint">
                        Songs each singer has on the <b>saved</b> Final List. Click a singer to see their songs.
                        After changing the Final List, click Save there and then Refresh here.
                    </p>
                </div>
                <div className="songcount-actions">
                    <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={refresh} disabled={loading}>
                        {loading ? "Loading…" : "↻ Refresh"}
                    </button>
                    <button
                        type="button"
                        className="admin-btn admin-btn-primary admin-btn-sm"
                        onClick={handleExport}
                        disabled={exporting || everyone.length === 0}
                    >
                        {exporting ? "Preparing…" : "⬇ Download Excel"}
                    </button>
                </div>
            </div>

            {error && <div className="pairing-error">⚠️ {error}</div>}

            <div className="songcount-stats">
                <div><span>Songs</span><strong>{totals.songs}</strong></div>
                <div><span>Duets</span><strong>{totals.duets}</strong></div>
                <div><span>Solos</span><strong>{totals.solos}</strong></div>
                <div><span>Male singers</span><strong>{male.length}</strong></div>
                <div><span>Female singers</span><strong>{female.length}</strong></div>
                <div className={zeroCount ? "warn" : ""}>
                    <span>No songs yet</span><strong>{zeroCount}</strong>
                </div>
            </div>

            <div className="songcount-tools">
                <input
                    type="search"
                    className="songcount-search"
                    placeholder="Search singer…"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    aria-label="Search singer"
                />
                <div className="songcount-sort" role="group" aria-label="Sort">
                    <button type="button" className={sortBy === "count" ? "active" : ""} onClick={() => setSortBy("count")}>Most songs</button>
                    <button type="button" className={sortBy === "name" ? "active" : ""} onClick={() => setSortBy("name")}>A – Z</button>
                </div>
            </div>

            <div className="songcount-columns">
                {renderGroup("Male singers", male, "male")}
                {renderGroup("Female singers", female, "female")}
            </div>

        </div>
    );
}

export default SongCountTab;
