import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getFinalPairingList } from "../../services/adminDashboardService";
import { exportToExcel } from "../../utils/excel";

import "./EventSongList.css";

// ==========================================================
// EVENT SONG LIST - every song on the selected event(s)' saved
// Final List: one row per performance with its singers. Changes
// are made on Pairing -> Final List; this is the read view.
// ==========================================================

const EXCEL_COLUMNS = [
    { key: "number", header: "#", width: 6 },
    { key: "song", header: "Song", width: 34 },
    { key: "movie", header: "Movie / Album", width: 28 },
    { key: "singers", header: "Singers", width: 34 },
    { key: "type", header: "Type", width: 12 },
    { key: "event", header: "Event", width: 30 }
];

const normalize = value => String(value || "").trim().toLowerCase();

function EventSongList({ eventIds }) {

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [type, setType] = useState("all");

    const idsKey = eventIds.join(",");

    useEffect(() => {
        let alive = true;
        const ids = idsKey ? idsKey.split(",") : [];

        Promise.resolve()
            .then(() => {
                if (!alive) return null;
                setLoading(true);
                setError("");
                return Promise.all(ids.map(id => getFinalPairingList(id)));
            })
            .then(list => {
                if (alive && list) setResults(list);
            })
            .catch(requestError => {
                if (alive) setError(requestError.message || "Unable to load the event's songs.");
            })
            .finally(() => {
                if (alive) setLoading(false);
            });

        return () => {
            alive = false;
        };
    }, [idsKey]);

    const many = results.length > 1;

    const songs = useMemo(() => results.flatMap(result => {
        const byId = new Map((result.singers || []).map(singer => [singer.id, singer]));

        return (result.rows || []).map(row => {
            const people = [row.male_singer_id, row.female_singer_id].filter(Boolean).map(id => byId.get(id));
            const sameGender = people.length === 2 &&
                normalize(people[0]?.gender) === normalize(people[1]?.gender);

            return {
                key: `${result.event_id}-${row.ref}`,
                song: row.song_title,
                movie: row.movie,
                singers: people.map(person => person?.singer_name || "?").join(" & "),
                type: people.length < 2 ? "Solo" : sameGender ? "Together" : "Duet",
                event: result.event_name
            };
        });
    }), [results]);

    const shown = songs.filter(row => {
        const term = normalize(search);
        const matches = !term || [row.song, row.movie, row.singers].some(value => normalize(value).includes(term));
        return matches && (type === "all" || row.type === type);
    });

    const count = kind => songs.filter(row => row.type === kind).length;

    const download = () => {
        const slug = many ? "events" : (results[0]?.event_name || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        exportToExcel(
            EXCEL_COLUMNS,
            shown.map((row, index) => ({ ...row, number: index + 1 })),
            `event-songs-${slug}`
        ).catch(exportError => setError(exportError.message || "Unable to create the Excel file."));
    };

    if (eventIds.length === 0) return null;

    return (
        <section className="event-songs">

            <header className="event-songs-head">
                <div>
                    <span className="admin-section-label">🎼 EVENT SONG LIST</span>
                    <h2>{many ? "Songs on the selected events" : `Songs at ${results[0]?.event_name || "this event"}`}</h2>
                    <p>From the saved Final List - change songs or singers on <Link to="/admin/pairing">Pairing → Final List</Link>.</p>
                </div>
                <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={download} disabled={shown.length === 0}>
                    ⬇ Download Excel
                </button>
            </header>

            <div className="event-songs-tools">
                <div className="event-songs-filter" role="group" aria-label="Song type">
                    {[
                        ["all", `All ${songs.length}`],
                        ["Duet", `Duets ${count("Duet")}`],
                        ["Solo", `Solos ${count("Solo")}`],
                        ["Together", `Together ${count("Together")}`]
                    ].filter(([value]) => value === "all" || count(value) > 0).map(([value, label]) => (
                        <button
                            type="button"
                            key={value}
                            className={type === value ? "active" : ""}
                            onClick={() => setType(value)}
                            aria-pressed={type === value}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <input
                    type="search"
                    className="event-songs-search"
                    placeholder="Search song, movie or singer…"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    aria-label="Search songs"
                />
            </div>

            {error && <div className="event-songs-error">⚠️ {error}</div>}

            <div className="event-songs-table-wrap">
                <table className="event-songs-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Song</th>
                            <th>Movie / Album</th>
                            <th>Singers</th>
                            <th>Type</th>
                            {many && <th>Event</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={many ? 6 : 5} className="event-songs-empty">Loading songs…</td></tr>
                        ) : shown.length === 0 ? (
                            <tr>
                                <td colSpan={many ? 6 : 5} className="event-songs-empty">
                                    {songs.length === 0
                                        ? "No songs on this event's Final List yet - add or upload them on Pairing → Final List and click Save."
                                        : "No songs match."}
                                </td>
                            </tr>
                        ) : shown.map((row, index) => (
                            <tr key={row.key}>
                                <td className="num">{index + 1}</td>
                                <td className="song">{row.song}</td>
                                <td className="movie">{row.movie || "—"}</td>
                                <td>{row.singers}</td>
                                <td><span className={`event-songs-type ${row.type.toLowerCase()}`}>{row.type}</span></td>
                                {many && <td className="movie">{row.event}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </section>
    );
}

export default EventSongList;
