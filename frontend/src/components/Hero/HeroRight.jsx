import { useEffect, useState } from "react";
import {
    FaCalendarAlt,
    FaMapMarkerAlt,
    FaClock,
    FaCheckCircle
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";

import journey from "../Journey/journeyData";
import { getActiveEvent } from "../../services/eventService";

import "./HeroRight.css";

const FALLBACK_EVENT = journey[0];

const formatDate = value => {

    if (!value) {

        return FALLBACK_EVENT.date;

    }

    try {

        return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });

    }
    catch {

        return value;

    }

};

const formatTime = value => {

    if (!value) {

        return "09:00 AM";

    }

    const [hourStr, minuteStr] = value.split(":");
    const hour = parseInt(hourStr, 10);

    if (Number.isNaN(hour)) {

        return value;

    }

    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;

    return `${displayHour}:${minuteStr} ${period}`;

};

function HeroRight() {

    const navigate = useNavigate();

    // Falls back to the static "featured" journey entry until an
    // admin creates/activates a real event on the /events page.
    const [event, setEvent] = useState({
        title: FALLBACK_EVENT.title,
        image: FALLBACK_EVENT.image,
        date: FALLBACK_EVENT.date,
        time: "09:00 AM",
        venue: FALLBACK_EVENT.venue,
        filledSeats: 50,
        maxSeats: 55
    });

    useEffect(() => {

        let cancelled = false;

        getActiveEvent()
            .then(result => {

                if (cancelled || !result.event) {

                    return;

                }

                const activeEvent = result.event;

                setEvent({
                    title: activeEvent.name,
                    image: activeEvent.banner_image_url || FALLBACK_EVENT.image,
                    date: formatDate(activeEvent.event_date),
                    time: formatTime(activeEvent.event_time),
                    venue: activeEvent.venue || FALLBACK_EVENT.venue,
                    filledSeats: activeEvent.filled_seats || 0,
                    maxSeats: activeEvent.max_seats || 0
                });

            })
            .catch(() => {

                // Keep the static fallback - the hero should never
                // break just because the events table/API isn't
                // ready yet.

            });

        return () => {

            cancelled = true;

        };

    }, []);

    const progress = event.filledSeats;
    const totalSeats = event.maxSeats || 1;

    return (

        <div className="hero-right">

            <div className="event-card">

                <img
                    src={event.image}
                    alt={event.title}
                    className="event-poster"
                />

                <div className="event-content">

                    <h3 className="event-title">

                        {event.title}

                    </h3>

                    <div className="event-info">

                        <div className="event-row">

                            <FaCalendarAlt />

                            <span>{event.date}</span>

                        </div>

                        <div className="event-row">

                            <FaClock />

                            <span>{event.time}</span>

                        </div>

                        <div className="event-row">

                            <FaMapMarkerAlt />

                            <span>{event.venue}</span>

                        </div>

                    </div>

                    <div className="registration-section">

                        <div className="registration-header">

                            <div className="registration-status">

                                <FaCheckCircle />

                                <span>Registration Open</span>

                            </div>

                            <span className="registration-count">

                                {event.filledSeats} / {event.maxSeats} Seats Filled

                            </span>

                        </div>

                        <div className="progress-bar">

                            <div
                                className="progress-fill"
                                style={{
                                    width: `${(progress / totalSeats) * 100}%`
                                }}
                            />

                        </div>

                        <button
                            type="button"
                            className="register-event-btn"
                            onClick={() => navigate("/login")}
                        >

                            Register for Event

                        </button>

                    </div>

                </div>

            </div>

        </div>

    );

}

export default HeroRight;
