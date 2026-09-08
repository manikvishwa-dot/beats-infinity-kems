import "./DashboardWelcome.css";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { logout } from "../../../services/singerService";

// ==========================================================
// GET CURRENT SINGER'S DISPLAY NAME
//
// Reads the same canonical "beatsInfinitySinger" localStorage
// session written by LoginForm.jsx and SingerRegistration.jsx.
// ==========================================================

const getSingerName = () => {

    try {

        const raw =
            localStorage.getItem(
                "beatsInfinitySinger"
            );

        if (!raw) {

            return null;

        }

        const singer =
            JSON.parse(raw);

        return (
            singer?.singer_name ||
            singer?.name ||
            null
        );

    }

    catch (error) {

        console.error(
            "Unable to read singer session:",
            error
        );

        return null;

    }

};

function DashboardWelcome() {

    const navigate = useNavigate();

    const [greeting, setGreeting] = useState("");

    const [singerName, setSingerName] = useState(
        getSingerName()
    );

    const handleLogout = () => {

        logout();
        navigate("/login");

    };

    useEffect(() => {

        const hour = new Date().getHours();

        if (hour < 12) {

            setGreeting("Good Morning");

        } else if (hour < 17) {

            setGreeting("Good Afternoon");

        } else {

            setGreeting("Good Evening");

        }

        setSingerName(
            getSingerName()
        );

    }, []);

    return (

        <section className="dashboard-welcome">

            <button
                type="button"
                className="dashboard-logout-btn"
                onClick={handleLogout}
            >
                Logout
            </button>

            <div className="welcome-content">

                <span className="welcome-label">

                    {greeting} 👋

                </span>

                <h1>

                    {singerName || "Singer"}

                </h1>

                <p>

                    Growing Together Through Music ❤️

                </p>

            </div>

            <div className="welcome-music">

                🎤

            </div>

        </section>

    );

}

export default DashboardWelcome;