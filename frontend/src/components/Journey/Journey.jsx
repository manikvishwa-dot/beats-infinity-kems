import { useRef } from "react";

import "./Journey.css";

import journey from "./journeyData";

import JourneyCard from "./JourneyCard";

function Journey() {

    const sliderRef = useRef(null);

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

                            journey.map((event) => (

                                <JourneyCard
                                    key={event.id}
                                    event={event}
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