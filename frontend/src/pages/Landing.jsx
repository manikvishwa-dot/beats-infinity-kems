// ==========================================================
// BEATS INFINITY - HOME / LANDING PAGE
// ==========================================================
//
// Music-festival style home page, shown at "/" to browser
// visitors (the installed app skips it - see AppEntryGate).
//
// Real content:
//   - next show from GET /events/active (countdown, seats)
//   - past shows from Admin -> Journey (GET /journey), with
//     the bundled posters in src/assets/events/* as fallback
//   - crew photos        (src/assets/team/*)
//   - stats / why-join   (existing data files)
// ==========================================================

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getActiveEvent } from "../services/eventService";
import { getJourneyEvents } from "../services/journeyService";
import statistics from "../components/Statistics/statisticsData";
import whyJoin from "../components/WhyJoin/whyJoinData";

import featuredPoster from "../assets/featured/cinematic-monarch.jpg";
import featuredBanner from "../assets/featured/cinematic-monarch-wide.jpg";
import logoMark from "../assets/branding/logo-mark.png";

import "./Landing.css";


// ---------- featured show (hero, top right) ----------
// Used until the show is added in Admin -> Events - once an
// upcoming event exists there, its name/date/venue/seats and
// banner take over automatically.

const FEATURED_SHOW = {
    name: "Cinematic Monarch",
    tagline: "Four Legends... One Stage!",
    event_date: "2026-12-06",
    event_time: "09:30",
    venue: "Art Stash Rehearsal Studio",
    poster: featuredPoster,
    // wide version, shown inside the "Block Your Slot" ticket
    banner: featuredBanner
};

const showTime = (show) => {
    if (!show?.event_date) return null;
    const time = show.event_time ? String(show.event_time).slice(0, 5) : "18:00";
    return new Date(`${show.event_date}T${time}:00`).getTime();
};


// ---------- posters: "Beats Kondattam - September.png" ----------

const posterFiles = import.meta.glob(
    "../assets/events/*.{png,jpg,jpeg}",
    { eager: true, import: "default" }
);

const MONTH_ORDER = [
    "january", "february", "march", "april", "may", "june", "july",
    "august", "september", "october", "november", "december"
];

const fallbackPosters = Object.entries(posterFiles)
    .map(([path, src]) => {
        const base = decodeURIComponent(path.split("/").pop()).replace(/\.[^.]+$/, "");
        const [title, month = ""] = base.split(" - ");
        return { src, title: title.trim(), month: month.trim() };
    })
    .sort((a, b) =>
        MONTH_ORDER.indexOf(b.month.toLowerCase()) -
        MONTH_ORDER.indexOf(a.month.toLowerCase())
    );


// ---------- crew: "advaith.jpeg" ----------

const crewFiles = import.meta.glob(
    "../assets/team/*.{png,jpg,jpeg}",
    { eager: true, import: "default" }
);

const crew = Object.entries(crewFiles).map(([path, src]) => {
    const name = path.split("/").pop().replace(/\.[^.]+$/, "");
    return { src, name: name.charAt(0).toUpperCase() + name.slice(1) };
});


const STEPS = [
    { no: "01", title: "Join in a minute", text: "Mobile number, one-time OTP, a 4-digit PIN. Quick Login with your fingerprint or face after that." },
    { no: "02", title: "Pick your songs", text: "Type a few letters - we suggest the song and its movie. Choose 6 duets (men can add a solo)." },
    { no: "03", title: "Book your spot", text: "One flat entry of ₹700. No extra songs, no extra fees." },
    { no: "04", title: "Get paired & perform", text: "We pair duet partners from everyone's picks. You sing 3 duets - and a solo if time permits." }
];

// Even count, so the outline / gradient alternation lines up
// when the strip loops.
const MARQUEE = ["SING", "DUET", "PERFORM", "CHENNAI", "LIVE KARAOKE", "EVERY MONTH", "NO JUDGEMENT", "MAKE FRIENDS"];


// ---------- countdown ----------

const useCountdown = (target) => {

    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!target) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [target]);

    if (!target) return null;

    const diff = target - now;
    if (diff <= 0) return null;

    return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor(diff / 3600000) % 24,
        minutes: Math.floor(diff / 60000) % 60,
        seconds: Math.floor(diff / 1000) % 60
    };

};

const pad = (n) => String(n).padStart(2, "0");

// "09:30" / "09:30:00" -> "9:30 AM"
const formatTime = (time) => {
    const [h, m] = String(time).split(":").map(Number);
    return `${h % 12 || 12}:${pad(m || 0)} ${h < 12 ? "AM" : "PM"}`;
};

const formatDate = (iso) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
        weekday: "short", day: "numeric", month: "long", year: "numeric"
    });


function Landing() {

    const [activeEvent, setActiveEvent] = useState(null);
    const [loadedAt] = useState(() => Date.now());
    const [posters, setPosters] = useState(fallbackPosters);
    const [menuOpen, setMenuOpen] = useState(false);

    // The site-wide #root style is a fixed 1126px centred column -
    // this full-bleed page opts out while it's on screen.
    useEffect(() => {
        const root = document.getElementById("root");
        root?.classList.add("bil-root");
        return () => root?.classList.remove("bil-root");
    }, []);

    // Past shows: managed in Admin -> Journey
    useEffect(() => {
        getJourneyEvents()
            .then((result) => {
                const shows = (result?.events || [])
                    .filter((show) => show.image_url)
                    .map((show) => ({
                        src: show.image_url,
                        title: show.title,
                        month: show.month_label || show.date_label || ""
                    }));
                if (shows.length > 0) setPosters(shows);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        getActiveEvent()
            .then((result) => setActiveEvent(result?.event || null))
            .catch(() => setActiveEvent(null));
    }, []);

    // Upcoming event from Admin -> Events wins; otherwise the
    // featured show above (while its date is still ahead).
    const event = useMemo(() => {
        const now = loadedAt;
        if (activeEvent && showTime(activeEvent) > now) {
            return {
                ...activeEvent,
                poster: activeEvent.banner_image_url ||
                    (activeEvent.event_date === FEATURED_SHOW.event_date ? FEATURED_SHOW.poster : null),
                banner: activeEvent.event_date === FEATURED_SHOW.event_date
                    ? FEATURED_SHOW.banner
                    : activeEvent.banner_image_url || null
            };
        }
        if (showTime(FEATURED_SHOW) > now) {
            return FEATURED_SHOW;
        }
        return null;
    }, [activeEvent, loadedAt]);

    const target = useMemo(() => showTime(event), [event]);

    const countdown = useCountdown(target);
    const upcoming = Boolean(countdown);

    const seatsLeft =
        event?.max_seats ? Math.max(0, event.max_seats - (event.filled_seats || 0)) : null;

    const closeMenu = () => setMenuOpen(false);

    return (

        <div className="bi-landing">

            {/* ================= NAV ================= */}

            <header className="bil-nav">
                <a href="#top" className="bil-brand" onClick={closeMenu}>
                    <img src={logoMark} alt="" />
                    <span>BEATS <em>∞</em> INFINITY</span>
                </a>

                <nav className={menuOpen ? "bil-links open" : "bil-links"}>
                    <a href="#show" onClick={closeMenu}>Next Show</a>
                    <a href="#lineup" onClick={closeMenu}>Past Shows</a>
                    <a href="#how" onClick={closeMenu}>How It Works</a>
                    <a href="#crew" onClick={closeMenu}>Crew</a>
                    <Link to="/login" className="bil-link-login">Singer Login</Link>
                    <Link to="/singer-registration" className="bil-link-join">Join Now</Link>
                </nav>

                <div className="bil-nav-actions">
                    <Link to="/singer-registration" className="bil-btn bil-btn-solid bil-btn-sm bil-nav-join">Join Now</Link>
                    <button
                        type="button"
                        className="bil-burger"
                        aria-label="Menu"
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        <span /><span /><span />
                    </button>
                </div>
            </header>


            {/* ================= HERO ================= */}

            <section id="top" className="bil-hero">

                <div className="bil-glow bil-glow-1" />
                <div className="bil-glow bil-glow-2" />
                <div className="bil-glow bil-glow-3" />

                <div className="bil-hero-inner">

                    <p className="bil-kicker">Chennai's live karaoke community · since 2023</p>

                    <h1 className="bil-title">
                        <span className="bil-title-line">SING IT</span>
                        <span className="bil-title-line bil-outline">LIVE.</span>
                        <span className="bil-title-line bil-gradient-text">LOUD.</span>
                    </h1>

                    <p className="bil-lead">
                        Monthly live shows where every voice gets a stage. Pick your
                        songs, get paired with a duet partner, and perform to a crowd
                        that cheers for you.
                    </p>

                    <div className="bil-hero-ctas">
                        <Link to="/singer-registration" className="bil-btn bil-btn-solid">Join Beats Infinity</Link>
                        <a href="#show" className="bil-btn bil-btn-ghost">See the next show →</a>
                    </div>

                </div>

                <div className={event?.poster ? "bil-feature has-poster" : "bil-feature"}>

                {event?.poster && (
                    <a href="#show" className="bil-feature-poster" aria-label={`${event.name} poster`}>
                        <img src={event.poster} alt={`${event.name} poster`} />
                    </a>
                )}

                <aside className="bil-ticket">
                    <div className="bil-ticket-top">
                        <span className="bil-chip">{upcoming ? "NEXT SHOW" : "COMING SOON"}</span>
                        <span className="bil-ticket-price">₹700</span>
                    </div>

                    <h3>{upcoming ? event.name : "Next show announcing soon"}</h3>

                    {upcoming && event?.event_date && (
                        <p className="bil-ticket-meta">
                            📅 {formatDate(event.event_date)}
                            {event.event_time && <> · {formatTime(event.event_time)}</>}
                            {event.venue && <><br />📍 {event.venue}</>}
                        </p>
                    )}

                    {upcoming ? (
                        <div className="bil-countdown">
                            {[
                                ["Days", countdown.days],
                                ["Hrs", countdown.hours],
                                ["Min", countdown.minutes],
                                ["Sec", countdown.seconds]
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <strong>{pad(value)}</strong>
                                    <span>{label}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="bil-ticket-soon">
                            The next date drops soon - join now and be first in line.
                        </p>
                    )}

                    {upcoming && seatsLeft !== null && (
                        <p className="bil-seats">
                            <span style={{ width: `${Math.min(100, ((event.filled_seats || 0) / event.max_seats) * 100)}%` }} />
                            {seatsLeft} of {event.max_seats} spots left
                        </p>
                    )}

                    <Link to="/singer-registration" className="bil-btn bil-btn-solid bil-btn-block">
                        {upcoming ? "Book my slot" : "Join the community"}
                    </Link>
                </aside>

                </div>

            </section>


            {/* ================= MARQUEE ================= */}

            <div className="bil-marquee" aria-hidden="true">
                <div className="bil-marquee-track">
                    {[...MARQUEE, ...MARQUEE, ...MARQUEE].map((word, i) => (
                        <span key={i}>
                            <b className={i % 2 === 0 ? "bil-outline" : "bil-gradient-text"}>{word}</b>
                            <i>♪</i>
                        </span>
                    ))}
                </div>
            </div>


            {/* ================= STATS ================= */}

            <section className="bil-stats">
                {statistics.map((item) => (
                    <div key={item.id ?? item.title} className="bil-stat">
                        <strong className="bil-gradient-text">{item.number}</strong>
                        <span>{item.title}</span>
                    </div>
                ))}
            </section>


            {/* ================= NEXT SHOW / TICKET ================= */}

            <section id="show" className="bil-section">
                <div className="bil-section-head">
                    <span className="bil-tag">The Show</span>
                    <h2>One ticket. <span className="bil-outline">Your stage.</span></h2>
                </div>

                <div className={upcoming && event?.banner ? "bil-pass has-banner" : "bil-pass"}>

                    {upcoming && event?.banner && (
                        <div className="bil-pass-banner">
                            <img src={event.banner} alt={`${event.name} - show banner`} loading="lazy" />
                        </div>
                    )}

                    <div className="bil-pass-main">
                        <h3>Block Your Slot</h3>
                        {upcoming && (
                            <p className="bil-pass-show">
                                {event.name} · {formatDate(event.event_date)}
                                {event.event_time && <> · {formatTime(event.event_time)}</>}
                            </p>
                        )}
                        <p className="bil-pass-price"><strong>₹700</strong> per show</p>
                        <ul>
                            <li>3 duets on stage, paired with a partner who picked the same songs</li>
                            <li>+1 solo if time permits (male singers)</li>
                            <li>Choose 6 duets so we can find you the best partners</li>
                            <li>Live crowd, real mic, friendly community</li>
                        </ul>
                        <Link to="/singer-registration" className="bil-btn bil-btn-solid">Block my slot</Link>
                    </div>
                    <div className="bil-pass-stub">
                        <span>ADMIT ONE</span>
                        <strong>BEATS ∞ INFINITY</strong>
                        <span>LIVE KARAOKE</span>
                    </div>
                </div>
            </section>


            {/* ================= PAST SHOWS (LINEUP) ================= */}

            <section id="lineup" className="bil-section">
                <div className="bil-section-head">
                    <span className="bil-tag">Past Shows</span>
                    <h2>A new theme <span className="bil-gradient-text">every month</span></h2>
                </div>

                <div className="bil-lineup">
                    {posters.map((poster, index) => (
                        <figure key={`${poster.title}-${index}`} className={index === 0 ? "bil-poster bil-poster-wide" : "bil-poster"}>
                            <img src={poster.src} alt={poster.title} loading="lazy" />
                            <figcaption>
                                <span>{poster.month}</span>
                                <strong>{poster.title}</strong>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </section>


            {/* ================= HOW IT WORKS ================= */}

            <section id="how" className="bil-section">
                <div className="bil-section-head">
                    <span className="bil-tag">How It Works</span>
                    <h2>From sofa to <span className="bil-outline">spotlight</span></h2>
                </div>

                <div className="bil-steps">
                    {STEPS.map((step) => (
                        <div key={step.no} className="bil-step">
                            <span className="bil-step-no">{step.no}</span>
                            <h3>{step.title}</h3>
                            <p>{step.text}</p>
                        </div>
                    ))}
                </div>
            </section>


            {/* ================= WHY JOIN ================= */}

            <section className="bil-section">
                <div className="bil-section-head">
                    <span className="bil-tag">Why Join</span>
                    <h2>More than a <span className="bil-gradient-text">karaoke night</span></h2>
                </div>

                <div className="bil-why">
                    {whyJoin.map(({ id, icon: Icon, title, description }) => (
                        <div key={id} className="bil-why-card">
                            <Icon className="bil-why-icon" />
                            <h3>{title}</h3>
                            <p>{description}</p>
                        </div>
                    ))}
                </div>
            </section>


            {/* ================= CREW ================= */}

            <section id="crew" className="bil-section">
                <div className="bil-section-head">
                    <span className="bil-tag">The Crew</span>
                    <h2>The people <span className="bil-outline">behind the mic</span></h2>
                </div>

                <div className="bil-crew">
                    {crew.map((person) => (
                        <figure key={person.name} className="bil-crew-card">
                            <img src={person.src} alt={person.name} loading="lazy" />
                            <figcaption>{person.name}</figcaption>
                        </figure>
                    ))}
                </div>
            </section>


            {/* ================= FINAL CTA ================= */}

            <section className="bil-final">
                <div className="bil-glow bil-glow-2" />
                <h2>
                    YOUR VOICE.<br />
                    <span className="bil-gradient-text">OUR STAGE.</span>
                </h2>
                <p>Join 117+ singers who perform live every month.</p>
                <div className="bil-hero-ctas">
                    <Link to="/singer-registration" className="bil-btn bil-btn-solid">Join Beats Infinity</Link>
                    <Link to="/login" className="bil-btn bil-btn-ghost">Singer Login</Link>
                </div>
            </section>


            {/* ================= FOOTER ================= */}

            <footer className="bil-footer">
                <span>© {new Date().getFullYear()} Beats ∞ Infinity · Chennai</span>
                <nav>
                    <Link to="/events">Events</Link>
                    <Link to="/gallery">Gallery</Link>
                    <Link to="/about">About</Link>
                    <Link to="/contact">Contact</Link>
                    <Link to="/admin/login">Admin</Link>
                    <Link to="/superadmin/login">Super Admin</Link>
                </nav>
            </footer>

        </div>

    );

}

export default Landing;
