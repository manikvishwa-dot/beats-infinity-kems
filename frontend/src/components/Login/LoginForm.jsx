import "./Login.css";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
    checkSinger,
    loginWithPin
} from "../../services/singerService";

import {
    FaMobileAlt,
    FaLock
} from "react-icons/fa";

import logo from "../../assets/logo/beats-infinity-logo.png";


function LoginForm() {

    const navigate = useNavigate();


    // ==========================================================
    // STATE
    // ==========================================================

    const [mobile, setMobile] = useState("");

    const [pin, setPin] = useState("");

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");

    const [success, setSuccess] = useState("");


    // ==========================================================
    // MOBILE
    // ==========================================================

    const handleMobileChange = (event) => {

        const value =
            event.target.value
                .replace(/\D/g, "")
                .slice(0, 10);

        setMobile(value);

        setError("");

        setSuccess("");

    };


    // ==========================================================
    // PIN
    // ==========================================================

    const handlePinChange = (event) => {

        const value =
            event.target.value
                .replace(/\D/g, "")
                .slice(0, 4);

        setPin(value);

        setError("");

        setSuccess("");

    };


    // ==========================================================
    // LOGIN
    // ==========================================================

    const handleLogin = async (event) => {

        event.preventDefault();

        setError("");

        setSuccess("");


        // ------------------------------------------------------
        // MOBILE VALIDATION
        // ------------------------------------------------------

        if (mobile.length !== 10) {

            setError(
                "Please enter a valid 10 digit mobile number."
            );

            return;

        }


        // ------------------------------------------------------
        // PIN VALIDATION
        // ------------------------------------------------------

        if (pin.length !== 4) {

            setError(
                "Please enter your 4 digit PIN."
            );

            return;

        }


        setLoading(true);


        try {

            // ==================================================
            // CHECK WHETHER SINGER EXISTS
            // ==================================================

            const singerCheck =
                await checkSinger(mobile);


            console.log(
                "Singer check:",
                singerCheck
            );


            if (
                !singerCheck ||
                singerCheck.exists !== true
            ) {

                setError(
                    "User Not Found - Please Register via Join Beats Infinity."
                );

                setPin("");

                return;

            }


            // ==================================================
            // LOGIN
            // ==================================================

            const loginResult =
                await loginWithPin(
                    mobile,
                    pin
                );


            console.log(
                "Login response:",
                loginResult
            );


            // ==================================================
            // LOGIN SUCCESS
            // ==================================================

            if (
                loginResult &&
                loginResult.success === true
            ) {

                setSuccess(
                    "Login successful."
                );


                // ------------------------------------------------
                // SAVE LOGIN RESPONSE
                // ------------------------------------------------

                localStorage.setItem(
                    "beatsInfinityLogin",
                    JSON.stringify(
                        loginResult
                    )
                );


                // ------------------------------------------------
                // SAVE SINGER
                // ------------------------------------------------

                if (
                    loginResult.singer
                ) {

                    localStorage.setItem(
                        "beatsInfinitySinger",
                        JSON.stringify(
                            loginResult.singer
                        )
                    );

                }


                // ------------------------------------------------
                // FIND SINGER ID
                // ------------------------------------------------

                const singer =
                    loginResult.singer;


                const singerId =
                    singer?.id ||
                    singer?.singer_id ||
                    loginResult?.singer_id ||
                    loginResult?.id;


                // ------------------------------------------------
                // SAVE SINGER ID
                // ------------------------------------------------

                if (singerId) {

                    localStorage.setItem(
                        "beatsInfinitySingerId",
                        String(singerId)
                    );

                }


                // ------------------------------------------------
                // GO TO DASHBOARD
                // ------------------------------------------------

                navigate(
                    "/singer-dashboard"
                );

                return;

            }


            // ==================================================
            // LOGIN FAILED
            // ==================================================

            setError(
                loginResult?.message ||
                "Invalid mobile number or PIN."
            );

            setPin("");

        }

        catch (error) {

            console.error(
                "Login error:",
                error
            );


            setError(
                error?.message ||
                "Unable to login. Please try again."
            );


            setPin("");

        }

        finally {

            setLoading(false);

        }

    };


    // ==========================================================
    // JOIN BEATS INFINITY
    // ==========================================================

    const handleJoinBeatsInfinity = () => {

        console.log(
            "========================================"
        );

        console.log(
            "JOIN BEATS INFINITY CLICKED"
        );

        console.log(
            "Navigating to /singer-registration"
        );

        console.log(
            "========================================"
        );


        setError("");

        setSuccess("");


        navigate(
            "/singer-registration"
        );

    };


    // ==========================================================
    // FORGOT PIN
    // ==========================================================

    const handleForgotPin = () => {

        navigate(
            "/singer-login",
            {
                state: {
                    mode: "forgot-pin",
                    mobile: mobile
                }
            }
        );

    };


    // ==========================================================
    // RENDER
    // ==========================================================

    return (

        <section className="login-page">

            <div className="login-overlay">

                <div className="login-card">


                    {/* ==================================================
                        HOME BUTTON
                    ================================================== */}

                    <Link to="/" className="login-home-button">
                        🏠 Home
                    </Link>


                    {/* ==================================================
                        LOGO
                    ================================================== */}

                    <div className="login-logo">

                        <Link to="/">
                            <img
                                src={logo}
                                alt="Beats Infinity"
                                className="login-logo-image"
                            />
                        </Link>

                    </div>


                    {/* ==================================================
                        TITLE
                    ================================================== */}

                    <h1>
                        Welcome Back
                    </h1>


                    <h2>
                        Continue Your Musical Journey
                    </h2>


                    {/* ==================================================
                        ERROR
                    ================================================== */}

                    {error && (

                        <div
                            style={{
                                color: "#ff6b6b",
                                textAlign: "center",
                                marginBottom: "15px",
                                fontSize: "14px",
                                lineHeight: "1.5"
                            }}
                        >

                            ⚠️ {error}

                        </div>

                    )}


                    {/* ==================================================
                        SUCCESS
                    ================================================== */}

                    {success && (

                        <div
                            style={{
                                color: "#32d26d",
                                textAlign: "center",
                                marginBottom: "15px",
                                fontSize: "14px"
                            }}
                        >

                            ✅ {success}

                        </div>

                    )}


                    {/* ==================================================
                        LOGIN FORM
                    ================================================== */}

                    <form
                        onSubmit={handleLogin}
                    >


                        {/* ==================================================
                            MOBILE NUMBER
                        ================================================== */}

                        <div className="input-group">

                            <FaMobileAlt />

                            <input
                                type="tel"
                                inputMode="numeric"
                                maxLength="10"
                                value={mobile}
                                onChange={
                                    handleMobileChange
                                }
                                placeholder="Enter Mobile Number"
                                autoComplete="tel"
                            />

                        </div>


                        {/* ==================================================
                            PIN
                        ================================================== */}

                        <div className="input-group">

                            <FaLock />

                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength="4"
                                value={pin}
                                onChange={
                                    handlePinChange
                                }
                                placeholder="Enter 4 Digit PIN"
                                autoComplete="current-password"
                            />

                        </div>


                        {/* ==================================================
                            LOGIN BUTTON
                        ================================================== */}

                        <button
                            type="submit"
                            className="login-btn"
                            disabled={loading}
                        >

                            {loading
                                ? "Logging In..."
                                : "LOGIN"
                            }

                        </button>


                    </form>


                    {/* ==================================================
                        FORGOT PIN
                    ================================================== */}

                    <button
                        type="button"
                        onClick={
                            handleForgotPin
                        }
                        style={{
                            display: "block",
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            color: "#BBBBBB",
                            cursor: "pointer",
                            marginTop: "16px",
                            fontSize: "13px"
                        }}
                    >

                        Forgot PIN?

                    </button>


                    {/* ==================================================
                        JOIN BEATS INFINITY
                    ================================================== */}

                    <div
                        style={{
                            textAlign: "center",
                            marginTop: "24px",
                            paddingTop: "20px",
                            borderTop:
                                "1px solid rgba(255,255,255,0.12)"
                        }}
                    >

                        <div
                            style={{
                                color: "#BBBBBB",
                                fontSize: "13px",
                                marginBottom: "8px"
                            }}
                        >

                            New Singer?

                        </div>


                        <button
                            type="button"
                            onClick={
                                handleJoinBeatsInfinity
                            }
                            style={{
                                display: "inline-block",
                                background: "transparent",
                                border: "none",
                                padding: "8px 12px",
                                color: "#FFD54A",
                                cursor: "pointer",
                                fontSize: "15px",
                                fontWeight: "600",
                                textDecoration: "underline",
                                position: "relative",
                                zIndex: 9999
                            }}
                        >

                            Join Beats Infinity →

                        </button>


                    </div>


                </div>

            </div>

        </section>

    );

}


export default LoginForm;