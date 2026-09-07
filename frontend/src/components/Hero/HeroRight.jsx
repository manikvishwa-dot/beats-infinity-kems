import {
    FaCalendarAlt,
    FaMapMarkerAlt,
    FaClock,
    FaCheckCircle
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";

import journey from "../Journey/journeyData";

import "./HeroRight.css";

function HeroRight() {

    const navigate = useNavigate();

    // Featured Event (Latest Event)
    const featuredEvent = journey[0];

    const progress = 50;
    const totalSeats = 55;

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

                            <span>09:00 AM</span>

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