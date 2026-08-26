import "./Auth.css";

import logo from "../../assets/logo/beats-infinity-logo.png";

function OTPVerification() {

    return (

        <section className="auth-page">

            <div className="auth-card">

                <img
                    src={logo}
                    alt="Beats Infinity"
                    className="auth-logo"
                />

                <h1>OTP Verification</h1>

                <p>Verify your mobile number</p>

            </div>

        </section>

    );

}

export default OTPVerification;