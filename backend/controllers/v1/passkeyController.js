const { supabase } = require("../../config/supabase");
const bcrypt = require("bcryptjs");
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} = require("@simplewebauthn/server");

// ==========================================================
// BEATS INFINITY - PASSKEY (FINGERPRINT / FACE ID) CONTROLLER
// ==========================================================
//
// FLOW:
//
// ENABLE ON THIS DEVICE (right after a successful PIN login)
//
//   POST /passkeys/register/options  { mobile, pin }
//     -> PIN re-checked, returns options for the phone
//   phone asks for fingerprint / face, creates a key pair
//   POST /passkeys/register/verify   { mobile, response }
//     -> public key saved in public.singer_passkeys
//
// LOGIN
//
//   POST /passkeys/login/options     {}
//   phone asks for fingerprint / face, signs the challenge
//   POST /passkeys/login/verify      { response }
//     -> returns { success, singer } - same shape as PIN login
//
// The biometric itself never leaves the phone; the server only
// ever sees a signature it checks against the saved public key.
//
// CONFIG (env, optional):
//   WEBAUTHN_ORIGINS - comma-separated frontend origins allowed
//                      to use passkeys. Defaults below.
//   WEBAUTHN_RP_NAME - name shown in the phone's prompt.
// ==========================================================

const DEFAULT_ORIGINS = [
    "https://beatsinfinity.online",
    "https://www.beatsinfinity.online",
    "http://localhost:5173"
];

const ALLOWED_ORIGINS = (
    process.env.WEBAUTHN_ORIGINS
        ? process.env.WEBAUTHN_ORIGINS.split(",")
        : DEFAULT_ORIGINS
)
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

const RP_NAME =
    process.env.WEBAUTHN_RP_NAME || "Beats Infinity";

// Challenges live for 5 minutes. In memory is enough: the
// backend runs as a single instance and the options -> verify
// round trip takes seconds.
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const registrationChallenges = new Map(); // singerId -> { challenge, expiresAt }
const loginChallenges = new Map();        // challenge -> expiresAt


// ==========================================================
// HELPERS
// ==========================================================

const normalizeMobile = (mobile) =>
    String(mobile || "").replace(/\D/g, "").slice(-10);

const pruneExpired = () => {

    const now = Date.now();

    for (const [key, value] of registrationChallenges) {
        if (value.expiresAt < now) registrationChallenges.delete(key);
    }

    for (const [key, expiresAt] of loginChallenges) {
        if (expiresAt < now) loginChallenges.delete(key);
    }

};

// Origin must be one of ALLOWED_ORIGINS. The RP ID is that
// origin's hostname without "www.", so a passkey created on
// www.beatsinfinity.online also works on beatsinfinity.online.
const resolveRelyingParty = (req) => {

    const origin =
        String(req.get("origin") || "").replace(/\/$/, "");

    if (!ALLOWED_ORIGINS.includes(origin)) {
        return null;
    }

    const rpID =
        new URL(origin).hostname.replace(/^www\./, "");

    return { origin, rpID };

};

const toBase64Url = (bytes) =>
    Buffer.from(bytes).toString("base64url");

const fromBase64Url = (text) =>
    new Uint8Array(Buffer.from(text, "base64url"));

const findSingerByMobile = async (mobile) => {

    const { data, error } = await supabase
        .from("singers")
        .select("*")
        .eq("mobile_number", mobile)
        .maybeSingle();

    if (error) throw error;

    return data;

};

const fail = (res, status, message) =>
    res.status(status).json({ success: false, message });


// ==========================================================
// REGISTER - OPTIONS
//
// POST /api/v1/singers/passkeys/register/options
// BODY: { mobile, pin }
// ==========================================================

const getRegistrationOptions = async (req, res) => {

    try {

        const rp = resolveRelyingParty(req);

        if (!rp) {
            return fail(res, 400, "Quick Login isn't available on this site address.");
        }

        const mobile = normalizeMobile(req.body.mobile);
        const pin = String(req.body.pin || "");

        if (!/^\d{10}$/.test(mobile) || !/^\d{4}$/.test(pin)) {
            return fail(res, 400, "Mobile number and 4-digit PIN are required.");
        }

        const singer = await findSingerByMobile(mobile);

        if (!singer || !(await bcrypt.compare(pin, singer.pin_hash))) {
            return fail(res, 401, "Invalid mobile number or PIN.");
        }

        const { data: existing, error: existingError } = await supabase
            .from("singer_passkeys")
            .select("credential_id,transports")
            .eq("singer_id", singer.id);

        if (existingError) throw existingError;

        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: rp.rpID,
            userID: new Uint8Array(Buffer.from(singer.id)),
            userName: mobile,
            userDisplayName: singer.singer_name || mobile,
            attestationType: "none",
            excludeCredentials: (existing || []).map((row) => ({
                id: row.credential_id,
                transports: row.transports || undefined
            })),
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                residentKey: "required",
                userVerification: "required"
            }
        });

        pruneExpired();

        registrationChallenges.set(singer.id, {
            challenge: options.challenge,
            expiresAt: Date.now() + CHALLENGE_TTL_MS
        });

        return res.status(200).json({ success: true, options });

    }
    catch (error) {

        console.error("❌ Passkey register options error:", error);

        return fail(res, 500, "Unable to start Quick Login setup.");

    }

};


// ==========================================================
// REGISTER - VERIFY
//
// POST /api/v1/singers/passkeys/register/verify
// BODY: { mobile, response, deviceLabel? }
//
// No PIN here: a valid challenge only exists for this singer
// if the PIN was checked in /register/options moments ago.
// ==========================================================

const verifyRegistration = async (req, res) => {

    try {

        const rp = resolveRelyingParty(req);

        if (!rp) {
            return fail(res, 400, "Quick Login isn't available on this site address.");
        }

        const mobile = normalizeMobile(req.body.mobile);
        const singer = await findSingerByMobile(mobile);

        if (!singer) {
            return fail(res, 404, "Singer not found.");
        }

        const pending = registrationChallenges.get(singer.id);
        registrationChallenges.delete(singer.id);

        if (!pending || pending.expiresAt < Date.now()) {
            return fail(res, 400, "Setup timed out. Please try again.");
        }

        const verification = await verifyRegistrationResponse({
            response: req.body.response,
            expectedChallenge: pending.challenge,
            expectedOrigin: rp.origin,
            expectedRPID: rp.rpID,
            requireUserVerification: true
        });

        if (!verification.verified || !verification.registrationInfo) {
            return fail(res, 400, "Quick Login could not be verified.");
        }

        const { credential } = verification.registrationInfo;

        const { error: insertError } = await supabase
            .from("singer_passkeys")
            .insert({
                singer_id: singer.id,
                credential_id: credential.id,
                public_key: toBase64Url(credential.publicKey),
                counter: credential.counter,
                transports: credential.transports || null,
                device_label: String(req.body.deviceLabel || "").slice(0, 120) || null
            });

        if (insertError) throw insertError;

        console.log("✅ Passkey enabled for singer:", singer.singer_name);

        return res.status(200).json({
            success: true,
            message: "Quick Login enabled."
        });

    }
    catch (error) {

        console.error("❌ Passkey register verify error:", error);

        return fail(res, 500, "Unable to enable Quick Login.");

    }

};


// ==========================================================
// LOGIN - OPTIONS
//
// POST /api/v1/singers/passkeys/login/options
// ==========================================================

const getLoginOptions = async (req, res) => {

    try {

        const rp = resolveRelyingParty(req);

        if (!rp) {
            return fail(res, 400, "Quick Login isn't available on this site address.");
        }

        // No allowCredentials: the phone offers whichever Beats
        // Infinity passkey it holds, so no mobile number is typed.
        const options = await generateAuthenticationOptions({
            rpID: rp.rpID,
            userVerification: "required"
        });

        pruneExpired();

        loginChallenges.set(
            options.challenge,
            Date.now() + CHALLENGE_TTL_MS
        );

        return res.status(200).json({ success: true, options });

    }
    catch (error) {

        console.error("❌ Passkey login options error:", error);

        return fail(res, 500, "Unable to start Quick Login.");

    }

};


// ==========================================================
// LOGIN - VERIFY
//
// POST /api/v1/singers/passkeys/login/verify
// BODY: { response }
// RETURNS: { success, message, singer } - same as PIN login
// ==========================================================

const verifyLogin = async (req, res) => {

    try {

        const rp = resolveRelyingParty(req);

        if (!rp) {
            return fail(res, 400, "Quick Login isn't available on this site address.");
        }

        const response = req.body.response;

        if (!response || !response.id) {
            return fail(res, 400, "Missing Quick Login response.");
        }

        const { data: passkey, error: passkeyError } = await supabase
            .from("singer_passkeys")
            .select("*")
            .eq("credential_id", response.id)
            .maybeSingle();

        if (passkeyError) throw passkeyError;

        if (!passkey) {
            return fail(res, 404, "Quick Login on this device was removed. Please log in with your PIN.");
        }

        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: (challenge) => {

                const expiresAt = loginChallenges.get(challenge);
                loginChallenges.delete(challenge);

                return Boolean(expiresAt && expiresAt >= Date.now());

            },
            expectedOrigin: rp.origin,
            expectedRPID: rp.rpID,
            requireUserVerification: true,
            credential: {
                id: passkey.credential_id,
                publicKey: fromBase64Url(passkey.public_key),
                counter: Number(passkey.counter) || 0,
                transports: passkey.transports || undefined
            }
        });

        if (!verification.verified) {
            return fail(res, 401, "Quick Login could not be verified.");
        }

        await supabase
            .from("singer_passkeys")
            .update({
                counter: verification.authenticationInfo.newCounter,
                last_used_at: new Date().toISOString()
            })
            .eq("id", passkey.id);

        const { data: singer, error: singerError } = await supabase
            .from("singers")
            .select("*")
            .eq("id", passkey.singer_id)
            .maybeSingle();

        if (singerError) throw singerError;

        if (!singer) {
            return fail(res, 404, "Singer not found.");
        }

        delete singer.pin_hash;

        console.log("✅ Singer passkey login successful:", singer.singer_name);

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            singer
        });

    }
    catch (error) {

        console.error("❌ Passkey login verify error:", error);

        return fail(res, 401, "Quick Login failed. Please use your PIN.");

    }

};


module.exports = {
    getRegistrationOptions,
    verifyRegistration,
    getLoginOptions,
    verifyLogin
};
