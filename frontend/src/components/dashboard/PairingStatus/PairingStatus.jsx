import { useEffect, useState } from "react";

import { getMyPairing } from "../../../services/pairingService";

import "./PairingStatus.css";

// ==========================================================
// BEATS INFINITY - MY PAIRING STATUS (singer dashboard)
// ==========================================================
//
// "Song List" card: every pairing the singer is in for the
// active event - # | Male Singer | Female Singer | Song | Movie,
// with a play button that opens a YouTube search for practice.
// Songs not paired yet are listed underneath with their status.
// ==========================================================

const STATUS_META = {
    Pending: {
        icon: "⏳",
        className: "pending",
        note: "Pairing decision pending - check back soon."
    },
    "Not Paired": {
        icon: "💬",
        className: "not-paired",
        note: "Don't worry, this song can be accommodated in an upcoming event if it fits the theme."
    },
    "Awaiting Payment": {
        icon: "💳",
        className: "pending",
        note: "Pairing starts once the admin confirms your payment."
    },
    "Payment Rejected": {
        icon: "⚠️",
        className: "rejected",
        note: "Your payment couldn't be verified - please contact the Beats Infinity team."
    }
};

// Payment badge in the card header
const PAYMENT_META = {
    Paid: {
        icon: "✅",
        label: "Payment confirmed",
        className: "paid"
    },
    Pending: {
        icon: "⏳",
        label: "Payment awaiting admin confirmation",
        className: "pending"
    },
    Rejected: {
        icon: "⚠️",
        label: "Payment rejected - please contact us",
        className: "rejected"
    }
};

// ----------------------------------------------------------
// ICONS (inline SVG - inherit currentColor)
// ----------------------------------------------------------

const MaleIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10" cy="14" r="6" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <path d="M14.5 9.5 20 4M14.5 4H20v5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const FemaleIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <path d="M12 15v7M8.5 19h7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
);

const NoteIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="6.5" cy="18" r="2.8" fill="currentColor" />
        <circle cx="17.5" cy="16" r="2.8" fill="currentColor" />
    </svg>
);

const ClapperIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="9" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M3 9 4.5 4l16 0L21 9M8.5 4 7 9M13.5 4 12 9M18.5 4 17 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M3 13h18" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
);

const MicIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const PlayIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 8.2v7.6L16 12z" fill="currentColor" />
    </svg>
);

const youtubeSearchUrl = song =>
    `https://www.youtube.com/results?search_query=${encodeURIComponent(
        [song.song_title, song.movie].filter(Boolean).join(" ")
    )}`;


function PairingStatus({ singerId }) {

    const [songs, setSongs] = useState([]);
    const [eventName, setEventName] = useState("");
    const [paymentStatus, setPaymentStatus] = useState(null);
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
                    setPaymentStatus(result.payment_status || null);

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

    const paired = songs.filter(song => song.status === "Paired");
    const notPaired = songs.filter(song => song.status !== "Paired");

    return (

        <section className="pairing-status-section" aria-labelledby="pairing-status-title">

            <header className="song-list-header">

                <span className="song-list-wave" aria-hidden="true" />

                <span className="song-list-badge" aria-hidden="true">
                    <MicIcon />
                </span>

                <div className="song-list-titles">
                    <h2 id="pairing-status-title" className="song-list-title">
                        Song List
                    </h2>

                    {eventName && (
                        <p className="song-list-subtitle">{eventName}</p>
                    )}
                </div>

            </header>

            {PAYMENT_META[paymentStatus] && (
                <p className="song-list-payment">
                    <span className={`payment-pill ${PAYMENT_META[paymentStatus].className}`}>
                        {PAYMENT_META[paymentStatus].icon} {PAYMENT_META[paymentStatus].label}
                    </span>
                </p>
            )}

            {paired.length > 0 ? (

                <div className="song-list-card">

                    <table className="song-list-table">

                        <thead>
                            <tr>
                                <th className="col-num">#</th>
                                <th className="col-male">
                                    <span className="th-inner"><MaleIcon /> Male Singer</span>
                                </th>
                                <th className="col-female">
                                    <span className="th-inner"><FemaleIcon /> Female Singer</span>
                                </th>
                                <th className="col-song">
                                    <span className="th-inner"><NoteIcon /> Song</span>
                                </th>
                                <th className="col-movie">
                                    <span className="th-inner"><ClapperIcon /> Movie</span>
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {paired.map((song, index) => (
                                <tr key={`${song.song_id}-${song.male_singer_name}-${song.female_singer_name}`}>

                                    <td className="col-num" data-label="#">
                                        {index + 1}
                                    </td>

                                    <td className="col-male" data-label="Male Singer">
                                        <span className="cell-inner">
                                            <span className="mic male"><MicIcon /></span>
                                            {song.male_singer_name || "—"}
                                        </span>
                                    </td>

                                    <td className="col-female" data-label="Female Singer">
                                        <span className="cell-inner">
                                            <span className="mic female"><MicIcon /></span>
                                            {song.female_singer_name || "—"}
                                        </span>
                                    </td>

                                    <td className="col-song" data-label="Song">
                                        {song.song_title}
                                    </td>

                                    <td className="col-movie" data-label="Movie">
                                        <span className="cell-inner movie-cell">
                                            <span className="clapper"><ClapperIcon /></span>
                                            <span className="movie-name">{song.movie || "—"}</span>
                                            <a
                                                className="play-link"
                                                href={youtubeSearchUrl(song)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={`Listen to ${song.song_title} on YouTube`}
                                                title="Listen on YouTube"
                                            >
                                                <PlayIcon />
                                            </a>
                                        </span>
                                    </td>

                                </tr>
                            ))}
                        </tbody>

                    </table>

                </div>

            ) : (

                <p className="song-list-empty">
                    No songs paired yet - your pairings will appear here.
                </p>

            )}

            {notPaired.length > 0 && (

                <div className="song-list-waiting">

                    <h3>Not paired yet</h3>

                    <ul>
                        {notPaired.map(song => {

                            const meta = STATUS_META[song.status] || STATUS_META.Pending;

                            return (
                                <li key={`${song.song_id}-${song.status}`}>
                                    <span className="waiting-song">
                                        {song.song_title}
                                        {song.movie && (
                                            <span className="waiting-movie"> · {song.movie}</span>
                                        )}
                                    </span>

                                    <span className={`pairing-status-badge ${meta.className}`} title={meta.note}>
                                        {meta.icon} {song.status}
                                    </span>
                                </li>
                            );

                        })}
                    </ul>

                    <ul className="pairing-status-legend">
                        {[...new Set(notPaired.map(song => song.status))].map(status => {
                            const meta = STATUS_META[status] || STATUS_META.Pending;
                            return (
                                <li key={status}>
                                    {meta.icon} <b>{status}</b> - {meta.note}
                                </li>
                            );
                        })}
                    </ul>

                </div>

            )}

        </section>

    );

}

export default PairingStatus;
