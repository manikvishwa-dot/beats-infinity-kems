import "./DashboardWelcome.css";

import { useEffect, useState } from "react";

function DashboardWelcome() {

    const [greeting, setGreeting] = useState("");

    useEffect(() => {

        const hour = new Date().getHours();

        if (hour < 12) {

            setGreeting("Good Morning");

        } else if (hour < 17) {

            setGreeting("Good Afternoon");

        } else {

            setGreeting("Good Evening");

        }

    }, []);

    return (

        <section className="dashboard-welcome">

            <div className="welcome-content">

                <span className="welcome-label">

                    {greeting} 👋

                </span>

                <h1>

                    Manikanda Vishwanathan

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