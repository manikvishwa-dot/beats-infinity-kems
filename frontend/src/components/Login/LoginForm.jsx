import "./Login.css";

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
    checkSinger,
    loginWithPin
} from "../../services/singerService";

import {
    clearDevicePasskey,
    dismissPrompt,
    enablePasskey,
    getDevicePasskey,
    checkPasskeySupport,
    isPasskeySupported,
    isUserCancel,
    loginWithPasskey,
    prepareEnable,
    prepareLogin,
    wasPromptDismissed
} from "../../services/passkeyService";

import toast from "react-hot-toast";

import {
    FaMobileAlt,
    FaLock,
    FaFingerprint
} from "react-icons/fa";

import PasswordToggleInput from "../common/PasswordToggleInput";

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
    // FINGERPRINT / FACE ID
    // ==========================================================

    // Device has biometric login enabled AND the phone supports it
    const [devicePasskey, setDevicePasskey] = useState(null);

    // PIN login succeeded; waiting on the "Enable?" prompt
    const [pendingLogin, setPendingLogin] = useState(null);

    const [passkeyBusy, setPasskeyBusy] = useState(false);

    // null = still checking, true / false = can this device do it
    const [passkeySupport, setPasskeySupport] = useState(null);

    // Diagnostic code from the support check (see passkeyService)
    const [passkeyCode, setPasskeyCode] = useState("");

    // Login options fetched ahead of the tap (see passkeyService)
    const preparedLoginRef = useRef(null);

    const prefetchLoginOptions = () => {

        prepareLogin()
            .then((prepared) => {
                preparedLoginRef.current = prepared;
            })
            .catch(() => {
                preparedLoginRef.current = null;
            });

    };

    useEffect(() => {

        let cancelled = false;

        checkPasskeySupport().then(({ supported, code }) => {

            if (cancelled) {
                return;
            }

            setPasskeySupport(supported);

            setPasskeyCode(code);

            const flag = getDevicePasskey();

            if (supported && flag) {
                setDevicePasskey(flag);
                prefetchLoginOptions();
            }

        });

        return () => {
            cancelled = true;
        };

    }, []);


    // ==========================================================
    // SAVE LOGIN + GO TO DASHBOARD
    //
    // Shared by PIN login and Fingerprint / Face ID login - both
    // return the same { success, singer } response.
    // ==========================================================

    const completeLogin = (loginResult) => {

        localStorage.setItem(
            "beatsInfinityLogin",
            JSON.stringify(loginResult)
        );

        const singer = loginResult.singer;

        if (singer) {

            localStorage.setItem(
                "beatsInfinitySinger",
                JSON.stringify(singer)
            );

        }

        const singerId =
            singer?.id ||
            singer?.singer_id ||
            loginResult?.singer_id ||
            loginResult?.id;

        if (singerId) {

            localStorage.setItem(
                "beatsInfinitySingerId",
                String(singerId)
            );

        }

        navigate(
            "/singer-dashboard",
            { replace: true }
        );

    };


    // ==========================================================
    // LOGIN WITH FINGERPRINT / FACE ID
    // ==========================================================

    const handlePasskeyLogin = async () => {

        setError("");
        setSuccess("");
        setPasskeyBusy(true);

        try {

            const prepared = preparedLoginRef.current;

            // Each challenge is single-use
            preparedLoginRef.current = null;

            const loginResult = await loginWithPasskey(prepared);

            setSuccess("Login successful.");

            completeLogin(loginResult);

        }
        catch (err) {

            if (isUserCancel(err)) {
                return;
            }

            // Passkey removed on the server - stop offering it here
            if (/removed/i.test(err?.message || "")) {
                clearDevicePasskey();
                setDevicePasskey(null);
            }

            setError(
                err?.message ||
                "Quick Login failed. Please use your PIN."
            );

        }
        finally {

            setPasskeyBusy(false);

            // Ready for another attempt
            if (!preparedLoginRef.current) {
                prefetchLoginOptions();
            }

        }

    };


    // ==========================================================
    // ENABLE PROMPT - YES / NOT NOW
    // ==========================================================

    const handleEnablePasskey = async () => {

        if (!pendingLogin) {
            return;
        }

        setPasskeyBusy(true);

        try {

            await enablePasskey({
                mobile: pendingLogin.mobile,
                pin: pendingLogin.pin,
                singerName: pendingLogin.result.singer?.singer_name,
                prepared: pendingLogin.prepared
            });

            toast.success("Quick Login enabled on this phone.");

        }
        catch (err) {

            if (isUserCancel(err)) {

                // Cancelled the phone's prompt = "Not now"
                dismissPrompt(pendingLogin.mobile);

            }
            else {

                toast.error(
                    err?.message ||
                    "Couldn't enable Quick Login. You can keep using your PIN."
                );
            }

        }
        finally {

            setPasskeyBusy(false);

            completeLogin(pendingLogin.result);

        }

    };

    const handleSkipPasskey = () => {

        if (!pendingLogin) {
            return;
        }

        dismissPrompt(pendingLogin.mobile);

        completeLogin(pendingLogin.result);

    };


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
    // FINGERPRINT / FACE ID BUTTON
    //
    // Set up on this device  -> log in with it.
    // Not set up yet         -> PIN login, then the enable prompt.
    // ==========================================================

    const handleFingerprintButton = () => {

        setError("");
        setSuccess("");

        if (devicePasskey) {

            handlePasskeyLogin();

            return;

        }

        if (mobile.length !== 10 || pin.length !== 4) {

            setError(
                "To set up Quick Login on this device, enter your mobile number and PIN, then tap Quick Login."
            );

            return;

        }

        handleLogin(null, { forcePasskeySetup: true });

    };


    // ==========================================================
    // LOGIN
    // ==========================================================

    // options.forcePasskeySetup - from the fingerprint button on a
    // device where it isn't set up yet: after the PIN login, always
    // offer setup, even if "Not now" was tapped before.
    const handleLogin = async (event, options = {}) => {

        event?.preventDefault();

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
                // OFFER FINGERPRINT / FACE ID ON THIS DEVICE
                //
                // Only once per mobile (unless enabled), and only
                // if the phone actually supports it.
                // ------------------------------------------------

                const deviceFlag = getDevicePasskey();

                const shouldOffer =
                    options.forcePasskeySetup ||
                    (
                        deviceFlag?.mobile !== mobile &&
                        !wasPromptDismissed(mobile)
                    );

                if (
                    shouldOffer &&
                    await isPasskeySupported()
                ) {

                    // Fetch setup options now so the tap on
                    // "Yes, enable" opens the phone's prompt
                    // directly (needed on iPhone / Safari).
                    let prepared = null;

                    try {
                        prepared = await prepareEnable({ mobile, pin });
                    } catch {
                        prepared = null;
                    }

                    setPendingLogin({
                        result: loginResult,
                        mobile,
                        pin,
                        prepared
                    });

                    return;

                }


                completeLogin(loginResult);

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

                            <PasswordToggleInput
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
                        LOGIN WITH FINGERPRINT / FACE ID
                        Only on devices where it was enabled.
                    ================================================== */}

                    {passkeySupport !== null && (

                        <div className="passkey-login">

                            <button
                                type="button"
                                className="passkey-login-btn"
                                onClick={handleFingerprintButton}
                                disabled={
                                    !passkeySupport ||
                                    passkeyBusy ||
                                    loading
                                }
                            >

                                <FaFingerprint />

                                {passkeyBusy
                                    ? "Waiting for your phone..."
                                    : devicePasskey?.name
                                        ? `Quick Login as ${devicePasskey.name}`
                                        : "Quick Login"
                                }

                            </button>

                            {!passkeySupport && (

                                <p className="passkey-login-hint">
                                    Not available on this device or browser.
                                    Please log in with your PIN.
                                    <span className="passkey-login-code">
                                        ({passkeyCode})
                                    </span>
                                </p>

                            )}

                            {passkeySupport && !devicePasskey && (

                                <p className="passkey-login-hint">
                                    First time on this device? Enter your mobile
                                    number and PIN, then tap the button above to
                                    set it up.
                                    {passkeyCode && passkeyCode !== "ok" && (
                                        <span className="passkey-login-code">
                                            ({passkeyCode})
                                        </span>
                                    )}
                                </p>

                            )}

                        </div>

                    )}


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


                    <Link
                        to="/admin/login"
                        className="admin-login-link"
                    >
                        Admin / Super Admin Login
                    </Link>


                </div>

            </div>


            {/* ==================================================
                ENABLE FINGERPRINT / FACE ID PROMPT
                Shown once after a PIN login on a supported phone.
            ================================================== */}

            {pendingLogin && (

                <div
                    className="passkey-prompt-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="passkey-prompt-title"
                >

                    <div className="passkey-prompt">

                        <div className="passkey-prompt-icon">
                            <FaFingerprint />
                        </div>

                        <h3 id="passkey-prompt-title">
                            Enable Quick Login?
                        </h3>

                        <p>
                            Next time, log in with one tap using your phone's
                            fingerprint, face, or screen lock (pattern / PIN).
                            Your 4-digit PIN will still work.
                        </p>

                        <button
                            type="button"
                            className="login-btn"
                            onClick={handleEnablePasskey}
                            disabled={passkeyBusy}
                            autoFocus
                        >

                            {passkeyBusy
                                ? "Setting up..."
                                : "YES, ENABLE"
                            }

                        </button>

                        <button
                            type="button"
                            className="passkey-prompt-skip"
                            onClick={handleSkipPasskey}
                            disabled={passkeyBusy}
                        >

                            Not now

                        </button>

                    </div>

                </div>

            )}

        </section>

    );

}


export default LoginForm;