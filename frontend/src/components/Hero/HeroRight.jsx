import {
    FaCalendarAlt,
    FaMapMarkerAlt,
    FaClock,
    FaCheckCircle
} from "react-icons/fa";

import journey from "../Journey/journeyData";

import "./HeroRight.css";

function HeroRight() {

    // Featured Event (Latest Event)
    const featuredEvent = journey[0];

    const progress = 64;
    const totalSeats = 120;

    return (

        <div className="hero-right">

            <div className="event-card">

                <img
                    src={featuredEvent.image}
                    alt={featuredEvent.title}
                    className="event-poster"
                />

                <div className="event-content">

                    <h3 className="event-title">

                        {featuredEvent.title}

                    </h3>

                    <div className="event-info">

                        <div className="event-row">

                            <FaCalendarAlt />

                            <span>{featuredEvent.date}</span>

                        </div>

                        <div className="event-row">

                            <FaClock />

                            <span>05:00 PM</span>

                        </div>

                        <div className="event-row">

                            <FaMapMarkerAlt />

                            <span>{featuredEvent.venue}</span>

                        </div>

                    </div>

                    <div className="registration-section">

                        <div className="registration-header">

                            <div className="registration-status">

                                <FaCheckCircle />

                                <span>Registration Open</span>

                            </div>

                            <span className="registration-count">

                                {progress} / {totalSeats} Seats Filled

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

                        <button className="register-event-btn">

                            Register for Event

                        </button>

                    </div>

                </div>

            </div>

        </div>

    );

}

export default HeroRight;