import "./JourneyCard.css";

function JourneyCard({ event }) {

    return (

        <div className="journey-card">

            <div className="journey-image">

                <div className="month-badge">

                    {event.month}

                </div>

                <img
                    src={event.image}
                    alt={event.title}
                />

                <div className="poster-overlay">

                    <button className="overlay-btn">

                        View Memories →

                    </button>

                </div>

            </div>

            <div className="journey-content">

                <h3>

                    {event.title}

                </h3>

                <p className="journey-date">

                    {event.date}

                </p>

            </div>

        </div>

    );

}

export default JourneyCard;