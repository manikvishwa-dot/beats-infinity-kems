import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
    checkSinger,
    loginWithPin,
    sendOTP,
    verifyOTP,
    resetPin
} from "../services/singerService";

import "./SingerLogin.css";

import logo from "../assets/logo/beats-infinity-logo.png";


const SingerLogin = () => {

    const navigate = useNavigate();
    const location = useLocation();

    // =====================================================
    // SCREEN
    // =====================================================

    const [screen, setScreen] = useState("login");

    /*
        login
        registration-mobile
        registration-otp
        registration-pin
        registration-details
        forgot-pin-mobile
        forgot-pin-otp
        forgot-pin-newpin
    */


    // =====================================================
    // FORM DATA
    // =====================================================

    const [mobile, setMobile] = useState("");
    const [pin, setPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [otp, setOtp] = useState("");
    const [name, setName] = useState("");
    const [gender, setGender] = useState("");

    // =====================================================
    // UI
    // =====================================================

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [generatedOtp, setGeneratedOtp] = useState("");


    // =====================================================
    // ARRIVED FROM "FORGOT PIN?" ON THE MAIN LOGIN FORM
    //
    // LoginForm navigates here with
    // { mode: "forgot-pin", mobile }.
    // =====================================================

    useEffect(() => {

        if (location.state?.mode === "forgot-pin") {

            setMobile(
                (location.state.mobile || "").replace(/\D/g, "").slice(0, 10)
            );

            setScreen("forgot-pin-mobile");

        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // =====================================================
    // HELPERS
    // =====================================================

    const clearMessages = () => {

        setError("");
        setSuccess("");

    };


    const cleanMobile = (value) => {

        return value
            .replace(/\D/g, "")
            .slice(0, 10);

    };


    const cleanPin = (value) => {

        return value
            .replace(/\D/g, "")
            .slice(0, 4);

    };


    const cleanOtp = (value) => {

        return value
            .replace(/\D/g, "")
            .slice(0, 6);

    };


    // =====================================================
    // MOBILE CHANGE
    // =====================================================

    const handleMobileChange = (event) => {

        setMobile(
            cleanMobile(event.target.value)
        );

        clearMessages();

    };


    // =====================================================
    // PIN CHANGE
    // =====================================================

    const handlePinChange = (event) => {

        setPin(
            cleanPin(event.target.value)
        );

        clearMessages();

    };


    const handleConfirmPinChange = (event) => {

        setConfirmPin(
            cleanPin(event.target.value)
        );

        clearMessages();

    };


    // =====================================================
    // OTP CHANGE
    // =====================================================

    const handleOtpChange = (event) => {

        setOtp(
            cleanOtp(event.target.value)
        );

        clearMessages();

    };


    // =====================================================
    // ⭐ JOIN BEATS INFINITY
    //
    // THIS BUTTON DOES NOT CALL THE BACKEND.
    //
    // IT ONLY CHANGES THE SCREEN.
    // =====================================================

    const handleJoinBeatsInfinity = () => {

        console.log(
            "JOIN BEATS INFINITY BUTTON CLICKED"
        );

        clearMessages();

        setMobile("");
        setPin("");
        setConfirmPin("");
        setOtp("");
        setName("");
        setGender("");
        setGeneratedOtp("");

        setScreen(
            "registration-mobile"
        );

    };


    // =====================================================
    // BACK TO LOGIN
    // =====================================================

    const handleBackToLogin = () => {

        clearMessages();

        setMobile("");
        setPin("");
        setConfirmPin("");
        setOtp("");
        setName("");
        setGender("");
        setGeneratedOtp("");

        setScreen("login");

    };


    // =====================================================
    // LOGIN
    //
    // EXISTING USERS ONLY
    //
    // MOBILE + 4 DIGIT PIN
    // =====================================================

    const handleLogin = async (event) => {

        event.preventDefault();

        clearMessages();


        if (mobile.length !== 10) {

            setError(
                "Please enter a valid 10-digit mobile number."
            );

            return;

        }


        if (pin.length !== 4) {

            setError(
                "Please enter your 4-digit PIN."
            );

            return;

        }


        setLoading(true);


        try {

            // ------------------------------------------------
            // FIRST CHECK WHETHER USER EXISTS
            // ------------------------------------------------

            const result =
                await checkSinger(mobile);


            console.log(
                "Singer check:",
                result
            );


            // ------------------------------------------------
            // USER NOT FOUND
            // ------------------------------------------------

            if (
                !result ||
                result.exists !== true
            ) {

                setError(
                    "User Not Found - Please Register via Join Beats Infinity Button."
                );

                setPin("");

                return;

            }


            // ------------------------------------------------
            // USER EXISTS - CHECK PIN
            // ------------------------------------------------

            const loginResult =
                await loginWithPin(
                    mobile,
                    pin
                );


            console.log(
                "Login result:",
                loginResult
            );


            if (
                loginResult &&
                loginResult.success === true
            ) {

                if (loginResult.singer) {

                    localStorage.setItem(
                        "beatsInfinitySinger",
                        JSON.stringify(
                            loginResult.singer
                        )
                    );

                }


                navigate(
                    "/singer-dashboard"
                );

                return;

            }


            setError(
                loginResult?.message ||
                "Invalid 4-digit PIN."
            );

            setPin("");

        }

        catch (err) {

            console.error(
                "Login error:",
                err
            );

            setError(
                err?.message ||
                "Unable to login."
            );

        }

        finally {

            setLoading(false);

        }

    };


    // =====================================================
    // REGISTRATION - SEND OTP
    // =====================================================

    const handleSendRegistrationOtp =
        async (event) => {

            event.preventDefault();

            clearMessages();

            setGeneratedOtp("");


            if (mobile.length !== 10) {

                setError(
                    "Please enter a valid 10-digit mobile number."
                );

                return;

            }


            setLoading(true);


            try {

                // ------------------------------------------------
                // CHECK IF ALREADY REGISTERED
                // ------------------------------------------------

                const existing =
                    await checkSinger(mobile);


                console.log(
                    "Registration singer check:",
                    existing
                );


                if (
                    existing &&
                    existing.exists === true
                ) {

                    setError(
                        "This mobile number is already registered. Please Login with your 4-digit PIN."
                    );

                    return;

                }


                // ------------------------------------------------
                // GENERATE REGISTRATION OTP
                // ------------------------------------------------

                const result =
                    await sendOTP(
                        mobile,
                        "registration"
                    );


                console.log(
                    "OTP result:",
                    result
                );


                if (
                    !result ||
                    result.success !== true
                ) {

                    setError(
                        result?.message ||
                        "Unable to generate OTP."
                    );

                    return;

                }


                // ------------------------------------------------
                // DEVELOPMENT ONLY
                //
                // Supabase generated OTP
                // ------------------------------------------------

                if (result.otp) {

                    setGeneratedOtp(
                        String(result.otp)
                    );

                }


                setSuccess(
                    "OTP generated successfully."
                );


                setScreen(
                    "registration-otp"
                );

            }

            catch (err) {

                console.error(
                    "Registration OTP error:",
                    err
                );

                setError(
                    err?.message ||
                    "Unable to generate OTP."
                );

            }

            finally {

                setLoading(false);

            }

        };


    // =====================================================
    // VERIFY REGISTRATION OTP
    // =====================================================

    const handleVerifyOtp =
        async (event) => {

            event.preventDefault();

            clearMessages();


            if (otp.length !== 6) {

                setError(
                    "Please enter the 6-digit OTP."
                );

                return;

            }


            setLoading(true);


            try {

                const result =
                    await verifyOTP(
                        mobile,
                        otp,
                        "registration"
                    );


                console.log(
                    "OTP verification:",
                    result
                );


                if (
                    result &&
                    result.success === true &&
                    result.verified === true
                ) {

                    sessionStorage.setItem(
                        "beatsInfinityRegistration",
                        JSON.stringify({

                            mobile: mobile,

                            otpVerified: true

                        })
                    );


                    setOtp("");

                    setGeneratedOtp("");

                    setSuccess(
                        "OTP verified successfully."
                    );


                    setTimeout(() => {

                        clearMessages();

                        setScreen(
                            "registration-pin"
                        );

                    }, 500);


                    return;

                }


                setError(
                    result?.message ||
                    "Invalid OTP."
                );

                setOtp("");

            }

            catch (err) {

                console.error(
                    "OTP verification error:",
                    err
                );

                setError(
                    err?.message ||
                    "Unable to verify OTP."
                );

            }

            finally {

                setLoading(false);

            }

        };


    // =====================================================
    // CREATE PIN
    // =====================================================

    const handleCreatePin =
        (event) => {

            event.preventDefault();

            clearMessages();


            if (pin.length !== 4) {

                setError(
                    "PIN must contain exactly 4 digits."
                );

                return;

            }


            if (pin !== confirmPin) {

                setError(
                    "PIN and Confirm PIN do not match."
                );

                return;

            }


            const registration = {

                mobile: mobile,

                pin: pin,

                otpVerified: true

            };


            sessionStorage.setItem(
                "beatsInfinityRegistration",
                JSON.stringify(registration)
            );


            setPin("");
            setConfirmPin("");


            setScreen(
                "registration-details"
            );

        };


    // =====================================================
    // NAME + GENDER
    // =====================================================

    const handleRegistrationDetails =
        (event) => {

            event.preventDefault();

            clearMessages();


            if (!name.trim()) {

                setError(
                    "Please enter your name."
                );

                return;

            }


            if (!gender) {

                setError(
                    "Please select your gender."
                );

                return;

            }


            const stored =
                sessionStorage.getItem(
                    "beatsInfinityRegistration"
                );


            let registration = {};


            try {

                registration =
                    stored
                        ? JSON.parse(stored)
                        : {};

            }

            catch {

                registration = {};

            }


            sessionStorage.setItem(
                "beatsInfinityRegistration",
                JSON.stringify({

                    ...registration,

                    mobile: mobile,

                    singer_name:
                        name.trim(),

                    gender: gender

                })
            );


            /*
                IMPORTANT:

                We are NOT creating the singer
                in Supabase yet.

                Next step will connect this
                to the 5-song selection page.
            */

            navigate(
                "/singer-song-selection"
            );

        };


    // =====================================================
    // FORGOT PIN - START (from login screen directly, or
    // pre-filled via LoginForm's "Forgot PIN?" button)
    // =====================================================

    const handleStartForgotPin = () => {

        clearMessages();

        setOtp("");
        setGeneratedOtp("");
        setPin("");
        setConfirmPin("");

        setScreen("forgot-pin-mobile");

    };


    // =====================================================
    // FORGOT PIN - SEND OTP
    // =====================================================

    const handleSendResetOtp =
        async (event) => {

            event.preventDefault();

            clearMessages();

            setGeneratedOtp("");


            if (mobile.length !== 10) {

                setError(
                    "Please enter a valid 10-digit mobile number."
                );

                return;

            }


            setLoading(true);


            try {

                const existing =
                    await checkSinger(mobile);


                if (
                    !existing ||
                    existing.exists !== true
                ) {

                    setError(
                        "No account found for this mobile number."
                    );

                    return;

                }


                const result =
                    await sendOTP(
                        mobile,
                        "reset_pin"
                    );


                if (
                    !result ||
                    result.success !== true
                ) {

                    setError(
                        result?.message ||
                        "Unable to generate OTP."
                    );

                    return;

                }


                // DEVELOPMENT ONLY - Supabase-generated OTP
                if (result.otp) {

                    setGeneratedOtp(
                        String(result.otp)
                    );

                }


                setSuccess(
                    "OTP generated successfully."
                );

                setScreen(
                    "forgot-pin-otp"
                );

            }

            catch (err) {

                console.error(
                    "Reset PIN - send OTP error:",
                    err
                );

                setError(
                    err?.message ||
                    "Unable to generate OTP."
                );

            }

            finally {

                setLoading(false);

            }

        };


    // =====================================================
    // FORGOT PIN - VERIFY OTP
    // =====================================================

    const handleVerifyResetOtp =
        async (event) => {

            event.preventDefault();

            clearMessages();


            if (otp.length !== 6) {

                setError(
                    "Please enter the 6-digit OTP."
                );

                return;

            }


            setLoading(true);


            try {

                const result =
                    await verifyOTP(
                        mobile,
                        otp,
                        "reset_pin"
                    );


                if (
                    result &&
                    result.success === true &&
                    result.verified === true
                ) {

                    setOtp("");
                    setGeneratedOtp("");

                    setSuccess(
                        "OTP verified successfully."
                    );

                    setTimeout(() => {

                        clearMessages();

                        setScreen(
                            "forgot-pin-newpin"
                        );

                    }, 500);

                    return;

                }


                setError(
                    result?.message ||
                    "Invalid OTP."
                );

                setOtp("");

            }

            catch (err) {

                console.error(
                    "Reset PIN - verify OTP error:",
                    err
                );

                setError(
                    err?.message ||
                    "Unable to verify OTP."
                );

            }

            finally {

                setLoading(false);

            }

        };


    // =====================================================
    // FORGOT PIN - RESEND OTP
    // =====================================================

    const handleResendResetOtp = () => {

        setOtp("");

        handleSendResetOtp({ preventDefault: () => {} });

    };


    // =====================================================
    // FORGOT PIN - SET NEW PIN
    // =====================================================

    const handleResetPin =
        async (event) => {

            event.preventDefault();

            clearMessages();


            if (pin.length !== 4) {

                setError(
                    "PIN must contain exactly 4 digits."
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

                const result =
                    await resetPin(
                        mobile,
                        pin
                    );


                if (
                    result &&
                    result.success === true
                ) {

                    setPin("");
                    setConfirmPin("");

                    setSuccess(
                        "PIN reset successfully. Please log in with your new PIN."
                    );

                    setTimeout(() => {

                        clearMessages();

                        setScreen("login");

                    }, 1200);

                    return;

                }


                setError(
                    result?.message ||
                    "Unable to reset PIN."
                );

            }

            catch (err) {

                console.error(
                    "Reset PIN error:",
                    err
                );

                setError(
                    err?.message ||
                    "Unable to reset PIN."
                );

            }

            finally {

                setLoading(false);

            }

        };


    // =====================================================
    // LOGIN SCREEN
    // =====================================================

    const renderLoginScreen = () => {

        return (

            <form
                className="singer-form"
                onSubmit={handleLogin}
            >

                <div className="welcome-icon">
                    🎤
                </div>


                <h1>
                    Beats ∞ Infinity
                </h1>


                <div className="tagline">
                    Unleash the Harmony in You
                </div>


                <h2>
                    Singer Login
                </h2>


                <p className="subtitle">
                    Existing singers can login using their mobile number and 4-digit PIN.
                </p>


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


                <label>
                    4-Digit PIN
                </label>


                <input
                    className="pin-input"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={
                        handlePinChange
                    }
                    placeholder="••••"
                />


                <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                >

                    {loading
                        ? "Logging in..."
                        : "LOGIN"
                    }

                </button>


                <button
                    type="button"
                    className="back-button"
                    onClick={
                        handleStartForgotPin
                    }
                >

                    🔑 Forgot PIN?

                </button>


                <div className="login-note">
                    Don't have an account?
                </div>


                {/* =================================================
                    IMPORTANT BUTTON
                    ================================================= */}

                <button
                    type="button"
                    className="secondary-button"
                    onClick={
                        handleJoinBeatsInfinity
                    }
                    disabled={false}
                    style={{
                        position: "relative",
                        zIndex: 9999,
                        pointerEvents: "auto",
                        cursor: "pointer"
                    }}
                >

                    JOIN BEATS INFINITY

                </button>

            </form>

        );

    };


    // =====================================================
    // REGISTRATION MOBILE
    // =====================================================

    const renderRegistrationMobile = () => {

        return (

            <form
                className="singer-form"
                onSubmit={
                    handleSendRegistrationOtp
                }
            >

                <div className="welcome-icon">
                    🎶
                </div>


                <h2>
                    Join Beats Infinity
                </h2>


                <p className="subtitle">
                    Create your singer account.
                </p>


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


                <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                >

                    {loading
                        ? "Generating OTP..."
                        : "SEND OTP"
                    }

                </button>


                <button
                    type="button"
                    className="back-button"
                    onClick={
                        handleBackToLogin
                    }
                    style={{
                        position: "relative",
                        zIndex: 9999,
                        pointerEvents: "auto"
                    }}
                >

                    ← Back to Login

                </button>

            </form>

        );

    };


    // =====================================================
    // OTP SCREEN
    // =====================================================

    const renderRegistrationOtp = () => {

        return (

            <form
                className="singer-form"
                onSubmit={
                    handleVerifyOtp
                }
            >

                <div className="welcome-icon">
                    🔐
                </div>


                <h2>
                    Verify Mobile Number
                </h2>


                <p className="subtitle">
                    Enter the 6-digit OTP generated for your number.
                </p>


                <div className="mobile-display">
                    📱 +91 {mobile}
                </div>


                <label>
                    6-Digit OTP
                </label>


                <input
                    className="pin-input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={
                        handleOtpChange
                    }
                    placeholder="••••••"
                    autoFocus
                />


                {generatedOtp && (

                    <div
                        style={{
                            marginTop: "15px",
                            padding: "12px",
                            borderRadius: "8px",
                            textAlign: "center",
                            background:
                                "rgba(255,213,74,0.10)",
                            border:
                                "1px solid rgba(255,213,74,0.30)"
                        }}
                    >

                        Development OTP:

                        <strong
                            style={{
                                color: "#FFD54A",
                                marginLeft: "8px",
                                letterSpacing: "3px"
                            }}
                        >

                            {generatedOtp}

                        </strong>

                    </div>

                )}


                <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                >

                    {loading
                        ? "Verifying..."
                        : "VERIFY OTP"
                    }

                </button>


                <button
                    type="button"
                    className="back-button"
                    onClick={() => {

                        clearMessages();

                        setOtp("");

                        setGeneratedOtp("");

                        setScreen(
                            "registration-mobile"
                        );

                    }}
                >

                    ← Back

                </button>

            </form>

        );

    };


    // =====================================================
    // PIN SCREEN
    // =====================================================

    const renderRegistrationPin = () => {

        return (

            <form
                className="singer-form"
                onSubmit={
                    handleCreatePin
                }
            >

                <div className="welcome-icon">
                    🔑
                </div>


                <h2>
                    Create Your PIN
                </h2>


                <p className="subtitle">
                    Create a 4-digit PIN for future login.
                </p>


                <label>
                    Create 4-Digit PIN
                </label>


                <input
                    className="pin-input"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={
                        handlePinChange
                    }
                    placeholder="••••"
                    autoFocus
                />


                <label>
                    Confirm 4-Digit PIN
                </label>


                <input
                    className="pin-input"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={confirmPin}
                    onChange={
                        handleConfirmPinChange
                    }
                    placeholder="••••"
                />


                <button
                    type="submit"
                    className="primary-button"
                >

                    NEXT

                </button>


                <button
                    type="button"
                    className="back-button"
                    onClick={() => {

                        clearMessages();

                        setScreen(
                            "registration-otp"
                        );

                    }}
                >

                    ← Back

                </button>

            </form>

        );

    };


    // =====================================================
    // DETAILS SCREEN
    // =====================================================

    const renderRegistrationDetails = () => {

        return (

            <form
                className="singer-form"
                onSubmit={
                    handleRegistrationDetails
                }
            >

                <div className="welcome-icon">
                    🎤
                </div>


                <h2>
                    Your Profile
                </h2>


                <p className="subtitle">
                    Tell us a little about yourself.
                </p>


                <label>
                    Name
                </label>


                <input
                    type="text"
                    value={name}
                    onChange={(event) => {

                        setName(
                            event.target.value
                        );

                        clearMessages();

                    }}
                    placeholder="Enter your name"
                    autoFocus
                />


                <label>
                    Gender
                </label>


                <select
                    value={gender}
                    onChange={(event) => {

                        setGender(
                            event.target.value
                        );

                        clearMessages();

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


                <button
                    type="submit"
                    className="primary-button"
                >

                    NEXT

                </button>


                <button
                    type="button"
                    className="back-button"
                    onClick={() => {

                        clearMessages();

                        setScreen(
                            "registration-pin"
                        );

                    }}
                >

                    ← Back

                </button>

            </form>

        );

    };


    // =====================================================
    // FORGOT PIN - MOBILE
    // =====================================================

    const renderForgotPinMobile = () => {

        return (

            <form
                className="singer-form"
                onSubmit={
                    handleSendResetOtp
                }
            >

                <div className="welcome-icon">
                    🔑
                </div>


                <h2>
                    Forgot PIN
                </h2>


                <p className="subtitle">
                    Enter your registered mobile number to receive an OTP.
                </p>


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


                <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                >

                    {loading
                        ? "Generating OTP..."
                        : "SEND OTP"
                    }

                </button>


                <button
                    type="button"
                    className="back-button"
                    onClick={
                        handleBackToLogin
                    }
                >

                    ← Back to Login

                </button>

            </form>

        );

    };


    // =====================================================
    // FORGOT PIN - OTP
    // =====================================================

    const renderForgotPinOtp = () => {

        return (

            <form
                className="singer-form"
                onSubmit={
                    handleVerifyResetOtp
                }
            >

                <div className="welcome-icon">
                    🔐
                </div>


                <h2>
                    Verify OTP
                </h2>


                <p className="subtitle">
                    Enter the 6-digit OTP sent for your mobile number.
                </p>


                <div className="mobile-display">
                    📱 +91 {mobile}
                </div>


                <label>
                    6-Digit OTP
                </label>


                <input
                    className="pin-input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={
                        handleOtpChange
                    }
                    placeholder="••••••"
                    autoFocus
                />


                {generatedOtp && (

                    <div
                        style={{
                            marginTop: "15px",
                            padding: "12px",
                            borderRadius: "8px",
                            textAlign: "center",
                            background:
                                "rgba(255,213,74,0.10)",
                            border:
                                "1px solid rgba(255,213,74,0.30)"
                        }}
                    >

                        Development OTP:

                        <strong
                            style={{
                                color: "#FFD54A",
                                marginLeft: "8px",
                                letterSpacing: "3px"
                            }}
                        >

                            {generatedOtp}

                        </strong>

                    </div>

                )}


                <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                >

                    {loading
                        ? "Verifying..."
                        : "VERIFY OTP"
                    }

                </button>


                <button
                    type="button"
                    className="back-button"
                    onClick={
                        handleResendResetOtp
                    }
                    disabled={loading}
                >

                    ↻ Resend OTP

                </button>


                <button
                    type="button"
                    className="back-button"
                    onClick={() => {

                        clearMessages();

                        setOtp("");
                        setGeneratedOtp("");

                        setScreen(
                            "forgot-pin-mobile"
                        );

                    }}
                >

                    ← Back

                </button>

            </form>

        );

    };


    // =====================================================
    // FORGOT PIN - NEW PIN
    // =====================================================

    const renderForgotPinNewPin = () => {

        return (

            <form
                className="singer-form"
                onSubmit={
                    handleResetPin
                }
            >

                <div className="welcome-icon">
                    🔑
                </div>


                <h2>
                    Set New PIN
                </h2>


                <p className="subtitle">
                    Create a new 4-digit PIN for your account.
                </p>


                <label>
                    New 4-Digit PIN
                </label>


                <input
                    className="pin-input"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={
                        handlePinChange
                    }
                    placeholder="••••"
                    autoFocus
                />


                <label>
                    Confirm New PIN
                </label>


                <input
                    className="pin-input"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={confirmPin}
                    onChange={
                        handleConfirmPinChange
                    }
                    placeholder="••••"
                />


                <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                >

                    {loading
                        ? "Resetting..."
                        : "RESET PIN"
                    }

                </button>


                <button
                    type="button"
                    className="back-button"
                    onClick={
                        handleBackToLogin
                    }
                >

                    ← Back to Login

                </button>

            </form>

        );

    };


    // =====================================================
    // PAGE
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

                {/* HOME BUTTON */}

                <Link to="/" className="singer-home-button">
                    🏠 Home
                </Link>


                {/* BRAND */}

                <Link to="/" className="brand-top">

                    <img
                        src={logo}
                        alt="Beats Infinity"
                        className="brand-infinity"
                    />


                    <div>

                        <div className="brand-name">
                            BEATS ∞ INFINITY
                        </div>


                        <div className="brand-tagline">
                            UNLEASH THE HARMONY IN YOU
                        </div>

                    </div>

                </Link>


                {/* ERROR */}

                {error && (

                    <div className="message error-message">

                        ⚠️ {error}

                    </div>

                )}


                {/* SUCCESS */}

                {success && (

                    <div className="message success-message">

                        ✅ {success}

                    </div>

                )}


                {/* LOGIN */}

                {screen === "login" &&
                    renderLoginScreen()
                }


                {/* REGISTRATION MOBILE */}

                {screen === "registration-mobile" &&
                    renderRegistrationMobile()
                }


                {/* REGISTRATION OTP */}

                {screen === "registration-otp" &&
                    renderRegistrationOtp()
                }


                {/* REGISTRATION PIN */}

                {screen === "registration-pin" &&
                    renderRegistrationPin()
                }


                {/* REGISTRATION DETAILS */}

                {screen === "registration-details" &&
                    renderRegistrationDetails()
                }


                {/* FORGOT PIN - MOBILE */}

                {screen === "forgot-pin-mobile" &&
                    renderForgotPinMobile()
                }


                {/* FORGOT PIN - OTP */}

                {screen === "forgot-pin-otp" &&
                    renderForgotPinOtp()
                }


                {/* FORGOT PIN - NEW PIN */}

                {screen === "forgot-pin-newpin" &&
                    renderForgotPinNewPin()
                }


                <div className="footer-text">

                    Beats Infinity • Singer Portal

                </div>

            </div>

        </div>

    );

};


export default SingerLogin;