import "./Auth.css";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaMobileAlt } from "react-icons/fa";

import logo from "../../assets/logo/beats-infinity-logo.png";
import members from "../../data/members";

function MobileEntry() {

    const navigate = useNavigate();

    const [mobile, setMobile] = useState("");

    const continueLogin = () => {

        // Validate Mobile Number
        if (mobile.length !== 10) {

            alert("Please enter a valid 10 digit mobile number.");

            return;

        }

        // Check if member already exists
        const member = members.find(

            (m) => m.mobile === mobile

        );

        // Existing Member
        if (member) {

            navigate("/auth/pin", {

                state: member

            });

        }

        // New Member
        else {

            navigate("/auth/otp", {

                state: {

                    mobile

                }

            });

        }

    };

    return (

        <section className="auth-page">

            <div className="auth-card">

                <img
                    src={logo}
                    alt="Beats Infinity"
                    className="auth-logo"
                />

                <h1>

                    Welcome to Beats ∞ Infinity

                </h1>

                <p>

                    Continue Your Musical Journey

                </p>

                <div className="auth-input">

                    <span className="country-code">

                        +91

                    </span>

                    <FaMobileAlt />

                    <input

                        type="tel"

                        placeholder="Enter Mobile Number"

                        maxLength={10}

                        value={mobile}

                        onChange={(e) =>

                            setMobile(

                                e.target.value.replace(/\D/g, "")

                            )

                        }

                    />

                </div>

                <button

                    className="primary-btn"

                    onClick={continueLogin}

                >

                    Continue

                </button>

            </div>

        </section>

    );

}

export default MobileEntry;