import "./Statistics.css";

import statistics from "./statisticsData";

function Statistics() {

    return (

        <section className="statistics-section">

            <div className="statistics-container">

                <div className="statistics-header">

                    <span className="statistics-tag">

                        OUR COMMUNITY

                    </span>

                    <h2>

                        Growing Together Through Music

                    </h2>

                    <p>

                        Every performance, every friendship, every event —
                        together, we're creating unforgettable musical memories.

                    </p>

                </div>

                <div className="statistics-grid">

                    {

                        statistics.map((item) => {

                            const Icon = item.icon;

                            return (

                                <div
                                    key={item.id}
                                    className="statistics-card"
                                >

                                    <div className="statistics-icon">

                                        <Icon />

                                    </div>

                                    <h3>

                                        {item.number}

                                    </h3>

                                    <p>

                                        {item.title}

                                    </p>

                                </div>

                            );

                        })

                    }

                </div>

            </div>

        </section>

    );

}

export default Statistics;