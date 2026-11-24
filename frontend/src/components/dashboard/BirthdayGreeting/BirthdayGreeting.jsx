import { useEffect, useState } from "react";

import { getBirthdayStatus } from "../../../services/singerService";

import "./BirthdayGreeting.css";

// ==========================================================
// BIRTHDAY GREETING - on the singer's own birthday (India time,
// checked by the server) their dashboard opens with a greeting.
// Closing it hides it for the rest of that day.
// ==========================================================

const CONFETTI_COLOURS = ["#ffd54a", "#39EF79", "#ff6fa8", "#6fb6ff", "#ff9f43", "#b48cff"];

// Fixed pieces (no randomness at render) so it looks the same every time
const PIECES = Array.from({ length: 28 }, (_, index) => ({
    left: (index * 37) % 100,
    delay: (index % 7) * 0.35,
    duration: 3.2 + (index % 5) * 0.45,
    colour: CONFETTI_COLOURS[index % CONFETTI_COLOURS.length],
    round: index % 3 === 0
}));

const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function BirthdayGreeting({ singerId }) {

    const [firstName, setFirstName] = useState(null);

    useEffect(() => {
        if (!singerId) return undefined;

        const dismissKey = `beatsInfinityBirthdaySeen-${singerId}`;
        if (localStorage.getItem(dismissKey) === todayKey()) return undefined;

        let alive = true;

        getBirthdayStatus(singerId)
            .then(result => {
                if (alive && result?.birthday) setFirstName(result.first_name || "Singer");
            })
            .catch(() => {
                // A greeting is a nice extra - never get in the way
            });

        return () => {
            alive = false;
        };
    }, [singerId]);

    if (!firstName) return null;

    const close = () => {
        localStorage.setItem(`beatsInfinityBirthdaySeen-${singerId}`, todayKey());
        setFirstName(null);
    };

    return (
        <section className="birthday-greeting" role="status" aria-live="polite">

            <div className="birthday-confetti" aria-hidden="true">
                {PIECES.map((piece, index) => (
                    <span
                        key={index}
                        className={piece.round ? "round" : ""}
                        style={{
                            left: `${piece.left}%`,
                            background: piece.colour,
                            animationDelay: `${piece.delay}s`,
                            animationDuration: `${piece.duration}s`
                        }}
                    />
                ))}
            </div>

            <button type="button" className="birthday-close" onClick={close} aria-label="Close birthday greeting">
                ×
            </button>

            <div className="birthday-cake" aria-hidden="true">🎂</div>

            <h2>Happy Birthday, {firstName}!</h2>

            <p>
                Wishing you a wonderful year filled with music, joy and many more beautiful songs.
                Thank you for being part of the Beats Infinity family!
            </p>

            <span className="birthday-sign">- With love, Team Beats Infinity 🎶</span>

        </section>
    );
}

export default BirthdayGreeting;
