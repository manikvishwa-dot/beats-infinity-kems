import { useEffect, useState } from "react";

import { getMyPairing } from "../../../services/pairingService";

import "./PairingStatus.css";

const STATUS_META = {
    Paired: {
        icon: "🎉",
        className: "paired"
    },
    Pending: {
        icon: "⏳",
        className: "pending"
    },
    "Not Paired": {
        icon: "💬",
        className: "not-paired"
    },
    "Awaiting Payment": {
        icon: "💳",
        className: "pending"
    }
};

function PairingStatus({ singerId }) {

    const [songs, setSongs] = useState([]);
    const [eventName, setEventName] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {

        let cancelled = false;

        const load = async () => {

            if (!singerId) {

                setLoading(false);
                return;

            }

            try {

                const result = await getMyPairing(singerId);

                if (!cancelled) {

                    setSongs(Array.isArray(result.songs) ? result.songs : []);
                    setEventName(result.event_name || "");

                }

            }
            catch (error) {

                console.error(
                    "Unable to load pairing status:",
                    error
                );

            }
            finally {

                if (!cancelled) {

                    setLoading(false);

                }

            }

        };

        load();

        return () => {

            cancelled = true;

        };

    }, [singerId]);

    if (loading || songs.length === 0) {

        return null;

    }

    return (

        <section className="pairing-status-section">

            <h2 className="pairing-status-heading">My Pairing Status</h2>

            {eventName && (
                <p className="pairing-status-event">{eventName}</p>
            )}

            <div className="pairing-status-table-wrap">

                <table className="pairing-status-table">

                    <thead>
                        <tr>
                            <th>Male Singer</th>
                            <th>Female Singer</th>
                            <th>Song</th>
                            <th>Movie</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>
                        {songs.map(song => {

                            const meta = STATUS_META[song.status] || STATUS_META.Pending;

                            return (
                                <tr
                                    className={meta.className}
                                    key={`${song.song_id}-${song.male_singer_name}-${song.female_singer_name}`}
                                >
                                    <td data-label="Male Singer">{song.male_singer_name || "—"}</td>
                                    <td data-label="Female Singer">{song.female_singer_name || "—"}</td>
                                    <td data-label="Song" className="pairing-status-song">{song.song_title}</td>
                                    <td data-label="Movie">{song.movie || "—"}</td>
                                    <td data-label="Status">
                                        <span className={`pairing-status-badge ${meta.className}`}>
                                            {meta.icon} {song.status}
                                        </span>
                                    </td>
                                </tr>
                            );

                        })}
                    </tbody>

                </table>

            </div>

            <ul className="pairing-status-legend">
                {songs.some(song => song.status === "Paired") && (
                    <li>🎉 <b>Paired</b> - wish you a happy singing!</li>
                )}
                {songs.some(song => song.status === "Awaiting Payment") && (
                    <li>💳 <b>Awaiting Payment</b> - pairing starts once the admin confirms your payment.</li>
                )}
                {songs.some(song => song.status === "Pending") && (
                    <li>⏳ <b>Pending</b> - pairing decision pending, check back soon.</li>
                )}
                {songs.some(song => song.status === "Not Paired") && (
                    <li>💬 <b>Not Paired</b> - don't worry, these songs can be accommodated in upcoming events if they fit the theme.</li>
                )}
            </ul>

        </section>

    );

}

export default PairingStatus;
