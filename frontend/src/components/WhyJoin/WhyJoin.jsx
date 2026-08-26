import "./WhyJoin.css";
import whyJoin from "./whyJoinData";

function WhyJoin() {

    return (

        <section className="why-section">

            <div className="why-container">

                <div className="why-header">

                    <h2>
                        Why Join Beats ∞ Infinity
                    </h2>

                    <p>
                        More Than Karaoke... A Musical Family.
                    </p>

                </div>

                <div className="why-grid">

                    {whyJoin.map((item) => {

                        const Icon = item.icon;

                        return (

                            <div
                                key={item.id}
                                className="why-card"
                            >

                                <div className="why-icon">
                                    <Icon />
                                </div>

                                <h3>{item.title}</h3>

                                <p>{item.description}</p>

                            </div>

                        );

                    })}

                </div>

            </div>

        </section>

    );

}

export default WhyJoin;