import React from "react";

import "./SingerDashboard.css";

import DashboardWelcome
    from "../components/dashboard/DashboardWelcome/DashboardWelcome";

import PairingStatus
    from "../components/dashboard/PairingStatus/PairingStatus";

import MySongs
    from "../components/dashboard/MySongs/MySongs";


function SingerDashboard() {

    // ==========================================================
    // GET CURRENT LOGGED-IN / REGISTERED SINGER
    // ==========================================================

    let singer = null;

    try {

        const storedSinger =
            localStorage.getItem(
                "beatsInfinitySinger"
            );

        if (storedSinger) {

            singer =
                JSON.parse(
                    storedSinger
                );

        }

    } catch (error) {

        console.error(
            "Unable to read singer session:",
            error
        );

    }


    // ==========================================================
    // SINGER ID
    // ==========================================================

    const singerId =
        singer?.id ||
        singer?.singer_id ||
        null;


    // ==========================================================
    // DEBUG
    // ==========================================================

    console.log(
        "🎤 SingerDashboard - Current Singer:",
        singer
    );

    console.log(
        "🎤 SingerDashboard - Singer ID:",
        singerId
    );


    // ==========================================================
    // RENDER
    // ==========================================================

    return (

        <main className="singer-dashboard">

            <DashboardWelcome />

            <PairingStatus
                singerId={singerId}
            />

            <MySongs
                singerId={singerId}
            />

        </main>

    );

}


export default SingerDashboard;