// ==========================================================
// BEATS INFINITY - SINGER API SERVICE
// ==========================================================

import { API_V1_URL } from "../config/api";

const API_BASE_URL =
    `${API_V1_URL}/singers`;


// ==========================================================
// COMMON RESPONSE HANDLER
// ==========================================================

const handleResponse = async (response) => {

    let data = {};

    try {

        data = await response.json();

    } catch (error) {

        data = {};

    }


    if (!response.ok) {

        const message =
            data?.message ||
            data?.error ||
            "Something went wrong.";

        throw new Error(message);

    }


    return data;

};


// ==========================================================
// CHECK SINGER BY MOBILE
//
// GET /api/v1/singers/check?mobile=9876543210
// ==========================================================

const checkSinger = async (mobile) => {

    const response = await fetch(

        `${API_BASE_URL}/check?mobile=${encodeURIComponent(mobile)}`,

        {

            method: "GET",

            headers: {

                "Content-Type":
                    "application/json"

            }

        }

    );


    return handleResponse(response);

};


// ==========================================================
// SEND OTP
//
// POST /api/v1/singers/send-otp
//
// Body:
// {
//     mobile: "9999999999",
//     purpose: "registration"
// }
// ==========================================================

const sendOTP = async (
    mobile,
    purpose = "registration"
) => {

    const response = await fetch(

        `${API_BASE_URL}/send-otp`,

        {

            method: "POST",

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify({

                mobile,

                purpose

            })

        }

    );


    return handleResponse(response);

};


// ==========================================================
// VERIFY OTP
//
// POST /api/v1/singers/verify-otp
//
// Body:
// {
//     mobile: "9999999999",
//     otp: "123456",
//     purpose: "registration"
// }
// ==========================================================

const verifyOTP = async (

    mobile,

    otp,

    purpose = "registration"

) => {

    const response = await fetch(

        `${API_BASE_URL}/verify-otp`,

        {

            method: "POST",

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify({

                mobile,

                otp,

                purpose

            })

        }

    );


    return handleResponse(response);

};


// ==========================================================
// REGISTER SINGER
//
// POST /api/v1/singers
// ==========================================================

const registerSinger = async (
    singerData
) => {

    const response = await fetch(

        API_BASE_URL,

        {

            method: "POST",

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify({

                mobile:
                    singerData.mobile,

                singer_name:
                    singerData.singer_name,

                gender:
                    singerData.gender,

                date_of_birth:
                    singerData.date_of_birth,

                pin:
                    singerData.pin

            })

        }

    );


    return handleResponse(response);

};


// ==========================================================
// LOGIN WITH PIN
//
// POST /api/v1/singers/login
// ==========================================================

const loginWithPin = async (

    mobile,

    pin

) => {

    const response = await fetch(

        `${API_BASE_URL}/login`,

        {

            method: "POST",

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify({

                mobile,

                pin

            })

        }

    );


    return handleResponse(response);

};


// ==========================================================
// RESET PIN
//
// POST /api/v1/singers/reset-pin
//
// Requires a verified "reset_pin" purpose OTP for this mobile
// (see verifyOTP above) - the backend checks singer_otps for
// that, not date_of_birth.
// ==========================================================

const resetPin = async (

    mobile,

    new_pin

) => {

    const response = await fetch(

        `${API_BASE_URL}/reset-pin`,

        {

            method: "POST",

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify({

                mobile,

                new_pin

            })

        }

    );


    return handleResponse(response);

};


// ==========================================================
// LOGOUT
//
// Purely local - there's no server-side singer session to
// revoke (unlike the admin Bearer-token session). Also clears
// any in-progress song selection so a different singer on the
// same device never sees a leftover pending selection.
// ==========================================================

const logout = () => {

    localStorage.removeItem("beatsInfinitySinger");
    sessionStorage.removeItem("beatsInfinityPendingSongSelection");

};


// ==========================================================
// UPDATE PROFILE
//
// PUT /api/v1/singers/:id
// ==========================================================

const updateSingerProfile = async (

    singerId,

    profileData

) => {

    const response = await fetch(

        `${API_BASE_URL}/${singerId}`,

        {

            method: "PUT",

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify(
                profileData
            )

        }

    );


    return handleResponse(response);

};


// ==========================================================
// EXPORT
// ==========================================================

export {

    checkSinger,

    sendOTP,

    verifyOTP,

    registerSinger,

    loginWithPin,

    resetPin,

    updateSingerProfile,

    logout

};