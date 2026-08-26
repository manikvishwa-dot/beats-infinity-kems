import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    FaMobileAlt,
    FaUser,
    FaCalendarAlt,
    FaVenusMars,
    FaLock
} from "react-icons/fa";

import "./SingerLogin.css";


const SingerRegistration = () => {

    const navigate = useNavigate();


    // =====================================================
    // FORM STATE
    // =====================================================

    const [mobile, setMobile] = useState("");

    const [name, setName] = useState("");

    const [dateOfBirth, setDateOfBirth] = useState("");

    const [gender, setGender] = useState("");

    const [pin, setPin] = useState("");

    const [confirmPin, setConfirmPin] = useState("");


    // =====================================================
    // UI STATE
    // =====================================================

    const [error, setError] = useState("");

    const [loading, setLoading] = useState(false);


    // =====================================================
    // MOBILE
    // =====================================================

    const handleMobileChange = (event) => {

        const value =
            event.target.value
                .replace(/\D/g, "")
                .slice(0, 10);

        setMobile(value);

        setError("");

    };


    // =====================================================
    // PIN
    // =====================================================

    const handlePinChange = (event) => {

        const value =
            event.target.value
                .replace(/\D/g, "")
                .slice(0, 4);

        setPin(value);

        setError("");

    };


    const handleConfirmPinChange = (event) => {

        const value =
            event.target.value
                .replace(/\D/g, "")
                .slice(0, 4);

        setConfirmPin(value);

        setError("");

    };


    // =====================================================
    // CONTINUE TO SONG SELECTION
    // =====================================================

    const handleContinue = (event) => {

        event.preventDefault();

        setError("");


        // -------------------------------------------------
        // MOBILE
        // -------------------------------------------------

        if (mobile.length !== 10) {

            setError(
                "Please enter a valid 10 digit mobile number."
            );

            return;

        }


        // -------------------------------------------------
        // NAME
        // -------------------------------------------------

        if (!name.trim()) {

            setError(
                "Please enter your name."
            );

            return;

        }


        // -------------------------------------------------
        // DATE OF BIRTH
        // -------------------------------------------------

        if (!dateOfBirth) {

            setError(
                "Please enter your date of birth."
            );

            return;

        }


        // -------------------------------------------------
        // GENDER
        // -------------------------------------------------

        if (!gender) {

            setError(
                "Please select your gender."
            );

            return;

        }


        // -------------------------------------------------
        // PIN
        // -------------------------------------------------

        if (pin.length !== 4) {

            setError(
                "PIN must contain exactly 4 digits."
            );

            return;

        }


        // -------------------------------------------------
        // CONFIRM PIN
        // -------------------------------------------------

        if (confirmPin.length !== 4) {

            setError(
                "Please confirm your 4 digit PIN."
            );

            return;

        }


        if (pin !== confirmPin) {

            setError(
                "PIN and Confirm PIN do not match."
            );

            return;

        }


        setLoading(true);


        try {

            // =================================================
            // TEMPORARILY STORE REGISTRATION DATA
            // =================================================

            const registrationData = {

                mobile,

                singer_name:
                    name.trim(),

                date_of_birth:
                    dateOfBirth,

                gender,

                pin

            };


            sessionStorage.setItem(
                "beatsInfinityRegistration",
                JSON.stringify(
                    registrationData
                )
            );


            console.log(
                "Registration data saved:",
                registrationData
            );


            // =================================================
            // GO TO SONG SELECTION
            // =================================================

            navigate(
                "/singer-song-selection"
            );

        }

        catch (error) {

            console.error(
                "Registration navigation error:",
                error
            );

            setError(
                "Unable to continue. Please try again."
            );

        }

        finally {

            setLoading(false);

        }

    };


    // =====================================================
    // BACK TO LOGIN
    // =====================================================

    const handleBackToLogin = () => {

        navigate(
            "/login"
        );

    };


    // =====================================================
    // RENDER
    // =====================================================

    return (

        <div className="singer-login-page">

            <div className="singer-login-background">

                <div className="music-note note-one">
                    ♪
                </div>

                <div className="music-note note-two">
                    ♫
                </div>

                <div className="music-note note-three">
                    ♪
                </div>

                <div className="music-note note-four">
                    ♬
                </div>

            </div>


            <div className="singer-login-card">


                {/* =================================================
                    BRAND
                ================================================= */}

                <div className="brand-top">

                    <div className="brand-infinity">
                        ∞
                    </div>

                    <div>

                        <div className="brand-name">
                            BEATS ∞ INFINITY
                        </div>

                        <div className="brand-tagline">
                            UNLEASH THE HARMONY IN YOU
                        </div>

                    </div>

                </div>


                {/* =================================================
                    FORM
                ================================================= */}

                <div className="singer-form">

                    <div className="welcome-icon">
                        🎤
                    </div>


                    <h2>
                        Join Beats Infinity
                    </h2>


                    <p className="subtitle">
                        Create your singer profile
                    </p>


                    {/* =================================================
                        ERROR
                    ================================================= */}

                    {error && (

                        <div
                            className="message error-message"
                        >

                            ⚠️ {error}

                        </div>

                    )}


                    {/* =================================================
                        MOBILE
                    ================================================= */}

                    <label>
                        Mobile Number
                    </label>


                    <div className="mobile-input-wrapper">

                        <span>
                            +91
                        </span>


                        <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            value={mobile}
                            onChange={
                                handleMobileChange
                            }
                            placeholder="9876543210"
                            autoFocus
                        />

                    </div>


                    {/* =================================================
                        NAME
                    ================================================= */}

                    <label>
                        Name
                    </label>


                    <div className="input-with-icon">

                        <FaUser />

                        <input
                            type="text"
                            value={name}
                            onChange={(event) => {

                                setName(
                                    event.target.value
                                );

                                setError("");

                            }}
                            placeholder="Enter your name"
                        />

                    </div>


                    {/* =================================================
                        DATE OF BIRTH
                    ================================================= */}

                    <label>
                        Date of Birth
                    </label>


                    <div className="input-with-icon">

                        <FaCalendarAlt />

                        <input
                            type="date"
                            value={dateOfBirth}
                            onChange={(event) => {

                                setDateOfBirth(
                                    event.target.value
                                );

                                setError("");

                            }}
                        />

                    </div>


                    {/* =================================================
                        GENDER
                    ================================================= */}

                    <label>
                        Gender
                    </label>


                    <div className="input-with-icon">

                        <FaVenusMars />

                        <select
                            value={gender}
                            onChange={(event) => {

                                setGender(
                                    event.target.value
                                );

                                setError("");

                            }}
                        >

                            <option value="">
                                Select Gender
                            </option>

                            <option value="Male">
                                Male
                            </option>

                            <option value="Female">
                                Female
                            </option>

                            <option value="Other">
                                Other
                            </option>

                        </select>

                    </div>


                    {/* =================================================
                        PIN
                    ================================================= */}

                    <label>
                        Create 4 Digit PIN
                    </label>


                    <div className="input-with-icon">

                        <FaLock />

                        <input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            value={pin}
                            onChange={
                                handlePinChange
                            }
                            placeholder="••••"
                        />

                    </div>


                    {/* =================================================
                        CONFIRM PIN
                    ================================================= */}

                    <label>
                        Confirm 4 Digit PIN
                    </label>


                    <div className="input-with-icon">

                        <FaLock />

                        <input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            value={confirmPin}
                            onChange={
                                handleConfirmPinChange
                            }
                            placeholder="••••"
                        />

                    </div>


                    {/* =================================================
                        CONTINUE
                    ================================================= */}

                    <button
                        type="button"
                        className="primary-button"
                        onClick={
                            handleContinue
                        }
                        disabled={loading}
                    >

                        {loading
                            ? "Please Wait..."
                            : "CONTINUE TO SONG SELECTION"
                        }

                    </button>


                    {/* =================================================
                        BACK TO LOGIN
                    ================================================= */}

                    <button
                        type="button"
                        className="back-button"
                        onClick={
                            handleBackToLogin
                        }
                    >

                        ← Back to Login

                    </button>

                </div>


                {/* =================================================
                    FOOTER
                ================================================= */}

                <div className="footer-text">

                    Beats Infinity • Singer Registration

                </div>

            </div>

        </div>

    );

};


export default SingerRegistration;