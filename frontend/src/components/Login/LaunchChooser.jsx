import { useNavigate } from "react-router-dom";

import "./Login.css";
import "./LaunchChooser.css";

import logo from "../../assets/logo/beats-infinity-logo.png";

// Shown when the installed app is opened with nobody logged in -
// lets whoever's opening it (singer or admin/super admin sharing
// the same installed app) pick the right login screen up front,
// instead of assuming everyone is a singer.
function LaunchChooser() {

    const navigate = useNavigate();

    return (

        <section className="login-page">

            <div className="login-overlay">

                <div className="login-card">

                    <div className="login-logo">
                        <img
                            src={logo}
                            alt="Beats Infinity"
                            className="login-logo-image"
                        />
                    </div>

                    <h1>Welcome</h1>
                    <h2>Who's logging in?</h2>

                    <button
                        type="button"
                        className="chooser-btn chooser-btn-primary"
                        onClick={() => navigate("/login", { replace: true })}
                    >
                        🎤 I'm a Singer
                    </button>

                    <button
                        type="button"
                        className="chooser-btn chooser-btn-secondary"
                        onClick={() => navigate("/admin/login", { replace: true })}
                    >
                        🔐 Admin / Super Admin
                    </button>

                </div>

            </div>

        </section>

    );

}

export default LaunchChooser;
