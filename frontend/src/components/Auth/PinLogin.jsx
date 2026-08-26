import "./Auth.css";

import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import logo from "../../assets/logo/beats-infinity-logo.png";

function PinLogin() {

    const navigate = useNavigate();
    const location = useLocation();

    const member = location.state || {};

    const memberName = member.name || "Member";
    const mobile = member.mobile || "";

    const [pin, setPin] = useState(["", "", "", ""]);
    const [attempts, setAttempts] = useState(0);

    const inputRefs = useRef([]);

    useEffect(() => {

        inputRefs.current[0]?.focus();

    }, []);

    const handlePinChange = (value, index) => {

        if (!/^[0-9]?$/.test(value)) return;

        const updatedPin = [...pin];

        updatedPin[index] = value;

        setPin(updatedPin);

        if (value && index < 3) {

            inputRefs.current[index + 1]?.focus();

        }

    };

    const handleKeyDown = (event, index) => {

        if (

            event.key === "Backspace" &&

            pin[index] === "" &&

            index > 0

        ) {

            inputRefs.current[index - 1]?.focus();

        }

    };

    const login = () => {

        const enteredPin = pin.join("");

        if (enteredPin.length !== 4) {

            alert("Please enter your 4 digit PIN.");

            return;

        }

        // Temporary PIN
        if (enteredPin === "1234") {

            navigate("/dashboard");

            return;

        }

        const newAttempts = attempts + 1;

        setAttempts(newAttempts);

        if (newAttempts >= 5) {

            alert("Too many incorrect attempts. OTP verification required.");

            navigate("/auth/otp", {

                state: {

                    mobile

                }

            });

            return;

        }

        alert(`Incorrect PIN. Remaining Attempts: ${5 - newAttempts}`);

        setPin(["", "", "", ""]);

        inputRefs.current[0]?.focus();

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

                    Welcome Back 👋

                </h1>

                <h2 className="member-name">

                    {memberName}

                </h2>

                <p className="member-mobile">

                    📱 +91 {mobile}

                </p>

                <div className="pin-boxes">

                    {

                        pin.map((digit, index) => (

                            <input

                                key={index}

                                ref={(element) => {

                                    inputRefs.current[index] = element;

                                }}

                                className="pin-box"

                                type="password"

                                inputMode="numeric"

                                maxLength={1}

                                value={digit}

                                onChange={(event) =>

                                    handlePinChange(

                                        event.target.value,

                                        index

                                    )

                                }

                                onKeyDown={(event) =>

                                    handleKeyDown(

                                        event,

                                        index

                                    )

                                }

                            />

                        ))

                    }

                </div>

                <button

                    className="primary-btn"

                    onClick={login}

                >

                    Login

                </button>

                <button

                    className="secondary-btn"

                    onClick={() =>

                        navigate("/auth/forgot-pin", {

                            state: member

                        })

                    }

                >

                    🔑 Forgot PIN?

                </button>

                <button

                    className="switch-btn"

                    onClick={() => navigate("/auth")}

                >

                    ← Use Another Mobile Number

                </button>

            </div>

        </section>

    );

}

export default PinLogin;