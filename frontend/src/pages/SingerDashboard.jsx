import { useEffect, useState } from "react";

import "./SingerDashboard.css";

import DashboardWelcome
    from "../components/dashboard/DashboardWelcome/DashboardWelcome";

import PairingStatus
    from "../components/dashboard/PairingStatus/PairingStatus";

import MySongs
    from "../components/dashboard/MySongs/MySongs";

import DobPrompt
    from "../components/dashboard/DobPrompt/DobPrompt";
import BirthdayGreeting
    from "../components/dashboard/BirthdayGreeting/BirthdayGreeting";
import { getMyPairing } from "../services/pairingService";


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
    // SONGS SET BY THE ADMIN
    //
    // A singer the admin put on the event's Final List (walk-in,
    // uploaded list) already has their songs - show those (the
    // Song List above) instead of asking them to pick 6.
    // null = still checking.
    // ==========================================================

    const [addedByAdmin, setAddedByAdmin] = useState(null);

    useEffect(() => {
        if (!singerId) return undefined;

        let alive = true;

        getMyPairing(singerId)
            .then(result => {
                if (alive) setAddedByAdmin(Boolean(result?.added_by_admin));
            })
            .catch(() => {
                if (alive) setAddedByAdmin(false);
            });

        return () => {
            alive = false;
        };
    }, [singerId]);

    // ==========================================================
    // RENDER
    // ==========================================================

    return (

        <main className="singer-dashboard">

            <DobPrompt />

            <DashboardWelcome />

            <BirthdayGreeting
                singerId={singerId}
            />

            <PairingStatus
                singerId={singerId}
            />

            {addedByAdmin === false && (
                <MySongs
                    singerId={singerId}
                />
            )}

            {addedByAdmin && (
                <p className="singer-dashboard-note">
                    Your songs for this event were arranged by the Beats Infinity team - they're listed above.
                    Need a change? Please contact the organisers.
                </p>
            )}

        </main>

    );

}


export default SingerDashboard;