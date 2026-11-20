// ==========================================================
// BEATS INFINITY - PASSKEY (FINGERPRINT / FACE ID) SERVICE
// ==========================================================
//
// Wraps the browser's WebAuthn API (via @simplewebauthn/browser)
// and the /api/v1/singers/passkeys/* endpoints.
//
// localStorage "beatsInfinityPasskey" remembers that THIS device
// has biometric login enabled, so the login screen knows when to
// show the "Login with Fingerprint / Face ID" button.
// ==========================================================

import {
    startRegistration,
    startAuthentication,
    browserSupportsWebAuthn,
    platformAuthenticatorIsAvailable
} from "@simplewebauthn/browser";

import { API_V1_URL } from "../config/api";

const PASSKEYS_URL = `${API_V1_URL}/singers/passkeys`;

const DEVICE_FLAG_KEY = "beatsInfinityPasskey";
const PROMPT_DISMISSED_KEY = "beatsInfinityPasskeyPromptDismissed";


const post = async (path, body) => {

    const response = await fetch(`${PASSKEYS_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
        throw new Error(data.message || "Something went wrong.");
    }

    return data;

};


// The phone's own "cancel" shows up as NotAllowedError - not
// worth an error message, the singer chose to back out.
export const isUserCancel = (error) =>
    error?.name === "NotAllowedError" ||
    error?.name === "AbortError";


// ----------------------------------------------------------
// DEVICE SUPPORT
// ----------------------------------------------------------

// Returns { supported, code }.
//
// supported - the browser has the WebAuthn (passkey) API at all.
//             The phone's own Face ID / fingerprint prompt has the
//             final say, so the button is usable whenever this is
//             true.
// code      - what the platform-authenticator check said, shown
//             on the login page to diagnose "not available":
//               ok          platform authenticator available
//               no-webauthn browser has no passkey API (in-app
//                           browsers, very old browsers)
//               no-platform browser says no Face ID / fingerprint
//               timeout     browser never answered (3s)
//               error       the check threw
export const checkPasskeySupport = async () => {

    if (!browserSupportsWebAuthn()) {
        return { supported: false, code: "no-webauthn" };
    }

    // Some browsers never answer platformAuthenticatorIsAvailable();
    // treat no answer within 3 seconds as "timeout".
    const timeout = new Promise((resolve) => {
        setTimeout(() => resolve("timeout"), 3000);
    });

    try {

        const answer = await Promise.race([
            platformAuthenticatorIsAvailable(),
            timeout
        ]);

        if (answer === "timeout") {
            return { supported: true, code: "timeout" };
        }

        return { supported: true, code: answer ? "ok" : "no-platform" };

    } catch {

        return { supported: true, code: "error" };

    }

};

export const isPasskeySupported = async () =>
    (await checkPasskeySupport()).supported;



// ----------------------------------------------------------
// LOCAL "ENABLED ON THIS DEVICE" FLAG
// ----------------------------------------------------------

export const getDevicePasskey = () => {

    try {
        return JSON.parse(localStorage.getItem(DEVICE_FLAG_KEY) || "null");
    } catch {
        return null;
    }

};

const setDevicePasskey = (value) => {

    if (value) {
        localStorage.setItem(DEVICE_FLAG_KEY, JSON.stringify(value));
    } else {
        localStorage.removeItem(DEVICE_FLAG_KEY);
    }

};

export const clearDevicePasskey = () => setDevicePasskey(null);


// ----------------------------------------------------------
// "NOT NOW" ON THE ENABLE PROMPT - remembered per mobile so
// the singer isn't asked again on every login.
// ----------------------------------------------------------

export const wasPromptDismissed = (mobile) => {

    try {
        const list = JSON.parse(localStorage.getItem(PROMPT_DISMISSED_KEY) || "[]");
        return list.includes(mobile);
    } catch {
        return false;
    }

};

export const dismissPrompt = (mobile) => {

    try {
        const list = JSON.parse(localStorage.getItem(PROMPT_DISMISSED_KEY) || "[]");
        if (!list.includes(mobile)) list.push(mobile);
        localStorage.setItem(PROMPT_DISMISSED_KEY, JSON.stringify(list));
    } catch {
        localStorage.setItem(PROMPT_DISMISSED_KEY, JSON.stringify([mobile]));
    }

};


// ----------------------------------------------------------
// OPTIONS ARE FETCHED AHEAD OF THE TAP
//
// Safari only opens the Face ID / Touch ID sheet if it starts
// straight from a tap - a network request in between can make
// it refuse. So the screen fetches options first (prepare*),
// then the tap goes straight to the phone's prompt.
// Challenges expire on the server after 5 minutes; anything
// older than 4 is re-fetched.
// ----------------------------------------------------------

const OPTIONS_MAX_AGE_MS = 4 * 60 * 1000;

const isFresh = (prepared) =>
    Boolean(prepared && Date.now() - prepared.fetchedAt < OPTIONS_MAX_AGE_MS);


// ----------------------------------------------------------
// ENABLE ON THIS DEVICE (needs the PIN just used to log in)
// ----------------------------------------------------------

export const prepareEnable = async ({ mobile, pin }) => {

    const { options } = await post("/register/options", { mobile, pin });

    return { options, fetchedAt: Date.now() };

};

export const enablePasskey = async ({ mobile, pin, singerName, prepared }) => {

    const { options } = isFresh(prepared)
        ? prepared
        : await prepareEnable({ mobile, pin });

    const response = await startRegistration({ optionsJSON: options });

    await post("/register/verify", {
        mobile,
        response,
        deviceLabel: navigator.userAgent
    });

    setDevicePasskey({ mobile, name: singerName || "" });

};


// ----------------------------------------------------------
// LOGIN - returns { success, singer } like PIN login
// ----------------------------------------------------------

export const prepareLogin = async () => {

    const { options } = await post("/login/options");

    return { options, fetchedAt: Date.now() };

};

export const loginWithPasskey = async (prepared) => {

    const { options } = isFresh(prepared)
        ? prepared
        : await prepareLogin();

    const response = await startAuthentication({ optionsJSON: options });

    return post("/login/verify", { response });

};
