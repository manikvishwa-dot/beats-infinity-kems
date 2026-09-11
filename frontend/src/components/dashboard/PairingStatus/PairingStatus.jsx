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
    }
};

function PairingStatus({ singerId }) {

    const [songs, setSongs] = useState([]);
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

            <div className="pairing-status-list">

                {songs.map(song => {

                    const meta = STATUS_META[song.status] || STATUS_META.Pending;

                    return (

                        <div
                            className={`pairing-status-card ${meta.className}`}
                            key={song.song_id}
                        >

                            <div className="pairing-status-icon">
                                {meta.icon}
                            </div>

                            <div className="pairing-status-body">
                                <h3>{song.song_title}</h3>

                                {song.status === "Pending" && (
                                    <p>Pairing decision pending - check back soon.</p>
                                )}

                                {song.status === "Not Paired" && (
                                    <p>
                                        Don't worry, these songs can be accommodated on
                                        upcoming events if it fits the theme.
                                    </p>
                                )}
                            </div>

                            {song.status === "Paired" && (
                                <div className="pairing-status-partner">
                                    <span className="partner-name">{song.partner_name}</span>
                                    <span className="partner-wish">Wish you a Happy Singing</span>
                                </div>
                            )}

                        </div>

                    );

                })}

            </div>

        </section>

    );

}

export default PairingStatus;
