// ==========================================================
// BEATS INFINITY - CONFIRM DATE OF BIRTH (one-time prompt)
// ==========================================================
//
// Singers imported on 2026-09-10 have the placeholder date
// 2000-01-01. Forgot PIN checks the date of birth, so until a
// real date is saved anyone could reset their PIN with just
// the mobile number.
//
// Shown on the singer dashboard until they confirm. Needs the
// PIN so nobody else can set it. "Later" hides it until the
// next visit (session only).
//
// Uses the OTP popup styles from SingerLogin.css; rendered
// into <body> so it covers the whole screen.
// ==========================================================

import { useState } from "react";
import { createPortal } from "react-dom";

import PasswordToggleInput from "../../common/PasswordToggleInput";
import DobSelect from "../../common/DobSelect";
import { confirmDob } from "../../../services/singerService";

import "../../../pages/SingerLogin.css";
import "./DobPrompt.css";

const PLACEHOLDER_DOB = "2000-01-01";
const LATER_KEY = "beatsInfinityDobLater";

const readSinger = () => {
    try {
        return JSON.parse(localStorage.getItem("beatsInfinitySinger") || "null");
    } catch {
        return null;
    }
};

const needsPrompt = () => {
    const singer = readSinger();
    return Boolean(
        singer?.id &&
        String(singer.date_of_birth || "").slice(0, 10) === PLACEHOLDER_DOB &&
        sessionStorage.getItem(LATER_KEY) !== singer.id
    );
};


function DobPrompt() {

    const [open, setOpen] = useState(needsPrompt);
    const [dob, setDob] = useState("");
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    if (!open) {
        return null;
    }

    const singer = readSinger();

    const handleLater = () => {
        sessionStorage.setItem(LATER_KEY, singer?.id || "");
        setOpen(false);
    };

    const handleSave = async (event) => {

        event.preventDefault();
        setError("");

        if (!dob) {
            setError("Please enter your date of birth.");
            return;
        }

        if (!/^\d{4}$/.test(pin)) {
            setError("Please enter your 4-digit PIN.");
            return;
        }

        setSaving(true);

        try {

            const result = await confirmDob(singer.id, pin, dob);

            localStorage.setItem(
                "beatsInfinitySinger",
                JSON.stringify({ ...singer, ...result.singer })
            );

            setOpen(false);

        }
        catch (err) {
            setError(err.message || "Unable to save your date of birth.");
        }
        finally {
            setSaving(false);
        }

    };

    return createPortal(

        <div
            className="otp-popup-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dob-prompt-title"
        >

            <form className="otp-popup singer-form dob-prompt" onSubmit={handleSave}>

                <div className="otp-popup-icon">🎂</div>

                <h3 id="dob-prompt-title">Please confirm your date of birth</h3>

                <p className="otp-popup-note">
                    We use it to keep your account safe - it's asked when
                    you reset a forgotten PIN. You only need to do this once.
                </p>

                <label htmlFor="dob-prompt-day">Date of Birth</label>

                <DobSelect
                    idPrefix="dob-prompt"
                    value={dob}
                    onChange={setDob}
                    disabled={saving}
                />

                <label htmlFor="dob-prompt-pin">Your 4-digit PIN</label>

                <PasswordToggleInput
                    id="dob-prompt-pin"
                    className="pin-input"
                    visibleType="tel"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    disabled={saving}
                />

                {error && <div className="error-message">{error}</div>}

                <button type="submit" className="primary-button" disabled={saving}>
                    {saving ? "Saving..." : "SAVE"}
                </button>

                <button
                    type="button"
                    className="back-button"
                    onClick={handleLater}
                    disabled={saving}
                >
                    Later
                </button>

            </form>

        </div>,

        document.body

    );

}

export default DobPrompt;
