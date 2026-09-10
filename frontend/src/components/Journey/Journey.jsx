import { useEffect, useRef, useState } from "react";

import "./Journey.css";

import { getJourneyEvents } from "../../services/journeyService";

import JourneyCard from "./JourneyCard";

function Journey() {

    const sliderRef = useRef(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {

        let cancelled = false;

        getJourneyEvents()
            .then(data => {
                if (!cancelled) {
                    setEvents(data.events || []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setEvents([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };

    }, []);

    const scrollLeft = () => {

        sliderRef.current.scrollBy({

            left: -260,

            behavior: "smooth"

        });

    };

    const scrollRight = () => {

        sliderRef.current.scrollBy({

            left: 260,

            behavior: "smooth"

        });

    };

    if (!loading && events.length === 0) {
        return null;
    }

    return (

        <section className="journey-section">

            <div className="journey-container">

                <div className="journey-header">

                    <div>

                        <h2>

                            Our Musical Journey

                        </h2>

                        <p>

                            Celebrating unforgettable musical moments, one event at a time.

                        </p>

                    </div>

                    <button className="view-all-btn">

                        View All

                    </button>

                </div>

                <div className="journey-carousel-wrapper">

                    <button
                        className="carousel-btn left"
                        onClick={scrollLeft}
                    >
                        &#10094;
                    </button>

                    <div
                        className="journey-carousel"
                        ref={sliderRef}
                    >

                        {

                            events.map((event) => (

                                <JourneyCard
                                    key={event.id}
                                    event={{
                                        id: event.id,
                                        title: event.title,
                                        month: event.month_label,
                                        date: event.date_label,
                                        venue: event.venue,
                                        image: event.image_url
                                    }}
                                />

                            ))

                        }

                    </div>

                    <button
                        className="carousel-btn right"
                        onClick={scrollRight}
                    >
                        &#10095;
                    </button>

                </div>

            </div>

        </section>

    );

}

export default Journey;
