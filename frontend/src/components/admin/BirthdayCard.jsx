import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getAllSingers } from "../../services/adminDashboardService";

import "./BirthdayCard.css";

// ==========================================================
// BIRTHDAYS (Admin Dashboard) - today's birthdays and the next
// 7 days, with a one-tap WhatsApp wish from the admin's phone.
// Singers still on the placeholder date (2000-01-01) are counted
// separately - their real birthday isn't known yet.
// ==========================================================

const PLACEHOLDER_DOB = "2000-01-01";
const DAYS_AHEAD = 7;
const DAY_MS = 86400000;

const isLeapYear = year => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

// Today in India, as a UTC-midnight timestamp (so day maths is exact)
const todayInIndia = () => {
    const [year, month, day] = new Date()
        .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
        .split("-")
        .map(Number);
    return Date.UTC(year, month - 1, day);
};

// Days until the next birthday (0 = today), or null if unknown
const daysUntilBirthday = (dateOfBirth, today) => {
    const dob = String(dateOfBirth || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob === PLACEHOLDER_DOB) return null;

    const month = Number(dob.slice(5, 7));
    const day = Number(dob.slice(8, 10));
    const thisYear = new Date(today).getUTCFullYear();

    const onYear = year => {
        // 29 Feb -> 28 Feb in non-leap years
        const realDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
        return Date.UTC(year, month - 1, realDay);
    };

    let next = onYear(thisYear);
    if (next < today) next = onYear(thisYear + 1);

    return Math.round((next - today) / DAY_MS);
};

const ageOn = (dateOfBirth, today, inDays) => {
    const birthYear = Number(String(dateOfBirth).slice(0, 4));
    return new Date(today + inDays * DAY_MS).getUTCFullYear() - birthYear;
};

const isRealMobile = mobile => /^\d{10}$/.test(String(mobile || "")) && !String(mobile).startsWith("00000");

const whatsappLink = singer => {
    const firstName = String(singer.singer_name || "").trim().split(/\s+/)[0];
    const text =
        `Happy Birthday, ${firstName}! 🎂🎶\n\n` +
        "Wishing you a wonderful year filled with music, joy and many more beautiful songs. " +
        "Thank you for being part of the Beats Infinity family!\n\n" +
        "- Team Beats Infinity";
    return `https://wa.me/91${singer.mobile_number}?text=${encodeURIComponent(text)}`;
};

const whenLabel = days =>
    days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;

function BirthdayCard() {

    const [singers, setSingers] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let alive = true;

        getAllSingers()
            .then(result => {
                if (alive) setSingers(Array.isArray(result?.singers) ? result.singers : []);
            })
            .catch(requestError => {
                if (alive) setError(requestError.message || "Unable to load birthdays.");
            });

        return () => {
            alive = false;
        };
    }, []);

    const { upcoming, unknownCount } = useMemo(() => {
        const today = todayInIndia();
        const list = [];
        let unknown = 0;

        (singers || []).forEach(singer => {
            const days = daysUntilBirthday(singer.date_of_birth, today);
            if (days === null) {
                unknown += 1;
                return;
            }
            if (days <= DAYS_AHEAD) {
                list.push({ ...singer, days, age: ageOn(singer.date_of_birth, today, days) });
            }
        });

        list.sort((a, b) => a.days - b.days || a.singer_name.localeCompare(b.singer_name));

        return { upcoming: list, unknownCount: unknown };
    }, [singers]);

    const todayCount = upcoming.filter(singer => singer.days === 0).length;

    return (
        <section className="dash-card birthday-card">

            <div className="dash-card-head">
                <div>
                    <h3>🎂 Birthdays</h3>
                    <p>
                        {todayCount > 0
                            ? `${todayCount} singer${todayCount === 1 ? " has a" : "s have their"} birthday today - their page shows a greeting automatically`
                            : `Today and the next ${DAYS_AHEAD} days`}
                    </p>
                </div>
            </div>

            {error && <div className="birthday-card-empty">⚠️ {error}</div>}

            {!error && singers === null && <div className="birthday-card-empty">Loading…</div>}

            {!error && singers !== null && upcoming.length === 0 && (
                <div className="birthday-card-empty">No birthdays in the next {DAYS_AHEAD} days.</div>
            )}

            {upcoming.length > 0 && (
                <ul className="birthday-list">
                    {upcoming.map(singer => (
                        <li key={singer.id} className={singer.days === 0 ? "is-today" : ""}>
                            <span className="birthday-when">{whenLabel(singer.days)}</span>
                            <span className="birthday-name">
                                {singer.singer_name}
                                <small>turns {singer.age}</small>
                            </span>
                            {isRealMobile(singer.mobile_number) ? (
                                <a
                                    className="birthday-wa"
                                    href={whatsappLink(singer)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`Send a birthday wish to ${singer.singer_name} on WhatsApp`}
                                >
                                    Wish on WhatsApp
                                </a>
                            ) : (
                                <Link className="birthday-nophone" to="/admin/singers" title="Add their real mobile number on the Singers page">
                                    No mobile yet
                                </Link>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {unknownCount > 0 && (
                <p className="birthday-card-note">
                    {unknownCount} singer{unknownCount === 1 ? "" : "s"} still {unknownCount === 1 ? "has" : "have"} the
                    placeholder date of birth (1 Jan 2000) - add the real date on
                    the <Link to="/admin/singers">Singers page</Link> so they get a greeting.
                </p>
            )}

        </section>
    );
}

export default BirthdayCard;
