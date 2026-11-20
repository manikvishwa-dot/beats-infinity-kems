// ==========================================================
// BEATS INFINITY - OTP POPUP
// ==========================================================
//
// Shows a freshly generated OTP in a popup instead of inline,
// with the next step (create a 4-digit PIN). "USE THIS OTP"
// fills the code in and closes the popup.
//
// Used by SingerRegistration (Join Beats Infinity) and
// SingerLogin (Forgot PIN). Styles live in SingerLogin.css.
//
// Rendered into <body> through a portal: the login card uses
// backdrop-filter, which traps position:fixed children inside
// the card - on a laptop the popup would be squeezed into the
// card instead of covering the screen.
// ==========================================================

import { createPortal } from "react-dom";

import "../../pages/SingerLogin.css";

const TEXT = {

    registration: {
        title: "Your OTP for User Creation",
        note: "After verifying, please create a 4-digit numeric PIN for further logins."
    },

    reset: {
        title: "Your OTP for PIN Reset",
        note: "After verifying, please create a new 4-digit numeric PIN for further logins."
    }

};


function OtpPopup({ otp, purpose = "registration", onUse }) {

    const text = TEXT[purpose] || TEXT.registration;

    return createPortal(

        <div
            className="otp-popup-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="otp-popup-title"
        >

            <div className="otp-popup">

                <div className="otp-popup-icon">
                    🔐
                </div>

                <h3 id="otp-popup-title">
                    {text.title}
                </h3>

                <div className="otp-popup-code">
                    {otp}
                </div>

                <p className="otp-popup-note">
                    {text.note}
                </p>

                <p className="otp-popup-expiry">
                    Valid for 5 minutes.
                </p>

                <button
                    type="button"
                    className="primary-button"
                    autoFocus
                    onClick={onUse}
                >

                    USE THIS OTP

                </button>

            </div>

        </div>,

        document.body

    );

}


export default OtpPopup;
