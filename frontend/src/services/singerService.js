// ==========================================================
// BEATS INFINITY - SINGER API SERVICE
// ==========================================================

const API_BASE_URL =
    "http://localhost:5000/api/v1/singers";


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
// ==========================================================

const resetPin = async (

    mobile,

    date_of_birth,

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

                date_of_birth,

                new_pin

            })

        }

    );


    return handleResponse(response);

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

    updateSingerProfile

};