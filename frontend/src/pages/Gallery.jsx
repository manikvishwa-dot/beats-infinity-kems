import Navbar from "../common/Navbar/Navbar";

import "./Gallery.css";

function Gallery() {

    return (
        <div className="gallery-page">
            <Navbar />

            <div className="gallery-coming-soon">

                <div className="gallery-glow" />

                <div className="gallery-icon-ring">
                    <span className="gallery-icon">🎵</span>
                </div>

                <span className="gallery-eyebrow">BEATS ∞ INFINITY</span>

                <h1 className="gallery-title">
                    Something Amazing Is Coming Soon
                </h1>

                <p className="gallery-subtitle">
                    We're working behind the scenes to bring in some good
                    memories of Beats Infinity.
                </p>

                <div className="gallery-equalizer" aria-hidden="true">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>

            </div>
        </div>
    );

}

export default Gallery;
