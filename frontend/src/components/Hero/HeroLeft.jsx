import {
    FaUsers,
    FaMusic
} from "react-icons/fa";

import { GiMicrophone } from "react-icons/gi";

import homepage from "../../config/homepage";

import "./HeroLeft.css";

function HeroLeft() {

    return (

        <div className="hero-left">

            {/* Community Badge */}

            <div className="community-badge">

                ⭐ {homepage.community}

            </div>

            {/* Boxed content panel */}

            <div className="hero-left-box">

                {/* Heading */}

                <h1 className="hero-heading">

                    <span>Where Every</span>

                    <span className="green">Voice Finds</span>

                    <span>A Stage</span>

                </h1>

                {/* Tagline */}

                <h2 className="hero-tagline">

                    {homepage.tagline}

                </h2>

                <div className="hero-divider"></div>

                {/* Description */}

                <p className="hero-description">

                    {homepage.description}

                </p>

                {/* Statistics */}

                <div className="hero-stats">

                    <div className="stat-card">

                        <div className="stat-icon users">

                            <FaUsers />

                        </div>

                        <div>

                            <h3>117+</h3>

                            <p>Members</p>

                        </div>

                    </div>

                    <div className="stat-card">

                        <div className="stat-icon music">

                            <FaMusic />

                        </div>

                        <div>

                            <h3>36</h3>

                            <p>Events</p>

                        </div>

                    </div>

                    <div className="stat-card">

                        <div className="stat-icon mic">

                            <GiMicrophone />

                        </div>

                        <div>

                            <h3>200+</h3>

                            <p>Performances</p>

                        </div>

                    </div>

                </div>

            </div>

        </div>

    );

}

export default HeroLeft;