import "./SingerDashboard.css";

import DashboardWelcome
    from "../components/Dashboard/DashboardWelcome/DashboardWelcome";

import MySongs
    from "../components/Dashboard/MySongs/MySongs";


function SingerDashboard() {

    return (

        <main className="singer-dashboard">

            <DashboardWelcome />

            <MySongs />

        </main>

    );

}

export default SingerDashboard;