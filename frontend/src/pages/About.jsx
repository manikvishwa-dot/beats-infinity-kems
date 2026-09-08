import Navbar from "../common/Navbar/Navbar";

import manikPhoto from "../assets/team/manik.jpg";
import geethaPhoto from "../assets/team/geetha.jpeg";

import "./About.css";

const FOUNDERS = [
    { name: "Manik Vishwa", photo: manikPhoto },
    { name: "Geetha", photo: geethaPhoto }
];

const JOURNEY_MILESTONES = [
    {
        badge: "2023",
        title: "The Beginning",
        description:
            "Beats Infinity was founded by Manik Vishwa and Geetha, driven by a shared " +
            "passion for music, entertainment, and bringing people together."
    },
    {
        badge: "50+",
        title: "In-House Events",
        description:
            "Creating engaging and memorable experiences within communities, " +
            "organizations, and private gatherings."
    },
    {
        badge: "300+",
        title: "Outdoor & Public Events",
        description:
            "Taking our energy beyond intimate spaces and reaching larger audiences " +
            "through public events, celebrations, and outdoor experiences."
    },
    {
        badge: "∞",
        title: "And the journey continues...",
        description:
            "With every event, every song, and every connection, Beats Infinity " +
            "continues to grow — powered by people who believe that everyone has a " +
            "song within them."
    }
];

const BELIEF_STATEMENTS = [
    "Music brings people together.",
    "Celebration creates memories.",
    "Participation makes the moment unforgettable."
];

function About() {

    return (
        <div className="about-page">
            <Navbar />

            <div className="about-page-inner">

                <div className="about-page-header">
                    <span className="about-page-eyebrow">BEATS ∞ INFINITY</span>
                    <h1>About Us</h1>
                </div>

                <div className="about-card">
                    <p>
                        Beats ∞ Infinity is a dynamic team of event organizers specializing in
                        crafting memorable experiences for both corporate and family audiences.
                        With a passion for creativity and connection, we design and execute a
                        wide range of fun-filled, interactive events—from team-building activities
                        and strategy games to family entertainment programs that spark joy across
                        generations.
                    </p>

                    <p>
                        Adding to the excitement, our in-house Karaoke and Live Orchestra Band
                        brings music to life, allowing guests to take center stage or enjoy a
                        professionally curated performance. Whether it's an employee engagement
                        event, a festive family celebration, or a musical night, we ensure every
                        moment is vibrant, engaging, and flawlessly executed.
                    </p>
                </div>

                <section className="about-founders-section">
                    <h2>Founded By</h2>

                    <div className="about-founders-row">
                        {FOUNDERS.map(founder => (
                            <div className="about-founder-card" key={founder.name}>
                                <div className="about-founder-avatar">
                                    <img src={founder.photo} alt={founder.name} />
                                </div>
                                <div className="about-founder-name">{founder.name}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="about-journey-section">
                    <h2>Our Journey</h2>

                    <div className="about-journey-timeline">
                        {JOURNEY_MILESTONES.map(milestone => (
                            <div className="about-journey-item" key={milestone.title}>
                                <div className="about-journey-badge">{milestone.badge}</div>
                                <div className="about-journey-content">
                                    <h3>{milestone.title}</h3>
                                    <p>{milestone.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="about-belief-section">
                    <h2>Our Belief</h2>

                    <div className="about-belief-statements">
                        {BELIEF_STATEMENTS.map(statement => (
                            <p key={statement}>{statement}</p>
                        ))}
                    </div>

                    <p className="about-belief-closing">
                        And that is what Beats ∞ Infinity is all about.
                    </p>
                </section>

            </div>
        </div>
    );

}

export default About;
