import "./DashboardWelcome.css";

import { useEffect, useState } from "react";

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

    const [greeting, setGreeting] = useState("");

    const [singerName, setSingerName] = useState(
        getSingerName()
    );

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